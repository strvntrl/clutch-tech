"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KpiCards from "@/app/preforming/components/KpiCards";
import MonitorHeader from "@/components/MonitorHeader";
import type { HeaderUser } from "@/components/UserStatus";
import AchievementTable from "./components/AchievementTable";
import ShiftTrendChart from "./components/ShiftTrendChart";
import HistoricalPanel from "./components/HistoricalPanel";
import MachineGantt from "./components/MachineGantt";
import { InsightsList, InsightsTicker } from "./components/InsightsPanel";
import { buildInsights } from "./insights";
import {
  SHIFTS,
  achievementTitle,
  getSystemShiftState,
  isHistoryView,
  maxSelectableShift,
} from "@/lib/shift-ui";
import {
  isApiError,
  type DrillingAchievementResponse,
  type DrillingDowntimeResponse,
} from "@/types/drilling";

const REFRESH_MS = 5_000;

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
};

export default function DrillingDashboard({ user }: { user: HeaderUser | null }) {
  const initial = getSystemShiftState();
  const [date, setDate] = useState(initial.date);
  const [shift, setShift] = useState(initial.shift);

  const [ach, setAch] = useState<DrillingAchievementResponse | null>(null);
  const [dt, setDt] = useState<DrillingDowntimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState(false);
  const [graphicVisible, setGraphicVisible] = useState(true);
  const [showInsights, setShowInsights] = useState(false);
  const [filterMc, setFilterMc] = useState("ALL");

  const sysRef = useRef(initial); // hari produksi + shift "live" terakhir yang kita ketahui

  const load = useCallback(async () => {
    try {
      const q = `date=${date}&shift=${shift}`;
      const [aRes, dRes] = await Promise.all([
        fetch(`/api/drilling/achievement?${q}`),
        fetch(`/api/drilling/downtime?${q}`),
      ]);

      if (aRes.status === 401 || dRes.status === 401) {
        window.location.href = "/login?redirect=/drilling";
        return;
      }

      const a = await aRes.json();
      const d = await dRes.json();

      if (isApiError(a)) {
        setError(a.error);
        return;
      }
      setAch(a as DrillingAchievementResponse);
      setDt(isApiError(d) ? null : (d as DrillingDowntimeResponse));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [date, shift]);

  // Muat data tiap kali tanggal/shift berubah
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Polling + deteksi pergantian shift (menggantikan window.location.reload() di versi PHP)
  useEffect(() => {
    const id = setInterval(() => {
      const sys = getSystemShiftState();
      const prev = sysRef.current;
      sysRef.current = sys;

      if (sys.date !== prev.date || sys.shift !== prev.shift) {
        // Kalau pengguna sedang mengikuti shift live, pindah ke shift baru
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

  const insights = useMemo(
    () =>
      ach
        ? buildInsights(ach.machines, ach.data, ach.total_pcs, ach.monthly_data, dt?.data ?? [])
        : [],
    [ach, dt]
  );

  const target = ach?.kpi_target ?? 0;
  const actual = ach?.kpi_actual ?? 0;
  const kpi = {
    plan: target,
    actual,
    gap: Math.max(0, target - actual),
    ach: target > 0 ? Math.round((actual / target) * 100) : 0,
    waktu_mulai: ach?.start_time_val ?? "--:--:--",
    waktu_selesai: ach?.last_update ?? "--:--:--",
  };

  const maxHistory = ach
    ? Math.max(
        0,
        ...ach.machines.map(
          (mc) => ach.table_data.filter((r) => r.mc === mc).length - 1
        )
      )
    : 0;
  const showSeeAll = !history && maxHistory > 0;
  const tableShowAll = history || expanded;

  const noData = ach !== null && ach.total_pcs === 0 && isPastDate;

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
        area="drilling"
        date={date}
        onDateChange={onDateChange}
        maxDate={sys.date}
        shift={shift}
        onShiftChange={setShift}
        shiftOptions={SHIFTS.filter((s) => s.no <= maxShift)}
        user={user}
        extra={
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
          START: <strong>{kpi.waktu_mulai}</strong>
        </span>
        <InsightsTicker items={insights} />
        <span style={{ whiteSpace: "nowrap" }}>
          LAST: <strong>{kpi.waktu_selesai}</strong>
        </span>
      </div>

      {error && (
        <div style={{ background: "#fdecea", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>
          Gagal memuat data: {error}
        </div>
      )}
      {noData && (
        <div style={{ background: "#fff8e1", color: "#8d6e00", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>
          Data Drilling untuk tanggal dan shift ini tidak ditemukan.
        </div>
      )}

      <KpiCards kpi={kpi} />

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>{achievementTitle(date, shift)}</h2>
          <button
            onClick={() => setShowInsights((v) => !v)}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #0d47a1", background: showInsights ? "#0d47a1" : "#fff", color: showInsights ? "#fff" : "#0d47a1", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
          >
            DASHBOARD INSIGHTS
          </button>
        </div>

        {showInsights && (
          <div style={{ marginBottom: 14, padding: "4px 14px", background: "#f6f9ff", borderRadius: 8 }}>
            <InsightsList items={insights} />
          </div>
        )}

        {ach ? (
          <AchievementTable
            machines={ach.machines}
            rows={ach.table_data}
            machineState={ach.machine_state}
            showAll={tableShowAll}
          />
        ) : (
          <p style={{ color: "#888" }}>{loading ? "Memuat data awal..." : "Belum ada data."}</p>
        )}

        {showSeeAll && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ padding: "6px 22px", borderRadius: 20, border: "1px solid #1565c0", background: "#fff", color: "#1565c0", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
            >
              {expanded ? "HIDE ALL" : "SEE ALL"}
            </button>
          </div>
        )}
      </section>

      {graphicVisible && (
        <>
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>PRODUCTION TREND GRAPH IN THIS SHIFT</h2>
              <select value={filterMc} onChange={(e) => setFilterMc(e.target.value)} style={inputStyle}>
                <option value="ALL">ALL MACHINES</option>
                {(ach?.machines ?? []).map((mc) => (
                  <option key={mc} value={mc}>
                    {mc}
                  </option>
                ))}
              </select>
            </div>
            <ShiftTrendChart machines={ach?.machines ?? []} cells={ach?.data ?? []} filterMc={filterMc} />
          </section>

          <section style={card}>
            <HistoricalPanel filterDate={date} isPastDate={isPastDate} />
          </section>

          <section style={card}>
            <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>MACHINE STATUS</h2>
            <MachineGantt machines={ach?.machines ?? []} data={dt} />
          </section>
        </>
      )}

      <div style={{ textAlign: "center" }}>
        <button
          onClick={() => setGraphicVisible((v) => !v)}
          style={{ padding: "8px 24px", borderRadius: 20, border: "none", background: "#37474f", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          {graphicVisible ? "HIDE GRAPHIC ▲" : "SEE GRAPHIC ▼"}
        </button>
      </div>
    </div>
  );
}