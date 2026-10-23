import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import UserBar from "@/components/UserBar";
import { getCurrentUser } from "@/lib/get-current-user";
import companyLogo from "@/assets/logo-perusahaan.webp";
import preformingLogo from "@/assets/logo-preforming.webp";
import drillingLogo from "@/assets/logo-drilling.webp";
import hotpressLogo from "@/assets/logo-hotpress.webp";
import pmcLogo from "@/assets/logo-pmc.webp";
import styles from "./home.module.css";

export const metadata = { title: "Beranda | Clutch Tech" };

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

interface Area {
  href: string;
  name: string;
  desc: string;
  logo: StaticImageData;
}

const AREAS: Area[] = [
  {
    href: "/preforming",
    name: "Preforming",
    desc: "Pencapaian dan status mesin preforming",
    logo: preformingLogo,
  },
  {
    href: "/drilling",
    name: "Drilling",
    desc: "Achievement, downtime, dan tren per shift",
    logo: drillingLogo,
  },
  {
    href: "/hotpress",
    name: "Hotpress",
    desc: "Status mesin dan siklus hotpress",
    logo: hotpressLogo,
  },
  {
    href: "/pmc",
    name: "PMC",
    desc: "Laporan produksi harian dan analisis",
    logo: pmcLogo,
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className={`${plex.variable} ${styles.page}`}>
      <section className={styles.brand}>
        <Image
          src={companyLogo}
          alt="Clutch Tech - Clutch Disc Manufacturing"
          className={styles.logo}
          sizes="(min-width: 960px) 520px, 70vw"
          priority
        />
        <p className={styles.brandLead}>Production at a Glance.</p>
        <p className={styles.brandSub}>
          Integrated production monitoring for better visibility, control, and
          performance across every shift.
        </p>
      </section>

      <main className={styles.panel}>
        <div className={styles.card}>
          <div>
            <h1 className={styles.title}>Pilih Area</h1>
            <p className={styles.subtitle}>
              Buka dashboard sesuai area produksi yang ingin dipantau.
            </p>
          </div>

          <nav aria-label="Area produksi">
            <ul className={styles.grid}>
              {AREAS.map((area) => (
                <li key={area.href}>
                  <Link href={area.href} className={styles.area}>
                    <Image
                      src={area.logo}
                      alt=""
                      className={styles.areaLogo}
                      sizes="84px"
                    />
                    <span className={styles.areaText}>
                      <span className={styles.areaName}>{area.name}</span>
                      <span className={styles.areaDesc}>{area.desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {user && (
            <div className={styles.userRow}>
              <UserBar fullName={user.fullName} role={user.role} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}