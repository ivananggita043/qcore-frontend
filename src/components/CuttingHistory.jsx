import { useEffect, useMemo, useState } from "react";
import { PANELS } from "../config/cuttingProcesses.js";
import {
  PROCESS_ENUM,
  fetchDefectTypes,
  fetchMyCuttingInspections,
  updateCuttingInspection,
} from "../api/cutting.js";
import "./History.css";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const PAGE = 30;

const LABEL = {
  MARKER: "Marker",
  FABRIC: "Fabric",
  SPREADING: "Spreading",
  CUTTING: "Cutting",
  FUSE: "Fuse",
  BUNDLE_AND_NUMBERING: "Bundle & Numbering",
};
const KEY_OF = Object.fromEntries(Object.entries(PROCESS_ENUM).map(([k, v]) => [v, k]));

// satu laporan backend -> satu baris di daftar
function toRow(x) {
  const items = x.items ?? [];
  const t = new Date(x.createdAt);
  const qty = items.reduce((s, i) => s + (i.quantityInspect || 0), 0);
  const defect = items.reduce((s, i) => s + (i.totalDefect || 0), 0);
  const first = items[0];
  const process = LABEL[x.processCheck] ?? x.processCheck;
  const id = `CUT-${String(x.id).slice(0, 4).toUpperCase()}`;
  return {
    key: x.id,
    raw: x,
    id,
    ts: t.getTime(),
    label: `${t.getDate()} ${SHORT[t.getMonth()]}`,
    time: `${pad(t.getHours())}.${pad(t.getMinutes())}`,
    process,
    status: defect > 0 ? "Defect" : "Pass",
    edited: Boolean(x.updatedAt) && new Date(x.updatedAt) - t > 1000,
    buyers: [...new Set(items.map((i) => i.buyerName))],
    summary: first
      ? `${first.buyerName} / ${first.styleCode}${items.length > 1 ? ` +${items.length - 1}` : ""}`
      : "-",
    qty,
    search: [
      id,
      process,
      ...items.flatMap((i) => [i.buyerName, i.styleCode, i.colorName, i.lot]),
    ]
      .join(" ")
      .toLowerCase(),
  };
}

/* ---------- lembar edit ---------- */
function EditSheet({ row, onClose, onSave }) {
  const raw = row.raw;
  const [comment, setComment] = useState(raw.comment ?? "");
  const [items, setItems] = useState(() =>
    (raw.items ?? []).map((i) => ({
      buyer: i.buyerName ?? "",
      style: i.styleCode ?? "",
      color: i.colorName ?? "",
      lot: i.lot ?? "",
      operator: i.operatorName ?? "",
      inspect: String(i.quantityInspect ?? ""),
      typeId: i.defectTypeId ?? "",
      typeName: i.defectTypeName ?? "",
      panels: Object.fromEntries(
        PANELS.map((p) => [p, String((i.defects ?? []).find((d) => d.panel === p)?.quantity ?? 0)])
      ),
    }))
  );
  const [types, setTypes] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchDefectTypes(KEY_OF[raw.processCheck], ctrl.signal)
      .then(setTypes)
      .catch((e) => {
        if (e?.name !== "AbortError") setErr(e.message || "Failed to load defect types.");
      });
    return () => ctrl.abort();
  }, [raw.processCheck]);

  const upd = (n, change) =>
    setItems((list) => list.map((it, idx) => (idx === n ? { ...it, ...change } : it)));
  const setPanel = (n, p, v) =>
    setItems((list) =>
      list.map((it, idx) =>
        idx === n ? { ...it, panels: { ...it.panels, [p]: v.replace(/\D/g, "") } } : it
      )
    );
  const total = (it) => Object.values(it.panels).reduce((a, b) => a + (Number(b) || 0), 0);

  const save = async () => {
    setErr("");
    if (items.length === 0) return setErr("At least one style is required.");
    const seen = new Set();
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      const tag = `Style ${n + 1}`;
      for (const [k, label] of [["buyer", "Buyer"], ["style", "Style"], ["color", "Color"], ["lot", "LOT"], ["operator", "Operator name"]])
        if (!it[k].trim()) return setErr(`${tag}: ${label} is required.`);
      const key = [it.buyer, it.style, it.color, it.lot].map((x) => x.trim().toLowerCase()).join("|");
      if (seen.has(key)) return setErr(`${tag}: same Buyer, Style, Color and LOT is already used.`);
      seen.add(key);
      const insp = Number(it.inspect);
      if (!Number.isInteger(insp) || insp < 1) return setErr(`${tag}: QTY INSP must be a whole number, minimum 1.`);
      if (!it.typeId) return setErr(`${tag}: select a defect type.`);
      const t = total(it);
      if (t < 1) return setErr(`${tag}: enter the defect quantity for at least one panel.`);
      if (t > insp) return setErr(`${tag}: defect total (${t}) is greater than QTY INSP.`);
    }

    setBusy(true);
    try {
      await onSave({
        processCheck: raw.processCheck,
        lineId: raw.lineId,
        comment: comment.trim() || null,
        items: items.map((it) => ({
          buyerName: it.buyer.trim(),
          styleCode: it.style.trim(),
          colorName: it.color.trim(),
          defectTypeId: it.typeId,
          lot: it.lot.trim(),
          operatorName: it.operator.trim(),
          quantityInspect: Number(it.inspect),
          defects: PANELS.filter((p) => Number(it.panels[p]) > 0).map((p) => ({
            panel: p,
            quantity: Number(it.panels[p]),
          })),
        })),
      });
    } catch (e) {
      setErr(e?.message || "Failed to save. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="hs-overlay" onClick={busy ? undefined : onClose}>
      <div className="hs-sheet" role="dialog" aria-modal="true" aria-label="Edit check"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="hs-sheet-title">Edit {row.id}</h2>
        <p className="hs-sheet-sub">CUTTING - {row.label} - {row.time}</p>
        <p className="hs-proc"><b>Process:</b> {row.process}</p>

        {items.map((it, n) => {
          const options = types.some((t) => t.id === it.typeId)
            ? types
            : it.typeId
            ? [{ id: it.typeId, name: it.typeName || "Current type" }, ...types]
            : types;
          return (
            <section key={n} className="hs-item">
              <div className="hs-item-head">
                <span>Style {n + 1}</span>
                {items.length > 1 && (
                  <button type="button" className="hs-item-remove" onClick={() => setItems((l) => l.filter((_, i) => i !== n))}>
                    Remove
                  </button>
                )}
              </div>

              {[["buyer", "Buyer"], ["style", "Style"], ["color", "Color"], ["lot", "LOT"], ["operator", "Operator name"]].map(([k, label]) => (
                <label key={k} className="hs-field">
                  <span>{label} *</span>
                  <input value={it[k]} onChange={(e) => upd(n, { [k]: e.target.value })} />
                </label>
              ))}

              <label className="hs-field">
                <span>QTY INSP (pcs) *</span>
                <input inputMode="numeric" value={it.inspect}
                       onChange={(e) => upd(n, { inspect: e.target.value.replace(/\D/g, "") })} />
              </label>

              <label className="hs-field">
                <span>Defect type *</span>
                <select value={it.typeId} onChange={(e) => upd(n, { typeId: e.target.value })}>
                  <option value="">- select -</option>
                  {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>

              <p className="hs-proc"><b>Defect per panel</b></p>
              <div className="hs-panels">
                {PANELS.map((p) => (
                  <label key={p}>
                    {p}
                    <input inputMode="numeric" value={it.panels[p]} onChange={(e) => setPanel(n, p, e.target.value)} />
                  </label>
                ))}
              </div>
              <p className="hs-total">Total defect: {total(it)} pcs</p>
            </section>
          );
        })}

        <label className="hs-field">
          <span>Comment</span>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>

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

export default function CuttingHistory({ user, onBack }) {
  const [state, setState] = useState({ list: [], loading: true, error: "" });
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [buyer, setBuyer] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchMyCuttingInspections(ctrl.signal)
      .then((list) => setState({ list, loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: e.message || "Failed to load history." }));
      });
    return () => ctrl.abort();
  }, [tick]);

  const all = useMemo(() => state.list.map(toRow), [state.list]);
  const buyers = useMemo(() => [...new Set(all.flatMap((r) => r.buyers))].sort(), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        (buyer === "all" || r.buyers.includes(buyer)) &&
        (!q || `${r.search} ${r.label} ${r.time} ${r.status} ${r.edited ? "edited" : ""}`.toLowerCase().includes(q))
    );
    return list.sort((a, b) => (sort === "recent" ? b.ts - a.ts : a.ts - b.ts));
  }, [all, query, buyer, sort]);

  const saveEdit = async (body) => {
    await updateCuttingInspection(editing.key, body); // error ditangani lembar edit
    setEditing(null);
    setTick((t) => t + 1);
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
        <h1 className="hs-title">{user?.area ?? "CUTTING"}</h1>
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
                  <span className={`hs-badge ${c.status === "Pass" ? "pass" : "other"}`}>{c.status}</span>
                </span>
                <span className="hs-meta">{c.label} - {c.time} - {c.process}</span>
                <span className="hs-meta r">{c.summary} - {c.qty} pcs</span>
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

      {editing && <EditSheet row={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {toast && <div className="hs-toast" role="status">{toast}</div>}
    </main>
  );
}