"use client";

import { useCallback, useEffect, useState } from "react";
import KpiCards from "./components/KpiCards";
import MachineGrid from "./components/MachineGrid";
import MonitorHeader from "@/components/MonitorHeader";
import AchievementChart from "./components/AchievementChart";
import {
  SHIFT_OPTIONS,
  getCurrentShiftState,
  isPreformingError,
  type PreformingApiResponse,
  type PreformingSuccessResponse,
} from "@/types/preforming";

const REFRESH_MS = 10_000;

export default function PreformingDashboard() {
  const initial = getCurrentShiftState();
  const [date, setDate] = useState(initial.date);
  const [shift, setShift] = useState(initial.shift);

  const [data, setData] = useState<PreformingSuccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/preforming?date=${date}&shift=${shift}`);
      const json: PreformingApiResponse = await res.json();

      if (isPreformingError(json)) {
        setError(json.error);
        return;
      }
      setData(json);
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
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const ticker = data?.ticker_data?.[0] ?? "Loading data...";

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
        area="preforming"
        date={date}
        onDateChange={setDate}
        shift={shift}
        onShiftChange={setShift}
        shiftOptions={SHIFT_OPTIONS}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>
          START: <strong>{data?.kpi.waktu_mulai ?? "--:--:--"}</strong>
        </span>
        <span style={{ color: "#555" }}>{ticker}</span>
        <span>
          LAST: <strong>{data?.kpi.waktu_selesai ?? "--:--:--"}</strong>
        </span>
      </div>

      {error && (
        <div
          style={{
            background: "#fdecea",
            color: "#c62828",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          Gagal memuat data: {error}
        </div>
      )}

      <KpiCards kpi={data?.kpi ?? null} />

      <section
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 16,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>
          Actual vs Target per Mesin
        </h2>
        <AchievementChart machines={data?.machines ?? []} />
      </section>

      <section
        style={{
          background: "#f6f7f9",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>
          Preforming Machines (Side A &amp; B)
        </h2>
        <MachineGrid machines={data?.machines ?? []} />
      </section>

      {loading && !data && <p style={{ color: "#888" }}>Memuat data awal...</p>}
    </div>
  );
}