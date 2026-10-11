const JAKARTA_OFFSET_SEC = 7 * 3600; // WIB tetap UTC+7, tanpa DST

const pad = (n: number) => String(n).padStart(2, "0");

/** Epoch jam dinding Jakarta untuk "sekarang". */
export function nowWallEpoch(): number {
  return Math.floor(Date.now() / 1000) + JAKARTA_OFFSET_SEC;
}

export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** "YYYY-MM-DD" + "HH:MM:SS" -> epoch jam dinding. */
export function wallEpoch(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi, s] = timeStr.split(":").map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d, h, mi, s ?? 0) / 1000);
}

export function fmtHms(epoch: number): string {
  const d = new Date(epoch * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function fmtHm(epoch: number): string {
  const d = new Date(epoch * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function fmtDate(epoch: number): string {
  const d = new Date(epoch * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fmtDateTime(epoch: number): string {
  return `${fmtDate(epoch)} ${fmtHms(epoch)}`;
}

/** Tanggal "hari ini" menurut jam Jakarta, format YYYY-MM-DD. */
export function todayJakarta(): string {
  return fmtDate(nowWallEpoch());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}