import type { InsightItem } from "../insights";

export function InsightsTicker({ items }: { items: InsightItem[] }) {
  if (items.length === 0) {
    return <span style={{ color: "#888" }}>Loading...</span>;
  }
  const line = items.map((it, i) => (
    <span key={i} style={{ marginRight: 48 }}>
      {it.label}: <strong style={{ color: "#e65100" }}>{it.value}</strong>
    </span>
  ));
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", width: "100%" }}>
      <div className="ticker-track">
        <span>{line}</span>
        <span aria-hidden="true">{line}</span>
      </div>
    </div>
  );
}

export function InsightsList({ items }: { items: InsightItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: "#888" }}>Data sedang disiapkan...</p>;
  }
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #eee", fontSize: 14, fontWeight: 700, color: "#0d47a1" }}>
          {it.label}: <span style={{ color: "#e65100", fontWeight: 900 }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}