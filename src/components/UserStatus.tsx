"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import monitor from "./MonitorHeader.module.css";
import styles from "./UserStatus.module.css";

export interface HeaderUser {
  fullName: string;
  role: string;
}

/** Status user yang sedang login + tombol logout (dipakai navbar PMC dan header monitor). */
export default function UserStatus({
  user,
  className = "",
}: {
  user: HeaderUser;
  className?: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className={`${styles.group} ${className}`}>
      <div className={`${monitor.box} ${styles.userBox}`}>
        <span className={monitor.boxLabel}>{user.role}</span>
        <span className={styles.userName} title={user.fullName}>
          {user.fullName}
        </span>
      </div>
      <button
        type="button"
        className={styles.logout}
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Keluar..." : "Logout"}
      </button>
    </div>
  );
}