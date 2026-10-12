"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CycleGraphPoint } from "@/types/hotpress";

interface Props {
  data: CycleGraphPoint[];
}

/** Waktu per siklus: Cycle Time (mesin) vs Machine Time (jarak antar siklus). */
export default function CycleChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={0} barCategoryGap="15%">
        <CartesianGrid strokeDasharray="3 3" stroke="#d6e4f5" />
        <XAxis dataKey="pcs" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={14} />
        <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} />
        <Tooltip />
        <Legend verticalAlign="bottom" height={28} />
        <Bar isAnimationActive={false} dataKey="cycle_time" name="Cycle Time" fill="#ff9800" radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="machine_time" name="Machine Time" fill="#1976d2" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}