"use client";

import { useCallback, useEffect, useState } from "react";
import { GRANULARITIES, REPORT_STAGE_CODES, isReportError, type Granularity, type ReportResponse, type ReportStageCode } from "@/types/report";
import StageSection from "./components/StageSection";
import PmcTitle from "@/components/PmcTitle";
import pmcLogo from "@/assets/logo-pmc.webp";

const STAGE_LABEL: Record<ReportStageCode, string> = { DRILLING: "Drilling", HOTPRESS: "Hot Press" };

/** Tanggal kalender Jakarta, terlepas dari timezone browser. */
function jakartaToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

const field: React.CSSProperties = { padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 };
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "#475569" };

export default function ReportView() {
  const today = jakartaToday();
  const [granularity, setGranularity] = useState<Granularity>("harian");
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [stages, setStages] = useState<ReportStageCode[]>([...REPORT_STAGE_CODES]);

  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (g: Granularity, f: string, t: string, s: ReportStageCode[]) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ granularity: g, from: f, to: t, stages: s.join(",") });
      const res = await fetch(`/api/report?${qs.toString()}`);
      if (res.status === 401) {
        window.location.href = "/login?redirect=/report";
        return;
      }
      const json = await res.json();
      if (isReportError(json)) {
        setError(json.error);
        return;
      }
      setData(json as ReportResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat laporan bawaan (bulan berjalan, semua seksi) saat halaman dibuka
  useEffect(() => {
    load("harian", `${today.slice(0, 8)}01`, today, [...REPORT_STAGE_CODES]);
  }, [load, today]);

  function toggleStage(code: ReportStageCode) {
    setStages((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return setError("Tanggal awal dan akhir wajib diisi.");
    if (from > to) return setError("Tanggal awal tidak boleh setelah tanggal akhir.");
    if (stages.length === 0) return setError("Pilih minimal satu seksi.");
    load(granularity, from, to, stages);
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <header>
        <PmcTitle title="Laporan Produksi" crumb="Laporan" logo={pmcLogo} />
      </header>

      <form
        onSubmit={onSubmit}
        className="no-print"
        style={{ background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.08)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label style={label}>
          Granularitas
          <select aria-label="Granularitas" value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)} style={field}>
            {GRANULARITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label style={label}>
          Dari tanggal
          <input type="date" aria-label="Dari tanggal" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={field} />
        </label>
        <label style={label}>
          Sampai tanggal
          <input type="date" aria-label="Sampai tanggal" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={field} />
        </label>

        <fieldset style={{ border: "none", padding: 0, margin: 0, ...label }}>
          <legend style={{ padding: 0, marginBottom: 4 }}>Seksi</legend>
          <div style={{ display: "flex", gap: 14, padding: "6px 0" }}>
            {REPORT_STAGE_CODES.map((code) => (
              <label key={code} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                <input type="checkbox" checked={stages.includes(code)} onChange={() => toggleStage(code)} />
                {STAGE_LABEL[code]}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: loading ? "#94a3b8" : "#1e3a8a", color: "#fff", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "MEMUAT..." : "TAMPILKAN"}
        </button>
      </form>

      {error && (
        <div role="alert" style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s", display: "flex", flexDirection: "column", gap: 28 }}>
        {data?.sections.map((s) => (
          <StageSection key={s.stage_code} section={s} from={data.date_from} to={data.date_to} />
        ))}
        {!data && !error && loading && <p style={{ color: "#64748b" }}>Memuat laporan...</p>}
      </div>
    </div>
  );
}