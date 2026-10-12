import type { PreformingKpi } from "@/types/preforming";

interface Props {
  kpi: PreformingKpi | null;
  unit?: string; // satuan di samping angka, default "PCS"
}

const cardStyle: React.CSSProperties = {
  flex: "1 1 180px",
  background: "#fff",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const headStyle: React.CSSProperties = {
  padding: "8px 14px",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.5,
};

const bodyStyle: React.CSSProperties = {
  padding: "16px 14px",
};

export default function KpiCards({ kpi, unit = "PCS" }: Props) {
  const plan = kpi?.plan ?? 0;
  const actual = kpi?.actual ?? 0;
  const gap = kpi?.gap ?? 0;
  const ach = kpi?.ach ?? 0;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={cardStyle}>
        <div style={{ ...headStyle, background: "#7b1fa2" }}>PLAN TOTAL</div>
        <div style={bodyStyle}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#4a148c" }}>
            {plan}
          </span>{" "}
          <span style={{ fontSize: 13, color: "#888" }}>{unit}</span>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...headStyle, background: "#2e7d32" }}>ACTUAL TOTAL</div>
        <div style={bodyStyle}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#2e7d32" }}>
            {actual}
          </span>{" "}
          <span style={{ fontSize: 13, color: "#888" }}>{unit}</span>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...headStyle, background: "#c62828" }}>OUTSTANDING</div>
        <div style={bodyStyle}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#c62828" }}>
            {gap}
          </span>{" "}
          <span style={{ fontSize: 13, color: "#888" }}>{unit}</span>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...headStyle, background: "#1565c0" }}>ACHIEVEMENT</div>
        <div style={bodyStyle}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#1565c0" }}>
            {ach}%
          </span>
        </div>
      </div>
    </div>
  );
}