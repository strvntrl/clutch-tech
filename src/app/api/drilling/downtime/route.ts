import { NextRequest, NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { getShiftWindow, normalizeDate, normalizeShiftCode } from "@/lib/shift";
import { fmtDateTime, fmtHms, nowWallEpoch } from "@/lib/time";
import type { DowntimeBlock, DowntimeSummary } from "@/types/drilling";

/**
 * GET /api/drilling/downtime?date=YYYY-MM-DD&shift=Shift-1
 * Port dari view/addon/controller/drilling/get_downtime.php.
 *
 * Aturan: jarak antar event <= 60 detik = UPTIME, > 60 detik = DOWNTIME.
 * Event berurutan dengan status sama digabung jadi satu blok.
 */

const GAP_SEC = 60;
const COLOR_UP = "#80EF80";
const COLOR_DOWN = "#FF746C";

type Status = "UPTIME" | "DOWNTIME";

const colorOf = (s: Status) => (s === "UPTIME" ? COLOR_UP : COLOR_DOWN);

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

    const machineRows = await dbSelect<{ machine_code: string }>(
      `SELECT m.machine_code
       FROM machine m
       JOIN process_stage s ON s.stage_id = m.stage_id
       WHERE s.stage_code = 'DRILLING'
       ORDER BY m.machine_code`
    );
    const machines = machineRows.map((r) => r.machine_code);

    const logRows = await dbSelect<{ machine_code: string; ts: string }>(
      `SELECT m.machine_code,
              floor(EXTRACT(EPOCH FROM l.event_time))::bigint AS ts
       FROM machine_process_log l
       JOIN machine m ON m.machine_id = l.machine_id
       JOIN process_stage s ON s.stage_id = m.stage_id AND s.stage_code = 'DRILLING'
       WHERE l.event_time >= $1 AND l.event_time < $2
       ORDER BY m.machine_code, l.event_time`,
      [shift.startStr, shift.endStr]
    );

    const records = new Map<string, number[]>();
    for (const mc of machines) records.set(mc, []);
    for (const r of logRows) records.get(r.machine_code)?.push(Number(r.ts));

    // Batas waktu yang diproses (sadar real-time)
    const now = nowWallEpoch();
    let limitTime = Math.min(now, shift.endEpoch);
    if (shift.startEpoch > now) limitTime = shift.startEpoch;

    const finalData: DowntimeBlock[] = [];
    const summary: Record<string, DowntimeSummary> = {};

    for (const mc of machines) {
      let lastTime = shift.startEpoch;
      let currentStatus: Status | null = null;
      let blockStart = lastTime;
      let blockPcs = 0;
      let mcStartUptime: number | null = null;
      let mcLastUptime: number | null = null;
      let totalUptimeSec = 0;
      let totalPcs = 0;

      const pushBlock = (
        start: number,
        end: number,
        status: Status,
        pcs: number,
        color: string = colorOf(status)
      ) => {
        const duration = end - start;
        finalData.push({
          machine: mc,
          start: fmtDateTime(start),
          end: fmtDateTime(end),
          status,
          color,
          pcs,
          duration,
        });
        if (status === "UPTIME") {
          totalUptimeSec += duration;
          totalPcs += pcs;
        }
      };

      for (const t of records.get(mc) ?? []) {
        if (t > limitTime) break;

        const diff = t - lastTime;
        const status: Status = diff <= GAP_SEC ? "UPTIME" : "DOWNTIME";

        if (currentStatus === null) {
          currentStatus = status;
        } else if (currentStatus !== status) {
          pushBlock(blockStart, lastTime, currentStatus, blockPcs);
          blockStart = lastTime;
          currentStatus = status;
          blockPcs = 0;
        }
        blockPcs++;
        lastTime = t;
        if (mcStartUptime === null) mcStartUptime = t;
        mcLastUptime = t;
      }

      // Sisa waktu antara event terakhir dan batas waktu
      if (lastTime < limitTime) {
        const diff = limitTime - lastTime;
        const status: Status = diff <= GAP_SEC ? "UPTIME" : "DOWNTIME";
        if (currentStatus !== status) {
          if (currentStatus !== null && blockStart !== lastTime) {
            pushBlock(blockStart, lastTime, currentStatus, blockPcs);
          }
          blockStart = lastTime;
          currentStatus = status;
          blockPcs = 0;
        }
        lastTime = limitTime;
      }

      if (currentStatus !== null && blockStart < lastTime) {
        pushBlock(blockStart, lastTime, currentStatus, blockPcs);
      } else if (currentStatus === null) {
        if (limitTime > blockStart) {
          pushBlock(blockStart, limitTime, "DOWNTIME", 0, "#ef4444");
        }
      }

      summary[mc] = {
        start_uptime: mcStartUptime !== null ? fmtHms(mcStartUptime) : "-",
        last_uptime: mcLastUptime !== null ? fmtHms(mcLastUptime) : "-",
        avg_time: totalPcs > 0 ? Math.round((totalUptimeSec / totalPcs) * 10) / 10 : 0,
      };
    }

    return NextResponse.json({
      date,
      shift: shiftParam,
      start_shift: shift.startStr,
      end_shift: shift.endStr,
      data: finalData,
      summary,
    });
  } catch (error) {
    console.error("Drilling downtime error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}