"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IBM_Plex_Sans } from "next/font/google";
import logo from "@/assets/logo-perusahaan.webp";
import styles from "./NavBar.module.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

interface Props {
  fullName: string;
  role: string;
}

const AREA_LINKS = [
  { href: "/preforming", label: "Preforming" },
  { href: "/drilling", label: "Drilling" },
  { href: "/hotpress", label: "Hotpress" },
];

// Halaman laporan dibuka dari menu PMC, jadi ikut dianggap bagian PMC.
const PMC_PREFIXES = ["/pmc", "/report"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavBar({ fullName, role }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const pmcActive = PMC_PREFIXES.some((p) => isActive(pathname, p));

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className={`${plex.className} ${styles.bar}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Beranda Clutch Tech">
          <Image src={logo} alt="Clutch Tech" className={styles.logo} sizes="120px" priority />
        </Link>

        <nav className={styles.nav} aria-label="Navigasi utama">
          <ul className={styles.links}>
            {AREA_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`${styles.link} ${active ? styles.linkActive : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/pmc"
            className={`${styles.pmc} ${pmcActive ? styles.pmcActive : ""}`}
            aria-current={pmcActive ? "page" : undefined}
          >
            PMC
          </Link>
        </nav>

        <div className={styles.user}>
          <span className={styles.userText}>
            <span className={styles.userName}>{fullName}</span>
            <span className={styles.userRole}>{role}</span>
          </span>
          <button
            type="button"
            className={styles.logout}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      </div>
    </header>
  );
}