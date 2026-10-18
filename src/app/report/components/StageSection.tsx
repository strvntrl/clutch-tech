"use client";

import { useMemo } from "react";
import { buildAnalysis, buildChart } from "@/lib/report/analysis";
import type { ReportSection, TextSegment, Tone } from "@/types/report";
import { AchievementChart, BreakdownChart, NgChart, ProductionChart } from "./ReportCharts";
import DetailTable from "./DetailTable";

interface Props {
  section: ReportSection;
  from: string;
  to: string;
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const TONE_COLOR: Record<Tone, string> = { green: "#15803d", red: "#b91c1c", yellow: "#a16207", blue: "#1d4ed8" };

function Sentence({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((s, i) => (
        <span key={i} style={{ color: s.tone ? TONE_COLOR[s.tone] : undefined, fontWeight: s.tone || s.bold ? 700 : undefined }}>
          {s.text}
        </span>
      ))}
    </>
  );
}

function Kpi({ label, value, color, unit }: { label: string; value: string | number; color: string; unit?: string }) {
  return (
    <div style={{ flex: "1 1 150px", background: "#fff", borderRadius: 10, padding: "12px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>
        {value}
        {unit && <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}> {unit}</span>}
      </div>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card, flex: "1 1 460px", minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e3a8a" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function StageSection({ section, from, to }: Props) {
  const { kpi, rows } = section;
  const chart = useMemo(() => buildChart(rows), [rows]);
  const a = useMemo(() => buildAnalysis(chart, kpi), [chart, kpi]);
  const hasData = rows.length > 0;
  const hasBreakdown = section.akar.length > 0 || section.mesin.length > 0;

  return (
    <section data-stage={section.stage_code} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", borderBottom: "3px solid #1e3a8a", paddingBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a8a" }}>{section.stage_name.toUpperCase()}</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {from} s/d {to} · {rows.length} baris
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Kpi label="TOTAL IOT" value={kpi.total_iot.toLocaleString("id-ID")} color="#2563eb" unit="pcs" />
        <Kpi label="TOTAL ACTUAL" value={kpi.total_actual.toLocaleString("id-ID")} color="#16a34a" unit="pcs" />
        <Kpi label="TOTAL NG" value={kpi.total_ng.toLocaleString("id-ID")} color="#dc2626" unit="pcs" />
        <Kpi label="TOTAL TARGET" value={kpi.total_target.toLocaleString("id-ID")} color="#7c3aed" unit="pcs" />
        <Kpi label="ACHIEVEMENT (ACTUAL ÷ TARGET)" value={`${kpi.achievement}%`} color="#ea580c" />
      </div>

      {hasData && (
        <div style={{ ...card, background: "#f8fafc", borderLeft: "5px solid #1e3a8a", lineHeight: 1.7, fontSize: 14 }}>
          <div style={{ fontWeight: 800, color: "#1e3a8a", marginBottom: 4 }}>Ringkasan Eksekutif</div>
          <p style={{ margin: "0 0 6px" }}>
            {a.hasAch ? (
              <>
                Rata-rata pencapaian produksi (Actual ÷ IOT) pada periode ini sebesar{" "}
                <strong style={{ color: TONE_COLOR[a.achTone] }}>{a.avgAch}%</strong> ({a.achStatus}),{" "}
              </>
            ) : (
              <>Pencapaian produksi (Actual ÷ IOT) </>
            )}
            <Sentence segments={a.trendSentence} /> <Sentence segments={a.ngSentence} />
          </p>
          <p style={{ margin: 0 }}>
            <strong>Rekomendasi:</strong> {a.recommendation}
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Panel title="Tren Produksi" sub={hasData ? `Rata-rata IOT ${a.avgIot.toLocaleString("id-ID")} · Actual ${a.avgActual.toLocaleString("id-ID")} per periode` : undefined}>
          <ProductionChart data={chart} />
        </Panel>
        <Panel title="Tren NG" sub={hasData ? `Total NG ${kpi.total_ng.toLocaleString("id-ID")} pcs · NG rate ${a.ngRate}%` : undefined}>
          <NgChart data={chart} />
        </Panel>
        <Panel
          title="Pencapaian (Actual ÷ IOT)"
          sub={hasData ? (a.hasAch ? `Rata-rata ${a.avgAch}% · tren ${a.trend.toLowerCase()}` : "Data IOT tidak tersedia pada periode ini") : undefined}
        >
          <AchievementChart data={chart} />
        </Panel>
      </div>

      {hasBreakdown && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Panel title="Akar Masalah" sub="Jumlah kejadian per kategori keterangan">
            <BreakdownChart items={section.akar} color="#ea580c" emptyText="Tidak ada keterangan masalah." />
          </Panel>
          <Panel title="Mesin Bermasalah" sub="Jumlah kejadian per mesin">
            <BreakdownChart items={section.mesin} color="#dc2626" emptyText="Tidak ada mesin bermasalah." />
          </Panel>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1e3a8a", marginBottom: 10 }}>Detail Laporan Produksi</div>
        <DetailTable rows={rows} />
      </div>
    </section>
  );
}