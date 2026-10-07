"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MachineStat } from "@/types/preforming";

interface Props {
  machines: MachineStat[];
}

export default function AchievementChart({ machines }: Props) {
  // Satu baris chart per mesin per sisi, misal "PF-01-A", "PF-01-B"
  const data = machines.flatMap((m) => [
    { name: `${m.mc}-A`, actual: m.A.actual, target: m.A.target },
    { name: `${m.mc}-B`, actual: m.B.actual, target: m.B.target },
  ]);

  if (data.length === 0) {
    return <p style={{ color: "#888" }}>Belum ada data untuk ditampilkan.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          interval={0}
          height={60}
          tick={{ fontSize: 11 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend verticalAlign="top" height={30} />
        <ReferenceLine y={200} stroke="#c62828" strokeDasharray="4 4" label={{ value: "Target 200", position: "right", fontSize: 11, fill: "#c62828" }} />
        <Bar dataKey="actual" name="Actual" fill="#2e7d32" radius={[4, 4, 0, 0]} />
        <Bar dataKey="target" name="Target" fill="#bdbdbd" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
