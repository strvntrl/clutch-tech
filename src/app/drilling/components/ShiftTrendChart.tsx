"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HourlyCell } from "@/types/drilling";
import { colorFor, TARGET_COLOR } from "./palette";

interface Props {
  machines: string[];
  cells: HourlyCell[];
  filterMc: string; // "ALL" atau kode mesin
}

const DEFAULT_TARGET = 125;

/** "06:30" -> "07:30" (untuk label akhir bucket terakhir). */
function plusOneHour(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function ShiftTrendChart({ machines, cells, filterMc }: Props) {
  const jams = Array.from(new Set(cells.map((c) => c.jam)));
  const shown = filterMc === "ALL" ? machines : [filterMc];

  const data = jams.map((jam, idx) => {
    const next = jams[idx + 1] ?? plusOneHour(jam);
    const row: Record<string, number | string> = { time: `${jam}-${next}` };
    for (const mc of shown) {
      const cell = cells.find((c) => c.jam === jam && c.mc === mc);
      row[mc] = cell?.actual ?? 0;
    }
    // sama seperti versi lama: target 0 (jam belum berjalan) ditampilkan 125
    const targetCell = filterMc === "ALL" ? undefined : cells.find((c) => c.jam === jam && c.mc === filterMc);
    row.target = targetCell?.target || DEFAULT_TARGET;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="time" angle={-45} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} domain={[0, "auto"]} label={{ value: "Production (PCS)", angle: -90, position: "insideLeft", fontSize: 12 }} />
        <Tooltip />
        <Legend verticalAlign="top" height={30} />
        {shown.map((mc) => (
          <Line key={mc} isAnimationActive={false} type="monotone" dataKey={mc} name={mc} stroke={colorFor(machines, mc)} strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
        ))}
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="target"
          name={filterMc === "ALL" ? "Target/Machine" : "Target"}
          stroke={TARGET_COLOR}
          strokeWidth={3}
          strokeDasharray="5 5"
          dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}