import type { PmcLevel, PmcPermissions } from "@/types/pmc";

/** Jumlah baris form Hotpress per shift (sama dengan versi PHP). */
export const HOTPRESS_ROWS = 18;

export interface HpRow {
  row_no: number;
  no_wos: string;
  mc_no: string;
  cf_no: string; // nomor part (C/F NO.)
  type: string; // dari master part
  customer: string; // dari master part
  berat_pcs: string; // teks desimal, "" = kosong
  hasil_kg: string;
  baik: number;
  rusak: number;
  total_hasil: number;
  reff_no: string;
  start: string; // "HH:MM" atau ""
  finish: string;
  operator: string;
  keterangan: string;
  validated: boolean;
}

export interface HpSaveRow {
  row_no: number;
  no_wos: string;
  mc_no: string;
  cf_no: string;
  berat_pcs: string;
  hasil_kg: string;
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

export interface HpFormResponse {
  date: string;
  shift: string; // "Shift-1"
  shiftStart: string;
  shiftEnd: string;
  rowCount: number;
  rows: HpRow[]; // hanya baris yang sudah tersimpan
  target: number; // target per shift (header)
  approve: Record<PmcLevel, boolean>;
  operators: string[];
  machines: string[]; // saran isian MC NO.
  perms: PmcPermissions;
}