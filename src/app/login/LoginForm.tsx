"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/preforming";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!json.status) {
        setError(json.error ?? "Login gagal");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        width: 320,
        background: "#fff",
        padding: 28,
        borderRadius: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Clutch Tech</h1>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666" }}>
        Masuk untuk mengakses sistem produksi
      </p>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Username
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={inputStyle}
        />
      </label>

      {error && <p style={{ color: "#c62828", fontSize: 13, margin: 0 }}>{error}</p>}

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  marginTop: 6,
  padding: "10px 14px",
  borderRadius: 6,
  border: "none",
  background: "#1565c0",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};