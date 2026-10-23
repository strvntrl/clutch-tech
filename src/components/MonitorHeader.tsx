"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import preformingLogo from "@/assets/logo-preforming.webp";
import drillingLogo from "@/assets/logo-drilling.webp";
import hotpressLogo from "@/assets/logo-hotpress.webp";
import styles from "./MonitorHeader.module.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export type MonitorArea = "preforming" | "drilling" | "hotpress";

/** Urutan dashboard untuk tombol panah kiri/kanan (berputar). */
const AREAS: { key: MonitorArea; href: string; label: string; logo: typeof drillingLogo }[] = [
  { key: "preforming", href: "/preforming", label: "Preforming", logo: preformingLogo },
  { key: "drilling", href: "/drilling", label: "Drilling", logo: drillingLogo },
  { key: "hotpress", href: "/hotpress", label: "Hotpress", logo: hotpressLogo },
];

interface ShiftOption {
  value: string;
  label: string;
}

interface Props {
  area: MonitorArea;
  date: string;
  onDateChange: (date: string) => void;
  /** Batas tanggal terakhir yang boleh dipilih (opsional). */
  maxDate?: string;
  shift: string;
  onShiftChange: (shift: string) => void;
  shiftOptions: readonly ShiftOption[];
  /** Elemen tambahan di bawah judul, mis. badge LIVE atau tombol insights. */
  extra?: ReactNode;
}

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(d)
    .replace(/:/g, ".");
}

export default function MonitorHeader({
  area,
  date,
  onDateChange,
  maxDate,
  shift,
  onShiftChange,
  shiftOptions,
  extra,
}: Props) {
  // null di render pertama supaya HTML server dan klien sama (cegah hydration mismatch)
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const index = AREAS.findIndex((a) => a.key === area);
  const current = AREAS[index];
  const prev = AREAS[(index - 1 + AREAS.length) % AREAS.length];
  const next = AREAS[(index + 1) % AREAS.length];

  return (
    <header className={`${plex.className} ${styles.header}`}>
      {/* Kiri: logo area + filter tanggal */}
      <div className={styles.left}>
        <Link href="/" className={styles.logoLink} aria-label="Kembali ke beranda">
          <Image
            src={current.logo}
            alt={`Logo ${current.label}`}
            className={styles.logo}
            sizes="72px"
            priority
          />
        </Link>
        <label className={styles.box}>
          <span className={styles.boxLabel}>Date</span>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            max={maxDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </label>
      </div>

      {/* Tengah: panah pindah dashboard + judul */}
      <div className={styles.center}>
        <div className={styles.titleRow}>
          <Link
            href={prev.href}
            className={styles.arrow}
            aria-label={`Dashboard sebelumnya: ${prev.label}`}
            title={prev.label}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className={styles.title}>Dashboard {current.label}</h1>
          <Link
            href={next.href}
            className={styles.arrow}
            aria-label={`Dashboard berikutnya: ${next.label}`}
            title={next.label}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
        {extra && <div className={styles.extra}>{extra}</div>}
      </div>

      {/* Kanan: tombol PMC + jam + pilih shift */}
      <div className={styles.right}>
        <Link href="/pmc" className={styles.pmc}>
          PMC
        </Link>

        <div className={`${styles.box} ${styles.timeBox}`} role="timer" aria-label="Waktu sekarang (WIB)">
          <span className={styles.boxLabel}>Time</span>
          <span className={styles.time}>{clock ?? "--.--.--"}</span>
        </div>

        <label className={styles.box}>
          <span className={styles.boxLabel}>Select Shift</span>
          <select
            className={styles.select}
            value={shift}
            onChange={(e) => onShiftChange(e.target.value)}
          >
            {shiftOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}