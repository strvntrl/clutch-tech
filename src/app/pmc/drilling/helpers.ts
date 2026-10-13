import type { PmcFormResponse, PmcRow, PmcSaveRow, PmcStation } from "@/types/pmc";

export const SLOTS = 4;

export function blankRow(rowNo: number): PmcRow {
  return {
    row_no: rowNo,
    part_number: "",
    customer: "",
    product_type: "",
    jumlah_mata_bor: "",
    ukuran_bor: "",
    jam_operasional: "",
    target: 0,
    actual: 0,
    ng: 0,
    operator: "",
    keterangan: "",
    validated: false,
  };
}

/** Semua baris form, berurutan per stasiun (4 baris per stasiun), baris kosong jika belum tersimpan. */
export function buildRows(form: PmcFormResponse): PmcRow[] {
  const saved = new Map(form.rows.map((r) => [r.row_no, r]));
  const out: PmcRow[] = [];
  for (const st of form.stations) {
    for (let i = 0; i < SLOTS; i++) {
      const no = st.rowBase + i;
      out.push(saved.get(no) ?? blankRow(no));
    }
  }
  return out;
}

/** Bandingkan hanya kolom yang dapat diedit pengguna. */
export function sameRow(a: PmcRow, b: PmcRow): boolean {
  return (
    a.part_number.trim().toUpperCase() === b.part_number.trim().toUpperCase() &&
    a.jumlah_mata_bor.trim() === b.jumlah_mata_bor.trim() &&
    a.ukuran_bor.trim() === b.ukuran_bor.trim() &&
    a.target === b.target &&
    a.actual === b.actual &&
    a.ng === b.ng &&
    a.operator.trim() === b.operator.trim() &&
    a.keterangan === b.keterangan &&
    a.validated === b.validated
  );
}

export function toSaveRow(r: PmcRow, validated: boolean = r.validated): PmcSaveRow {
  return {
    row_no: r.row_no,
    part_number: r.part_number.trim(),
    jumlah_mata_bor: r.jumlah_mata_bor.trim(),
    ukuran_bor: r.ukuran_bor.trim(),
    target: r.target,
    actual: r.actual,
    ng: r.ng,
    operator: r.operator.trim(),
    keterangan: r.keterangan,
    validated,
  };
}

/** Teks input angka -> bilangan bulat >= 0 (kosong / tidak valid = 0). */
export function toCount(text: string): number {
  const n = Math.floor(Number(text));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000) : 0;
}

export function stationRows(rows: PmcRow[], station: PmcStation): PmcRow[] {
  return rows.filter((r) => r.row_no >= station.rowBase && r.row_no < station.rowBase + SLOTS);
}