export type HotpressMachineStatus = "OFF" | "RUNNING" | "RUNNING_BD";

export interface ShaftData {
  partno: string;
  operator: string;
  target: number; // PCS
  actual_pcs: number;
  ach: number; // persen, maks 100
  start: string; // HH:MM:SS atau "-"
  last: string;
}

export interface CycleGraphPoint {
  pcs: string; // urutan siklus: "1", "2", ...
  machine_time: number;
  cycle_time: number;
}

export interface HotpressMachine {
  mc: string;
  status: HotpressMachineStatus;
  shafts: Record<"1" | "2" | "3" | "4", ShaftData>;
  bd_history: string[]; // ["09:10 - 09:42", ...]
  graph_data: CycleGraphPoint[];
  avg_machine_time: number;
  avg_cycle_time: number;
}

export interface MachineListValue {
  mc: string; // satu atau beberapa kode mesin dipisah koma
  val: number;
}

export interface MonthRecord {
  mc: string;
  val: number;
  date: string; // "10 Oct 2026"
  shift: string;
}

export interface HotpressTicker {
  high_out_shift: MachineListValue;
  low_out_shift: MachineListValue;
  fast_cyc_shift: MachineListValue;
  slow_cyc_shift: MachineListValue;
  highest_month_record: MonthRecord;
  lowest_month_record: MonthRecord;
  most_prod_shift: { shift: string; avg: number };
  least_prod_shift: { shift: string; avg: number };
  total_month: number;
}

export interface HotpressResponse {
  punya_data: boolean;
  kpi: {
    plan: number; // dalam CYCLE
    actual: number;
    gap: number;
    ach: number;
    waktu_mulai: string;
    waktu_selesai: string;
  };
  status: { run: number; bd: number; off: number };
  ticker_data: HotpressTicker;
  machines: HotpressMachine[];
}

export interface HotpressError {
  error: string;
}

export function isHotpressError(x: unknown): x is HotpressError {
  return typeof x === "object" && x !== null && "error" in x;
}

/** Total PCS aktual semua shaft pada satu mesin. */
export function machineActualPcs(m: HotpressMachine): number {
  return (["1", "2", "3", "4"] as const).reduce((s, k) => s + m.shafts[k].actual_pcs, 0);
}