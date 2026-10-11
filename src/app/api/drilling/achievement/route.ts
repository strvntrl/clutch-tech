import { NextRequest, NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { getShiftWindow, normalizeDate, normalizeShiftCode } from "@/lib/shift";
import { fmtHm, fmtHms, nowWallEpoch } from "@/lib/time";
import type {
  HourlyCell,
  MachineRunState,
  MonthlyInsight,
  SessionRow,
} from "@/types/drilling";

const HOURLY_TARGET_PCS = 125;
const DEFAULT_CYCLE_SEC = 30;
const BREAKDOWN_AFTER_SEC = 300; // tanpa event > 5 menit = BREAKDOWN

interface LogRow {
  machine_id: number;
  machine_code: string;
  ts: string; // epoch jam dinding (bigint -> string)
  part_id: number | null;
  part_number: string | null;
  standard_cycle_sec: number | null;
  operator_id: number | null;
  operator_name: string | null;
}

interface Session {
  pn: string;
  opr: string;
  cycleSec: number;
  events: number[];
}

interface MonthRow {
  machine_code: string;
  shift_code: string;
  shift_date: string;
  cnt: string;
}

// Insight bulanan berat (scan sebulan penuh) tapi hampir tidak berubah dalam
// hitungan detik, padahal dashboard polling tiap 5 detik. Cache 60 detik per bulan.
const MONTH_CACHE_TTL_MS = 60_000;
const monthCache = new Map<string, { at: number; rows: MonthRow[] }>();

async function getMonthRows(date: string): Promise<MonthRow[]> {
  const key = date.slice(0, 7); // "YYYY-MM"
  const hit = monthCache.get(key);
  if (hit && Date.now() - hit.at < MONTH_CACHE_TTL_MS) return hit.rows;

  const rows = await dbSelect<MonthRow>(
    `SELECT m.machine_code, sh.shift_code,
            DATE(l.event_time - INTERVAL '7 hours')::text AS shift_date,
            COUNT(*) AS cnt
     FROM machine_process_log l
     JOIN machine m ON m.machine_id = l.machine_id
     JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'DRILLING'
     JOIN shift sh ON sh.shift_id = l.shift_id
     WHERE date_trunc('month', l.event_time) = date_trunc('month', $1::date)
     GROUP BY m.machine_code, sh.shift_code, DATE(l.event_time - INTERVAL '7 hours')
     ORDER BY m.machine_code, sh.shift_code, shift_date`,
    [date]
  );
  monthCache.set(key, { at: Date.now(), rows });
  return rows;
}

function buildMonthly(rows: MonthRow[]): MonthlyInsight | null {
  if (rows.length === 0) return null;

  const groups = rows.map((r) => ({
    mc: r.machine_code,
    shift: r.shift_code,
    date: r.shift_date,
    count: Number(r.cnt),
  }));

  let topMc = groups[0];
  let lowMc: (typeof groups)[number] | null = null;
  for (const g of groups) {
    if (g.count > topMc.count) topMc = g;
    if (g.count > 0 && (lowMc === null || g.count < lowMc.count)) lowMc = g;
  }

  const perDate = new Map<string, { s1: number; s2: number; s3: number; total: number }>();
  for (const g of groups) {
    const v = perDate.get(g.date) ?? { s1: 0, s2: 0, s3: 0, total: 0 };
    if (g.shift === "SHIFT-1") v.s1 += g.count;
    else if (g.shift === "SHIFT-2") v.s2 += g.count;
    else if (g.shift === "SHIFT-3") v.s3 += g.count;
    v.total += g.count;
    perDate.set(g.date, v);
  }

  const dates = Array.from(perDate.keys()).sort();
  let highDate: string | null = null;
  let lowDate: string | null = null;
  for (const d of dates) {
    const v = perDate.get(d)!;
    if (highDate === null || v.total > perDate.get(highDate)!.total) highDate = d;
    if (v.total > 0 && (lowDate === null || v.total < perDate.get(lowDate)!.total)) lowDate = d;
  }

  const shiftCodes = ["SHIFT-1", "SHIFT-2", "SHIFT-3"];
  const shiftTotals: Record<string, number> = { "SHIFT-1": 0, "SHIFT-2": 0, "SHIFT-3": 0 };
  const shiftDays: Record<string, Set<string>> = {
    "SHIFT-1": new Set(),
    "SHIFT-2": new Set(),
    "SHIFT-3": new Set(),
  };
  for (const g of groups) {
    if (g.shift in shiftTotals) {
      shiftTotals[g.shift] += g.count;
      shiftDays[g.shift].add(g.date);
    }
  }
  const shiftAvg = shiftCodes.map((sc) => ({
    name: sc,
    avg: shiftDays[sc].size > 0 ? Math.round(shiftTotals[sc] / shiftDays[sc].size) : 0,
  }));
  // sort menurun, stabil (urutan awal dipertahankan kalau sama)
  const ranked = [...shiftAvg].sort((a, b) => b.avg - a.avg);

  const high = highDate ? perDate.get(highDate)! : { s1: 0, s2: 0, s3: 0, total: 0 };
  const low = lowDate ? perDate.get(lowDate)! : { s1: 0, s2: 0, s3: 0, total: 0 };

  return {
    top_mc: { mc: topMc.mc, val: topMc.count, date: topMc.date, shift: topMc.shift },
    low_mc: {
      mc: lowMc?.mc ?? "-",
      val: lowMc?.count ?? 0,
      date: lowMc?.date ?? "-",
      shift: lowMc?.shift ?? "-",
    },
    high_cum: { date: highDate ?? "-", total: high.total, s1: high.s1, s2: high.s2, s3: high.s3 },
    low_cum: { date: lowDate ?? "-", total: low.total, s1: low.s1, s2: low.s2, s3: low.s3 },
    top_shift: ranked[0],
    low_shift: ranked[ranked.length - 1],
    total_month: groups.reduce((sum, g) => sum + g.count, 0),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = normalizeDate(searchParams.get("date"));
  const shiftParam = searchParams.get("shift") ?? "Shift-1";
  const shiftCode = normalizeShiftCode(shiftParam);

  try {
    const shift = await getShiftWindow(date, shiftCode);
    if (!shift) {
      return NextResponse.json(
        { error: `Shift tidak dikenali: ${shiftCode}` },
        { status: 400 }
      );
    }

    // 1. Log produksi drilling dalam rentang shift
    const logs = await dbSelect<LogRow>(
      `SELECT l.machine_id, m.machine_code,
              floor(EXTRACT(EPOCH FROM l.event_time))::bigint AS ts,
              p.part_id, p.part_number, p.standard_cycle_sec,
              o.operator_id, o.operator_name
       FROM machine_process_log l
       JOIN machine m ON m.machine_id = l.machine_id
       JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'DRILLING'
       LEFT JOIN part p ON p.part_id = l.part_id
       LEFT JOIN operator o ON o.operator_id = l.operator_id
       WHERE l.event_time >= $1 AND l.event_time < $2
       ORDER BY m.machine_code, l.event_time`,
      [shift.startStr, shift.endStr]
    );

    const machineRows = await dbSelect<{ machine_code: string }>(
      `SELECT m.machine_code
       FROM machine m
       JOIN process_stage s ON s.stage_id = m.stage_id
       WHERE s.stage_code = 'DRILLING'
       ORDER BY m.machine_code`
    );
    const machines = machineRows.map((r) => r.machine_code);

    const now = nowWallEpoch();

    // 2. Grid jam x mesin
    const numBuckets = Math.ceil((shift.endEpoch - shift.startEpoch) / 3600);
    const actualGrid = new Map<string, number>(); // `${idx}|${mc}` -> count
    for (const r of logs) {
      const idx = Math.floor((Number(r.ts) - shift.startEpoch) / 3600);
      if (idx >= 0 && idx < numBuckets) {
        const key = `${idx}|${r.machine_code}`;
        actualGrid.set(key, (actualGrid.get(key) ?? 0) + 1);
      }
    }

    const chartData: HourlyCell[] = [];
    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = shift.startEpoch + i * 3600;
      const target = bucketStart > now ? 0 : HOURLY_TARGET_PCS;
      for (const mc of machines) {
        chartData.push({
          jam: fmtHm(bucketStart),
          mc,
          target,
          actual: actualGrid.get(`${i}|${mc}`) ?? 0,
        });
      }
    }

    // 3. KPI
    const planRows = await dbSelect<{ total_target: string }>(
      `SELECT COALESCE(SUM(target_qty), 0) AS total_target
       FROM production_plan
       WHERE status = 'ACTIVE' AND shift_id = $1 AND plan_date = $2`,
      [shift.shiftId, date]
    );
    const kpiTarget = Number(planRows[0]?.total_target ?? 0);
    const totalPcs = logs.length;

    let startTimeVal = "--:--:--";
    let lastUpdate = "--:--:--";
    if (logs.length > 0) {
      const times = logs.map((r) => Number(r.ts));
      startTimeVal = fmtHms(Math.min(...times));
      lastUpdate = fmtHms(Math.max(...times));
    }

    // 4. Tabel: per mesin -> per sesi (part + operator)
    const byMachine = new Map<string, LogRow[]>();
    for (const mc of machines) byMachine.set(mc, []);
    for (const r of logs) byMachine.get(r.machine_code)?.push(r);

    const tableData: SessionRow[] = [];
    const machineState: Record<string, MachineRunState> = {};

    for (const [mc, rows] of byMachine) {
      if (rows.length === 0) {
        machineState[mc] = "NO_DATA";
        continue;
      }

      const sessions = new Map<string, Session>();
      let lastEvent = 0;
      for (const r of rows) {
        const key = `${r.part_id ?? 0}-${r.operator_id ?? 0}`;
        let s = sessions.get(key);
        if (!s) {
          s = {
            pn: r.part_number ?? "-",
            opr: r.operator_name ?? "-",
            cycleSec: r.standard_cycle_sec || DEFAULT_CYCLE_SEC,
            events: [],
          };
          sessions.set(key, s);
        }
        const t = Number(r.ts);
        s.events.push(t);
        if (t > lastEvent) lastEvent = t;
      }

      machineState[mc] = now - lastEvent > BREAKDOWN_AFTER_SEC ? "BREAKDOWN" : "RUNNING";

      for (const s of sessions.values()) {
        s.events.sort((a, b) => a - b);
        const firstT = s.events[0];
        const lastT = s.events[s.events.length - 1];
        const cycleSec = Math.max(1, Math.trunc(s.cycleSec));
        const elapsed = lastT - firstT;
        const target = elapsed < cycleSec ? 1 : Math.floor(elapsed / cycleSec);

        tableData.push({
          mc,
          pn: s.pn,
          opr: s.opr,
          start: fmtHms(firstT),
          last: fmtHms(lastT),
          target,
          actual: s.events.length,
        });
      }
    }

    // 5. Insight bulanan (agregasi di SQL + cache 60 detik)
    const monthRows = await getMonthRows(date);

    return NextResponse.json({
      date,
      shift: shiftParam,
      machines,
      machine_state: machineState,
      start_time_val: startTimeVal,
      last_update: lastUpdate,
      total_pcs: totalPcs,
      data: chartData,
      table_data: tableData,
      monthly_data: buildMonthly(monthRows),
      kpi_target: kpiTarget,
      kpi_actual: totalPcs,
    });
  } catch (error) {
    console.error("Drilling achievement error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}