import { NextRequest, NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import type { MachineStat, SideCode } from "@/types/preforming";

/**
 * GET /api/preforming?date=YYYY-MM-DD&shift=Shift-1
 *
 * Port dari view/addon/controller/preforming/api_preforming.php.
 * Logikanya dipertahankan sama persis:
 *   1. Cari jam mulai/selesai shift yang diminta (termasuk shift
 *      overnight yang melewati tengah malam).
 *   2. Siapkan daftar mesin PREFORMING, default OFF, target 200/sisi.
 *   3. Agregasi machine_process_log per mesin + sisi (station_no)
 *      dalam rentang waktu shift tsb.
 *   4. Hitung KPI (plan, actual, gap, achievement%) + status RUNNING/OFF.
 */

const TARGET_PER_SIDE = 200;

interface ShiftRow {
  shift_id: number;
  start_time: string; // format "HH:MM:SS" dari Postgres
  end_time: string;
  is_overnight: boolean;
}

interface MachineRow {
  machine_id: number;
  machine_code: string;
}

interface LogAggRow {
  machine_id: number;
  station_no: number | null;
  actual: string; // COUNT(*) datang sebagai string (bigint) dari pg
}

interface TimeRangeRow {
  waktu_mulai: string | null;
  waktu_selesai: string | null;
}

function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Tambah/kurang hari pada string tanggal "YYYY-MM-DD" tanpa isu timezone,
 *  karena hanya aritmatika kalender (pakai komponen UTC sebagai angka biasa). */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawDate = searchParams.get("date") ?? "";
  const date = isValidDateStr(rawDate)
    ? rawDate
    : new Date().toISOString().slice(0, 10);

  const rawShift = (searchParams.get("shift") ?? "Shift-1").replace(
    /[^a-zA-Z0-9-]/g,
    ""
  );
  const shiftCode = rawShift.toUpperCase();

  try {
    // ----------------------------------------------------------------
    // 1. Tentukan rentang waktu shift
    // ----------------------------------------------------------------
    const shiftRows = await dbSelect<ShiftRow>(
      `SELECT shift_id, start_time, end_time, is_overnight
       FROM shift WHERE shift_code = $1 LIMIT 1`,
      [shiftCode]
    );

    if (shiftRows.length === 0) {
      return NextResponse.json(
        { status: false, error: `Shift tidak dikenali: ${shiftCode}` },
        { status: 400 }
      );
    }
    const shift = shiftRows[0];

    const startTime = `${date} ${shift.start_time}`;
    const endDateStr = shift.is_overnight ? addDays(date, 1) : date;
    const endTime = `${endDateStr} ${shift.end_time}`;

    // ----------------------------------------------------------------
    // 2. Siapkan daftar mesin PREFORMING (default OFF)
    // ----------------------------------------------------------------
    const machineRows = await dbSelect<MachineRow>(
      `SELECT m.machine_id, m.machine_code
       FROM machine m
       JOIN process_stage s ON s.stage_id = m.stage_id
       WHERE s.stage_code = 'PREFORMING'
       ORDER BY m.machine_code`
    );

    const machines = new Map<number, MachineStat>();
    for (const m of machineRows) {
      machines.set(m.machine_id, {
        machine_id: m.machine_id,
        mc: m.machine_code,
        status: "OFF",
        A: { target: TARGET_PER_SIDE, actual: 0, ach: 0 },
        B: { target: TARGET_PER_SIDE, actual: 0, ach: 0 },
      });
    }

    // ----------------------------------------------------------------
    // 3. Agregasi log per mesin + sisi (station_no)
    // ----------------------------------------------------------------
    const logRows = await dbSelect<LogAggRow>(
      `SELECT l.machine_id, l.station_no, COUNT(*) AS actual
       FROM machine_process_log l
       JOIN machine m ON m.machine_id = l.machine_id
       JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'PREFORMING'
       WHERE l.event_time >= $1 AND l.event_time < $2
       GROUP BY l.machine_id, l.station_no`,
      [startTime, endTime]
    );

    let totalActual = 0;
    let totalPlan = 0;
    let highestOut = { mc: "-", val: 0 };

    for (const r of logRows) {
      const m = machines.get(r.machine_id);
      if (!m) continue;

      const side: SideCode = r.station_no === 2 ? "B" : "A";
      const actual = Number(r.actual);

      m.status = "RUNNING";
      m[side].actual = actual;
      m[side].ach = Math.round((actual / TARGET_PER_SIDE) * 1000) / 10;

      totalActual += actual;
      totalPlan += TARGET_PER_SIDE;

      if (actual > highestOut.val) {
        highestOut = { mc: `${m.mc}-${side}`, val: actual };
      }
    }

    // ----------------------------------------------------------------
    // 4. Jam mulai/selesai aktual (MIN/MAX event_time), diformat di SQL
    //    supaya tidak perlu urus parsing timezone Date di JS.
    // ----------------------------------------------------------------
    const timeRangeRows = await dbSelect<TimeRangeRow>(
      `SELECT to_char(MIN(l.event_time), 'HH24:MI:SS') AS waktu_mulai,
              to_char(MAX(l.event_time), 'HH24:MI:SS') AS waktu_selesai
       FROM machine_process_log l
       JOIN machine m ON m.machine_id = l.machine_id
       JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'PREFORMING'
       WHERE l.event_time >= $1 AND l.event_time < $2`,
      [startTime, endTime]
    );
    const timeRange = timeRangeRows[0];

    // ----------------------------------------------------------------
    // 5. Ringkasan
    // ----------------------------------------------------------------
    let running = 0;
    let off = 0;
    for (const m of machines.values()) {
      if (m.status === "RUNNING") running++;
      else off++;
    }

    let ach = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0;
    if (ach > 100) ach = 100;

    return NextResponse.json({
      punya_data: totalActual > 0,
      kpi: {
        plan: totalPlan,
        actual: totalActual,
        gap: Math.max(0, totalPlan - totalActual),
        ach,
        waktu_mulai: timeRange?.waktu_mulai ?? "--:--:--",
        waktu_selesai: timeRange?.waktu_selesai ?? "--:--:--",
      },
      status: { run: running, off },
      ticker_data: [
        `This shift has the highest output: ${highestOut.mc} REACHES ${highestOut.val} PCS`,
      ],
      machines: Array.from(machines.values()),
    });
  } catch (error) {
    console.error("Preforming API error:", error);
    return NextResponse.json(
      {
        status: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
