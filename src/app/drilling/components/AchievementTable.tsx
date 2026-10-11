import type { MachineRunState, SessionRow } from "@/types/drilling";

interface Props {
  machines: string[];
  rows: SessionRow[];
  machineState: Record<string, MachineRunState>;
  showAll: boolean; // true = tampilkan semua sesi (mode riwayat / SEE ALL)
}

const STATE_STYLE: Record<MachineRunState, { text: string; color: string }> = {
  RUNNING: { text: "RUNNING", color: "#00e676" },
  BREAKDOWN: { text: "BREAKDOWN", color: "#ffeb3b" },
  NO_DATA: { text: "BREAKDOWN", color: "#ff5252" },
};

const th: React.CSSProperties = {
  padding: "8px 6px",
  fontSize: 12,
  background: "#1565c0",
  color: "#fff",
  border: "1px solid #0d47a1",
  textAlign: "center",
};

const td: React.CSSProperties = {
  padding: "8px 6px",
  fontSize: 13,
  border: "1px solid #e0e0e0",
  textAlign: "center",
};

const pct = (actual: number, target: number) =>
  Math.min(100, target > 0 ? Math.round((actual / target) * 100) : 0);

function SessionCells({ r, active }: { r: SessionRow; active: boolean }) {
  return (
    <>
      <td style={{ ...td, textAlign: "left", lineHeight: 1.4, fontWeight: 700 }}>
        {r.pn}
        <br />
        <span style={{ color: "#1565c0" }}>{r.opr}</span>
        <br />
        <span
          style={{
            fontSize: 11,
            padding: "2px 5px",
            borderRadius: 3,
            background: active ? "#1976d2" : "#e0e0e0",
            color: active ? "#fff" : "#555",
          }}
        >
          {r.start} - {r.last}
        </span>
      </td>
      <td style={td}>{r.target}</td>
      <td style={td}>{r.actual}</td>
      <td style={td}>{pct(r.actual, r.target)}%</td>
    </>
  );
}

export default function AchievementTable({ machines, rows, machineState, showAll }: Props) {
  const byMachine: Record<string, SessionRow[]> = {};
  for (const mc of machines) byMachine[mc] = [];
  for (const r of rows) byMachine[r.mc]?.push(r);

  // jumlah baris riwayat = sesi terbanyak - 1 (sesi terakhir = baris aktif)
  const maxHistory = Math.max(0, ...machines.map((mc) => byMachine[mc].length - 1));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
        <thead>
          <tr>
            {machines.map((mc, idx) => {
              const st = STATE_STYLE[machineState[mc] ?? "NO_DATA"];
              return (
                <th key={mc} colSpan={4} style={th}>
                  MACHINE {idx + 1}
                  <br />
                  <span style={{ color: st.color, fontSize: 14 }}>{st.text}</span>
                </th>
              );
            })}
          </tr>
          <tr>
            {machines.map((mc) => (
              <FragmentHead key={mc} />
            ))}
          </tr>
        </thead>
        <tbody>
          {showAll &&
            Array.from({ length: maxHistory }, (_, i) => (
              <tr key={`h${i}`}>
                {machines.map((mc) => {
                  const data = byMachine[mc];
                  return i < data.length - 1 ? (
                    <SessionCells key={mc} r={data[i]} active={false} />
                  ) : (
                    <td key={mc} colSpan={4} style={{ ...td, background: "#f9fbfd", color: "#ccc" }}>
                      -
                    </td>
                  );
                })}
              </tr>
            ))}

          <tr style={{ background: "#e3f2fd" }}>
            {machines.map((mc) => {
              const data = byMachine[mc];
              return data.length === 0 ? (
                <td key={mc} colSpan={4} style={{ ...td, color: "#888", fontStyle: "italic" }}>
                  MACHINE NO ACTIVE
                </td>
              ) : (
                <SessionCells key={mc} r={data[data.length - 1]} active />
              );
            })}
          </tr>

          <tr style={{ background: "#fff8e1", fontWeight: 700 }}>
            {machines.map((mc) => {
              const data = byMachine[mc];
              const totA = data.reduce((s, d) => s + d.actual, 0);
              const totT = data.reduce((s, d) => s + d.target, 0);
              return (
                <FragmentCum key={mc} target={totT} actual={totA} acv={pct(totA, totT)} />
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FragmentHead() {
  return (
    <>
      <th style={{ ...th, background: "#1976d2" }}>PARTNO | OPR</th>
      <th style={{ ...th, background: "#1976d2" }}>TARGET</th>
      <th style={{ ...th, background: "#1976d2" }}>ACTUAL</th>
      <th style={{ ...th, background: "#1976d2" }}>ACV %</th>
    </>
  );
}

function FragmentCum({ target, actual, acv }: { target: number; actual: number; acv: number }) {
  return (
    <>
      <td style={{ ...td, textAlign: "left" }}>CUMULATIVE</td>
      <td style={td}>{target}</td>
      <td style={td}>{actual}</td>
      <td style={td}>{acv}%</td>
    </>
  );
}