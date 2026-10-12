import { NextRequest, NextResponse } from "next/server";
import pool, { dbSelect } from "@/lib/db";
import {
  getShiftWindow,
  normalizeDate,
  normalizeShiftCode,
  type ShiftWindow,
} from "@/lib/shift";
import { fmtHm, fmtHms, nowWallEpoch } from "@/lib/time";
import type {
  CycleGraphPoint,
  HotpressMachine,
  HotpressMachineStatus,
  HotpressTicker,
  MachineListValue,
  MonthRecord,
  ShaftData,
} from "@/types/hotpress";

const DEFAULT_TARGET_CYCLE = 82;
const DEFAULT_CVT = 1; // 1 siklus = 1 pcs
const BREAKDOWN_GAP_SEC = 600; // jeda > 10 menit = breakdown

// ----------------------------------------------------------------------
// 1. SYNC
// ----------------------------------------------------------------------

const AGG_CTE = `
  agg AS (
    SELECT l.machine_id, l.part_id, l.operator_id,
           MIN(l.event_time) AS first_dt,
           MAX(l.event_time) AS last_dt,
           COUNT(*)::int AS jml
    FROM machine_process_log l
    JOIN machine m ON m.machine_id = l.machine_id
    JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'HOTPRESS'
    WHERE l.event_time >= $1::timestamp AND l.event_time < $2::timestamp
    GROUP BY l.machine_id, l.part_id, l.operator_id
  )`;

// Grup yang sudah punya baris di press_station_cycle -> perbarui hitungannya.
const UPDATE_SQL = `
  WITH ${AGG_CTE}
  UPDATE press_station_cycle psc
  SET actual_cycle = agg.jml,
      actual_pcs   = agg.jml * $5::int,
      last_time    = CASE WHEN $4::boolean THEN agg.last_dt ELSE psc.last_time END
  FROM agg
  WHERE psc.cycle_id = (
    SELECT p2.cycle_id
    FROM press_station_cycle p2
    WHERE p2.machine_id = agg.machine_id
      AND p2.shift_id = $3::smallint
      AND p2.part_id IS NOT DISTINCT FROM agg.part_id
      AND p2.operator_id IS NOT DISTINCT FROM agg.operator_id
      AND p2.start_time >= $1::timestamp AND p2.start_time < $2::timestamp
    ORDER BY p2.cycle_id
    LIMIT 1
  )`;

// Grup baru -> sisipkan. station_no = (shaft terbesar yang sudah ada) + 1,
// dst., kembali ke 1 setelah 4 (sama seperti aturan PHP).
const INSERT_SQL = `
  WITH ${AGG_CTE},
  new_groups AS (
    SELECT agg.*,
           ROW_NUMBER() OVER (
             PARTITION BY agg.machine_id
             ORDER BY agg.first_dt, agg.part_id NULLS FIRST, agg.operator_id NULLS FIRST
           ) AS rn
    FROM agg
    WHERE NOT EXISTS (
      SELECT 1 FROM press_station_cycle p2
      WHERE p2.machine_id = agg.machine_id
        AND p2.shift_id = $3::smallint
        AND p2.part_id IS NOT DISTINCT FROM agg.part_id
        AND p2.operator_id IS NOT DISTINCT FROM agg.operator_id
        AND p2.start_time >= $1::timestamp AND p2.start_time < $2::timestamp
    )
  ),
  base AS (
    SELECT machine_id, MAX(station_no) AS max_shaf
    FROM press_station_cycle
    WHERE shift_id = $3::smallint
      AND start_time >= $1::timestamp AND start_time < $2::timestamp
    GROUP BY machine_id
  )
  INSERT INTO press_station_cycle
    (machine_id, station_no, part_id, operator_id, shift_id, start_time, last_time,
     target_cycle, actual_cycle, target_pcs, actual_pcs, status)
  SELECT g.machine_id,
         ((COALESCE(b.max_shaf, 0) + g.rn - 1) % 4 + 1)::smallint,
         g.part_id, g.operator_id, $3::smallint, g.first_dt, g.last_dt,
         $5::int, g.jml, $5::int * $4::int, g.jml * $4::int, 'RUNNING'
  FROM new_groups g
  LEFT JOIN base b ON b.machine_id = g.machine_id
  ON CONFLICT DO NOTHING`;

async function syncStationCycles(shift: ShiftWindow, updateLastTime: boolean) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialkan sinkronisasi untuk shift yang sama (cegah race antar layar)
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `hotpress-sync:${shift.shiftId}:${shift.date}`,
    ]);
    await client.query(UPDATE_SQL, [
      shift.startStr,
      shift.endStr,
      shift.shiftId,
      updateLastTime,
      DEFAULT_CVT,
    ]);
    await client.query(INSERT_SQL, [
      shift.startStr,
      shift.endStr,
      shift.shiftId,
      DEFAULT_CVT,
      DEFAULT_TARGET_CYCLE,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------------
// 2. INSIGHT BULANAN (dari machine_process_log, bukan press_station_cycle,
//    supaya lengkap walau shift lama belum pernah dibuka/disinkronkan)
// ----------------------------------------------------------------------

interface MonthRow {
  mc: string;
  prod_date: string;
  shift_code: string;
  actual: string;
}

const MONTH_CACHE_TTL_MS = 60_000;
const monthCache = new Map<string, { at: number; rows: MonthRow[] }>();

async function getMonthRows(date: string): Promise<MonthRow[]> {
  const key = date.slice(0, 7);
  const hit = monthCache.get(key);
  if (hit && Date.now() - hit.at < MONTH_CACHE_TTL_MS) return hit.rows;

  const rows = await dbSelect<MonthRow>(
    `SELECT m.machine_code AS mc,
            DATE(l.event_time - INTERVAL '7 hours')::text AS prod_date,
            sh.shift_code,
            COUNT(*) AS actual
     FROM machine_process_log l
     JOIN machine m ON m.machine_id = l.machine_id
     JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'HOTPRESS'
     JOIN shift sh ON sh.shift_id = l.shift_id
     WHERE l.event_time >= date_trunc('month', $1::date)
       AND l.event_time <  date_trunc('month', $1::date) + INTERVAL '1 month'
     GROUP BY m.machine_code, DATE(l.event_time - INTERVAL '7 hours'), sh.shift_code
     ORDER BY m.machine_code, prod_date, sh.shift_code`,
    [date]
  );
  monthCache.set(key, { at: Date.now(), rows });
  return rows;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-07" -> "07 Oct 2026" (sama seperti date('d M Y') di PHP) */
function fmtDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTH_ABBR[Number(m) - 1]} ${y}`;
}

function buildMonthly(rows: MonthRow[]) {
  let highest: MonthRecord = { mc: "-", val: 0, date: "-", shift: "-" };
  let lowest: MonthRecord = { mc: "-", val: 999999, date: "-", shift: "-" };
  let totalMonth = 0;
  const shiftTotals = new Map<string, number>();
  const shiftDays = new Map<string, Set<string>>();

  for (const r of rows) {
    const val = Number(r.actual) * DEFAULT_CVT;
    totalMonth += val;
    const dateFmt = fmtDMY(r.prod_date);
    if (val > highest.val) highest = { mc: r.mc, val, date: dateFmt, shift: r.shift_code };
    if (val > 0 && val < lowest.val) lowest = { mc: r.mc, val, date: dateFmt, shift: r.shift_code };

    shiftTotals.set(r.shift_code, (shiftTotals.get(r.shift_code) ?? 0) + val);
    if (!shiftDays.has(r.shift_code)) shiftDays.set(r.shift_code, new Set());
    shiftDays.get(r.shift_code)!.add(r.prod_date);
  }
  if (lowest.val === 999999) lowest = { ...lowest, val: 0 };

  let most = { shift: "-", avg: 0 };
  let least = { shift: "-", avg: 999999 };
  for (const sc of [...shiftTotals.keys()].sort()) {
    const days = shiftDays.get(sc)?.size ?? 0;
    if (days === 0) continue;
    const avg = Math.round(shiftTotals.get(sc)! / days);
    if (avg > most.avg) most = { shift: sc, avg };
    if (avg < least.avg) least = { shift: sc, avg };
  }
  if (least.avg === 999999) least = { ...least, avg: 0 };

  return { highest, lowest, most, least, totalMonth };
}

// ----------------------------------------------------------------------
// 3. HANDLER
// ----------------------------------------------------------------------

interface LogRow {
  machine_id: number;
  ts: string;
  cycle_time_sec: string | null; // NUMERIC -> string dari pg
}

interface StationRow {
  machine_id: number;
  station_no: number;
  target_cycle: number | null;
  actual_cycle: number | null;
  target_pcs: number | null;
  actual_pcs: number | null;
  start_ts: string | null;
  last_ts: string | null;
  part_number: string | null;
  operator_name: string | null;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Mesin dengan nilai sama dengan `target` (hanya jika > 0), digabung koma. */
function machinesWith(values: Map<string, number>, target: number): string {
  const out: string[] = [];
  for (const [mc, v] of values) if (v === target && v > 0) out.push(mc);
  return out.join(", ");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = normalizeDate(searchParams.get("date"));
  const shiftCode = normalizeShiftCode(searchParams.get("shift"));

  try {
    const shift = await getShiftWindow(date, shiftCode);
    if (!shift) {
      return NextResponse.json({ error: `Shift tidak dikenali: ${shiftCode}` }, { status: 400 });
    }

    const nowTs = nowWallEpoch();
    const isLive = nowTs >= shift.startEpoch && nowTs < shift.endEpoch;

    // 1. Sinkronisasi log -> press_station_cycle
    await syncStationCycles(shift, nowTs < shift.endEpoch);

    // 2. Mesin HOTPRESS
    const machines = await dbSelect<{ machine_id: number; machine_code: string }>(
      `SELECT m.machine_id, m.machine_code
       FROM machine m
       JOIN process_stage s ON s.stage_id = m.stage_id
       WHERE s.stage_code = 'HOTPRESS'
       ORDER BY m.machine_code`
    );

    // 3. Log mesin (untuk grafik & deteksi breakdown) + detail stasiun
    const logRows = await dbSelect<LogRow>(
      `SELECT l.machine_id,
              floor(EXTRACT(EPOCH FROM l.event_time))::bigint AS ts,
              l.cycle_time_sec
       FROM machine_process_log l
       JOIN machine m ON m.machine_id = l.machine_id
       JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'HOTPRESS'
       WHERE l.event_time >= $1 AND l.event_time < $2
       ORDER BY l.machine_id, l.event_time`,
      [shift.startStr, shift.endStr]
    );
    const logsByMachine = new Map<number, { ts: number; cycle: number }[]>();
    for (const r of logRows) {
      const list = logsByMachine.get(r.machine_id) ?? [];
      list.push({ ts: Number(r.ts), cycle: Number(r.cycle_time_sec ?? 0) });
      logsByMachine.set(r.machine_id, list);
    }

    const stationRows = await dbSelect<StationRow>(
      `SELECT psc.machine_id, psc.station_no, psc.target_cycle, psc.actual_cycle,
              psc.target_pcs, psc.actual_pcs,
              floor(EXTRACT(EPOCH FROM psc.start_time))::bigint AS start_ts,
              floor(EXTRACT(EPOCH FROM psc.last_time))::bigint AS last_ts,
              p.part_number, o.operator_name
       FROM press_station_cycle psc
       LEFT JOIN part p ON p.part_id = psc.part_id
       LEFT JOIN operator o ON o.operator_id = psc.operator_id
       WHERE psc.shift_id = $1 AND psc.start_time >= $2 AND psc.start_time < $3
       ORDER BY psc.cycle_id`,
      [shift.shiftId, shift.startStr, shift.endStr]
    );
    const stationsByMachine = new Map<number, Map<number, StationRow>>();
    for (const r of stationRows) {
      const byStation = stationsByMachine.get(r.machine_id) ?? new Map<number, StationRow>();
      byStation.set(Number(r.station_no), r); // baris terakhir menang (sama seperti PHP)
      stationsByMachine.set(r.machine_id, byStation);
    }

    // 4. Detail per mesin
    const limitTs = isLive ? nowTs : shift.endEpoch;
    const shiftOutputs = new Map<string, number>();
    const shiftCycles = new Map<string, number>();
    let running = 0;
    let breakdown = 0;
    let off = 0;
    let globalStart: number | null = null;
    let globalLast: number | null = null;
    let totalKpiActualCycle = 0;
    let totalKpiPlan = 0;
    const machineDetails: HotpressMachine[] = [];

    for (const m of machines) {
      const mc = m.machine_code;
      const logs = logsByMachine.get(m.machine_id) ?? [];
      const stations = stationsByMachine.get(m.machine_id) ?? new Map<number, StationRow>();

      let hasBreakdown = false;
      const bdHistory: string[] = [];
      const graphData: CycleGraphPoint[] = [];
      let totalMcTime = 0;
      let totalCycleTime = 0;

      if (logs.length > 0) {
        const firstTs = logs[0].ts;
        const lastTs = logs[logs.length - 1].ts;
        if (globalStart === null || firstTs < globalStart) globalStart = firstTs;
        if (globalLast === null || lastTs > globalLast) globalLast = lastTs;

        let prevTs = shift.startEpoch;
        logs.forEach((rec, idx) => {
          if (rec.ts - prevTs > BREAKDOWN_GAP_SEC) {
            hasBreakdown = true;
            bdHistory.push(`${fmtHm(prevTs)} - ${fmtHm(rec.ts)}`);
          }
          const machineTime = idx === 0 ? rec.cycle : rec.ts - prevTs;
          totalMcTime += machineTime;
          totalCycleTime += rec.cycle;
          graphData.push({
            pcs: String(idx + 1),
            machine_time: round1(machineTime),
            cycle_time: round1(rec.cycle),
          });
          prevTs = rec.ts;
        });
        if (limitTs - prevTs > BREAKDOWN_GAP_SEC) {
          hasBreakdown = true;
          bdHistory.push(`${fmtHm(prevTs)} - ${fmtHm(limitTs)}`);
        }
      }

      const avgMcTime = logs.length > 0 ? round1(totalMcTime / logs.length) : 0;
      const avgCycleTime = logs.length > 0 ? round1(totalCycleTime / logs.length) : 0;

      const shafts = {} as Record<"1" | "2" | "3" | "4", ShaftData>;
      let mcActualPcs = 0;
      for (let s = 1; s <= 4; s++) {
        const key = String(s) as "1" | "2" | "3" | "4";
        let data: ShaftData = {
          partno: "-",
          operator: "-",
          target: 0,
          actual_pcs: 0,
          ach: 0,
          start: "-",
          last: "-",
        };
        const row = stations.get(s);
        if (row) {
          const target = Number(row.target_pcs ?? 0);
          const actual = Number(row.actual_pcs ?? 0);
          let ach = target > 0 ? round1((actual / target) * 100) : 0;
          if (ach > 100) ach = 100;
          data = {
            partno: row.part_number || "-",
            operator: row.operator_name || "-",
            target,
            actual_pcs: actual,
            ach,
            start: row.start_ts ? fmtHms(Number(row.start_ts)) : "-",
            last: row.last_ts ? fmtHms(Number(row.last_ts)) : "-",
          };
          totalKpiActualCycle += Number(row.actual_cycle ?? 0);
          totalKpiPlan += Number(row.target_cycle ?? 0);
        }
        shafts[key] = data;
        mcActualPcs += data.actual_pcs;
      }

      if (logs.length > 0 || stations.size > 0) {
        shiftOutputs.set(mc, mcActualPcs);
        shiftCycles.set(mc, avgCycleTime);
      }

      const lastEventTs = logs.length > 0 ? logs[logs.length - 1].ts : shift.startEpoch;
      const isCurrentlyBd = limitTs - lastEventTs > BREAKDOWN_GAP_SEC;
      const isCurrentlyOff = logs.length === 0 && stations.size === 0;

      if (isCurrentlyOff) {
        off++;
      } else if (isLive) {
        if (isCurrentlyBd) breakdown++;
        else running++;
      } else {
        running++;
        if (hasBreakdown) breakdown++;
      }

      let status: HotpressMachineStatus = "OFF";
      if (!isCurrentlyOff) {
        const bd = isLive ? isCurrentlyBd : hasBreakdown;
        status = bd ? "RUNNING_BD" : "RUNNING";
      }

      machineDetails.push({
        mc,
        status,
        shafts,
        bd_history: bdHistory,
        graph_data: graphData,
        avg_machine_time: avgMcTime,
        avg_cycle_time: avgCycleTime,
      });
    }

    machineDetails.sort((a, b) => (a.mc < b.mc ? -1 : a.mc > b.mc ? 1 : 0));

    let achRate = totalKpiPlan > 0 ? round1((totalKpiActualCycle / totalKpiPlan) * 100) : 0;
    if (achRate > 100) achRate = 100;

    // 5. Ticker (insight shift ini)
    const outputs = [...shiftOutputs.values()];
    const nonZeroOutputs = outputs.filter((v) => v > 0);
    const cycles = [...shiftCycles.values()];
    const nonZeroCycles = cycles.filter((v) => v > 0);

    const highOut = outputs.length > 0 ? Math.max(...outputs) : 0;
    const lowOut = nonZeroOutputs.length > 0 ? Math.min(...nonZeroOutputs) : 0;
    const fastCyc = nonZeroCycles.length > 0 ? Math.min(...nonZeroCycles) : 0;
    const slowCyc = cycles.length > 0 ? Math.max(...cycles) : 0;

    const list = (mcs: string, val: number): MachineListValue => ({ mc: mcs, val });

    // 6. Insight bulanan
    const month = buildMonthly(await getMonthRows(date));

    const ticker: HotpressTicker = {
      high_out_shift: list(machinesWith(shiftOutputs, highOut), highOut),
      low_out_shift: list(machinesWith(shiftOutputs, lowOut), lowOut),
      fast_cyc_shift: list(machinesWith(shiftCycles, fastCyc), fastCyc),
      slow_cyc_shift: list(machinesWith(shiftCycles, slowCyc), slowCyc),
      highest_month_record: month.highest,
      lowest_month_record: month.lowest,
      most_prod_shift: month.most,
      least_prod_shift: month.least,
      total_month: month.totalMonth,
    };

    return NextResponse.json({
      punya_data: totalKpiActualCycle > 0,
      kpi: {
        plan: totalKpiPlan,
        actual: totalKpiActualCycle,
        gap: Math.max(0, totalKpiPlan - totalKpiActualCycle),
        ach: achRate,
        waktu_mulai: globalStart !== null ? fmtHms(globalStart) : "--:--:--",
        waktu_selesai: globalLast !== null ? fmtHms(globalLast) : "--:--:--",
      },
      status: { run: running, bd: breakdown, off },
      ticker_data: ticker,
      machines: machineDetails,
    });
  } catch (error) {
    console.error("Hotpress API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}