"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import preformingLogo from "@/assets/logo-preforming.webp";
import drillingLogo from "@/assets/logo-drilling.webp";
import hotpressLogo from "@/assets/logo-hotpress.webp";
import { DateBox, ShiftBox, TimeBox } from "./HeaderBoxes";
import UserStatus, { type HeaderUser } from "./UserStatus";
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
  /** User yang sedang login (nama, role, dan tombol logout). */
  user?: HeaderUser | null;
  /** Elemen tambahan di bawah judul, mis. badge LIVE atau tombol insights. */
  extra?: ReactNode;
}

export default function MonitorHeader({
  area,
  date,
  onDateChange,
  maxDate,
  shift,
  onShiftChange,
  shiftOptions,
  user,
  extra,
}: Props) {
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
        <DateBox date={date} onChange={onDateChange} max={maxDate} />
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

      {/* Kanan: tombol PMC + jam + shift + user */}
      <div className={styles.right}>
        <Link href="/pmc" className={styles.pmc}>
          PMC
        </Link>
        <TimeBox />
        <ShiftBox shift={shift} onChange={onShiftChange} options={shiftOptions} />
        {user && <UserStatus user={user} />}
      </div>
    </header>
  );
}