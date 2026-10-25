"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KpiCards from "./components/KpiCards";
import MachineGrid from "./components/MachineGrid";
import MonitorHeader from "@/components/MonitorHeader";
import type { HeaderUser } from "@/components/UserStatus";
import AchievementChart from "./components/AchievementChart";
import {
  SHIFTS,
  getSystemShiftState,
  isHistoryView,
  maxSelectableShift,
} from "@/lib/shift-ui";
import {
  isPreformingError,
  type PreformingApiResponse,
  type PreformingSuccessResponse,
} from "@/types/preforming";

const REFRESH_MS = 10_000;

export default function PreformingDashboard({ user }: { user: HeaderUser | null }) {
  const initial = getSystemShiftState();
  const [date, setDate] = useState(initial.date);
  const [shift, setShift] = useState(initial.shift);

  const [data, setData] = useState<PreformingSuccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sysRef = useRef(initial); // hari produksi + shift "live" terakhir yang kita ketahui

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

  // Muat data tiap kali tanggal/shift berubah
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Polling + deteksi pergantian shift. Mode riwayat tidak perlu polling.
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
  const maxShift = maxSelectableShift(date);

  function onDateChange(newDate: string) {
    if (!newDate) return;
    const max = maxSelectableShift(newDate);
    setDate(newDate);
    if (parseInt(shift.replace("Shift-", ""), 10) > max) setShift(`Shift-${max}`);
  }

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