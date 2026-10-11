"use client";

import { useEffect, useRef, useState } from "react";
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
import { isApiError, type DrillingTrendResponse, type TrendType } from "@/types/drilling";
import { colorFor, TARGET_COLOR } from "./palette";

interface Props {
  filterDate: string; // tanggal yang sedang dilihat di dashboard
  isPastDate: boolean; // true kalau filterDate bukan hari produksi ini
}

type UserMode = "now" | "monthly" | "yearly";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const selectStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #ccc",
};

function modeButton(active: boolean, disabled: boolean, color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    border: `1px solid ${color}`,
    background: active ? color : "#fff",
    color: active ? "#fff" : color,
    fontWeight: 700,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

export default function HistoricalPanel({ filterDate, isPastDate }: Props) {
  const nowYear = new Date().getFullYear();

  const [mode, setMode] = useState<UserMode>("now");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(nowYear);
  const [picker, setPicker] = useState<null | "monthly" | "yearly">(null);
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftYear, setDraftYear] = useState(String(year));
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [result, setResult] = useState<DrillingTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterMc, setFilterMc] = useState("ALL");
  // true = fetch berikutnya hanya "kembali ke tampilan sebelumnya", jangan hapus notice
  const keepNoticeRef = useRef(false);

  // Tanggal lampau -> otomatis mode "history" (tombol dinonaktifkan)
  const effectiveType: TrendType = isPastDate ? "history" : mode;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ type: effectiveType });
    if (effectiveType === "history") params.set("date", filterDate);
    if (effectiveType === "monthly") {
      params.set("month", String(month));
      params.set("year", String(year));
    }
    if (effectiveType === "yearly") params.set("year", String(year));

    setLoading(true);
    fetch(`/api/drilling/trend?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (isApiError(json)) {
          setNotice(json.error);
          return;
        }
        const res = json as DrillingTrendResponse;
        if (res.total_data === 0 && (effectiveType === "monthly" || effectiveType === "yearly")) {
          setNotice("Tidak ada data produksi pada periode yang dipilih.");
          keepNoticeRef.current = true;
          setMode("now"); // kembali ke tampilan sebelumnya yang pasti ada
          return;
        }
        if (keepNoticeRef.current) keepNoticeRef.current = false;
        else setNotice(null);
        setResult(res);
      })
      .catch((e) => !cancelled && setNotice(e instanceof Error ? e.message : "Gagal memuat tren"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [effectiveType, filterDate, month, year]);

  function applyPicker() {
    const y = draftYear.trim();
    if (!/^\d{4}$/.test(y) || parseInt(y, 10) < 2000 || parseInt(y, 10) > 2100) {
      setPickerError("Tahun tidak valid. Masukkan 4 digit (contoh 2026).");
      return;
    }
    setPickerError(null);
    setYear(parseInt(y, 10));
    if (picker === "monthly") setMonth(draftMonth);
    setMode(picker as UserMode);
    setPicker(null);
  }

  const machines = result?.machines ?? [];
  const shown = filterMc === "ALL" ? machines : [filterMc];
  const showTarget = result?.type !== "yearly";
  const title = !result
    ? "PRODUCTION TREND GRAPH"
    : result.type === "yearly"
    ? `PRODUCTION TREND GRAPH IN ${result.year}`
    : `PRODUCTION TREND GRAPH IN ${result.month_name.toUpperCase()}, ${result.year}`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            disabled={isPastDate}
            onClick={() => setPicker(picker === "yearly" ? null : "yearly")}
            style={modeButton(effectiveType === "yearly", isPastDate, "#6a1b9a")}
          >
            YEARLY
          </button>
          <button
            disabled={isPastDate}
            onClick={() => setPicker(picker === "monthly" ? null : "monthly")}
            style={modeButton(effectiveType === "monthly", isPastDate, "#2e7d32")}
          >
            MONTHLY
          </button>
          <button
            disabled={isPastDate}
            onClick={() => {
              setMode("now");
              setPicker(null);
            }}
            style={modeButton(effectiveType === "now", isPastDate, "#1565c0")}
          >
            NOW
          </button>
          <select value={filterMc} onChange={(e) => setFilterMc(e.target.value)} style={selectStyle}>
            <option value="ALL">ALL MACHINES</option>
            {machines.map((mc) => (
              <option key={mc} value={mc}>
                {mc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {picker && !isPastDate && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: 12, marginBottom: 12, background: "#f6f7f9", borderRadius: 8 }}>
          {picker === "monthly" && (
            <select value={draftMonth} onChange={(e) => setDraftMonth(Number(e.target.value))} style={selectStyle}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <input
            value={draftYear}
            onChange={(e) => setDraftYear(e.target.value)}
            placeholder="YYYY"
            maxLength={4}
            style={{ ...selectStyle, width: 90, textAlign: "center", fontWeight: 700 }}
          />
          <button onClick={applyPicker} style={{ ...modeButton(true, false, "#1b5e20") }}>
            SEARCH
          </button>
          {pickerError && <span style={{ color: "#c62828", fontSize: 13 }}>{pickerError}</span>}
        </div>
      )}

      {notice && (
        <div style={{ background: "#fff8e1", color: "#8d6e00", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
          {notice}
        </div>
      )}

      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={result?.data ?? []} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={result?.type === "yearly" ? 0 : "preserveStartEnd"} />
            <YAxis tick={{ fontSize: 12 }} domain={[0, "auto"]} label={{ value: "Production (PCS)", angle: -90, position: "insideLeft", fontSize: 12 }} />
            <Tooltip />
            <Legend verticalAlign="top" height={30} />
            {shown.map((mc) => (
              <Line key={mc} isAnimationActive={false} type="monotone" dataKey={mc} name={mc} stroke={colorFor(machines, mc)} strokeWidth={3} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} />
            ))}
            {showTarget && (
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="target"
                name={filterMc === "ALL" ? "Target/Machine" : "Target"}
                stroke={TARGET_COLOR}
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}