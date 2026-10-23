import NavBar from "@/components/NavBar";
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
    <>
    {user && <NavBar fullName={user.fullName} role={user.role} />}
    <main style={{ padding: 24, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>PMC - Laporan Produksi Harian</h1>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <a href="/pmc/drilling" style={cardStyle}>
          DRILLING
          <div style={{ fontSize: 12, fontWeight: 400, color: "#555", marginTop: 6 }}>Form laporan harian drilling</div>
        </a>
        <a href="/pmc/hotpress" style={cardStyle}>
          HOTPRESS
          <div style={{ fontSize: 12, fontWeight: 400, color: "#555", marginTop: 6 }}>Form laporan harian hotpress</div>
        </a>
        <a href="/report" style={cardStyle}>
          LAPORAN
          <div style={{ fontSize: 12, fontWeight: 400, color: "#555", marginTop: 6 }}>Laporan produksi, grafik, dan analisis</div>
        </a>
      </div>
    </main>
    </>
  );
}