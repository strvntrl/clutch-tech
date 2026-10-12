import CycleChart from "./CycleChart";
import type { HotpressMachine, ShaftData } from "@/types/hotpress";

interface Props {
  machine: HotpressMachine;
  bdOpen: boolean;
  graphOpen: boolean;
  onToggleBd: () => void;
  onToggleGraph: () => void;
}

const HEAD: Record<HotpressMachine["status"], { bg: string; text: string }> = {
  RUNNING: { bg: "#2e7d32", text: "RUNNING" },
  RUNNING_BD: { bg: "#e65100", text: "BREAKDOWN" },
  OFF: { bg: "#455a64", text: "OFF" },
};

const th: React.CSSProperties = {
  padding: "7px 6px",
  fontSize: 11,
  background: "#eceff1",
  color: "#455a64",
  textAlign: "center",
  borderBottom: "1px solid #cfd8dc",
};

const td: React.CSSProperties = {
  padding: "7px 6px",
  fontSize: 13,
  textAlign: "center",
  borderBottom: "1px solid #eceff1",
};

const actionBtn = (bg: string): React.CSSProperties => ({
  marginLeft: 6,
  padding: "4px 10px",
  borderRadius: 14,
  border: "1.5px solid #fff",
  background: bg,
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
});

function isUsed(s: ShaftData): boolean {
  return s.partno !== "-" || s.operator !== "-" || s.target > 0 || s.actual_pcs > 0;
}

export default function MachineCard({ machine: m, bdOpen, graphOpen, onToggleBd, onToggleGraph }: Props) {
  const head = HEAD[m.status];
  const operators = Array.from(
    new Set(
      (["1", "2", "3", "4"] as const)
        .map((k) => m.shafts[k].operator)
        .filter((o) => o && o !== "-")
    )
  );

  return (
    <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          padding: "9px 12px",
          background: head.bg,
          color: "#fff",
          fontWeight: 800,
        }}
      >
        {m.mc}
        <span style={{ fontSize: 11, border: "1px solid #fff", padding: "2px 9px", borderRadius: 14 }}>
          {head.text}
        </span>
        {operators.map((o) => (
          <span
            key={o}
            style={{ fontSize: 11, fontWeight: 600, border: "1.5px solid #fff", borderRadius: 20, padding: "2px 10px", background: "rgba(255,255,255,0.2)" }}
          >
            👤 {o}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>
          {m.status === "RUNNING_BD" && (
            <button onClick={onToggleBd} style={actionBtn("#bf360c")}>
              BREAKDOWN LOG
            </button>
          )}
          {m.status !== "OFF" && (
            <button onClick={onToggleGraph} style={actionBtn("#1565c0")}>
              {graphOpen ? "HIDE GRAPH" : "SEE GRAPH"}
            </button>
          )}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>SHAF</th>
              <th style={th}>PARTNO</th>
              <th style={th}>TARGET (PCS)</th>
              <th style={th}>ACTUAL (PCS)</th>
              <th style={th}>ACH (%)</th>
              <th style={th}>START</th>
              <th style={th}>LAST</th>
            </tr>
          </thead>
          <tbody>
            {m.status === "OFF" ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ ...td, padding: 20, background: "#f5f5f5", color: "#7b8794", fontWeight: 900, letterSpacing: 2 }}
                >
                  MACHINE OFF
                </td>
              </tr>
            ) : (
              (["1", "2", "3", "4"] as const).map((k) => {
                const s = m.shafts[k];
                if (!isUsed(s)) {
                  return (
                    <tr key={k}>
                      <td style={{ ...td, background: "#fafafa", color: "#7b8794", fontWeight: 700 }}>SHAF {k}</td>
                      <td colSpan={6} style={{ ...td, background: "#fafafa", color: "#b0bec5", fontStyle: "italic", fontWeight: 700, letterSpacing: 1 }}>
                        NOT IN USE
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={k}>
                    <td style={{ ...td, color: "#0d47a1", fontWeight: 700 }}>SHAF {k}</td>
                    <td style={td}>{s.partno}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{s.target}</td>
                    <td style={{ ...td, fontWeight: 900 }}>{s.actual_pcs}</td>
                    <td style={{ ...td, fontWeight: 900, color: s.ach >= 100 ? "#2e7d32" : "#c62828" }}>{s.ach}%</td>
                    <td style={td}>{s.start}</td>
                    <td style={td}>{s.last}</td>
                  </tr>
                );
              })
            )}

            {bdOpen && m.status === "RUNNING_BD" && (
              <tr style={{ background: "#fff3e0" }}>
                <td colSpan={7} style={{ ...td, textAlign: "left", color: "#e65100", fontWeight: 700 }}>
                  ⏱ DOWNTIME HISTORY:
                  <br />
                  {m.bd_history.length > 0 ? m.bd_history.map((h) => <div key={h}>{h}</div>) : "-"}
                </td>
              </tr>
            )}

            {graphOpen && m.status !== "OFF" && (
              <tr style={{ background: "#e3f2fd" }}>
                <td colSpan={7} style={{ padding: "8px 8px 6px" }}>
                  <CycleChart data={m.graph_data} />
                  <div style={{ fontWeight: 700, color: "#0d47a1", marginTop: 4, fontSize: 13 }}>
                    AVERAGE TIME FOR 1 CYCLE ➔ MACHINE TIME: {m.avg_machine_time}s | CYCLE TIME: {m.avg_cycle_time}s
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}