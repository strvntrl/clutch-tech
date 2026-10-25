"use client";

import { useEffect, useState } from "react";
import monitor from "./MonitorHeader.module.css";

interface ShiftOption {
  value: string;
  label: string;
}

/** Kotak filter tanggal. */
export function DateBox({
  date,
  onChange,
  max,
}: {
  date: string;
  onChange: (date: string) => void;
  max?: string;
}) {
  return (
    <label className={monitor.box}>
      <span className={monitor.boxLabel}>Date</span>
      <input
        type="date"
        className={monitor.dateInput}
        value={date}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Kotak pilihan shift. */
export function ShiftBox({
  shift,
  onChange,
  options,
}: {
  shift: string;
  onChange: (shift: string) => void;
  options: readonly ShiftOption[];
}) {
  return (
    <label className={monitor.box}>
      <span className={monitor.boxLabel}>Select Shift</span>
      <select
        className={monitor.select}
        value={shift}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
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

/** Kotak jam digital (WIB). */
export function TimeBox() {
  // null di render pertama supaya HTML server dan klien sama (cegah hydration mismatch)
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`${monitor.box} ${monitor.timeBox}`}
      role="timer"
      aria-label="Waktu sekarang (WIB)"
    >
      <span className={monitor.boxLabel}>Time</span>
      <span className={monitor.time}>{clock ?? "--.--.--"}</span>
    </div>
  );
}