"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import logo from "@/assets/logo-perusahaan.webp";
import styles from "./login.module.css";

const DEFAULT_REDIRECT = "/";

function safeRedirect(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return DEFAULT_REDIRECT;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const uid = useId();
  const usernameId = `${uid}-username`;
  const passwordId = `${uid}-password`;
  const errorId = `${uid}-error`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    let success = false;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!json.status) {
        setError(json.error ?? "Login gagal. Periksa username dan password.");
        return;
      }
      success = true;
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      // Saat berhasil, tombol tetap nonaktif sampai halaman berpindah (cegah klik ganda).
      if (!success) setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.brand}>
        <Image
          src={logo}
          alt="Clutch Tech - Clutch Disc Manufacturing"
          className={styles.logo}
          sizes="(min-width: 960px) 520px, 70vw"
          priority
        />
        <p className={styles.brandLead}>
          Production at a Glance.
        </p>
        <p className={styles.brandSub}>
          Integrated production monitoring for better visibility, control, and performance across every shift.
        </p>
      </section>

      <main className={styles.formSide}>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div>
            <h1 className={styles.title}>Selamat Datang</h1>
            <p className={styles.subtitle}>
              Masuk ke akun Anda untuk mengakses sistem monitoring produksi.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={usernameId}>
              Username
            </label>
            <input
              id={usernameId}
              className={`${styles.input} ${error ? styles.inputInvalid : ""}`}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              required
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={passwordId}>
              Password
            </label>
            <div className={styles.inputWrap}>
              <input
                id={passwordId}
                className={`${styles.input} ${styles.inputWithToggle} ${
                  error ? styles.inputInvalid : ""
                }`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-controls={passwordId}
                aria-pressed={showPassword}
              >
                {showPassword ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
          </div>

          <div className={styles.live} aria-live="polite">
            {error && (
              <p id={errorId} className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading && <span className={styles.spinner} aria-hidden="true" />}
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <p className={styles.help}>Lupa password? Hubungi admin sistem.</p>
        </form>
      </main>
    </div>
  );
}