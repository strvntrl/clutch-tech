"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KpiCards from "@/app/preforming/components/KpiCards";
import MonitorHeader from "@/components/MonitorHeader";
import { InsightsList, InsightsTicker } from "@/app/drilling/components/InsightsPanel";
import MachineCard from "./components/MachineCard";
import StatusSummary, { type StatusKey } from "./components/StatusSummary";
import { buildHotpressInsights } from "./insights";
import {
  SHIFTS,
  getSystemShiftState,
  isHistoryView,
  maxSelectableShift,
} from "@/lib/shift-ui";
import { isHotpressError, type HotpressResponse } from "@/types/hotpress";

const REFRESH_MS = 15_000;
const STATUS_DETAIL_MS = 15_000;

const section: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  margin: "0 0 12px",
  color: "#0d47a1",
  letterSpacing: 0.5,
};

export default function HotpressDashboard() {
  const initial = getSystemShiftState();
  const [date, setDate] = useState(initial.date);
  const [shift, setShift] = useState(initial.shift);

  const [data, setData] = useState<HotpressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeStatus, setActiveStatus] = useState<StatusKey | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [bdOpen, setBdOpen] = useState<Record<string, boolean>>({});
  const [graphOpen, setGraphOpen] = useState<Record<string, boolean>>({});

  const sysRef = useRef(initial);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/hotpress?date=${date}&shift=${shift}`);
      if (res.status === 401) {
        window.location.href = "/login?redirect=/hotpress";
        return;
      }
      const json = await res.json();
      if (isHotpressError(json)) {
        setError(json.error);
        return;
      }
      setData(json as HotpressResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [date, shift]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Polling 15 detik + deteksi pergantian shift (pengganti window.location.reload() di PHP)
  useEffect(() => {
    const id = setInterval(() => {
      const sys = getSystemShiftState();
      const prev = sysRef.current;
      sysRef.current = sys;

      if (sys.date !== prev.date || sys.shift !== prev.shift) {
        if (date === prev.date && shift === prev.shift) {
          setDate(sys.date);
          setShift(sys.shift);
        }
        return;
      }
      if (!isHistoryView(date, shift)) load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [date, shift, load]);

  // Daftar mesin per status tertutup sendiri setelah 15 detik
  useEffect(() => {
    if (!activeStatus) return;
    const t = setTimeout(() => setActiveStatus(null), STATUS_DETAIL_MS);
    return () => clearTimeout(t);
  }, [activeStatus]);

  const sys = getSystemShiftState();
  const history = isHistoryView(date, shift);
  const isPastDate = date !== sys.date;
  const maxShift = maxSelectableShift(date);

  function onDateChange(newDate: string) {
    if (!newDate) return;
    const max = maxSelectableShift(newDate);
    setDate(newDate);
    if (parseInt(shift.replace("Shift-", ""), 10) > max) setShift(`Shift-${max}`);
  }

  const insights = useMemo(() => (data ? buildHotpressInsights(data.ticker_data) : []), [data]);

  const activeMachines = (data?.machines ?? []).filter((m) => m.status !== "OFF");
  const offMachines = (data?.machines ?? []).filter((m) => m.status === "OFF");
  const noData = data !== null && !data.punya_data && isPastDate;

  const renderCard = (m: (typeof activeMachines)[number]) => (
    <MachineCard
      key={m.mc}
      machine={m}
      bdOpen={!!bdOpen[m.mc]}
      graphOpen={!!graphOpen[m.mc]}
      onToggleBd={() => setBdOpen((s) => ({ ...s, [m.mc]: !s[m.mc] }))}
      onToggleGraph={() => setGraphOpen((s) => ({ ...s, [m.mc]: !s[m.mc] }))}
    />
  );

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
    gap: 14,
    alignItems: "start", // kartu tidak ikut memanjang saat grafik tetangganya dibuka
  };

  return (
    <div
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <MonitorHeader
        area="hotpress"
        date={date}
        onDateChange={onDateChange}
        maxDate={sys.date}
        shift={shift}
        onShiftChange={setShift}
        shiftOptions={SHIFTS.filter((s) => s.no <= maxShift)}
        extra={
          <>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 14,
                background: history ? "#eceff1" : "#e8f5e9",
                color: history ? "#546e7a" : "#2e7d32",
              }}
            >
              {history ? "HISTORY" : "● LIVE"}
            </span>
            <button
              onClick={() => setShowInsights((v) => !v)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #0d47a1", background: showInsights ? "#0d47a1" : "#fff", color: showInsights ? "#fff" : "#0d47a1", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              DASHBOARD INSIGHTS
            </button>
          </>
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "#fff",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          START: <strong>{data?.kpi.waktu_mulai ?? "--:--:--"}</strong>
        </span>
        <InsightsTicker items={insights} />
        <span style={{ whiteSpace: "nowrap" }}>
          LAST: <strong>{data?.kpi.waktu_selesai ?? "--:--:--"}</strong>
        </span>
      </div>

      {showInsights && (
        <div style={{ ...section, padding: "4px 18px" }}>
          <InsightsList items={insights} />
        </div>
      )}

      {error && (
        <div style={{ background: "#fdecea", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>
          Gagal memuat data: {error}
        </div>
      )}
      {noData && (
        <div style={{ background: "#fff8e1", color: "#8d6e00", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>
          Data Hotpress untuk tanggal dan shift ini tidak ditemukan.
        </div>
      )}

      <KpiCards kpi={data?.kpi ?? null} unit="CYCLE" />

      <section style={section}>
        <h2 style={sectionTitle}>MACHINE STATUS</h2>
        {data ? (
          <StatusSummary
            counts={data.status}
            machines={data.machines}
            history={history}
            active={activeStatus}
            onSelect={(k) => setActiveStatus((cur) => (cur === k ? null : k))}
          />
        ) : (
          <p style={{ color: "#888" }}>{loading ? "Memuat data awal..." : "Belum ada data."}</p>
        )}
      </section>

      <section style={{ ...section, background: "#f6f7f9" }}>
        <h2 style={sectionTitle}>MACHINE DETAIL</h2>

        {data && activeMachines.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontWeight: 700, color: "#c62828" }}>NO ACTIVE MACHINES</div>
        ) : (
          <div style={grid}>{activeMachines.map(renderCard)}</div>
        )}

        {offMachines.length > 0 && (
          <>
            <div style={{ textAlign: "center", margin: "16px 0 12px" }}>
              <button
                onClick={() => setShowOffline((v) => !v)}
                style={{ padding: "7px 22px", borderRadius: 20, border: "1px solid #455a64", background: "#fff", color: "#455a64", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                {showOffline ? `HIDE ${offMachines.length} OFFLINE MACHINES` : `SHOW ${offMachines.length} OFFLINE MACHINES`}
              </button>
            </div>
            {showOffline && <div style={grid}>{offMachines.map(renderCard)}</div>}
          </>
        )}

        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginTop: 16,
            padding: "10px 16px",
            background: "#fff8e1",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          <span style={{ color: "#8d6e00" }}>TOTAL CUMULATIVE</span>
          <span>
            TARGET <span style={{ color: "#4a148c" }}>{data?.kpi.plan ?? 0}</span>
          </span>
          <span>
            ACTUAL <span style={{ color: "#2e7d32" }}>{data?.kpi.actual ?? 0}</span>
          </span>
          <span>
            ACH% <span style={{ color: "#1565c0" }}>{data?.kpi.ach ?? 0}%</span>
          </span>
        </div>
      </section>
    </div>
  );
}