export type Granularity = "harian" | "bulanan" | "tahunan";

export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "harian", label: "Harian" },
  { value: "bulanan", label: "Bulanan" },
  { value: "tahunan", label: "Tahunan" },
];

/** Seksi yang punya form PMC (dan karenanya punya data laporan). */
export const REPORT_STAGE_CODES = ["DRILLING", "HOTPRESS"] as const;
export type ReportStageCode = (typeof REPORT_STAGE_CODES)[number];

/** Satu baris tabel laporan: gabungan per (periode, mesin, shift). */
export interface ReportRow {
  periode: string; // "2026-10-13" | "2026-10" | "2026"
  mesin: string;
  shift: string; // "1", "2", "3"
  iot: number;
  actual: number;
  ng: number;
  target: number;
}

export interface ReportKpi {
  total_iot: number;
  total_actual: number;
  total_ng: number;
  total_target: number;
  achievement: number; // actual / target * 100 (1 desimal), 0 bila target 0
}

export interface BreakdownItem {
  label: string;
  count: number;
}

export interface ReportSection {
  stage_code: ReportStageCode;
  stage_name: string;
  kpi: ReportKpi;
  rows: ReportRow[]; // terbaru dulu (urutan tabel)
  akar: BreakdownItem[]; // akar masalah (dari kolom keterangan), terbanyak dulu
  mesin: BreakdownItem[]; // mesin bermasalah, terbanyak dulu
}

export interface ReportResponse {
  granularity: Granularity;
  date_from: string;
  date_to: string;
  sections: ReportSection[];
}

/** Satu titik grafik (agregat per periode), urutan kronologis. */
export interface ChartPoint {
  periode: string;
  iot: number;
  actual: number;
  ng: number;
  ngRate: number; // ng / actual * 100
  ach: number | null; // actual / iot * 100; null bila periode itu tidak punya data IOT
  regresi: number | null; // garis regresi linear atas ach (null bila belum bisa dihitung)
}

export type TrendLabel = "Meningkat" | "Menurun" | "Stabil";
export type AchStatus = "tercapai" | "evaluasi" | "di bawah target" | "tidak tersedia";
export type NgLevel = "tinggi" | "sedang" | "rendah" | "tidak ada";
export type Tone = "green" | "red" | "yellow" | "blue";

export interface TextSegment {
  text: string;
  tone?: Tone;
  bold?: boolean;
}

export interface ReportAnalysis {
  hasAch: boolean; // false bila tidak ada satu pun periode yang punya data IOT
  avgAch: number;
  trend: TrendLabel;
  slope: number;
  ngRate: number;
  achStatus: AchStatus;
  achTone: Tone;
  ngLevel: NgLevel;
  trendSentence: TextSegment[];
  ngSentence: TextSegment[];
  recommendation: string;
  avgIot: number;
  avgActual: number;
}

export function isReportError(x: unknown): x is { error: string } {
  return typeof x === "object" && x !== null && "error" in x;
}