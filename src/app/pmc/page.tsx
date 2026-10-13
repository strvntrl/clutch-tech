import UserBar from "@/components/UserBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = { title: "PMC | Clutch Tech" };

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: "22px 26px",
  borderRadius: 12,
  background: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  textDecoration: "none",
  color: "#0d47a1",
  fontWeight: 800,
  fontSize: 16,
  minWidth: 240,
};

export default async function PmcIndexPage() {
  const user = await getCurrentUser();

  return (
    <main style={{ padding: 24, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>PMC - Laporan Produksi Harian</h1>
        {user && <UserBar fullName={user.fullName} role={user.role} />}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <a href="/pmc/drilling" style={cardStyle}>
          DRILLING
          <div style={{ fontSize: 12, fontWeight: 400, color: "#555", marginTop: 6 }}>Form laporan harian drilling</div>
        </a>
        <div style={{ ...cardStyle, color: "#90a4ae", cursor: "not-allowed" }}>
          HOTPRESS
          <div style={{ fontSize: 12, fontWeight: 400, marginTop: 6 }}>Segera hadir</div>
        </div>
        <div style={{ ...cardStyle, color: "#90a4ae", cursor: "not-allowed" }}>
          PREFORMING
          <div style={{ fontSize: 12, fontWeight: 400, marginTop: 6 }}>Segera hadir</div>
        </div>
      </div>
    </main>
  );
}