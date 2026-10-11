export const SHIFTS = [
  { no: 1, value: "Shift-1", label: "SHIFT 1 (07:30 - 15:30)" },
  { no: 2, value: "Shift-2", label: "SHIFT 2 (15:30 - 23:30)" },
  { no: 3, value: "Shift-3", label: "SHIFT 3 (23:30 - 07:30)" },
] as const;

const JAKARTA_OFFSET_MS = 7 * 3600 * 1000;

function jakartaNow() {
  const d = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    hourFloat: d.getUTCHours() + d.getUTCMinutes() / 60,
    dayNum: d.getUTCDay() === 0 ? 7 : d.getUTCDay(), // Senin=1 ... Minggu=7
  };
}

function shiftNoByHour(hourFloat: number): 1 | 2 | 3 {
  if (hourFloat >= 7.5 && hourFloat < 15.5) return 1;
  if (hourFloat >= 15.5 && hourFloat < 23.5) return 2;
  return 3;
}

function prevDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Tanggal produksi + shift "sekarang".
 * Dini hari (00:00-07:30) masih shift-3 milik hari sebelumnya, kecuali
 * hari Minggu (libur) - sama seperti versi PHP.
 */
export function getSystemShiftState(): { date: string; shift: string } {
  const { date, hourFloat, dayNum } = jakartaNow();

  if (dayNum !== 7 && hourFloat >= 0 && hourFloat < 7.5) {
    return { date: prevDay(date), shift: "Shift-3" };
  }
  return { date, shift: `Shift-${shiftNoByHour(hourFloat)}` };
}

/** Nomor shift terbesar yang boleh dipilih pada tanggal tsb. */
export function maxSelectableShift(filterDate: string): 1 | 2 | 3 {
  const sys = getSystemShiftState();
  if (filterDate !== sys.date) return 3;
  return shiftNoByHour(jakartaNow().hourFloat);
}

/**
 * "Mode riwayat" = data sudah final, tidak perlu polling.
 * Tanggal lampau, atau hari ini tapi shift yang dipilih sudah lewat.
 */
export function isHistoryView(filterDate: string, shift: string): boolean {
  const sys = getSystemShiftState();
  if (filterDate < sys.date) return true;
  if (filterDate === sys.date) {
    const selected = parseInt(shift.replace("Shift-", ""), 10);
    return selected < maxSelectableShift(filterDate);
  }
  return false;
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** "ACHIEVEMENT DETAIL SHIFT 1 ON SATURDAY, 10-10-2026" */
export function achievementTitle(filterDate: string, shift: string): string {
  const [y, m, d] = filterDate.split("-").map(Number);
  const dayName = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `ACHIEVEMENT DETAIL ${shift.replace("-", " ").toUpperCase()} ON ${dayName}, ${filterDate
    .split("-")
    .reverse()
    .join("-")}`;
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} H`);
  if (m > 0) parts.push(`${m} M`);
  if (s > 0) parts.push(`${s} S`);
  return parts.join(" ");
}