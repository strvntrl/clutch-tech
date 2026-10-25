"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHIFTS, getSystemShiftState, maxSelectableShift } from "@/lib/shift-ui";
import PmcTitle from "@/components/PmcTitle";
import NavBar from "@/components/NavBar";
import type { HeaderUser } from "@/components/UserStatus";
import hotpressLogo from "@/assets/logo-hotpress.webp";
import { PMC_LEVELS, isPmcError, type PartSuggestion, type PmcLevel } from "@/types/pmc";
import type { HpFormResponse, HpRow, HpSaveRow } from "@/types/pmc-hotpress";
import { buildHpRows, sameHpRow, toCount, toHpSaveRow } from "./helpers";

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const th: React.CSSProperties = {
  padding: "8px 4px",
  fontSize: 11,
  background: "#0a2a66",
  color: "#fff",
  border: "1px solid #072050",
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
    padding: "5px 5px",
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
  table { font-size: 9px !important; }
}`;

export default function HotpressPmcForm({ user }: { user: HeaderUser | null }) {
  const initial = getSystemShiftState();
  const [date, setDate] = useState(initial.date);
  const [shift, setShift] = useState(initial.shift);

  const [form, setForm] = useState<HpFormResponse | null>(null);
  const [rows, setRows] = useState<HpRow[]>([]);
  const [baseline, setBaseline] = useState<HpRow[]>([]);
  const [target, setTarget] = useState(0);
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
      const res = await fetch(`/api/pmc/hotpress?date=${d}&shift=${s}`);
      if (res.status === 401) {
        window.location.href = "/login?redirect=/pmc/hotpress";
        return;
      }
      const json = await res.json();
      if (isPmcError(json)) {
        setMessage({ kind: "err", text: json.error });
        return;
      }
      const f = json as HpFormResponse;
      const built = buildHpRows(f);
      setForm(f);
      setRows(built);
      setBaseline(built);
      setTarget(f.target);
      setRowErrors({});
      setPartInfo((prev) => {
        const next = { ...prev };
        for (const r of f.rows) {
          if (r.cf_no) {
            next[r.cf_no.toUpperCase()] = { part_number: r.cf_no, customer: r.customer, product_type: r.type };
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

  // ------------------------------------------------------------------
  // Status perubahan & hak akses
  // ------------------------------------------------------------------
  const dirtyRows = useMemo(
    () => rows.filter((r, i) => baseline[i] && !sameHpRow(r, baseline[i])),
    [rows, baseline]
  );
  const perms = form?.perms;
  const canEditTarget = !!perms?.canEditLocked;
  const targetDirty = !!form && canEditTarget && target !== form.target;
  const dirty = dirtyRows.length > 0 || targetDirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const isLocked = (idx: number) => !!baseline[idx]?.validated && !perms?.canEditLocked;
  const isEditable = (idx: number) => !!perms?.canEdit && !isLocked(idx) && !saving;

  const patchRow = (idx: number, patch: Partial<HpRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // ------------------------------------------------------------------
  // Autocomplete C/F No.
  // ------------------------------------------------------------------
  function onCfChange(idx: number, value: string) {
    const key = value.trim().toUpperCase();
    const info = partInfo[key];
    patchRow(idx, { cf_no: value, customer: info?.customer ?? "", type: info?.product_type ?? "" });

    clearTimeout(timers.current[idx]);
    if (!key) return;
    timers.current[idx] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/pmc/parts?q=${encodeURIComponent(value.trim())}`);
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

  // Sinkronkan type / customer baris dengan hasil pencarian part
  useEffect(() => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const key = r.cf_no.trim().toUpperCase();
        const info = key ? partInfo[key] : null;
        if (key && info === undefined) return r;
        const customer = info?.customer ?? "";
        const type = info?.product_type ?? "";
        if (r.customer === customer && r.type === type) return r;
        changed = true;
        return { ...r, customer, type };
      });
      return changed ? next : prev;
    });
  }, [partInfo]);

  function onCfBlur(idx: number) {
    const info = partInfo[rows[idx].cf_no.trim().toUpperCase()];
    if (info && info.part_number !== rows[idx].cf_no) patchRow(idx, { cf_no: info.part_number });
  }

  // ------------------------------------------------------------------
  // Simpan, validasi baris, approve
  // ------------------------------------------------------------------
  function authExpired() {
    window.location.href = "/login?redirect=/pmc/hotpress";
  }

  async function submit(payload: HpSaveRow[], okText: string) {
    setSaving(true);
    setMessage(null);
    setRowErrors({});
    try {
      const body: Record<string, unknown> = { date, shift, rows: payload };
      if (targetDirty) body.target = target;
      const res = await fetch("/api/pmc/hotpress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    submit(dirtyRows.map((r) => toHpSaveRow(r)), "Data berhasil disimpan.");
  }

  function onValidate(idx: number, checked: boolean) {
    const r = rows[idx];
    if (checked) {
      if (!r.cf_no.trim() || !r.operator.trim() || r.baik <= 0) {
        setMessage({ kind: "err", text: "C/F No., Operator, dan Baik (lebih dari 0) wajib diisi sebelum validasi." });
        return;
      }
      if (partInfo[r.cf_no.trim().toUpperCase()] === null) {
        setMessage({ kind: "err", text: `C/F No. "${r.cf_no.trim()}" tidak ditemukan di master part.` });
        return;
      }
    }
    const others = dirtyRows.filter((d) => d.row_no !== r.row_no).map((d) => toHpSaveRow(d));
    submit([...others, toHpSaveRow(r, checked)], checked ? "Baris divalidasi dan dikunci." : "Validasi baris dibuka.");
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
      const res = await fetch("/api/pmc/hotpress/approve", {
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
  const totalBaik = rows.reduce((s, r) => s + r.baik, 0);
  const totalRusak = rows.reduce((s, r) => s + r.rusak, 0);
  const percent = target > 0 ? (totalBaik / target) * 100 : null;
  const percentColor = percent === null ? "#9ca3af" : percent >= 100 ? "#2e7d32" : percent >= 80 ? "#ef6c00" : "#c62828";

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
      <datalist id="hp-cf-list">
        {suggestions.map((p) => (
          <option key={p.part_number} value={p.part_number}>
            {p.customer}
          </option>
        ))}
      </datalist>
      <datalist id="hp-operator-list">
        {(form?.operators ?? []).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="hp-machine-list">
        {(form?.machines ?? []).map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <header>
        <PmcTitle title="Laporan Harian Hotpress" crumb="Hotpress" logo={hotpressLogo} />
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
                  <strong>Baris {Number(no) + 1}:</strong> {err}
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
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1150 }}>
              <thead>
                <tr>
                  <th style={th} rowSpan={2}>NO</th>
                  <th style={th} rowSpan={2}>NO. WOS</th>
                  <th style={th} rowSpan={2}>MC NO.</th>
                  <th style={th} rowSpan={2}>TYPE</th>
                  <th style={th} rowSpan={2}>C/F NO.</th>
                  <th style={th} rowSpan={2}>CUST.</th>
                  <th style={th}>BERAT</th>
                  <th style={th} rowSpan={2}>HASIL KG</th>
                  <th style={th} colSpan={2}>HASIL PCS</th>
                  <th style={th}>TOTAL</th>
                  <th style={th}>REFF NO.</th>
                  <th style={th} colSpan={2}>PROSES</th>
                  <th style={th} rowSpan={2}>OPERATOR</th>
                  <th style={th} rowSpan={2}>KETERANGAN</th>
                  <th style={th} rowSpan={2}>VALIDASI</th>
                </tr>
                <tr>
                  <th style={th}>PCS</th>
                  <th style={th}>BAIK</th>
                  <th style={th}>RUSAK</th>
                  <th style={th}>HASIL</th>
                  <th style={th}>(SS)</th>
                  <th style={th}>START</th>
                  <th style={th}>FINISH</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const editable = isEditable(idx);
                  const locked = isLocked(idx);
                  const err = rowErrors[r.row_no];
                  const key = r.cf_no.trim().toUpperCase();
                  const cfUnknown = !!key && partInfo[key] === null;
                  const rowBg = err ? "#fdecea" : r.validated ? "#f1f8e9" : idx % 2 ? "#fafafa" : "#fff";

                  return (
                    <tr key={r.row_no} style={{ background: rowBg }}>
                      <td style={{ ...td, minWidth: 26, fontWeight: 700, color: "#546e7a" }}>{idx + 1}</td>
                      <td style={{ ...td, minWidth: 78 }}>
                        <input value={r.no_wos} disabled={!editable} onChange={(e) => patchRow(idx, { no_wos: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 64 }}>
                        <input list="hp-machine-list" value={r.mc_no} disabled={!editable} onChange={(e) => patchRow(idx, { mc_no: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 72, textAlign: "left", paddingLeft: 6 }}>{r.type}</td>
                      <td style={{ ...td, minWidth: 98 }}>
                        <input
                          list="hp-cf-list"
                          value={r.cf_no}
                          disabled={!editable}
                          onChange={(e) => onCfChange(idx, e.target.value)}
                          onBlur={() => onCfBlur(idx)}
                          title={cfUnknown ? "C/F No. tidak ditemukan di master part" : undefined}
                          style={inp(editable, cfUnknown)}
                        />
                      </td>
                      <td style={{ ...td, minWidth: 88, textAlign: "left", paddingLeft: 6 }}>{r.customer}</td>
                      <td style={{ ...td, minWidth: 54 }}>
                        <input type="number" min={0} step="any" value={r.berat_pcs} disabled={!editable} onChange={(e) => patchRow(idx, { berat_pcs: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 62 }}>
                        <input type="number" min={0} step="any" value={r.hasil_kg} disabled={!editable} onChange={(e) => patchRow(idx, { hasil_kg: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 50 }}>
                        <input type="number" min={0} value={r.baik || ""} disabled={!editable} onChange={(e) => patchRow(idx, { baik: toCount(e.target.value) })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 50 }}>
                        <input type="number" min={0} value={r.rusak || ""} disabled={!editable} onChange={(e) => patchRow(idx, { rusak: toCount(e.target.value) })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 54 }}>
                        <input type="number" min={0} value={r.total_hasil || ""} disabled={!editable} onChange={(e) => patchRow(idx, { total_hasil: toCount(e.target.value) })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 68 }}>
                        <input value={r.reff_no} disabled={!editable} onChange={(e) => patchRow(idx, { reff_no: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 70 }}>
                        <input type="time" aria-label={`Start baris ${idx + 1}`} value={r.start} disabled={!editable} onChange={(e) => patchRow(idx, { start: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 70 }}>
                        <input type="time" aria-label={`Finish baris ${idx + 1}`} value={r.finish} disabled={!editable} onChange={(e) => patchRow(idx, { finish: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 92 }}>
                        <input list="hp-operator-list" value={r.operator} disabled={!editable} onChange={(e) => patchRow(idx, { operator: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 104 }}>
                        <input value={r.keterangan} disabled={!editable} onChange={(e) => patchRow(idx, { keterangan: e.target.value })} style={inp(editable)} />
                      </td>
                      <td style={{ ...td, minWidth: 44 }}>
                        <input
                          type="checkbox"
                          aria-label={`Validasi baris ${idx + 1}`}
                          checked={!!baseline[idx]?.validated}
                          disabled={!perms?.canEdit || saving || (locked && !perms?.canEditLocked)}
                          onChange={(e) => onValidate(idx, e.target.checked)}
                          style={{ width: 18, height: 18, cursor: "pointer" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <span style={{ fontSize: 13, color: dirty ? "#e65100" : "#78909c", fontWeight: dirty ? 700 : 400 }}>
            {dirty
              ? `● ${dirtyRows.length > 0 ? `${dirtyRows.length} baris` : ""}${dirtyRows.length > 0 && targetDirty ? " + " : ""}${targetDirty ? "target" : ""} belum disimpan`
              : "Semua perubahan tersimpan"}
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
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#78909c", fontWeight: 700 }}>TARGET SHIFT (PCS)</div>
              <input
                type="number"
                min={0}
                aria-label="Target shift"
                value={target || ""}
                disabled={!canEditTarget || saving}
                placeholder="0"
                onChange={(e) => setTarget(toCount(e.target.value))}
                title={canEditTarget ? undefined : "Target hanya dapat diubah oleh Supervisor / Ast. Manager"}
                style={{ ...inp(canEditTarget && !saving), width: 130, fontSize: 20, fontWeight: 800, color: "#4a148c", padding: "4px 8px" }}
              />
            </div>
            <Stat label="TOTAL ACTUAL (BAIK)" value={totalBaik} color="#2e7d32" />
            <Stat label="TOTAL RUSAK" value={totalRusak} color="#c62828" />
            <Stat label="ACHIEVEMENT" value={percent === null ? "–" : `${percent.toFixed(1)}%`} color={percentColor} />
          </div>
          <p className="no-print" style={{ fontSize: 11, color: "#78909c", margin: "10px 0 0" }}>
            Target per shift hanya dapat diubah oleh Supervisor / Ast. Manager. Actual = jumlah kolom BAIK.
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