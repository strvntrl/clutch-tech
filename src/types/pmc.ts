export type PmcLevel = "foreman" | "supervisor" | "ast_manager";

export const PMC_LEVELS: { level: PmcLevel; label: string }[] = [
  { level: "foreman", label: "FOREMAN" },
  { level: "supervisor", label: "SUPERVISOR" },
  { level: "ast_manager", label: "AST. MANAGER" },
];

/** Opsi kolom keterangan per mesin (sama dengan form PHP). */
export const KETERANGAN_OPTIONS = [
  "Mesin Error: Breakdown",
  "Quality: Cacat/Rework",
  "Quality: Sortir & Variasi",
  "Tooling: Mata Bor & Plong",
  "Tooling: Spindle/Joint",
  "Tooling: TC/Blushing/Upper-Bottom",
  "Setting Atas",
  "Setting Bawah",
  "Lainnya",
] as const;

/** Satu stasiun pada form: satu mesin (4 baris input) atau stasiun "BOR ULANG". */
export interface PmcStation {
  code: string; // "DR-01" ... atau "BOR ULANG"
  rowBase: number; // row_no baris pertama stasiun ini; baris = rowBase + 0..3
  hasIot: boolean; // BOR ULANG tidak punya sumber IoT
}

export interface PmcRow {
  row_no: number;
  part_number: string;
  customer: string;
  product_type: string;
  jumlah_mata_bor: string;
  ukuran_bor: string;
  jam_operasional: string;
  target: number;
  actual: number;
  ng: number;
  operator: string;
  keterangan: string;
  validated: boolean;
}

export interface PmcPermissions {
  started: boolean; // shift sudah dimulai
  canEdit: boolean;
  canEditLocked: boolean;
  canApprove: Record<PmcLevel, boolean>;
  isLive: boolean;
  reason: string | null; // alasan kalau tidak bisa mengedit
}

export interface PmcFormResponse {
  date: string;
  shift: string; // "Shift-1"
  shiftStart: string; // "YYYY-MM-DD HH:MM:SS"
  shiftEnd: string;
  stations: PmcStation[];
  rows: PmcRow[]; // hanya baris yang sudah tersimpan
  approve: Record<PmcLevel, boolean>;
  iot: Record<string, number>; // kode mesin -> jumlah event IoT di shift tsb
  operators: string[];
  perms: PmcPermissions;
}

export interface PmcSaveRow {
  row_no: number;
  part_number: string;
  jumlah_mata_bor: string;
  ukuran_bor: string;
  target: number;
  actual: number;
  ng: number;
  operator: string;
  keterangan: string;
  validated: boolean;
}

export interface PartSuggestion {
  part_number: string;
  customer: string;
  product_type: string;
}

export interface PmcApiError {
  error: string;
  rowErrors?: Record<number, string>;
}

export function isPmcError(x: unknown): x is PmcApiError {
  return typeof x === "object" && x !== null && "error" in x;
}