import "server-only";
import { dbSelect } from "@/lib/db";
import { fmtDateTime, fmtHm, nowWallEpoch } from "@/lib/time";
import type { PmcLevel } from "@/types/pmc";
import { HOTPRESS_ROWS, type HpFormResponse, type HpRow } from "@/types/pmc-hotpress";
import { HttpError, computePermissions, type AuthUser } from "./common";
import {
  ensureAndLockEntry,
  resolveOperatorId,
  resolveWindow,
  setApprovalFor,
  shiftLabel,
  withTx,
} from "./shared";

const MAX_COUNT = 1_000_000;
const MAX_TARGET = 10_000_000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ----------------------------------------------------------------------
// LOAD
// ----------------------------------------------------------------------

/** "12.500" (NUMERIC dari pg) -> "12.5"; null -> "" */
const numText = (v: string | null): string => (v === null || v === "" ? "" : String(Number(v)));

export async function loadForm(user: AuthUser, date: string, shiftRaw: string): Promise<HpFormResponse> {
  const win = await resolveWindow(date, shiftRaw);
  const now = nowWallEpoch();

  const entries = await dbSelect<{
    entry_id: number;
    target_qty: number | null;
    approve_foreman: boolean | null;
    approve_supervisor: boolean | null;
    approve_manager: boolean | null;
  }>(
    `SELECT e.entry_id, e.target_qty, e.approve_foreman, e.approve_supervisor, e.approve_manager
     FROM pmc_entry e
     JOIN process_stage s ON s.stage_id = e.stage_id AND s.stage_code = 'HOTPRESS'
     WHERE e.entry_date = $1::date AND e.shift_id = $2::smallint`,
    [date, win.shiftId]
  );
  const entry = entries[0];

  let rows: HpRow[] = [];
  if (entry) {
    const raw = await dbSelect<{
      row_no: number;
      no_wos: string | null;
      mc_no: string | null;
      part_number: string | null;
      product_type: string | null;
      customer_name: string | null;
      berat_pcs: string | null;
      hasil_kg: string | null;
      baik: number;
      rusak: number;
      total_hasil: number;
      reff_no: string | null;
      start_proses: string | null;
      finish_proses: string | null;
      operator_name: string | null;
      keterangan: string | null;
      is_checked: boolean;
    }>(
      `SELECT d.row_no, d.no_wos, d.mc_no, p.part_number, p.product_type, c.customer_name,
              d.berat_pcs::text AS berat_pcs, d.hasil_kg::text AS hasil_kg,
              d.baik, d.rusak, d.total_hasil, d.reff_no, d.start_proses, d.finish_proses,
              o.operator_name, d.keterangan, d.is_checked
       FROM pmc_hotpress_detail d
       LEFT JOIN part p ON p.part_id = d.part_id
       LEFT JOIN customer c ON c.customer_id = p.customer_id
       LEFT JOIN operator o ON o.operator_id = d.operator_id
       WHERE d.entry_id = $1 AND d.row_no < $2
       ORDER BY d.row_no`,
      [entry.entry_id, HOTPRESS_ROWS]
    );
    rows = raw.map((r) => ({
      row_no: r.row_no,
      no_wos: r.no_wos ?? "",
      mc_no: r.mc_no ?? "",
      cf_no: r.part_number ?? "",
      type: r.product_type ?? "",
      customer: r.customer_name ?? "",
      berat_pcs: numText(r.berat_pcs),
      hasil_kg: numText(r.hasil_kg),
      baik: r.baik,
      rusak: r.rusak,
      total_hasil: r.total_hasil,
      reff_no: r.reff_no ?? "",
      start: r.start_proses ?? "",
      finish: r.finish_proses ?? "",
      operator: r.operator_name ?? "",
      keterangan: r.keterangan ?? "",
      validated: r.is_checked,
    }));
  }

  const operators = (
    await dbSelect<{ operator_name: string }>(`SELECT operator_name FROM operator WHERE is_active ORDER BY operator_name`)
  ).map((o) => o.operator_name);

  const machines = (
    await dbSelect<{ machine_code: string }>(
      `SELECT m.machine_code FROM machine m
       JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'HOTPRESS'
       ORDER BY m.machine_code`
    )
  ).map((m) => m.machine_code);

  return {
    date,
    shift: shiftLabel(win.shiftCode),
    shiftStart: win.startStr,
    shiftEnd: win.endStr,
    rowCount: HOTPRESS_ROWS,
    rows,
    target: entry?.target_qty ?? 0,
    approve: {
      foreman: !!entry?.approve_foreman,
      supervisor: !!entry?.approve_supervisor,
      ast_manager: !!entry?.approve_manager,
    },
    operators,
    machines,
    perms: computePermissions(user.role, win, now),
  };
}

// ----------------------------------------------------------------------
// PARSING INPUT
// ----------------------------------------------------------------------

function parseText(v: unknown, max: number, label: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new HttpError(400, `Format ${label} tidak valid`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(400, `${label} terlalu panjang (maks ${max} karakter)`);
  return t;
}

function parseCount(v: unknown, label: string, max = MAX_COUNT): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new HttpError(400, `${label} harus bilangan bulat 0 - ${max}`);
  }
  return n;
}

/** "" / 0 -> null (sama seperti PHP: NULL kalau tidak > 0); selain itu desimal 3 digit. */
function parseDecimal(v: unknown, label: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > MAX_COUNT) {
    throw new HttpError(400, `${label} harus angka 0 - ${MAX_COUNT}`);
  }
  const r = Math.round(n * 1000) / 1000;
  return r > 0 ? r : null;
}

function parseTime(v: unknown, label: string): string {
  const t = parseText(v, 5, label);
  if (t !== "" && !TIME_RE.test(t)) throw new HttpError(400, `${label} harus berformat JJ:MM (contoh 07:45)`);
  return t;
}

interface ParsedRow {
  row_no: number;
  no_wos: string;
  mc_no: string;
  cf_no: string;
  berat_pcs: number | null;
  hasil_kg: number | null;
  baik: number;
  rusak: number;
  total_hasil: number;
  reff_no: string;
  start: string;
  finish: string;
  operator: string;
  keterangan: string;
  validated: boolean;
}

function parseRows(raw: unknown): ParsedRow[] {
  if (!Array.isArray(raw)) throw new HttpError(400, "Format data tidak valid");
  if (raw.length > HOTPRESS_ROWS) throw new HttpError(400, "Terlalu banyak baris");

  const seen = new Set<number>();
  return raw.map((item) => {
    if (typeof item !== "object" || item === null) throw new HttpError(400, "Format baris tidak valid");
    const r = item as Record<string, unknown>;

    const rowNo = Number(r.row_no);
    if (!Number.isInteger(rowNo) || rowNo < 0 || rowNo >= HOTPRESS_ROWS) {
      throw new HttpError(400, `Nomor baris tidak valid: ${String(r.row_no)}`);
    }
    if (seen.has(rowNo)) throw new HttpError(400, `Baris ganda: ${rowNo}`);
    seen.add(rowNo);
    if (typeof r.validated !== "boolean") throw new HttpError(400, "Format validasi tidak valid");

    return {
      row_no: rowNo,
      no_wos: parseText(r.no_wos, 100, "No. WOS"),
      mc_no: parseText(r.mc_no, 30, "MC No."),
      cf_no: parseText(r.cf_no, 50, "C/F No."),
      berat_pcs: parseDecimal(r.berat_pcs, "Berat"),
      hasil_kg: parseDecimal(r.hasil_kg, "Hasil (kg)"),
      baik: parseCount(r.baik, "Baik"),
      rusak: parseCount(r.rusak, "Rusak"),
      total_hasil: parseCount(r.total_hasil, "Total hasil"),
      reff_no: parseText(r.reff_no, 100, "Reff No."),
      start: parseTime(r.start, "Start"),
      finish: parseTime(r.finish, "Finish"),
      operator: parseText(r.operator, 100, "Operator"),
      keterangan: parseText(r.keterangan, 500, "Keterangan"),
      validated: r.validated,
    };
  });
}

// ----------------------------------------------------------------------
// SIMPAN
// ----------------------------------------------------------------------

interface ExistingRow {
  row_no: number;
  is_checked: boolean;
}

const DETAIL_UPSERT = `
  INSERT INTO pmc_hotpress_detail
    (entry_id, row_no, no_wos, mc_no, part_id, berat_pcs, hasil_kg, baik, rusak, total_hasil,
     reff_no, start_proses, finish_proses, operator_id, keterangan,
     is_checked, checked_by, checked_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18::timestamp, $19::timestamp)
  ON CONFLICT (entry_id, row_no) DO UPDATE SET
    no_wos        = EXCLUDED.no_wos,
    mc_no         = EXCLUDED.mc_no,
    part_id       = EXCLUDED.part_id,
    berat_pcs     = EXCLUDED.berat_pcs,
    hasil_kg      = EXCLUDED.hasil_kg,
    baik          = EXCLUDED.baik,
    rusak         = EXCLUDED.rusak,
    total_hasil   = EXCLUDED.total_hasil,
    reff_no       = EXCLUDED.reff_no,
    start_proses  = EXCLUDED.start_proses,
    finish_proses = EXCLUDED.finish_proses,
    operator_id   = EXCLUDED.operator_id,
    keterangan    = EXCLUDED.keterangan,
    is_checked    = CASE WHEN $20::boolean THEN pmc_hotpress_detail.is_checked ELSE EXCLUDED.is_checked END,
    checked_by    = CASE WHEN $20::boolean THEN pmc_hotpress_detail.checked_by ELSE EXCLUDED.checked_by END,
    checked_at    = CASE WHEN $20::boolean THEN pmc_hotpress_detail.checked_at ELSE EXCLUDED.checked_at END,
    updated_at    = EXCLUDED.updated_at`;

export async function saveRows(
  user: AuthUser,
  date: string,
  shiftRaw: string,
  rawRows: unknown,
  rawTarget: unknown
): Promise<void> {
  const win = await resolveWindow(date, shiftRaw);
  const rows = parseRows(rawRows ?? []);
  const target = rawTarget === undefined ? undefined : parseCount(rawTarget, "Target", MAX_TARGET);
  if (rows.length === 0 && target === undefined) throw new HttpError(400, "Tidak ada perubahan untuk disimpan");

  const now = nowWallEpoch();
  const perms = computePermissions(user.role, win, now);
  if (!perms.canEdit) throw new HttpError(403, perms.reason ?? "Anda tidak boleh mengubah data ini");
  if (target !== undefined && !perms.canEditLocked) {
    throw new HttpError(403, "Target per shift hanya dapat diubah oleh Supervisor / Ast. Manager.");
  }

  const nowStr = fmtDateTime(now);

  await withTx(async (client) => {
    const entry = await ensureAndLockEntry(client, "HOTPRESS", date, win.shiftId);
    const entryId = entry.entry_id;

    const existing = new Map<number, ExistingRow>(
      (
        await client.query(`SELECT row_no, is_checked FROM pmc_hotpress_detail WHERE entry_id = $1`, [entryId])
      ).rows.map((r: ExistingRow) => [r.row_no, r])
    );

    // ---- Tahap 1: validasi semua baris (belum menulis apa pun) ----
    const rowErrors: Record<number, string> = {};
    const partIds = new Map<number, number | null>();

    for (const r of rows) {
      const ex = existing.get(r.row_no);

      if (ex?.is_checked && !perms.canEditLocked) {
        rowErrors[r.row_no] = "Baris sudah divalidasi dan terkunci. Hanya Supervisor / Ast. Manager yang dapat mengubahnya.";
        continue;
      }
      if (r.validated && (!r.cf_no || !r.operator || r.baik <= 0)) {
        rowErrors[r.row_no] = "Validasi memerlukan C/F No., Operator, dan Baik lebih dari 0.";
        continue;
      }
      if (r.cf_no) {
        const p = await client.query(
          `SELECT part_id FROM part WHERE UPPER(part_number) = UPPER($1::text) AND is_active LIMIT 1`,
          [r.cf_no]
        );
        if (!p.rowCount) {
          rowErrors[r.row_no] = `C/F No. "${r.cf_no}" tidak ditemukan di master part.`;
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
    for (const r of rows) {
      const ex = existing.get(r.row_no);

      const isEmpty =
        !r.no_wos && !r.mc_no && !r.cf_no && r.berat_pcs === null && r.hasil_kg === null &&
        r.baik === 0 && r.rusak === 0 && r.total_hasil === 0 && !r.reff_no && !r.start && !r.finish &&
        !r.operator && !r.keterangan && !r.validated;

      if (isEmpty) {
        if (ex) await client.query(`DELETE FROM pmc_hotpress_detail WHERE entry_id = $1 AND row_no = $2`, [entryId, r.row_no]);
        continue;
      }

      const becomesValidated = r.validated && !ex?.is_checked;
      const keepCheck = r.validated && !!ex?.is_checked; // sudah tervalidasi sebelumnya: pengecek & waktu tetap
      const operatorId = r.operator ? await resolveOperatorId(client, r.operator) : null;
      // seperti PHP: saat divalidasi, jam finish yang kosong diisi jam sekarang
      const finish = r.finish || (becomesValidated ? fmtHm(now) : "");

      await client.query(DETAIL_UPSERT, [
        entryId,
        r.row_no,
        r.no_wos || null,
        r.mc_no || null,
        partIds.get(r.row_no) ?? null,
        r.berat_pcs,
        r.hasil_kg,
        r.baik,
        r.rusak,
        r.total_hasil,
        r.reff_no || null,
        r.start || null,
        finish || null,
        operatorId,
        r.keterangan || null,
        r.validated,
        becomesValidated ? user.userId : null,
        becomesValidated ? nowStr : null,
        nowStr,
        keepCheck,
      ]);
    }

    if (target !== undefined) {
      await client.query(`UPDATE pmc_entry SET target_qty = $2::int WHERE entry_id = $1`, [entryId, target]);
    }
    await client.query(`UPDATE pmc_entry SET updated_at = $2::timestamp WHERE entry_id = $1`, [entryId, nowStr]);
  });
}

// ----------------------------------------------------------------------
// APPROVE
// ----------------------------------------------------------------------

export function setApproval(
  user: AuthUser,
  date: string,
  shiftRaw: string,
  level: unknown,
  value: unknown
): Promise<Record<PmcLevel, boolean>> {
  return setApprovalFor("HOTPRESS", "pmc_hotpress_detail", user, date, shiftRaw, level, value);
}