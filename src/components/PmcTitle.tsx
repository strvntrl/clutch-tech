import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import styles from "./PmcTitle.module.css";

interface Props {
  /** Judul halaman, mis. "Laporan Harian Drilling" */
  title: string;
  /** Nama halaman untuk breadcrumb, mis. "Drilling" */
  crumb: string;
  logo: StaticImageData;
}

/** Judul halaman PMC: logo area + breadcrumb "PMC › ..." + judul. */
export default function PmcTitle({ title, crumb, logo }: Props) {
  return (
    <div className={styles.wrap}>
      <Image src={logo} alt="" className={styles.logo} sizes="56px" />
      <div className={styles.text}>
        <nav className={`${styles.crumbs} no-print`} aria-label="Breadcrumb">
          <Link href="/pmc" className={styles.crumbLink}>
            PMC
          </Link>
          <span className={styles.sep} aria-hidden="true">
            ›
          </span>
          <span aria-current="page">{crumb}</span>
        </nav>
        <h1 className={styles.title}>{title}</h1>
      </div>
    </div>
  );
}