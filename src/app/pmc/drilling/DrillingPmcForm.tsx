"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHIFTS, getSystemShiftState, maxSelectableShift } from "@/lib/shift-ui";
import PmcTitle from "@/components/PmcTitle";
import NavBar from "@/components/NavBar";
import type { HeaderUser } from "@/components/UserStatus";
import drillingLogo from "@/assets/logo-drilling.webp";
import {
  KETERANGAN_OPTIONS,
  PMC_LEVELS,
  isPmcError,
  type PartSuggestion,
  type PmcFormResponse,
  type PmcLevel,
  type PmcRow,
  type PmcSaveRow,
  type PmcStation,
} from "@/types/pmc";
import { SLOTS, buildRows, sameRow, toCount, toSaveRow } from "./helpers";

const IOT_REFRESH_MS = 5_000;

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const th: React.CSSProperties = {
  padding: "8px 6px",
  fontSize: 11,
  background: "#1565c0",
  color: "#fff",
  border: "1px solid #0d47a1",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: 3,
  border: "1px solid #e0e0e0",
  fontSize: 12,
  textAlign: "center",
  verticalAlign: "middle",
};

function inp(editable: boolean, invalid = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "5px 6px",
    border: `1px solid ${invalid ? "#d32f2f" : "#cfd8dc"}`,
    borderRadius: 4,
    fontSize: 12,
    background: editable ? "#fff" : "#eceff1",
    color: "#263238",
  };
}

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  input, select { border: none !important; background: transparent !important; appearance: none; }
  table { font-size: 10px !important; }
}`;

export default function DrillingPmcForm({ user }: { user: HeaderUser | null }) {
  const initial = getSystemShiftState();
  const [date, setDate] = useState(initial.date);
  const [shift, setShift] = useState(initial.shift);

  const [form, setForm] = useState<PmcFormResponse | null>(null);
  const [rows, setRows] = useState<PmcRow[]>([]);
  const [baseline, setBaseline] = useState<PmcRow[]>([]);
  const [iot, setIot] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [partInfo, setPartInfo] = useState<Record<string, PartSuggestion | null>>({});
  const [suggestions, setSuggestions] = useState<PartSuggestion[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // ------------------------------------------------------------------
  // Muat data
  // ------------------------------------------------------------------
  const load = useCallback(async (d: string, s: string, keepMessage = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pmc/drilling?date=${d}&shift=${s}`);
      if (res.status === 401) {
        window.location.href = "/login?redirect=/pmc/drilling";
        return;
      }
      const json = await res.json();
      if (isPmcError(json)) {
        setMessage({ kind: "err", text: json.error });
        return;
      }
      const f = json as PmcFormResponse;
      const built = buildRows(f);
      setForm(f);
      setRows(built);
      setBaseline(built);
      setIot(f.iot);
      setRowErrors({});
      setPartInfo((prev) => {
        const next = { ...prev };
        for (const r of f.rows) {
          if (r.part_number) {
            next[r.part_number.toUpperCase()] = {
              part_number: r.part_number,
              customer: r.customer,
              product_type: r.product_type,
            };
          }
        }
        return next;
      });
      if (!keepMessage) setMessage(null);
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Gagal memuat data" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date, shift);
  }, [date, shift, load]);

  // Jumlah IOT diperbarui otomatis selama shift berjalan (tidak menyentuh isian pengguna)
  const isLive = form?.perms.isLive ?? false;
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/pmc/drilling/iot?date=${date}&shift=${shift}`);
        if (r.ok) setIot((await r.json()).iot);
      } catch {
        /* abaikan, coba lagi di putaran berikutnya */
      }
    }, IOT_REFRESH_MS);
    return () => clearInterval(id);
  }, [isLive, date, shift]);

  // ------------------------------------------------------------------
  // Status perubahan & hak akses
  // ------------------------------------------------------------------
  const dirtyRows = useMemo(
    () => rows.filter((r, i) => baseline[i] && !sameRow(r, baseline[i])),
    [rows, baseline]
  );
  const dirty = dirtyRows.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const perms = form?.perms;
  const isLocked = (idx: number) => !!baseline[idx]?.validated && !perms?.canEditLocked;
  const isEditable = (idx: number) => !!perms?.canEdit && !isLocked(idx) && !saving;

  const patchRow = (idx: number, patch: Partial<PmcRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // ------------------------------------------------------------------
  // Autocomplete nomor part
  // ------------------------------------------------------------------
  function onPartChange(idx: number, value: string) {
    const key = value.trim().toUpperCase();
    const info = partInfo[key];
    patchRow(idx, {
      part_number: value,
      customer: info?.customer ?? "",
      product_type: info?.product_type ?? "",
    });

    clearTimeout(timers.current[idx]);
    if (!key) return;
    timers.current[idx] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pmc/drilling/parts?q=${encodeURIComponent(value.trim())}`);
        if (!r.ok) return;
        const { parts } = (await r.json()) as { parts: PartSuggestion[] };
        setSuggestions(parts);
        setPartInfo((prev) => {
          const next = { ...prev };
          for (const p of parts) next[p.part_number.toUpperCase()] = p;
          if (!parts.some((p) => p.part_number.toUpperCase() === key)) next[key] = null;
          return next;
        });
      } catch {
        /* abaikan */
      }
    }, 250);
  }

  // Sinkronkan customer / type baris dengan hasil pencarian part
  useEffect(() => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const key = r.part_number.trim().toUpperCase();
        const info = key ? partInfo[key] : null;
        if (key && info === undefined) return r;
        const customer = info?.customer ?? "";
        const product_type = info?.product_type ?? "";
        if (r.customer === customer && r.product_type === product_type) return r;
        changed = true;
        return { ...r, customer, product_type };
      });
      return changed ? next : prev;
    });
  }, [partInfo]);

  function onPartBlur(idx: number) {
    const info = partInfo[rows[idx].part_number.trim().toUpperCase()];
    if (info && info.part_number !== rows[idx].part_number) patchRow(idx, { part_number: info.part_number });
  }

  // Keterangan berlaku per mesin (4 baris sekaligus), kecuali baris yang terkunci
  function onKeterangan(st: PmcStation, value: string) {
    setRows((prev) =>
      prev.map((r, i) =>
        r.row_no >= st.rowBase && r.row_no < st.rowBase + SLOTS && !isLocked(i) ? { ...r, keterangan: value } : r
      )
    );
  }

  // ------------------------------------------------------------------
  // Simpan, validasi baris, approve
  // ------------------------------------------------------------------
  function authExpired() {
    window.location.href = "/login?redirect=/pmc/drilling";
  }

  async function submit(payload: PmcSaveRow[], okText: string) {
    setSaving(true);
    setMessage(null);
    setRowErrors({});
    try {
      const res = await fetch("/api/pmc/drilling", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, shift, rows: payload }),
      });
      if (res.status === 401) return authExpired();
      const json = await res.json();
      if (!res.ok) {
        setRowErrors(json.rowErrors ?? {});
        setMessage({ kind: "err", text: json.error ?? "Gagal menyimpan" });
        return;
      }
      await load(date, shift, true);
      setMessage({ kind: "ok", text: okText });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  }

  function onSave() {
    if (!dirty) return;
    submit(dirtyRows.map((r) => toSaveRow(r)), "Data berhasil disimpan.");
  }

  function onValidate(idx: number, checked: boolean) {
    const r = rows[idx];
    if (checked) {
      if (!r.part_number.trim() || !r.operator.trim() || r.actual <= 0) {
        setMessage({ kind: "err", text: "Validasi memerlukan Part No., Operator, dan Actual lebih dari 0." });
        return;
      }
      if (partInfo[r.part_number.trim().toUpperCase()] === null) {
        setMessage({ kind: "err", text: `Part No. "${r.part_number.trim()}" tidak ditemukan di master part.` });
        return;
      }
    }
    const others = dirtyRows.filter((d) => d.row_no !== r.row_no).map((d) => toSaveRow(d));
    submit(
      [...others, toSaveRow(r, checked)],
      checked ? "Baris divalidasi dan dikunci." : "Validasi baris dibuka."
    );
  }

  async function onApprove(level: PmcLevel, checked: boolean) {
    if (dirty) {
      setMessage({ kind: "err", text: "Simpan perubahan terlebih dahulu sebelum approve." });
      return;
    }
    const label = PMC_LEVELS.find((l) => l.level === level)?.label ?? level;
    if (!window.confirm(`${checked ? "Approve" : "Batalkan approval"} laporan ${shift} ${date} sebagai ${label}?`)) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pmc/drilling/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, shift, level, value: checked }),
      });
      if (res.status === 401) return authExpired();
      const json = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: json.error ?? "Gagal menyimpan approval" });
        return;
      }
      setForm((f) => (f ? { ...f, approve: json.approve } : f));
      setMessage({ kind: "ok", text: checked ? "Approval tersimpan." : "Approval dibatalkan." });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Gagal menyimpan approval" });
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------------
  // Navigasi tanggal / shift
  // ------------------------------------------------------------------
  const sys = getSystemShiftState();
  const maxShift = maxSelectableShift(date);
  const guard = () => !dirty || window.confirm("Ada perubahan yang belum disimpan. Tinggalkan?");

  function onDateChange(newDate: string) {
    if (!newDate || !guard()) return;
    const max = maxSelectableShift(newDate);
    setDate(newDate);
    if (parseInt(shift.replace("Shift-", ""), 10) > max) setShift(`Shift-${max}`);
  }

  function onShiftChange(value: string) {
    if (!guard()) return;
    setShift(value);
  }

  // ------------------------------------------------------------------
  // Rekap
  // ------------------------------------------------------------------
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalNg = rows.reduce((s, r) => s + r.ng, 0);
  const totalIot = Object.values(iot).reduce((s, v) => s + v, 0);
  const anyApproved = form ? Object.values(form.approve).some(Boolean) : false;
  // Sama seperti versi PHP: sebelum ada approval, "actual" rekap mengikuti IOT; sesudahnya hasil input.
  const summaryActual = anyApproved ? totalActual : totalIot;
  const ach = totalTarget > 0 ? Math.round((summaryActual / totalTarget) * 100) : 0;

  const stationLabel = (rowNo: number) => {
    const st = form?.stations.find((s) => rowNo >= s.rowBase && rowNo < s.rowBase + SLOTS);
    return st ? `${st.code} baris ${rowNo - st.rowBase + 1}` : `Baris ${rowNo}`;
  };

  const statusChip = !perms
    ? null
    : perms.isLive
    ? { text: "● SHIFT BERJALAN", bg: "#e8f5e9", color: "#2e7d32" }
    : perms.started
    ? { text: "SHIFT SELESAI", bg: "#eceff1", color: "#546e7a" }
    : { text: "BELUM DIMULAI", bg: "#fff8e1", color: "#8d6e00" };

  return (
    <div
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <style>{PRINT_CSS}</style>
      {user && (
        <NavBar
          fullName={user.fullName}
          role={user.role}
          embedded
          filters={{
            date,
            onDateChange,
            maxDate: sys.date,
            shift,
            onShiftChange,
            shiftOptions: SHIFTS.filter((s) => s.no <= maxShift),
          }}
          extra={
            statusChip ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 14, background: statusChip.bg, color: statusChip.color }}>
                {statusChip.text}
              </span>
            ) : null
          }
        />
      )}
      <datalist id="pmc-part-list">
        {suggestions.map((p) => (
          <option key={p.part_number} value={p.part_number}>
            {p.customer}
          </option>
        ))}
      </datalist>
      <datalist id="pmc-operator-list">
        {(form?.operators ?? []).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      <header>
        <PmcTitle title="Laporan Harian Drilling" crumb="Drilling" logo={drillingLogo} />
      </header>

      {perms && !perms.canEdit && (
        <div className="no-print" style={{ background: "#eceff1", color: "#37474f", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
          🔒 Mode lihat saja. {perms.reason}
        </div>
      )}

      {message && (
        <div
          className="no-print"
          style={{
            background: message.kind === "ok" ? "#e8f5e9" : "#fdecea",
            color: message.kind === "ok" ? "#2e7d32" : "#c62828",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {message.text}
          {Object.keys(rowErrors).length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {Object.entries(rowErrors).map(([no, err]) => (
                <li key={no}>
                  <strong>{stationLabel(Number(no))}:</strong> {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section style={card}>
        {!form ? (
          <p style={{ color: "#888" }}>{loading ? "Memuat form..." : "Form tidak tersedia."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={th}>MESIN</th>
                  <th style={th}>PART NO</th>
                  <th style={th}>CUSTOMER</th>
                  <th style={th}>TYPE</th>
                  <th style={th}>JML MATA BOR</th>
                  <th style={th}>UKURAN MATA BOR</th>
                  <th style={th}>JAM</th>
                  <th style={th}>IOT</th>
                  <th style={th}>TARGET</th>
                  <th style={th}>ACTUAL</th>
                  <th style={th}>NG</th>
                  <th style={th}>OPERATOR</th>
                  <th style={th}>KETERANGAN</th>
                  <th style={th}>VALIDASI</th>
                </tr>
              </thead>
              <tbody>
                {form.stations.map((st, si) => {
                  const stRows = rows.slice(si * SLOTS, si * SLOTS + SLOTS);
                  const sumIn = stRows.reduce((s, r) => s + r.actual + r.ng, 0);
                  const stIot = iot[st.code] ?? 0;
                  const over = st.hasIot && sumIn > stIot;
                  const ketValue = stRows.find((r) => r.keterangan)?.keterangan ?? "";
                  const ketEditable = stRows.some((_, k) => isEditable(si * SLOTS + k));

                  return stRows.map((r, k) => {
                    const idx = si * SLOTS + k;
                    const editable = isEditable(idx);
                    const locked = isLocked(idx);
                    const err = rowErrors[r.row_no];
                    const partKey = r.part_number.trim().toUpperCase();
                    const partUnknown = !!partKey && partInfo[partKey] === null;
                    const rowBg = err ? "#fdecea" : r.validated ? "#f1f8e9" : k % 2 ? "#fafafa" : "#fff";

                    return (
                      <tr key={r.row_no} style={{ background: rowBg, borderTop: k === 0 ? "3px solid #90a4ae" : undefined }}>
                        {k === 0 && (
                          <td rowSpan={SLOTS} style={{ ...td, fontWeight: 800, color: "#0d47a1", background: "#e3f2fd", minWidth: 76 }}>
                            {st.code}
                          </td>
                        )}
                        <td style={{ ...td, minWidth: 120 }}>
                          <input
                            list="pmc-part-list"
                            value={r.part_number}
                            disabled={!editable}
                            onChange={(e) => onPartChange(idx, e.target.value)}
                            onBlur={() => onPartBlur(idx)}
                            title={partUnknown ? "Part No. tidak ditemukan di master part" : undefined}
                            style={inp(editable, partUnknown)}
                          />
                        </td>
                        <td style={{ ...td, minWidth: 120, textAlign: "left", paddingLeft: 6 }}>{r.customer}</td>
                        <td style={{ ...td, minWidth: 90, textAlign: "left", paddingLeft: 6 }}>{r.product_type}</td>
                        <td style={{ ...td, minWidth: 64 }}>
                          <input value={r.jumlah_mata_bor} disabled={!editable} onChange={(e) => patchRow(idx, { jumlah_mata_bor: e.target.value })} style={inp(editable)} />
                        </td>
                        <td style={{ ...td, minWidth: 80 }}>
                          <input value={r.ukuran_bor} disabled={!editable} onChange={(e) => patchRow(idx, { ukuran_bor: e.target.value })} style={inp(editable)} />
                        </td>
                        <td style={{ ...td, minWidth: 66, color: "#546e7a" }}>{r.jam_operasional || "-"}</td>

                        {k === 0 && (
                          <td rowSpan={SLOTS} style={{ ...td, minWidth: 64, background: over ? "#ffebee" : "#fffde7", fontWeight: 800 }}>
                            {st.hasIot ? (
                              <>
                                <div style={{ fontSize: 18, color: "#e65100" }}>{stIot}</div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: over ? "#c62828" : "#78909c" }}>
                                  input: {sumIn}
                                </div>
                              </>
                            ) : (
                              <span style={{ color: "#b0bec5" }}>-</span>
                            )}
                          </td>
                        )}

                        <td style={{ ...td, minWidth: 66 }}>
                          <input type="number" min={0} value={r.target || ""} disabled={!editable} onChange={(e) => patchRow(idx, { target: toCount(e.target.value) })} style={inp(editable)} />
                        </td>
                        <td style={{ ...td, minWidth: 66 }}>
                          <input type="number" min={0} value={r.actual || ""} disabled={!editable} onChange={(e) => patchRow(idx, { actual: toCount(e.target.value) })} style={inp(editable)} />
                        </td>
                        <td style={{ ...td, minWidth: 56 }}>
                          <input type="number" min={0} value={r.ng || ""} disabled={!editable} onChange={(e) => patchRow(idx, { ng: toCount(e.target.value) })} style={inp(editable)} />
                        </td>
                        <td style={{ ...td, minWidth: 120 }}>
                          <input
                            list="pmc-operator-list"
                            value={r.operator}
                            disabled={!editable}
                            onChange={(e) => patchRow(idx, { operator: e.target.value })}
                            style={inp(editable)}
                          />
                        </td>

                        {k === 0 && (
                          <td rowSpan={SLOTS} style={{ ...td, minWidth: 160 }}>
                            <select
                              value={ketValue}
                              disabled={!ketEditable}
                              onChange={(e) => onKeterangan(st, e.target.value)}
                              style={inp(ketEditable)}
                            >
                              <option value="">- pilih -</option>
                              {KETERANGAN_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        <td style={{ ...td, minWidth: 60 }}>
                          <input
                            type="checkbox"
                            aria-label={`Validasi ${st.code} baris ${k + 1}`}
                            checked={!!baseline[idx]?.validated}
                            disabled={!perms?.canEdit || saving || (locked && !perms?.canEditLocked)}
                            onChange={(e) => onValidate(idx, e.target.checked)}
                            style={{ width: 18, height: 18, cursor: "pointer" }}
                          />
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <span style={{ fontSize: 13, color: dirty ? "#e65100" : "#78909c", fontWeight: dirty ? 700 : 400 }}>
            {dirty ? `● ${dirtyRows.length} baris belum disimpan` : "Semua perubahan tersimpan"}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => window.print()}
              style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #546e7a", background: "#fff", color: "#37474f", fontWeight: 700, cursor: "pointer" }}
            >
              CETAK
            </button>
            <button
              onClick={onSave}
              disabled={!dirty || saving || !perms?.canEdit}
              style={{
                padding: "9px 26px",
                borderRadius: 8,
                border: "none",
                background: !dirty || saving || !perms?.canEdit ? "#b0bec5" : "#1565c0",
                color: "#fff",
                fontWeight: 800,
                cursor: !dirty || saving || !perms?.canEdit ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "MENYIMPAN..." : "SIMPAN"}
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <div style={{ ...card, flex: "2 1 420px" }}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px", color: "#0d47a1" }}>REKAP SHIFT</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Stat label="TOTAL TARGET" value={totalTarget} color="#4a148c" />
            <Stat label="TOTAL ACTUAL" value={summaryActual} color="#2e7d32" />
            <Stat label="TOTAL NG" value={totalNg} color="#c62828" />
            <Stat label="ACHIEVEMENT" value={`${ach}%`} color="#1565c0" />
          </div>
          <p style={{ fontSize: 11, color: "#78909c", margin: "10px 0 0" }}>
            {anyApproved
              ? "Actual dihitung dari hasil input (laporan sudah di-approve)."
              : `Actual sementara mengikuti jumlah IOT (${totalIot}); berubah ke hasil input setelah ada approval.`}
          </p>
        </div>

        <div style={{ ...card, flex: "1 1 320px" }}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px", color: "#0d47a1" }}>APPROVAL</h2>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {PMC_LEVELS.map(({ level, label }) => {
              const can = !!perms?.canApprove[level] && !saving;
              return (
                <label key={level} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, opacity: can || form?.approve[level] ? 1 : 0.6 }}>
                  <input
                    type="checkbox"
                    aria-label={`Approve ${label}`}
                    checked={!!form?.approve[level]}
                    disabled={!can}
                    onChange={(e) => onApprove(level, e.target.checked)}
                    style={{ width: 22, height: 22, cursor: can ? "pointer" : "not-allowed" }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          <p className="no-print" style={{ fontSize: 11, color: "#78909c", margin: "10px 0 0" }}>
            Setiap tingkat hanya dapat di-approve oleh role-nya sendiri, setelah shift dimulai.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#78909c", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}