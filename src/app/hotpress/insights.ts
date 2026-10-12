import type { HotpressTicker } from "@/types/hotpress";
import type { InsightItem } from "@/app/drilling/insights";

/** Daftar insight shift ini + bulan ini (sama dengan ticker di versi PHP). */
export function buildHotpressInsights(tk: HotpressTicker): InsightItem[] {
  const mc = (v: string) => v || "-";
  const m = tk.highest_month_record;
  const l = tk.lowest_month_record;

  return [
    {
      label: "THIS SHIFT HIGHEST OUTPUT",
      value: `${mc(tk.high_out_shift.mc)} (${tk.high_out_shift.val || 0} PCS)`,
    },
    {
      label: "THIS SHIFT LOWEST OUTPUT",
      value: `${mc(tk.low_out_shift.mc)} (${tk.low_out_shift.val || 0} PCS)`,
    },
    {
      label: "FASTEST AVG CYCLE TIME (THIS SHIFT)",
      value: `${mc(tk.fast_cyc_shift.mc)} (${tk.fast_cyc_shift.val || 0} SEC)`,
    },
    {
      label: "SLOWEST AVG CYCLE TIME (THIS SHIFT)",
      value: `${mc(tk.slow_cyc_shift.mc)} (${tk.slow_cyc_shift.val || 0} SEC)`,
    },
    {
      label: "THIS MONTH HIGHEST OUTPUT",
      value: `${mc(m.mc)} (${m.val || 0} PCS) ON ${m.date || "-"} (${m.shift || "-"})`,
    },
    {
      label: "THIS MONTH LOWEST OUTPUT",
      value: `${mc(l.mc)} (${l.val || 0} PCS) ON ${l.date || "-"} (${l.shift || "-"})`,
    },
    {
      label: "MOST PRODUCTIVE SHIFT (THIS MONTH)",
      value: `${tk.most_prod_shift.shift || "-"} (AVG ${tk.most_prod_shift.avg || 0} PCS/DAY)`,
    },
    {
      label: "LEAST PRODUCTIVE SHIFT (THIS MONTH)",
      value: `${tk.least_prod_shift.shift || "-"} (AVG ${tk.least_prod_shift.avg || 0} PCS/DAY)`,
    },
    { label: "TOTAL ACTUAL (THIS MONTH)", value: `${tk.total_month || 0} PCS` },
  ];
}