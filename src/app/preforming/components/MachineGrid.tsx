import type { MachineStat } from "@/types/preforming";

interface Props {
  machines: MachineStat[];
}

function SideRow({ label, target, actual, ach }: { label: string; target: number; actual: number; ach: number }) {
  const actualColor = actual > 0 ? "#333" : "#b0bec5";
  const achColor = ach >= 100 ? "#2e7d32" : "#c62828";

  return (
    <tr>
      <td style={{ fontWeight: 700, padding: "6px 8px" }}>{label}</td>
      <td style={{ padding: "6px 8px", textAlign: "center" }}>{target}</td>
      <td style={{ padding: "6px 8px", textAlign: "center", color: actualColor, fontWeight: 700 }}>
        {actual}
      </td>
      <td style={{ padding: "6px 8px", textAlign: "center", color: achColor, fontWeight: 700 }}>
        {ach}%
      </td>
    </tr>
  );
}

export default function MachineGrid({ machines }: Props) {
  if (machines.length === 0) {
    return <p style={{ color: "#888" }}>Belum ada data mesin.</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {machines.map((m) => {
        const isOff = m.status === "OFF" && m.A.actual === 0 && m.B.actual === 0;
        return (
          <div
            key={m.machine_id}
            style={{
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: isOff ? "#9e9e9e" : "#2e7d32",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              <span>{m.mc}</span>
              <span
                style={{
                  fontSize: 11,
                  border: "1px solid #fff",
                  padding: "2px 8px",
                  borderRadius: 15,
                }}
              >
                {isOff ? "OFF" : "RUNNING"}
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f3f6", color: "#555" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>SIDE</th>
                  <th style={{ padding: "6px 8px" }}>TARGET</th>
                  <th style={{ padding: "6px 8px" }}>ACTUAL</th>
                  <th style={{ padding: "6px 8px" }}>ACH</th>
                </tr>
              </thead>
              <tbody>
                <SideRow label="A" target={m.A.target} actual={m.A.actual} ach={m.A.ach} />
                <SideRow label="B" target={m.B.target} actual={m.B.actual} ach={m.B.ach} />
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
