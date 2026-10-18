import "server-only";
import { dbSelect } from "@/lib/db";
import { HttpError } from "@/lib/pmc/common";
import { isValidDateStr } from "@/lib/time";
import { buildKpi } from "@/lib/report/analysis";
import {
  GRANULARITIES,
  REPORT_STAGE_CODES,
  type BreakdownItem,
  type Granularity,
  type ReportResponse,
  type ReportRow,
  type ReportSection,
  type ReportStageCode,
} from "@/types/report";

export interface ReportParams {
  granularity: Granularity;
  from: string;
  to: string;
  stages: ReportStageCode[];
}

const MAX_RANGE_DAYS = 1830; // ~5 tahun

const PERIODE_FORMAT: Record<Granularity, string> = {
  harian: "YYYY-MM-DD",
  bulanan: "YYYY-MM",
  tahunan: "YYYY",
};

const dayNumber = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

export function parseParams(sp: URLSearchParams): ReportParams {
  const gRaw = sp.get("granularity") ?? "harian";
  const granularity = GRANULARITIES.find((g) => g.value === gRaw)?.value;
  if (!granularity) throw new HttpError(400, "Granularitas tidak valid (harian, bulanan, atau tahunan).");

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    throw new HttpError(400, "Tanggal awal dan akhir wajib diisi dengan format YYYY-MM-DD yang valid.");
  }
  if (from > to) throw new HttpError(400, "Tanggal awal tidak boleh setelah tanggal akhir.");
  if (dayNumber(to) - dayNumber(from) > MAX_RANGE_DAYS) {
    throw new HttpError(400, "Rentang tanggal terlalu panjang (maksimum 5 tahun).");
  }

  const raw = sp.get("stages");
  const requested = raw === null ? [...REPORT_STAGE_CODES] : raw.split(",").map((s) => s.trim()).filter(Boolean);
  const stages: ReportStageCode[] = [];
  for (const s of requested) {
    if (!(REPORT_STAGE_CODES as readonly string[]).includes(s)) throw new HttpError(400, `Seksi tidak dikenal: ${s}`);
    if (!stages.includes(s as ReportStageCode)) stages.push(s as ReportStageCode);
  }
  if (stages.length === 0) throw new HttpError(400, "Pilih minimal satu seksi.");
  // urutan tampil mengikuti urutan baku
  stages.sort((a, b) => REPORT_STAGE_CODES.indexOf(a) - REPORT_STAGE_CODES.indexOf(b));

  return { granularity, from, to, stages };
}

type RawRow = { periode: string; mesin: string; shift: string; iot: number; actual: number; ng: number; target: number };

const toRows = (raw: RawRow[]): ReportRow[] =>
  raw.map((r) => ({
    periode: r.periode,
    mesin: r.mesin,
    shift: r.shift,
    iot: Number(r.iot),
    actual: Number(r.actual),
    ng: Number(r.ng),
    target: Number(r.target),
  }));

// Jendela waktu shift untuk (tanggal entry, shift)
const WINDOW_START = `v.entry_date + sh.start_time`;
const WINDOW_END = `v.entry_date + sh.start_time + (CASE WHEN sh.is_overnight
                      THEN sh.end_time - sh.start_time + INTERVAL '24 hours'
                      ELSE sh.end_time - sh.start_time END)`;

async function drillingRows(p: ReportParams): Promise<ReportRow[]> {
  const raw = await dbSelect<RawRow>(
    `SELECT x.periode, x.mesin, x.shift,
            SUM(x.iot)::int AS iot, SUM(x.actual)::int AS actual,
            SUM(x.ng)::int AS ng, SUM(x.target)::int AS target
     FROM (
       SELECT to_char(v.entry_date, $3::text) AS periode,
              COALESCE(m.machine_code, 'BOR ULANG') AS mesin,
              REPLACE(sh.shift_code, 'SHIFT-', '') AS shift,
              COALESCE(iot.cnt, 0) AS iot, v.actual, v.ng, v.target
       FROM (
         SELECT pe.entry_id, pe.entry_date, pe.shift_id, d.machine_id,
                SUM(d.actual_qty) AS actual, SUM(d.reject_qty) AS ng, SUM(d.target_qty) AS target
         FROM pmc_entry pe
         JOIN process_stage ps ON ps.stage_id = pe.stage_id AND ps.stage_code = 'DRILLING'
         JOIN pmc_entry_detail d ON d.entry_id = pe.entry_id
         WHERE pe.entry_date BETWEEN $1::date AND $2::date AND d.is_checked
         GROUP BY pe.entry_id, pe.entry_date, pe.shift_id, d.machine_id
       ) v
       JOIN shift sh ON sh.shift_id = v.shift_id
       LEFT JOIN machine m ON m.machine_id = v.machine_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM machine_process_log l
         WHERE l.machine_id = v.machine_id
           AND l.event_time >= ${WINDOW_START}
           AND l.event_time <  ${WINDOW_END}
       ) iot ON TRUE
       WHERE NOT (COALESCE(iot.cnt, 0) = 0 AND v.actual = 0 AND v.ng = 0)
     ) x
     GROUP BY x.periode, x.mesin, x.shift
     ORDER BY x.periode DESC, x.mesin, x.shift`,
    [p.from, p.to, PERIODE_FORMAT[p.granularity]]
  );
  return toRows(raw);
}

async function hotpressRows(p: ReportParams): Promise<ReportRow[]> {
  const raw = await dbSelect<RawRow>(
    `SELECT x.periode, '-' AS mesin, x.shift,
            SUM(x.iot)::int AS iot, SUM(x.actual)::int AS actual,
            SUM(x.ng)::int AS ng, SUM(x.target)::int AS target
     FROM (
       SELECT to_char(v.entry_date, $3::text) AS periode,
              REPLACE(sh.shift_code, 'SHIFT-', '') AS shift,
              COALESCE(iot.cnt, 0) AS iot, v.actual, v.ng, v.target
       FROM (
         SELECT pe.entry_id, pe.entry_date, pe.shift_id, COALESCE(pe.target_qty, 0) AS target,
                SUM(d.baik) AS actual, SUM(d.rusak) AS ng
         FROM pmc_entry pe
         JOIN process_stage ps ON ps.stage_id = pe.stage_id AND ps.stage_code = 'HOTPRESS'
         JOIN pmc_hotpress_detail d ON d.entry_id = pe.entry_id
         WHERE pe.entry_date BETWEEN $1::date AND $2::date AND d.is_checked
         GROUP BY pe.entry_id, pe.entry_date, pe.shift_id, pe.target_qty
       ) v
       JOIN shift sh ON sh.shift_id = v.shift_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt
         FROM machine_process_log l
         JOIN machine m ON m.machine_id = l.machine_id
         JOIN process_stage s2 ON s2.stage_id = m.stage_id AND s2.stage_code = 'HOTPRESS'
         WHERE l.event_time >= ${WINDOW_START}
           AND l.event_time <  ${WINDOW_END}
       ) iot ON TRUE
       WHERE NOT (COALESCE(iot.cnt, 0) = 0 AND v.actual = 0 AND v.ng = 0)
     ) x
     GROUP BY x.periode, x.shift
     ORDER BY x.periode DESC, x.shift`,
    [p.from, p.to, PERIODE_FORMAT[p.granularity]]
  );
  return toRows(raw);
}

/** Akar masalah (dari kolom keterangan) dan mesin bermasalah - hanya Drilling. */
async function drillingBreakdown(p: ReportParams): Promise<{ akar: BreakdownItem[]; mesin: BreakdownItem[] }> {
  const raw = await dbSelect<{ mesin: string; keterangan: string }>(
    `SELECT COALESCE(m.machine_code, 'BOR ULANG') AS mesin, k.keterangan
     FROM (
       SELECT DISTINCT pe.entry_id, d.machine_id, d.keterangan
       FROM pmc_entry pe
       JOIN process_stage ps ON ps.stage_id = pe.stage_id AND ps.stage_code = 'DRILLING'
       JOIN pmc_entry_detail d ON d.entry_id = pe.entry_id
       WHERE pe.entry_date BETWEEN $1::date AND $2::date
         AND d.is_checked AND d.keterangan IS NOT NULL AND d.keterangan <> ''
     ) k
     LEFT JOIN machine m ON m.machine_id = k.machine_id`,
    [p.from, p.to]
  );

  const akar = new Map<string, number>();
  const mesin = new Map<string, number>();
  for (const r of raw) {
    mesin.set(r.mesin, (mesin.get(r.mesin) ?? 0) + 1);
    for (const part of r.keterangan.split(",").map((s) => s.trim()).filter(Boolean)) {
      akar.set(part, (akar.get(part) ?? 0) + 1);
    }
  }
  const sorted = (m: Map<string, number>): BreakdownItem[] =>
    [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { akar: sorted(akar), mesin: sorted(mesin) };
}

export async function getReport(p: ReportParams): Promise<ReportResponse> {
  const names = new Map(
    (
      await dbSelect<{ stage_code: string; stage_name: string }>(
        `SELECT stage_code, stage_name FROM process_stage WHERE stage_code = ANY($1::text[])`,
        [p.stages]
      )
    ).map((r) => [r.stage_code, r.stage_name])
  );

  const sections: ReportSection[] = [];
  for (const stage of p.stages) {
    const rows = stage === "DRILLING" ? await drillingRows(p) : await hotpressRows(p);
    const breakdown = stage === "DRILLING" ? await drillingBreakdown(p) : { akar: [], mesin: [] };
    sections.push({
      stage_code: stage,
      stage_name: names.get(stage) ?? stage,
      kpi: buildKpi(rows),
      rows,
      akar: breakdown.akar,
      mesin: breakdown.mesin,
    });
  }

  return { granularity: p.granularity, date_from: p.from, date_to: p.to, sections };
}