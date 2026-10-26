import "server-only";
import type { PoolClient } from "pg";
import pool, { dbSelect } from "@/lib/db";
import { getShiftWindow, normalizeShiftCode, type ShiftWindow } from "@/lib/shift";
import { fmtDateTime, fmtHms, isValidDateStr, nowWallEpoch } from "@/lib/time";
import {
  KETERANGAN_OPTIONS,
  type PartSuggestion,
  type PmcFormResponse,
  type PmcLevel,
  type PmcRow,
  type PmcSaveRow,
  type PmcStation,
} from "@/types/pmc";
import { HttpError, LEVEL_ROLE, computePermissions, type AuthUser } from "./common";

const SLOTS = 4; // baris input per stasiun
const MAX_FIXED_MACHINES = 5; // posisi baris DR01..DR05 sama dengan versi PHP: 0..19
const BOR_ULANG_ROW_BASE = 20; // "BOR ULANG" tetap di baris 20..23 (sama dengan PHP)
const EXTRA_ROW_BASE = 24; // mesin ke-6 dan seterusnya (kalau suatu hari ada)
const MAX_NUMBER = 1_000_000;

interface ServerStation extends PmcStation {
  machineId: number | null;
}

// ----------------------------------------------------------------------
// Helper umum
// ----------------------------------------------------------------------

export async function getStations(): Promise<ServerStation[]> {
  const rows = await dbSelect<{ machine_id: number; machine_code: string }>(
    `SELECT m.machine_id, m.machine_code
     FROM machine m
     JOIN process_stage s ON s.stage_id = m.stage_id
     WHERE s.stage_code = 'DRILLING'
     ORDER BY m.machine_code`
  );
  const stations: ServerStation[] = rows.map((r, i) => ({
    code: r.machine_code,
    machineId: r.machine_id,
    hasIot: true,
    rowBase: i < MAX_FIXED_MACHINES ? i * SLOTS : EXTRA_ROW_BASE + (i - MAX_FIXED_MACHINES) * SLOTS,
  }));
  stations.push({ code: "BOR ULANG", machineId: null, hasIot: false, rowBase: BOR_ULANG_ROW_BASE });
  return stations;
}

function stationOfRow(stations: ServerStation[], rowNo: number): ServerStation | undefined {
  return stations.find((s) => rowNo >= s.rowBase && rowNo < s.rowBase + SLOTS);
}

async function resolveWindow(date: string, shiftRaw: string): Promise<ShiftWindow> {
  if (!isValidDateStr(date)) throw new HttpError(400, "Tanggal tidak valid");
  const win = await getShiftWindow(date, normalizeShiftCode(shiftRaw));
  if (!win) throw new HttpError(400, `Shift tidak dikenali: ${shiftRaw}`);
  return win;
}

/** "SHIFT-1" -> "Shift-1" (format yang dipakai UI) */
const shiftLabel = (code: string) => `Shift-${code.split("-")[1]}`;

async function iotCounts(win: ShiftWindow, stations: ServerStation[], client?: PoolClient) {
  const sql = `SELECT m.machine_code, COUNT(*)::int AS cnt
               FROM machine_process_log l
               JOIN machine m ON m.machine_id = l.machine_id
               JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'DRILLING'
               WHERE l.event_time >= $1::timestamp AND l.event_time < $2::timestamp
               GROUP BY m.machine_code`;
  const params = [win.startStr, win.endStr];
  const rows: { machine_code: string; cnt: number }[] = client
    ? (await client.query(sql, params)).rows
    : await dbSelect(sql, params);

  const out: Record<string, number> = {};
  for (const s of stations) if (s.hasIot) out[s.code] = 0;
  for (const r of rows) out[r.machine_code] = r.cnt;
  return out;
}

async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

const ENTRY_UPSERT = `
  INSERT INTO pmc_entry (entry_date, shift_id, stage_id)
  SELECT $1::date, $2::smallint, stage_id FROM process_stage WHERE stage_code = 'DRILLING'
  ON CONFLICT (entry_date, shift_id, stage_id) DO NOTHING`;

const ENTRY_LOCK = `
  SELECT e.entry_id, e.approve_foreman, e.approve_supervisor, e.approve_manager
  FROM pmc_entry e
  JOIN process_stage s ON s.stage_id = e.stage_id AND s.stage_code = 'DRILLING'
  WHERE e.entry_date = $1::date AND e.shift_id = $2::smallint
  FOR UPDATE OF e`;

// ----------------------------------------------------------------------
// LOAD
// ----------------------------------------------------------------------

export async function loadForm(user: AuthUser, date: string, shiftRaw: string): Promise<PmcFormResponse> {
  const win = await resolveWindow(date, shiftRaw);
  const stations = await getStations();
  const now = nowWallEpoch();

  const entries = await dbSelect<{
    entry_id: number;
    approve_foreman: boolean | null;
    approve_supervisor: boolean | null;
    approve_manager: boolean | null;
  }>(
    `SELECT e.entry_id, e.approve_foreman, e.approve_supervisor, e.approve_manager
     FROM pmc_entry e
     JOIN process_stage s ON s.stage_id = e.stage_id AND s.stage_code = 'DRILLING'
     WHERE e.entry_date = $1::date AND e.shift_id = $2::smallint`,
    [date, win.shiftId]
  );
  const entry = entries[0];

  let rows: PmcRow[] = [];
  if (entry) {
    const raw = await dbSelect<{
      row_no: number;
      part_number: string | null;
      customer_name: string | null;
      product_type: string | null;
      jumlah_mata_bor: string | null;
      ukuran_bor: string | null;
      jam_operasional: string | null;
      target_qty: number;
      actual_qty: number;
      reject_qty: number;
      operator_name: string | null;
      keterangan: string | null;
      is_checked: boolean;
    }>(
      `SELECT d.row_no, p.part_number, c.customer_name, p.product_type,
              d.jumlah_mata_bor, d.ukuran_bor, d.jam_operasional,
              d.target_qty, d.actual_qty, d.reject_qty,
              o.operator_name, d.keterangan, d.is_checked
       FROM pmc_entry_detail d
       LEFT JOIN part p ON p.part_id = d.part_id
       LEFT JOIN customer c ON c.customer_id = p.customer_id
       LEFT JOIN operator o ON o.operator_id = d.operator_id
       WHERE d.entry_id = $1
       ORDER BY d.row_no`,
      [entry.entry_id]
    );
    rows = raw
      .filter((r) => stationOfRow(stations, r.row_no))
      .map((r) => ({
        row_no: r.row_no,
        part_number: r.part_number ?? "",
        customer: r.customer_name ?? "",
        product_type: r.product_type ?? "",
        jumlah_mata_bor: r.jumlah_mata_bor ?? "",
        ukuran_bor: r.ukuran_bor ?? "",
        jam_operasional: r.jam_operasional ?? "",
        target: r.target_qty,
        actual: r.actual_qty,
        ng: r.reject_qty,
        operator: r.operator_name ?? "",
        keterangan: r.keterangan ?? "",
        validated: r.is_checked,
      }));
  }

  const operators = (
    await dbSelect<{ operator_name: string }>(
      `SELECT operator_name FROM operator WHERE is_active ORDER BY operator_name`
    )
  ).map((o) => o.operator_name);

  return {
    date,
    shift: shiftLabel(win.shiftCode),
    shiftStart: win.startStr,
    shiftEnd: win.endStr,
    stations: stations.map(({ code, rowBase, hasIot }) => ({ code, rowBase, hasIot })),
    rows,
    approve: {
      foreman: !!entry?.approve_foreman,
      supervisor: !!entry?.approve_supervisor,
      ast_manager: !!entry?.approve_manager,
    },
    iot: await iotCounts(win, stations),
    operators,
    perms: computePermissions(user.role, win, now),
  };
}

export async function loadIot(date: string, shiftRaw: string): Promise<Record<string, number>> {
  const win = await resolveWindow(date, shiftRaw);
  return iotCounts(win, await getStations());
}

// ----------------------------------------------------------------------
// SIMPAN BARIS
// ----------------------------------------------------------------------

function parseText(v: unknown, max: number, label: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new HttpError(400, `Format ${label} tidak valid`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(400, `${label} terlalu panjang (maks ${max} karakter)`);
  return t;
}

function parseCount(v: unknown, label: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) {
    throw new HttpError(400, `${label} harus bilangan bulat 0 - ${MAX_NUMBER}`);
  }
  return n;
}

function parseRows(raw: unknown, stations: ServerStation[]): PmcSaveRow[] {
  if (!Array.isArray(raw)) throw new HttpError(400, "Format data tidak valid");
  if (raw.length === 0) throw new HttpError(400, "Tidak ada baris untuk disimpan");
  if (raw.length > 64) throw new HttpError(400, "Terlalu banyak baris");

  const seen = new Set<number>();
  return raw.map((item) => {
    if (typeof item !== "object" || item === null) throw new HttpError(400, "Format baris tidak valid");
    const r = item as Record<string, unknown>;

    const rowNo = Number(r.row_no);
    if (!Number.isInteger(rowNo) || !stationOfRow(stations, rowNo)) {
      throw new HttpError(400, `Nomor baris tidak valid: ${String(r.row_no)}`);
    }
    if (seen.has(rowNo)) throw new HttpError(400, `Baris ganda: ${rowNo}`);
    seen.add(rowNo);

    const keterangan = parseText(r.keterangan, 100, "Keterangan");
    if (keterangan !== "" && !(KETERANGAN_OPTIONS as readonly string[]).includes(keterangan)) {
      throw new HttpError(400, "Keterangan tidak dikenal");
    }
    if (typeof r.validated !== "boolean") throw new HttpError(400, "Format validasi tidak valid");

    return {
      row_no: rowNo,
      part_number: parseText(r.part_number, 50, "Part No."),
      jumlah_mata_bor: parseText(r.jumlah_mata_bor, 50, "Jumlah mata bor"),
      ukuran_bor: parseText(r.ukuran_bor, 150, "Ukuran mata bor"),
      target: parseCount(r.target, "Target"),
      actual: parseCount(r.actual, "Actual"),
      ng: parseCount(r.ng, "NG"),
      operator: parseText(r.operator, 100, "Operator"),
      keterangan,
      validated: r.validated,
    };
  });
}

interface ExistingRow {
  row_no: number;
  is_checked: boolean;
  jam_operasional: string | null;
  checked_by: number | null;
  actual_qty: number;
  reject_qty: number;
}

async function resolveOperatorId(client: PoolClient, name: string): Promise<number> {
  const found = await client.query(
    `SELECT operator_id FROM operator
     WHERE LOWER(operator_name) = LOWER($1::text)
     ORDER BY is_active DESC, operator_id LIMIT 1`,
    [name]
  );
  if (found.rowCount) return found.rows[0].operator_id;

  const ins = await client.query(
    `INSERT INTO operator (operator_code, operator_name)
     VALUES ('OP-' || UPPER(SUBSTR(MD5(clock_timestamp()::text || $1::text), 1, 8)), $1::text)
     RETURNING operator_id`,
    [name]
  );
  return ins.rows[0].operator_id;
}

const DETAIL_UPSERT = `
  INSERT INTO pmc_entry_detail
    (entry_id, row_no, machine_id, part_id, operator_id, target_qty, actual_qty, reject_qty,
     jumlah_mata_bor, ukuran_bor, keterangan, jam_operasional,
     is_checked, checked_by, checked_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::timestamp, $16::timestamp)
  ON CONFLICT (entry_id, row_no) DO UPDATE SET
    machine_id      = EXCLUDED.machine_id,
    part_id         = EXCLUDED.part_id,
    operator_id     = EXCLUDED.operator_id,
    target_qty      = EXCLUDED.target_qty,
    actual_qty      = EXCLUDED.actual_qty,
    reject_qty      = EXCLUDED.reject_qty,
    jumlah_mata_bor = EXCLUDED.jumlah_mata_bor,
    ukuran_bor      = EXCLUDED.ukuran_bor,
    keterangan      = EXCLUDED.keterangan,
    jam_operasional = CASE WHEN $17::boolean THEN pmc_entry_detail.jam_operasional ELSE EXCLUDED.jam_operasional END,
    is_checked      = CASE WHEN $17::boolean THEN pmc_entry_detail.is_checked      ELSE EXCLUDED.is_checked      END,
    checked_by      = CASE WHEN $17::boolean THEN pmc_entry_detail.checked_by      ELSE EXCLUDED.checked_by      END,
    checked_at      = CASE WHEN $17::boolean THEN pmc_entry_detail.checked_at      ELSE EXCLUDED.checked_at      END,
    updated_at      = EXCLUDED.updated_at`;

export async function saveRows(user: AuthUser, date: string, shiftRaw: string, rawRows: unknown): Promise<void> {
  const win = await resolveWindow(date, shiftRaw);
  const stations = await getStations();
  const rows = parseRows(rawRows, stations);

  const now = nowWallEpoch();
  const perms = computePermissions(user.role, win, now);
  if (!perms.canEdit) throw new HttpError(403, perms.reason ?? "Anda tidak boleh mengubah data ini");

  const nowStr = fmtDateTime(now);

  await withTx(async (client) => {
    await client.query(ENTRY_UPSERT, [date, win.shiftId]);
    const entry = (await client.query(ENTRY_LOCK, [date, win.shiftId])).rows[0];
    const entryId: number = entry.entry_id;

    const existingRows: ExistingRow[] = (
      await client.query(
        `SELECT row_no, is_checked, jam_operasional, checked_by, actual_qty, reject_qty
         FROM pmc_entry_detail WHERE entry_id = $1`,
        [entryId]
      )
    ).rows;
    const existing = new Map(existingRows.map((r) => [r.row_no, r]));

    // ---- Tahap 1: validasi semua baris (belum menulis apa pun) ----
    const rowErrors: Record<number, string> = {};
    const partIds = new Map<number, number | null>();

    for (const r of rows) {
      const ex = existing.get(r.row_no);

      if (ex?.is_checked && !perms.canEditLocked) {
        rowErrors[r.row_no] = "Baris sudah divalidasi dan terkunci. Hanya Supervisor / Ast. Manager yang dapat mengubahnya.";
        continue;
      }
      if (r.validated && (!r.part_number || !r.operator || r.actual <= 0)) {
        rowErrors[r.row_no] = "Validasi memerlukan Part No., Operator, dan Actual lebih dari 0.";
        continue;
      }
      if (r.part_number) {
        const p = await client.query(
          `SELECT part_id FROM part WHERE UPPER(part_number) = UPPER($1::text) AND is_active LIMIT 1`,
          [r.part_number]
        );
        if (!p.rowCount) {
          rowErrors[r.row_no] = `Part No. "${r.part_number}" tidak ditemukan di master part.`;
          continue;
        }
        partIds.set(r.row_no, p.rows[0].part_id);
      } else {
        partIds.set(r.row_no, null);
      }
    }
    if (Object.keys(rowErrors).length > 0) {
      throw new HttpError(400, "Ada baris yang tidak dapat disimpan.", { rowErrors });
    }

    // ---- Tahap 2: tulis ----
    const merged = new Map<number, { actual: number; ng: number }>(
      existingRows.map((r) => [r.row_no, { actual: r.actual_qty, ng: r.reject_qty }])
    );
    const touchedStations = new Set<ServerStation>();

    for (const r of rows) {
      const station = stationOfRow(stations, r.row_no)!;
      touchedStations.add(station);
      const ex = existing.get(r.row_no);

      const isEmpty =
        !r.part_number && !r.operator && !r.jumlah_mata_bor && !r.ukuran_bor && !r.keterangan &&
        r.target === 0 && r.actual === 0 && r.ng === 0 && !r.validated;

      if (isEmpty) {
        if (ex) {
          await client.query(`DELETE FROM pmc_entry_detail WHERE entry_id = $1 AND row_no = $2`, [entryId, r.row_no]);
          merged.delete(r.row_no);
        }
        continue;
      }

      const operatorId = r.operator ? await resolveOperatorId(client, r.operator) : null;

      const becomesValidated = r.validated && !ex?.is_checked;
      const keepCheck = r.validated && !!ex?.is_checked; // sudah tervalidasi sebelumnya: jangan ubah jam/pengecek
      const jam = r.validated ? (becomesValidated ? fmtHms(now) : ex?.jam_operasional ?? null) : null;

      await client.query(DETAIL_UPSERT, [
        entryId,
        r.row_no,
        station.machineId,
        partIds.get(r.row_no) ?? null,
        operatorId,
        r.target,
        r.actual,
        r.ng,
        r.jumlah_mata_bor || null,
        r.ukuran_bor || null,
        r.keterangan || null,
        jam,
        r.validated,
        becomesValidated ? user.userId : null,
        becomesValidated ? nowStr : null,
        nowStr,
        keepCheck,
      ]);
      merged.set(r.row_no, { actual: r.actual, ng: r.ng });
    }

    // ---- Tahap 3: batas IOT per mesin (hanya mesin yang baru disentuh) ----
    const iot = await iotCounts(win, stations, client);
    for (const s of touchedStations) {
      if (!s.hasIot) continue;
      let sum = 0;
      for (let i = 0; i < SLOTS; i++) {
        const m = merged.get(s.rowBase + i);
        if (m) sum += m.actual + m.ng;
      }
      if (sum > (iot[s.code] ?? 0)) {
        throw new HttpError(
          400,
          `Total Actual + NG ${s.code} (${sum}) melebihi jumlah IOT (${iot[s.code] ?? 0}).`
        );
      }
    }

    await client.query(`UPDATE pmc_entry SET updated_at = $2::timestamp WHERE entry_id = $1`, [entryId, nowStr]);
  });
}

// ----------------------------------------------------------------------
// APPROVE
// ----------------------------------------------------------------------

const APPROVE_COLUMN: Record<PmcLevel, string> = {
  foreman: "approve_foreman",
  supervisor: "approve_supervisor",
  ast_manager: "approve_manager",
};

export async function setApproval(
  user: AuthUser,
  date: string,
  shiftRaw: string,
  level: unknown,
  value: unknown
): Promise<Record<PmcLevel, boolean>> {
  if (level !== "foreman" && level !== "supervisor" && level !== "ast_manager") {
    throw new HttpError(400, "Tingkat approval tidak valid");
  }
  if (typeof value !== "boolean") throw new HttpError(400, "Nilai approval tidak valid");

  const win = await resolveWindow(date, shiftRaw);
  if (user.role !== LEVEL_ROLE[level]) {
    throw new HttpError(403, `Approval tingkat ini hanya untuk role ${LEVEL_ROLE[level]}.`);
  }
  const now = nowWallEpoch();
  if (!computePermissions(user.role, win, now).canApprove[level]) {
    throw new HttpError(403, "Shift ini belum dimulai.");
  }

  const column = APPROVE_COLUMN[level]; // dari whitelist, bukan dari input pengguna
  const nowStr = fmtDateTime(now);

  return withTx(async (client) => {
    await client.query(ENTRY_UPSERT, [date, win.shiftId]);
    const entry = (await client.query(ENTRY_LOCK, [date, win.shiftId])).rows[0];

    if (value) {
      const has = await client.query(`SELECT 1 FROM pmc_entry_detail WHERE entry_id = $1 LIMIT 1`, [entry.entry_id]);
      if (!has.rowCount) throw new HttpError(400, "Belum ada data yang dapat di-approve pada shift ini.");
    }

    const res = await client.query(
      `UPDATE pmc_entry SET ${column} = $2::boolean, updated_at = $3::timestamp
       WHERE entry_id = $1
       RETURNING approve_foreman, approve_supervisor, approve_manager`,
      [entry.entry_id, value, nowStr]
    );
    const row = res.rows[0];
    return {
      foreman: !!row.approve_foreman,
      supervisor: !!row.approve_supervisor,
      ast_manager: !!row.approve_manager,
    };
  });
}

// ----------------------------------------------------------------------
// AUTOCOMPLETE PART
// ----------------------------------------------------------------------

export async function searchParts(q: string): Promise<PartSuggestion[]> {
  const term = q.trim().slice(0, 50);
  const esc = term.replace(/[\\%_]/g, (c) => `\\${c}`);

  return dbSelect<PartSuggestion>(
    `SELECT p.part_number,
            COALESCE(c.customer_name, '') AS customer,
            COALESCE(p.product_type, '') AS product_type
     FROM part p
     LEFT JOIN customer c ON c.customer_id = p.customer_id
     WHERE p.is_active AND p.part_number ILIKE $1 ESCAPE '\\'
     ORDER BY (p.part_number ILIKE $2 ESCAPE '\\') DESC, p.part_number
     LIMIT 20`,
    [`%${esc}%`, `${esc}%`]
  );
}