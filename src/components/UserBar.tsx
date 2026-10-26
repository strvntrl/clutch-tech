"use client";

import { useRouter } from "next/navigation";
import { roleLabel } from "@/lib/roles";

interface Props {
  fullName: string;
  role: string;
}

export default function UserBar({ fullName, role }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span>
        <strong>{fullName}</strong> <span style={{ color: "#777" }}>({roleLabel(role)})</span>
      </span>
      <button
        onClick={handleLogout}
        style={{
          padding: "5px 12px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}