import { machineActualPcs, type HotpressMachine, type HotpressResponse } from "@/types/hotpress";

export type StatusKey = "RUNNING" | "BREAKDOWN" | "OFF";

interface Props {
  counts: HotpressResponse["status"];
  machines: HotpressMachine[];
  history: boolean;
  active: StatusKey | null;
  onSelect: (key: StatusKey) => void;
}

const STYLE: Record<StatusKey, { bg: string; border: string; label: string }> = {
  RUNNING: { bg: "#2e7d32", border: "3px dashed #4caf50", label: "RUNNING" },
  BREAKDOWN: { bg: "#e65100", border: "3px dashed #ff9800", label: "BREAKDOWN" },
  OFF: { bg: "#455a64", border: "3px dashed #78909c", label: "OFF" },
};

export function machinesForStatus(key: StatusKey, machines: HotpressMachine[], history: boolean): string[] {
  const list = machines.filter((m) => {
    const act = machineActualPcs(m);
    if (key === "RUNNING") return history ? act > 0 : m.status === "RUNNING";
    if (key === "BREAKDOWN") return history ? m.status === "RUNNING_BD" || m.bd_history.length > 0 : m.status === "RUNNING_BD";
    return history ? act === 0 && m.bd_history.length === 0 : m.status === "OFF";
  });
  return list.map((m) => m.mc);
}

export default function StatusSummary({ counts, machines, history, active, onSelect }: Props) {
  const boxes: { key: StatusKey; count: number }[] = [
    { key: "RUNNING", count: counts.run },
    { key: "BREAKDOWN", count: counts.bd },
    { key: "OFF", count: counts.off },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {boxes.map(({ key, count }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 18px",
              borderRadius: 10,
              border: active === key ? "3px solid #222" : "3px solid transparent",
              background: STYLE[key].bg,
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <span>{STYLE[key].label}</span>
            <span style={{ fontSize: 36 }}>{count}</span>
          </button>
        ))}
      </div>

      {active && (
        <div
          style={{
            marginTop: 12,
            padding: "14px 18px",
            borderRadius: 10,
            background: STYLE[active].bg,
            border: STYLE[active].border,
            color: "#e0f2f1",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {(() => {
            const list = machinesForStatus(active, machines, history);
            if (list.length === 0) return `There are no machines in ${active} condition at this time.`;
            return (
              <>
                {history ? "HISTORY LIST" : "MACHINE LIST"} <span style={{ color: "#fff" }}>{active}</span>:
                <br />
                <span style={{ fontSize: 22, letterSpacing: 1, color: "#fff" }}>{list.join(", ")}</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}   