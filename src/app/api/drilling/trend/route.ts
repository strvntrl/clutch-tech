import { NextRequest, NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { daysInMonth, isValidDateStr, monthName, todayJakarta } from "@/lib/time";
import type { TrendRow, TrendType } from "@/types/drilling";

/**
 * GET /api/drilling/trend?type=now|history|monthly|yearly&month=&year=&date=
 * Port dari view/addon/controller/drilling/get_historical_trend.php.
 *
 * "Hari produksi" dimulai 07:30, jadi pengelompokan harian memakai
 * (event_time - 7 jam), sama seperti versi PHP.
 */

const DAILY_TARGET_PCS = 3000;
const VALID_TYPES: TrendType[] = ["now", "history", "monthly", "yearly"];

const pad = (n: number) => String(n).padStart(2, "0");

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? NaN : parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const typeRaw = searchParams.get("type") ?? "now";
  const type: TrendType = (VALID_TYPES as string[]).includes(typeRaw)
    ? (typeRaw as TrendType)
    : "now";

  const today = todayJakarta();
  const [curYear, curMonth] = today.split("-").map(Number);

  const dateParam = searchParams.get("date");
  const historyDate = dateParam && isValidDateStr(dateParam) ? dateParam : today;

  try {
    const machineRows = await dbSelect<{ machine_code: string }>(
      `SELECT m.machine_code
       FROM machine m
       JOIN process_stage s ON s.stage_id = m.stage_id
       WHERE s.stage_code = 'DRILLING'
       ORDER BY m.machine_code`
    );
    const machines = machineRows.map((r) => r.machine_code);

    const blankRow = (time: string, target: number): TrendRow => {
      const row: TrendRow = { time, target };
      for (const mc of machines) row[mc] = 0;
      return row;
    };

    let totalAll = 0;
    let data: TrendRow[];
    let year: number;
    let month: number;

    if (type === "yearly") {
      year = clampInt(searchParams.get("year"), curYear, 2000, 2100);
      month = 1;

      data = Array.from({ length: 12 }, (_, i) => blankRow(monthName(i + 1), 0));

      const rows = await dbSelect<{ mc: string; bulan: number; actual: string }>(
        `SELECT m.machine_code AS mc,
                EXTRACT(MONTH FROM (l.event_time - INTERVAL '7 hours'))::int AS bulan,
                COUNT(*) AS actual
         FROM machine_process_log l
         JOIN machine m ON m.machine_id = l.machine_id
         JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'DRILLING'
         WHERE l.event_time >= $1 AND l.event_time < $2
         GROUP BY m.machine_code, EXTRACT(MONTH FROM (l.event_time - INTERVAL '7 hours'))`,
        [`${year}-01-01 07:30:00`, `${year + 1}-01-01 07:30:00`]
      );

      for (const r of rows) {
        const row = data[r.bulan - 1];
        if (row && r.mc in row) {
          row[r.mc] = Number(r.actual);
          totalAll += Number(r.actual);
        }
      }
    } else {
      if (type === "now") {
        year = curYear;
        month = curMonth;
      } else if (type === "history") {
        const [hy, hm] = historyDate.split("-").map(Number);
        year = hy;
        month = hm;
      } else {
        year = clampInt(searchParams.get("year"), curYear, 2000, 2100);
        month = clampInt(searchParams.get("month"), curMonth, 1, 12);
      }

      const dim = daysInMonth(year, month);
      data = Array.from({ length: dim }, (_, i) =>
        blankRow(String(i + 1), DAILY_TARGET_PCS)
      );

      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const startDate = `${year}-${pad(month)}-01 07:30:00`;
      let endDate = `${nextYear}-${pad(nextMonth)}-01 07:30:00`;

      if (type === "now") {
        const todayStart = `${today} 07:30:00`;
        if (todayStart < endDate) endDate = todayStart; // string ISO bisa dibandingkan langsung
      }

      const rows = await dbSelect<{ mc: string; tanggal: number; actual: string }>(
        `SELECT m.machine_code AS mc,
                EXTRACT(DAY FROM (l.event_time - INTERVAL '7 hours'))::int AS tanggal,
                COUNT(*) AS actual
         FROM machine_process_log l
         JOIN machine m ON m.machine_id = l.machine_id
         JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'DRILLING'
         WHERE l.event_time >= $1 AND l.event_time < $2
         GROUP BY m.machine_code, EXTRACT(DAY FROM (l.event_time - INTERVAL '7 hours'))`,
        [startDate, endDate]
      );

      for (const r of rows) {
        const row = data[r.tanggal - 1];
        if (row && r.mc in row) {
          row[r.mc] = Number(r.actual);
          totalAll += Number(r.actual);
        }
      }
    }

    return NextResponse.json({
      status: "success",
      type,
      month_name: monthName(month),
      year,
      total_data: totalAll,
      machines,
      data,
    });
  } catch (error) {
    console.error("Drilling trend error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}