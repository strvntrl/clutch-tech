import { HOTPRESS_ROWS, type HpFormResponse, type HpRow, type HpSaveRow } from "@/types/pmc-hotpress";

export function blankHpRow(rowNo: number): HpRow {
  return {
    row_no: rowNo,
    no_wos: "",
    mc_no: "",
    cf_no: "",
    type: "",
    customer: "",
    berat_pcs: "",
    hasil_kg: "",
    baik: 0,
    rusak: 0,
    total_hasil: 0,
    reff_no: "",
    start: "",
    finish: "",
    operator: "",
    keterangan: "",
    validated: false,
  };
}

/** 18 baris form; baris yang belum tersimpan berupa baris kosong. */
export function buildHpRows(form: HpFormResponse): HpRow[] {
  const saved = new Map(form.rows.map((r) => [r.row_no, r]));
  return Array.from({ length: form.rowCount || HOTPRESS_ROWS }, (_, i) => saved.get(i) ?? blankHpRow(i));
}

/** "1,5" / " 2.50 " -> "1.5" / "2.5"; kosong atau tidak valid -> "" */
export function normDecimal(s: string): string {
  const t = s.trim().replace(",", ".");
  if (t === "") return "";
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

/** Bandingkan hanya kolom yang dapat diedit pengguna. */
export function sameHpRow(a: HpRow, b: HpRow): boolean {
  return (
    a.no_wos.trim() === b.no_wos.trim() &&
    a.mc_no.trim() === b.mc_no.trim() &&
    a.cf_no.trim().toUpperCase() === b.cf_no.trim().toUpperCase() &&
    normDecimal(a.berat_pcs) === normDecimal(b.berat_pcs) &&
    normDecimal(a.hasil_kg) === normDecimal(b.hasil_kg) &&
    a.baik === b.baik &&
    a.rusak === b.rusak &&
    a.total_hasil === b.total_hasil &&
    a.reff_no.trim() === b.reff_no.trim() &&
    a.start === b.start &&
    a.finish === b.finish &&
    a.operator.trim() === b.operator.trim() &&
    a.keterangan.trim() === b.keterangan.trim() &&
    a.validated === b.validated
  );
}

export function toHpSaveRow(r: HpRow, validated: boolean = r.validated): HpSaveRow {
  return {
    row_no: r.row_no,
    no_wos: r.no_wos.trim(),
    mc_no: r.mc_no.trim(),
    cf_no: r.cf_no.trim(),
    berat_pcs: r.berat_pcs.trim(),
    hasil_kg: r.hasil_kg.trim(),
    baik: r.baik,
    rusak: r.rusak,
    total_hasil: r.total_hasil,
    reff_no: r.reff_no.trim(),
    start: r.start,
    finish: r.finish,
    operator: r.operator.trim(),
    keterangan: r.keterangan.trim(),
    validated,
  };
}

/** Teks input angka -> bilangan bulat >= 0 (kosong / tidak valid = 0). */
export function toCount(text: string): number {
  const n = Math.floor(Number(text));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000) : 0;
}