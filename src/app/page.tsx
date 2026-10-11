export default function HomePage() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Clutch Tech Dashboard</h1>
      <p>Kerangka project berhasil jalan.</p>
      <p>
        Cek koneksi database di{" "}
        <a href="/api/health">/api/health</a>
      </p>
      <p>
        Dashboard: <a href="/preforming">/preforming</a> · <a href="/drilling">/drilling</a>
      </p>
    </main>
  );
}
