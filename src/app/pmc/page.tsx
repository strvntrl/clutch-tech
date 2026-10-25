import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import NavBar from "@/components/NavBar";
import { getCurrentUser } from "@/lib/get-current-user";
import drillingLogo from "@/assets/logo-drilling.webp";
import hotpressLogo from "@/assets/logo-hotpress.webp";
import pmcLogo from "@/assets/logo-pmc.webp";
import styles from "./pmc.module.css";

export const metadata = { title: "PMC | Clutch Tech" };

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

interface Item {
  href: string;
  name: string;
  desc: string;
  logo: StaticImageData;
}

const INPUT_ITEMS: Item[] = [
  {
    href: "/pmc/drilling",
    name: "Drilling",
    desc: "Form laporan harian drilling",
    logo: drillingLogo,
  },
  {
    href: "/pmc/hotpress",
    name: "Hotpress",
    desc: "Form laporan harian hotpress",
    logo: hotpressLogo,
  },
];

const REPORT_ITEM: Item = {
  href: "/report",
  name: "Laporan Produksi",
  desc: "Laporan produksi, grafik, dan analisis per periode",
  logo: pmcLogo,
};

function Card({ item, wide = false }: { item: Item; wide?: boolean }) {
  return (
    <Link href={item.href} className={`${styles.card} ${wide ? styles.cardWide : ""}`}>
      <Image src={item.logo} alt="" className={styles.cardLogo} sizes="80px" />
      <span className={styles.cardText}>
        <span className={styles.cardName}>{item.name}</span>
        <span className={styles.cardDesc}>{item.desc}</span>
      </span>
      <span className={styles.cardGo} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            d="M9 5l7 7-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

export default async function PmcIndexPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && <NavBar fullName={user.fullName} role={user.role} />}

      <main className={`${plex.className} ${styles.page}`}>
        <section className={styles.hero}>
          <span className={styles.heroBadge}>
            <Image src={pmcLogo} alt="" className={styles.heroLogo} sizes="96px" priority />
          </span>
          <div>
            <h1 className={styles.heroTitle}>PMC</h1>
            <p className={styles.heroSub}>Laporan Produksi Harian</p>
          </div>
        </section>

        <section aria-labelledby="sec-input" className={styles.section}>
          <h2 id="sec-input" className={styles.sectionTitle}>
            Input Laporan Harian
          </h2>
          <ul className={styles.grid}>
            {INPUT_ITEMS.map((item) => (
              <li key={item.href}>
                <Card item={item} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sec-report" className={styles.section}>
          <h2 id="sec-report" className={styles.sectionTitle}>
            Laporan &amp; Analisis
          </h2>
          <Card item={REPORT_ITEM} wide />
        </section>
      </main>
    </>
  );
}