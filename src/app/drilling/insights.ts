import { formatDuration } from "@/lib/shift-ui";
import type {
  DowntimeBlock,
  HourlyCell,
  MonthlyInsight,
} from "@/types/drilling";

export interface InsightItem {
  label: string;
  value: string;
}

/** Total detik DOWNTIME suatu mesin, sebagai teks " | Downtime Duration: 1 H 5 M". */
function breakdownText(machine: string, blocks: DowntimeBlock[]): string {
  const sec = blocks
    .filter((b) => b.machine === machine && b.status === "DOWNTIME")
    .reduce((sum, b) => sum + b.duration, 0);
  return sec === 0 ? "" : ` | Downtime Duration: ${formatDuration(sec)}`;
}

export function buildInsights(
  machines: string[],
  cells: HourlyCell[],
  totalPcs: number,
  monthly: MonthlyInsight | null,
  downtime: DowntimeBlock[]
): InsightItem[] {
  const actual: Record<string, number> = {};
  const target: Record<string, number> = {};
  for (const mc of machines) {
    actual[mc] = 0;
    target[mc] = 0;
  }
  for (const c of cells) {
    actual[c.mc] += c.actual;
    target[c.mc] += c.target;
  }

  let highAct = -1;
  let lowAct = Infinity;
  let highMc = "-";
  let lowMc = "-";
  let validCount = 0;
  let arSum = 0;

  for (const mc of machines) {
    const act = actual[mc];
    const tgt = target[mc];
    if (act > highAct) {
      highAct = act;
      highMc = mc;
    }
    if (act < lowAct) {
      lowAct = act;
      lowMc = mc;
    }
    if (tgt > 0) {
      validCount++;
      arSum += Math.min(100, Math.floor((act / tgt) * 100));
    }
  }
  if (highAct === -1) highAct = 0;
  if (lowAct === Infinity) lowAct = 0;
  const avgAr = validCount > 0 ? Math.floor(arSum / validCount) : 0;

  const items: InsightItem[] = [
    {
      label: "THIS SHIFT HIGHEST OUTPUT",
      value: `${highMc} (${highAct} PCS${breakdownText(highMc, downtime)})`,
    },
    {
      label: "THIS SHIFT LOWEST OUTPUT",
      value: `${lowMc} (${lowAct} PCS${breakdownText(lowMc, downtime)})`,
    },
    { label: "TOTAL ACTUAL PRODUCTION", value: `${totalPcs} PCS` },
    { label: "AVERAGE ACHIEVEMENT RATE", value: `${avgAr}%` },
  ];

  if (monthly) {
    items.push(
      {
        label: "HIGHEST MACHINE (THIS MONTH)",
        value: `${monthly.top_mc.mc} (${monthly.top_mc.val} PCS) - DATE : ${monthly.top_mc.date} ${monthly.top_mc.shift}`,
      },
      {
        label: "LOWEST MACHINE (THIS MONTH)",
        value: `${monthly.low_mc.mc} (${monthly.low_mc.val} PCS) - DATE : ${monthly.low_mc.date} ${monthly.low_mc.shift}`,
      },
      {
        label: "HIGHEST CUMULATIVE ALL SHIFT (MONTH)",
        value: `DATE : ${monthly.high_cum.date} (${monthly.high_cum.total} PCS) | S1: ${monthly.high_cum.s1} PCS, S2: ${monthly.high_cum.s2} PCS, S3: ${monthly.high_cum.s3} PCS`,
      },
      {
        label: "LOWEST CUMULATIVE ALL SHIFT (MONTH)",
        value: `DATE : ${monthly.low_cum.date} (${monthly.low_cum.total} PCS) | S1: ${monthly.low_cum.s1} PCS, S2: ${monthly.low_cum.s2} PCS, S3: ${monthly.low_cum.s3} PCS`,
      },
      {
        label: "MOST PRODUCTIVE SHIFT",
        value: `${monthly.top_shift.name} (Avg: ${monthly.top_shift.avg} PCS/Day)`,
      },
      {
        label: "LOWEST PRODUCTIVE SHIFT",
        value: `${monthly.low_shift.name} (Avg: ${monthly.low_shift.avg} PCS/Day)`,
      },
      { label: "TOTAL ACTUAL (THIS MONTH)", value: `${monthly.total_month} PCS` }
    );
  }

  return items;
}