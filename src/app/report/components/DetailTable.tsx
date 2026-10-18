"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReportRow } from "@/types/report";

interface Props {
  rows: ReportRow[];
}

const PAGE_SIZES = [10, 25, 50, 100];

const th: React.CSSProperties = {
  padding: "9px 8px",
  fontSize: 12,
  background: "#1e3a8a",
  color: "#fff",
  textAlign: "center",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "7px 8px", fontSize: 13, borderBottom: "1px solid #eef0f3", textAlign: "center" };

const achOf = (r: ReportRow) => (r.target > 0 ? Math.round((r.actual / r.target) * 1000) / 10 : 0);

export function statusOf(ach: number): { text: string; bg: string; color: string } {
  if (ach >= 100) return { text: "Tercapai", bg: "#dcfce7", color: "#166534" };
  if (ach >= 90) return { text: "Evaluasi", bg: "#fef9c3", color: "#854d0e" };
  return { text: "Di Bawah Target", bg: "#fee2e2", color: "#991b1b" };
}

export default function DetailTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.periode, r.mesin, `shift ${r.shift}`, r.target, r.iot, r.actual, r.ng, achOf(r)].join(" ").toLowerCase().includes(t)
    );
  }, [rows, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => setPage(1), [search, pageSize, rows]);
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize);

  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: disabled ? "#f1f5f9" : "#fff",
    color: disabled ? "#94a3b8" : "#1e3a8a",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    fontWeight: 600,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
          Tampilkan
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          baris
        </label>
        <input
          type="search"
          aria-label="Cari di tabel"
          placeholder="Cari periode, mesin, shift..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", minWidth: 220 }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Periode</th>
              <th style={th}>Mesin</th>
              <th style={th}>Shift</th>
              <th style={th}>Target</th>
              <th style={th}>IOT</th>
              <th style={th}>Actual</th>
              <th style={th}>NG</th>
              <th style={th}>Ach (%)</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, color: "#94a3b8", padding: 24 }}>
                  {rows.length === 0 ? "Tidak ada data pada periode ini." : "Tidak ada baris yang cocok dengan pencarian."}
                </td>
              </tr>
            ) : (
              slice.map((r, i) => {
                const ach = achOf(r);
                const st = statusOf(ach);
                return (
                  <tr key={`${r.periode}|${r.mesin}|${r.shift}`} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                    <td style={td}>{r.periode}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.mesin}</td>
                    <td style={td}>Shift {r.shift}</td>
                    <td style={td}>{r.target}</td>
                    <td style={td}>{r.iot}</td>
                    <td style={{ ...td, fontWeight: 700, color: "#166534" }}>{r.actual}</td>
                    <td style={{ ...td, fontWeight: 700, color: r.ng > 0 ? "#b91c1c" : undefined }}>{r.ng}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{ach}%</td>
                    <td style={td}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.text}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 10, fontSize: 12, color: "#64748b" }}>
        <span>
          {filtered.length === 0
            ? "0 baris"
            : `Menampilkan ${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, filtered.length)} dari ${filtered.length} baris`}
          {filtered.length !== rows.length && ` (disaring dari ${rows.length})`}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setPage(current - 1)} disabled={current <= 1} style={btn(current <= 1)}>
            ‹ Sebelumnya
          </button>
          <span>
            Halaman {current} / {pages}
          </span>
          <button onClick={() => setPage(current + 1)} disabled={current >= pages} style={btn(current >= pages)}>
            Berikutnya ›
          </button>
        </span>
      </div>
    </div>
  );
}