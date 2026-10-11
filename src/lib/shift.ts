import "server-only";
import { dbSelect } from "@/lib/db";
import { addDays, fmtDateTime, isValidDateStr, todayJakarta, wallEpoch } from "@/lib/time";

export interface ShiftWindow {
  shiftId: number;
  shiftCode: string; // "SHIFT-1"
  date: string; // YYYY-MM-DD (tanggal mulai shift)
  startEpoch: number;
  endEpoch: number;
  startStr: string; // "YYYY-MM-DD HH:MM:SS"
  endStr: string;
}

interface ShiftRow {
  shift_id: number;
  shift_code: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
}

/** Normalisasi query param: tanggal tidak valid -> hari ini (Jakarta). */
export function normalizeDate(raw: string | null): string {
  return raw && isValidDateStr(raw) ? raw : todayJakarta();
}

/** "Shift-1" / "shift-1" -> "SHIFT-1", karakter aneh dibuang. */
export function normalizeShiftCode(raw: string | null): string {
  return (raw ?? "Shift-1").replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
}

/** Null kalau kode shift tidak dikenal. */
export async function getShiftWindow(
  date: string,
  shiftCode: string
): Promise<ShiftWindow | null> {
  const rows = await dbSelect<ShiftRow>(
    `SELECT shift_id, shift_code, start_time, end_time, is_overnight
     FROM shift WHERE shift_code = $1 LIMIT 1`,
    [shiftCode]
  );
  if (rows.length === 0) return null;

  const s = rows[0];
  const startEpoch = wallEpoch(date, s.start_time);
  const endDate = s.is_overnight ? addDays(date, 1) : date;
  const endEpoch = wallEpoch(endDate, s.end_time);

  return {
    shiftId: s.shift_id,
    shiftCode: s.shift_code,
    date,
    startEpoch,
    endEpoch,
    startStr: fmtDateTime(startEpoch),
    endStr: fmtDateTime(endEpoch),
  };
}