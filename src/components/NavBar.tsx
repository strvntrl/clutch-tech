"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IBM_Plex_Sans } from "next/font/google";
import pmcLogo from "@/assets/logo-pmc.webp";
import drillingLogo from "@/assets/logo-drilling.webp";
import hotpressLogo from "@/assets/logo-hotpress.webp";
import monitor from "./MonitorHeader.module.css"; // tampilan sama persis dengan header dashboard monitor
import { DateBox, ShiftBox, TimeBox } from "./HeaderBoxes";
import UserStatus from "./UserStatus";
import styles from "./NavBar.module.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

interface ShiftOption {
  value: string;
  label: string;
}

/** Filter tanggal + shift (hanya untuk halaman form PMC). */
export interface NavFilters {
  date: string;
  onDateChange: (date: string) => void;
  maxDate?: string;
  shift: string;
  onShiftChange: (shift: string) => void;
  shiftOptions: readonly ShiftOption[];
}

interface Props {
  fullName: string;
  role: string;
  /** Kalau diisi, kotak tanggal dan shift tampil di navbar. */
  filters?: NavFilters;
  /** Elemen tambahan di bawah judul, mis. chip status. */
  extra?: ReactNode;
  /** Dipakai saat navbar ada di dalam wadah yang sudah punya padding sendiri. */
  embedded?: boolean;
}

/** Urutan halaman PMC untuk tombol panah kiri/kanan (berputar). */
const PAGES = [
  { href: "/pmc", prefix: "/pmc", exact: true, title: "PMC", label: "Menu PMC", logo: pmcLogo },
  { href: "/pmc/drilling", prefix: "/pmc/drilling", title: "PMC Drilling", label: "Drilling", logo: drillingLogo },
  { href: "/pmc/hotpress", prefix: "/pmc/hotpress", title: "PMC Hotpress", label: "Hotpress", logo: hotpressLogo },
  { href: "/report", prefix: "/report", title: "PMC Laporan", label: "Laporan", logo: pmcLogo },
] as const;

function findPageIndex(pathname: string): number {
  const i = PAGES.findIndex((p) =>
    "exact" in p ? pathname === p.prefix : pathname === p.prefix || pathname.startsWith(`${p.prefix}/`)
  );
  return i === -1 ? 0 : i;
}

export default function NavBar({ fullName, role, filters, extra, embedded = false }: Props) {
  const pathname = usePathname();

  const index = findPageIndex(pathname);
  const current = PAGES[index];
  const prev = PAGES[(index - 1 + PAGES.length) % PAGES.length];
  const next = PAGES[(index + 1) % PAGES.length];

  return (
    <header
      className={`${plex.className} ${monitor.header} ${styles.bar} ${embedded ? styles.embedded : ""}`}
    >
      {/* Kiri: logo + filter tanggal */}
      <div className={monitor.left}>
        <Link href="/" className={monitor.logoLink} aria-label="Kembali ke beranda">
          <Image src={current.logo} alt={`Logo ${current.label}`} className={monitor.logo} sizes="72px" priority />
        </Link>
        {filters && (
          <DateBox date={filters.date} onChange={filters.onDateChange} max={filters.maxDate} />
        )}
      </div>

      {/* Tengah: panah pindah halaman + judul */}
      <div className={monitor.center}>
        <div className={monitor.titleRow}>
          <Link
            href={prev.href}
            className={monitor.arrow}
            aria-label={`Halaman sebelumnya: ${prev.label}`}
            title={prev.label}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className={monitor.title}>{current.title}</span>
          <Link
            href={next.href}
            className={monitor.arrow}
            aria-label={`Halaman berikutnya: ${next.label}`}
            title={next.label}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
        {extra && <div className={monitor.extra}>{extra}</div>}
      </div>

      {/* Kanan: tombol monitoring + jam + shift + user */}
      <div className={monitor.right}>
        <Link href="/preforming" className={monitor.pmc}>
          Monitoring
        </Link>
        <TimeBox />
        {filters && (
          <ShiftBox shift={filters.shift} onChange={filters.onShiftChange} options={filters.shiftOptions} />
        )}
        <UserStatus user={{ fullName, role }} />
      </div>
    </header>
  );
}