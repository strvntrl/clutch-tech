import "server-only";
import type { PoolClient } from "pg";
import pool from "@/lib/db";
import { getShiftWindow, normalizeShiftCode, type ShiftWindow } from "@/lib/shift";
import { fmtDateTime, isValidDateStr, nowWallEpoch } from "@/lib/time";
import type { PmcLevel } from "@/types/pmc";
import { HttpError, LEVEL_ROLE, computePermissions, type AuthUser } from "./common";
import { ROLE_LABEL } from "@/lib/roles";

/** Helper PMC yang dipakai bersama oleh form selain Drilling (Hotpress, dst.). */

export async function resolveWindow(date: string, shiftRaw: string): Promise<ShiftWindow> {
  if (!isValidDateStr(date)) throw new HttpError(400, "Tanggal tidak valid");
  const win = await getShiftWindow(date, normalizeShiftCode(shiftRaw));
  if (!win) throw new HttpError(400, `Shift tidak dikenali: ${shiftRaw}`);
  return win;
}

/** "SHIFT-1" -> "Shift-1" (format yang dipakai UI) */
export const shiftLabel = (code: string) => `Shift-${code.split("-")[1]}`;

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
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

export async function resolveOperatorId(client: PoolClient, name: string): Promise<number> {
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

export interface LockedEntry {
  entry_id: number;
  target_qty: number | null;
}

/** Buat header pmc_entry bila belum ada, lalu kunci barisnya (FOR UPDATE) selama transaksi. */
export async function ensureAndLockEntry(
  client: PoolClient,
  stageCode: string,
  date: string,
  shiftId: number
): Promise<LockedEntry> {
  await client.query(
    `INSERT INTO pmc_entry (entry_date, shift_id, stage_id)
     SELECT $1::date, $2::smallint, stage_id FROM process_stage WHERE stage_code = $3::text
     ON CONFLICT (entry_date, shift_id, stage_id) DO NOTHING`,
    [date, shiftId, stageCode]
  );
  const res = await client.query(
    `SELECT e.entry_id, e.target_qty
     FROM pmc_entry e
     JOIN process_stage s ON s.stage_id = e.stage_id AND s.stage_code = $3::text
     WHERE e.entry_date = $1::date AND e.shift_id = $2::smallint
     FOR UPDATE OF e`,
    [date, shiftId, stageCode]
  );
  return res.rows[0];
}

const APPROVE_COLUMN: Record<PmcLevel, string> = {
  foreman: "approve_foreman",
  supervisor: "approve_supervisor",
  ast_manager: "approve_manager",
};

/**
 * Approve / batalkan approval satu tingkat. Tiap tingkat hanya untuk role-nya
 * sendiri, bebas kapan saja setelah shift dimulai, dan laporan kosong ditolak.
 */
export async function setApprovalFor(
  stageCode: string,
  detailTable: "pmc_entry_detail" | "pmc_hotpress_detail",
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
    throw new HttpError(403, `Approval tingkat ini hanya untuk role ${ROLE_LABEL[LEVEL_ROLE[level]]}.`);
  }
  const now = nowWallEpoch();
  if (!computePermissions(user.role, win, now).canApprove[level]) {
    throw new HttpError(403, "Shift ini belum dimulai.");
  }

  const column = APPROVE_COLUMN[level]; // dari whitelist, bukan dari input pengguna
  const nowStr = fmtDateTime(now);

  return withTx(async (client) => {
    const entry = await ensureAndLockEntry(client, stageCode, date, win.shiftId);

    if (value) {
      // nama tabel dari whitelist literal di atas, bukan dari input pengguna
      const has = await client.query(`SELECT 1 FROM ${detailTable} WHERE entry_id = $1 LIMIT 1`, [entry.entry_id]);
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