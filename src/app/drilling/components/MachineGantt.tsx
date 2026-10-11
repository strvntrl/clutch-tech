"use client";

import { useEffect, useState } from "react";
import type { DowntimeBlock, DrillingDowntimeResponse } from "@/types/drilling";

interface Props {
  machines: string[];
  data: DrillingDowntimeResponse | null;
}

interface Selected {
  block: DowntimeBlock;
  x: number;
  y: number;
}

// "2026-10-10 07:30:00" -> epoch jam dinding (tanpa pengaruh timezone browser)
function parseWall(s: string): number {
  const [d, t] = s.split(" ");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi, se] = t.split(":").map(Number);
  return Date.UTC(y, mo - 1, da, h, mi, se) / 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function MachineGantt({ machines, data }: Props) {
  const [zoom, setZoom] = useState(100);
  const [selected, setSelected] = useState<Selected | null>(null);

  // Tutup popover saat klik di luar blok/popover.
  // Catatan: e.stopPropagation() React tidak bisa mencegah listener lain di
  // `document` (React memasang event di sana), jadi targetnya dicek manual.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-gantt-block], [data-gantt-popover]")) return;
      setSelected(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (!data) return <p style={{ color: "#888" }}>Memuat status mesin...</p>;

  const start = parseWall(data.start_shift);
  const total = parseWall(data.end_shift) - start;
  const hours = Math.round(total / 3600);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={() => setZoom((z) => Math.max(100, z - 100))} style={zoomBtn}>
          − ZOOM OUT
        </button>
        <button onClick={() => setZoom((z) => Math.min(600, z + 100))} style={zoomBtn}>
          + ZOOM IN
        </button>
        <span style={{ marginLeft: 8, fontSize: 12 }}>
          <Legend color="#80EF80" label="UPTIME" /> <Legend color="#FF746C" label="DOWNTIME" />
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ width: `${zoom}%`, minWidth: "100%", boxSizing: "border-box", padding: "0 26px" }}>
          {machines.map((mc) => {
            const s = data.summary[mc];
            return (
              <div key={mc} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 18, fontSize: 12, fontWeight: 700, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ color: "#0d47a1", fontSize: 14 }}>{mc}</span>
                  <span>
                    START UPTIME : <span style={{ fontWeight: 400 }}>{s?.start_uptime ?? "-"}</span>
                  </span>
                  <span>
                    LAST UPTIME : <span style={{ fontWeight: 400 }}>{s?.last_uptime ?? "-"}</span>
                  </span>
                  <span>
                    AVG : <span style={{ fontWeight: 400 }}>{s?.avg_time ?? 0} SCD/PCS</span>
                  </span>
                </div>
                <div style={{ position: "relative", height: 34, background: "#eceff1", borderRadius: 6, overflow: "hidden" }}>
                  {data.data
                    .filter((b) => b.machine === mc)
                    .map((b, i) => {
                      const left = ((parseWall(b.start) - start) / total) * 100;
                      const width = (b.duration / total) * 100;
                      return (
                        <div
                          key={i}
                          data-gantt-block
                          onClick={(e) => setSelected({ block: b, x: e.clientX, y: e.clientY })}
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${left}%`,
                            width: `${width}%`,
                            background: b.color,
                            cursor: "pointer",
                          }}
                        />
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* sumbu waktu */}
          <div style={{ position: "relative", height: 35, marginTop: 6, borderTop: "2px solid #bdbdbd" }}>
            {Array.from({ length: hours + 1 }, (_, i) => {
              const d = new Date((start + i * 3600) * 1000);
              return (
                <div key={i} style={{ position: "absolute", left: `${(i / hours) * 100}%`, transform: "translateX(-50%)", textAlign: "center" }}>
                  <div style={{ width: 2, height: 10, background: "#bdbdbd", margin: "0 auto" }} />
                  <div style={{ fontSize: 12, color: "#555" }}>
                    {pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div
          data-gantt-popover
          style={{
            position: "fixed",
            left: Math.min(selected.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 230),
            top: Math.max(0, selected.y - 15),
            width: 210,
            padding: 12,
            borderRadius: 8,
            color: "#fff",
            fontSize: 13,
            zIndex: 50,
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            background: selected.block.status === "UPTIME" ? "#43a047" : "#e53935",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 6 }}>
            <span>{selected.block.machine}</span>
            <span style={{ cursor: "pointer" }} onClick={() => setSelected(null)}>
              ✖
            </span>
          </div>
          <div>
            STATUS: <b>{selected.block.status}</b>
          </div>
          <div>
            TIME: {selected.block.start.split(" ")[1]} - {selected.block.end.split(" ")[1]}
          </div>
          {selected.block.status === "UPTIME" && (
            <>
              <div style={{ marginTop: 4 }}>
                TOTAL: <b>{selected.block.pcs} PCS</b>
              </div>
              <div>
                AVG:{" "}
                <b>
                  {selected.block.pcs > 0 ? (selected.block.duration / selected.block.pcs).toFixed(1) : 0} SCD/PCS
                </b>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ marginRight: 10 }}>
      <span style={{ display: "inline-block", width: 12, height: 12, background: color, borderRadius: 3, marginRight: 4, verticalAlign: "middle" }} />
      {label}
    </span>
  );
}