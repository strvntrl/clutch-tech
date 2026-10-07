export type SideCode = "A" | "B";

export interface SideStat {
  target: number;
  actual: number;
  ach: number; // persen, sudah dibulatkan 1 desimal
}

export interface MachineStat {
  machine_id: number;
  mc: string; // machine_code, misal "PF-01"
  status: "RUNNING" | "OFF";
  A: SideStat;
  B: SideStat;
}

export interface PreformingKpi {
  plan: number;
  actual: number;
  gap: number;
  ach: number;
  waktu_mulai: string; // "HH:MM:SS"
  waktu_selesai: string;
}

export interface PreformingSuccessResponse {
  punya_data: boolean;
  kpi: PreformingKpi;
  status: { run: number; off: number };
  ticker_data: string[];
  machines: MachineStat[];
}

export interface PreformingErrorResponse {
  status: false;
  error: string;
}

export type PreformingApiResponse =
  | PreformingSuccessResponse
  | PreformingErrorResponse;

export function isPreformingError(
  res: PreformingApiResponse
): res is PreformingErrorResponse {
  return "error" in res;
}

export const SHIFT_OPTIONS = [
  { value: "Shift-1", label: "SHIFT 1 (07:30 - 15:30)" },
  { value: "Shift-2", label: "SHIFT 2 (15:30 - 23:30)" },
  { value: "Shift-3", label: "SHIFT 3 (23:30 - 07:30)" },
] as const;

/**
 * Tentukan tanggal & shift "saat ini" berdasarkan jam sekarang,
 * setara getSystemShiftState() di preforming.php (versi lama).
 *
 * Shift-1: 07:30 - 15:30
 * Shift-2: 15:30 - 23:30
 * Shift-3: 23:30 - 07:30 (overnight; sebelum jam 07:30 dianggap
 *          masih bagian shift-3 HARI SEBELUMNYA)
 */
export function getCurrentShiftState(): { date: string; shift: string } {
  const now = new Date();
  const hourFloat = now.getHours() + now.getMinutes() / 60;

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  if (hourFloat >= 0 && hourFloat < 7.5) {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    return { date: toDateStr(prev), shift: "Shift-3" };
  }

  if (hourFloat >= 7.5 && hourFloat < 15.5) {
    return { date: toDateStr(now), shift: "Shift-1" };
  }
  if (hourFloat >= 15.5 && hourFloat < 23.5) {
    return { date: toDateStr(now), shift: "Shift-2" };
  }
  return { date: toDateStr(now), shift: "Shift-3" };
}
