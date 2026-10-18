"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BreakdownItem, ChartPoint } from "@/types/report";

const HEIGHT = 280;
const xAxisProps = {
  dataKey: "periode",
  tick: { fontSize: 11 },
  interval: "preserveStartEnd" as const,
  minTickGap: 18,
};

function Empty({ text }: { text: string }) {
  return (
    <div style={{ height: HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
      {text}
    </div>
  );
}

/** Tren produksi: Actual (batang) vs IOT (garis). */
export function ProductionChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return <Empty text="Belum ada data." />;
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis {...xAxisProps} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend verticalAlign="top" height={28} />
        <Bar isAnimationActive={false} dataKey="actual" name="Actual" fill="#16a34a" radius={[3, 3, 0, 0]} />
        <Line isAnimationActive={false} type="monotone" dataKey="iot" name="IOT" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Tren NG: jumlah NG (batang) dan NG rate % (garis, sumbu kanan). */
export function NgChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return <Empty text="Belum ada data." />;
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis {...xAxisProps} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
        <Tooltip />
        <Legend verticalAlign="top" height={28} />
        <Bar isAnimationActive={false} yAxisId="left" dataKey="ng" name="NG (pcs)" fill="#dc2626" radius={[3, 3, 0, 0]} />
        <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="ngRate" name="NG rate (%)" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Pencapaian (Actual ÷ IOT) per periode + garis regresi linear + ambang 90%. */
export function AchievementChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return <Empty text="Belum ada data." />;
  const top = Math.max(110, ...data.map((d) => d.ach ?? 0));
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 18, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis {...xAxisProps} />
        <YAxis tick={{ fontSize: 11 }} domain={[0, Math.ceil(top / 10) * 10]} unit="%" />
        <Tooltip />
        <Legend verticalAlign="top" height={28} />
        <ReferenceLine y={90} stroke="#d97706" strokeDasharray="5 4" label={{ value: "Target 90%", position: "insideTopRight", fontSize: 11, fill: "#d97706" }} />
        <Line isAnimationActive={false} connectNulls={false} type="monotone" dataKey="ach" name="Pencapaian (%)" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }}>
          {data.length <= 16 && <LabelList dataKey="ach" position="top" fontSize={10} formatter={(v: unknown) => (v === null || v === undefined ? "" : `${v}%`)} />}
        </Line>
        <Line isAnimationActive={false} type="linear" dataKey="regresi" name="Tren (regresi)" stroke="#ea580c" strokeWidth={2} strokeDasharray="6 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Batang horizontal untuk akar masalah / mesin bermasalah. */
export function BreakdownChart({ items, color, emptyText }: { items: BreakdownItem[]; color: string; emptyText: string }) {
  if (items.length === 0) return <Empty text={emptyText} />;
  const height = Math.max(HEIGHT - 40, items.length * 34 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 5, right: 28, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar isAnimationActive={false} dataKey="count" name="Jumlah kejadian" fill={color} radius={[0, 3, 3, 0]}>
          <LabelList dataKey="count" position="right" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}