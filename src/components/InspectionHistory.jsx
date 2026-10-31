import { useEffect, useMemo, useState } from "react";
import {
  PREFIX,
  fetchMyInspections,
  loadDefectTypes,
  updateInspection,
} from "../api/inspections.js";
import "./History.css";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const PAGE = 30;

/* ---------- field yang bisa diedit per section ---------- */
const BASIC = [
  { k: "buyer", label: "Buyer", type: "text", required: true },
  { k: "style", label: "Style", type: "text", required: true },
  { k: "color", label: "Color", type: "text", required: true },
  { k: "qty", label: "Inspected qty (pcs)", type: "number", min: 1, required: true },
];

function fieldsFor(section) {
  const f = [...BASIC];
  if (section === "sewing" || section === "finishing")
    f.push({ k: "transfer", label: "Transfer (pcs)", type: "number", min: 0, required: true });
  if (section === "washing")
    f.push(
      { k: "washingType", label: "Washing type", type: "select", options: ["BULK", "REPAIR"], required: true },
      { k: "handfeel", label: "Handfeel", type: "text", required: true },
      { k: "grade", label: "Grade", type: "text", required: true }
    );
  if (section === "finishing")
    f.push({ k: "process", label: "Process", type: "select", options: ["WASH", "NON_WASH"], required: true });
  if (section === "packing")
    f.push({ k: "cartons", label: "Cartons checked today", type: "number", min: 0, required: true });
  f.push({ k: "comment", label: "Notes", type: "textarea" });
  return f;
}

// satu data backend -> satu baris daftar
function toRow(section, x) {
  const t = new Date(x.createdAt);
  return {
    key: x.id,
    raw: x,
    id: `${PREFIX[section]}-${String(x.id).slice(0, 4).toUpperCase()}`,
    ts: t.getTime(),
    label: `${t.getDate()} ${SHORT[t.getMonth()]}`,
    time: `${pad(t.getHours())}.${pad(t.getMinutes())}`,
    buyer: x.buyerName,
    style: x.styleCode,
    color: x.colorName,
    qty: x.inspectQuantity,
    transfer: x.transferQuantity ?? 0,
    washingType: x.washingType ?? "",
    handfeel: x.handfeel ?? "",
    grade: x.grade ?? "",
    process: x.process ?? "",
    cartons: x.qtyCheckCartonToday ?? 0,
    comment: x.comment ?? "",
    slot: x.inspectionTimeSlot ?? "",
    edited: Boolean(x.updatedAt) && new Date(x.updatedAt) - t > 1000,
  };
}

// nilai form -> body PUT (defect dikirim ulang apa adanya)
function toBody(section, row, v, lineId) {
  const body = {
    buyerName: v.buyer,
    styleCode: v.style,
    colorName: v.color,
    lineId,
    inspectedQuantity: Number(v.qty),
    transferQuantity: section === "sewing" || section === "finishing" ? Number(v.transfer) : row.transfer,
    comment: v.comment || null,
    defects: (row.raw.defects ?? []).map((d) => ({
      defectTypeId: d.defectTypeId,
      quantity: d.quantity,
    })),
  };
  if (row.slot) body.inspectionTimeSlot = row.slot;
  if (section === "washing") {
    body.washingType = v.washingType;
    body.handfeel = v.handfeel;
    body.grade = v.grade;
  }
  if (section === "finishing") body.process = v.process;
  if (section === "packing") body.qtyCheckCartonToday = Number(v.cartons);
  return body;
}

/* ---------- lembar edit ---------- */
function EditSheet({ section, item, lineIds, defectNames, onClose, onSave }) {
  const fields = useMemo(() => fieldsFor(section), [section]);
  const [v, setV] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.k, String(item[f.k] ?? "")]))
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k, val) => {
    setV((o) => ({ ...o, [k]: val }));
    setErr("");
  };

  const save = async () => {
    for (const f of fields) {
      const val = String(v[f.k] ?? "").trim();
      if (f.required && !val) return setErr(`${f.label} is required.`);
      if (f.type === "number" && val !== "") {
        const n = Number(val);
        if (!Number.isInteger(n) || n < (f.min ?? 0))
          return setErr(`${f.label} must be a whole number, minimum ${f.min ?? 0}.`);
      }
    }
    const qty = Number(v.qty);
    const totalDefect = (item.raw.defects ?? []).reduce((s, d) => s + d.quantity, 0);
    if (totalDefect > qty)
      return setErr(`Inspected qty cannot be less than the recorded defects (${totalDefect}).`);
    if ((section === "sewing" || section === "finishing") && Number(v.transfer) > qty)
      return setErr("Transfer quantity cannot be greater than inspected quantity.");
    if (lineIds.length !== 1)
      return setErr("This record cannot be edited here because its line is unknown. Please contact your admin.");

    const clean = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val).trim()]));
    setBusy(true);
    try {
      await onSave(toBody(section, item, clean, lineIds[0]));
    } catch (e) {
      setErr(e?.message || "Failed to save. Please try again.");
      setBusy(false);
    }
  };

  const defects = item.raw.defects ?? [];

  return (
    <div className="hs-overlay" onClick={onClose}>
      <div className="hs-sheet" role="dialog" aria-modal="true" aria-label="Edit check"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="hs-sheet-title">Edit {item.id}</h2>
        <p className="hs-sheet-sub">{section.toUpperCase()} - {item.label} - {item.time}</p>

        {fields.map((f) => (
          <label key={f.k} className="hs-field">
            <span>{f.label}{f.required ? " *" : ""}</span>
            {f.type === "select" ? (
              <select value={v[f.k]} onChange={(e) => set(f.k, e.target.value)}>
                <option value="">- select -</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea rows={3} value={v[f.k]} onChange={(e) => set(f.k, e.target.value)} />
            ) : (
              <input
                type={f.type === "number" ? "text" : f.type}
                inputMode={f.type === "number" ? "numeric" : undefined}
                value={v[f.k]}
                onChange={(e) => set(f.k, f.type === "number" ? e.target.value.replace(/\D/g, "") : e.target.value)}
              />
            )}
          </label>
        ))}

        <div className="hs-field">
          <span>Defects (read only)</span>
          {defects.length === 0 ? (
            <p className="hs-meta">No defects recorded.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16 }}>
              {defects.map((d) => (
                <li key={d.id ?? d.defectTypeId}>
                  {defectNames[d.defectTypeId] ?? "Defect"} ×{d.quantity}
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="hs-err" role="alert">{err}</p>}

        <div className="hs-actions">
          <button type="button" className="hs-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="hs-btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- halaman ---------- */
export default function InspectionHistory({ user, section = "washing", lineIds = [], onBack }) {
  const [state, setState] = useState({ list: [], loading: true, error: "" });
  const [defectNames, setDefectNames] = useState({});
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [buyer, setBuyer] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ list: [], loading: true, error: "" });
    fetchMyInspections(section, ctrl.signal)
      .then((list) => setState({ list, loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({ list: [], loading: false, error: e.message || "Failed to load history." });
      });
    loadDefectTypes()
      .then((all) => setDefectNames(Object.fromEntries(all.map((t) => [t.id, t.name]))))
      .catch(() => {}); // nama defect hanya pelengkap
    return () => ctrl.abort();
  }, [section]);

  const all = useMemo(
    () => state.list.map((x) => toRow(section, x)).sort((a, b) => b.ts - a.ts),
    [state.list, section]
  );
  const buyers = useMemo(() => [...new Set(all.map((c) => c.buyer))].sort(), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter(
      (c) =>
        (buyer === "all" || c.buyer === buyer) &&
        (!q || `${c.id} ${c.buyer} ${c.style} ${c.color} ${c.label} ${c.time} ${c.edited ? "edited" : ""}`
          .toLowerCase().includes(q))
    );
    if (sort === "oldest") list = [...list].reverse();
    return list;
  }, [all, query, buyer, sort]);

  const saveEdit = async (body) => {
    const saved = await updateInspection(editing.key, body); // error ditangani lembar edit
    setState((s) => ({ ...s, list: s.list.map((x) => (x.id === saved.id ? saved : x)) }));
    setEditing(null);
    setToast("Changes saved.");
    setTimeout(() => setToast(""), 2200);
  };

  return (
    <main className="hs">
      <header className="hs-head">
        <button type="button" className="hs-back" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="hs-title">{user?.area ?? section.toUpperCase()}</h1>
      </header>

      <div className="hs-tools">
        <label className="hs-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search by buyer, style, or color..."
            aria-label="Search history"
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          />
        </label>
        <div className="hs-filters">
          <select className="hs-select" value={sort} aria-label="sort" onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
          </select>
          <select className="hs-select" value={buyer} aria-label="Filter buyer"
                  onChange={(e) => { setBuyer(e.target.value); setShown(PAGE); }}>
            <option value="all">All Buyers</option>
            {buyers.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {state.loading && all.length === 0 ? (
        <p className="hs-empty">Loading…</p>
      ) : state.error ? (
        <p className="hs-empty" role="alert">{state.error}</p>
      ) : rows.length === 0 ? (
        <p className="hs-empty">No matching history found.</p>
      ) : (
        <>
          <ul className="hs-list">
            {rows.slice(0, shown).map((c) => (
              <li key={c.key} className="hs-card">
                <span className="hs-id">{c.id}</span>
                <span className="hs-badges">
                  {c.edited && <span className="hs-badge edited">Edited</span>}
                  <span className="hs-badge buyer">{c.buyer}</span>
                </span>
                <span className="hs-meta">{c.label} - {c.time}</span>
                <span className="hs-meta r">{c.style} - {c.qty} pcs</span>
                <button type="button" className="hs-edit" onClick={() => setEditing(c)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {shown < rows.length && (
            <button type="button" className="hs-more" onClick={() => setShown((n) => n + PAGE)}>
              Show more ({rows.length - shown})
            </button>
          )}
        </>
      )}

      {editing && (
        <EditSheet
          section={section}
          item={editing}
          lineIds={lineIds}
          defectNames={defectNames}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
      {toast && <div className="hs-toast" role="status">{toast}</div>}
    </main>
  );
}