export interface HourlyCell {
  jam: string; // "07:30"
  mc: string; // "DR-01"
  target: number;
  actual: number;
}

export interface SessionRow {
  mc: string;
  pn: string; // part number
  opr: string; // operator
  start: string; // HH:MM:SS
  last: string;
  target: number;
  actual: number;
}

export type MachineRunState = "RUNNING" | "BREAKDOWN" | "NO_DATA";

export interface MonthlyInsight {
  top_mc: { mc: string; val: number; date: string; shift: string };
  low_mc: { mc: string; val: number; date: string; shift: string };
  high_cum: { date: string; total: number; s1: number; s2: number; s3: number };
  low_cum: { date: string; total: number; s1: number; s2: number; s3: number };
  top_shift: { name: string; avg: number };
  low_shift: { name: string; avg: number };
  total_month: number;
}

export interface DrillingAchievementResponse {
  date: string;
  shift: string;
  machines: string[];
  machine_state: Record<string, MachineRunState>;
  start_time_val: string;
  last_update: string;
  total_pcs: number;
  data: HourlyCell[];
  table_data: SessionRow[];
  monthly_data: MonthlyInsight | null;
  kpi_target: number;
  kpi_actual: number;
}

export interface DowntimeBlock {
  machine: string;
  start: string; // "YYYY-MM-DD HH:MM:SS"
  end: string;
  status: "UPTIME" | "DOWNTIME";
  color: string;
  pcs: number;
  duration: number; // detik
}

export interface DowntimeSummary {
  start_uptime: string;
  last_uptime: string;
  avg_time: number;
}

export interface DrillingDowntimeResponse {
  date: string;
  shift: string;
  start_shift: string;
  end_shift: string;
  data: DowntimeBlock[];
  summary: Record<string, DowntimeSummary>;
}

export type TrendType = "now" | "history" | "monthly" | "yearly";

export interface TrendRow {
  time: string;
  target: number;
  [machineCode: string]: number | string;
}

export interface DrillingTrendResponse {
  status: "success";
  type: TrendType;
  month_name: string;
  year: number;
  total_data: number;
  machines: string[];
  data: TrendRow[];
}

export interface ApiError {
  error: string;
}

export function isApiError(x: unknown): x is ApiError {
  return typeof x === "object" && x !== null && "error" in x;
}