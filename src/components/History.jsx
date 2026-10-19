import { useMemo, useState } from "react";
import { userDay, buyerOfStyle } from "../mock/dashboardData.js";
import "./History.css";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DAYS = 14;
const PAGE = 30;

/* ---------- field form per section (mengikuti DTO backend) ---------- */
const PROCESS = ["MARKER", "FABRIC", "SPREADING", "CUTTING", "FUSE", "BUNDLE_AND_NUMBERING"];
const PANELS = ["FRONT", "BACK", "SLEEVE", "BKYK", "COLLAR", "CUFF", "PCT", "PLT", "TAB"];
// TODO: ganti dengan daftar defect type dari API (defectTypeId)
const DEFECT_TYPES = {
  sewing: ["Skip stitch", "Open seam", "Broken stitch", "Puckering", "Uneven hem"],
  washing: ["Stain", "Color shading", "Uneven wash", "Hole"],
  finishing: ["Loose thread", "Stain", "Missing label", "Wrong measurement"],
  packing: ["Wrong carton label", "Missing polybag", "Wrong qty"],
};

const BASIC = [
  { k: "buyer", label: "Buyer", type: "text", required: true },
  { k: "style", label: "Style", type: "text", required: true },
  { k: "color", label: "Color", type: "text", required: true },
];

function fieldsFor(section) {
  if (section === "cutting") {
    return [
      { k: "process", label: "Process check", type: "select", options: PROCESS, required: true },
      ...BASIC,
      { k: "lot", label: "Lot", type: "text", required: true },
      { k: "operator", label: "Operator name", type: "text", required: true },
      { k: "qty", label: "Inspected qty (pcs)", type: "number", min: 1, required: true },
      { k: "panel", label: "Panel defect", type: "select", options: PANELS, required: true },
      { k: "defectQty", label: "Defect qty (pcs)", type: "number", min: 1, required: true },
      { k: "comment", label: "Comment", type: "textarea" },
    ];
  }
  return [
    ...BASIC,
    { k: "qty", label: "Inspected qty (pcs)", type: "number", min: 1, required: true },
    { k: "defectType", label: "Defect type", type: "select", options: DEFECT_TYPES[section] ?? [], optional: true },
    { k: "defectQty", label: "Defect qty (pcs)", type: "number", min: 0 },
    { k: "transfer", label: "Transfer (pcs)", type: "number", min: 0 },
    { k: "comment", label: "Notes", type: "textarea" },
  ];
}

// Dipakai saat sudah terhubung ke backend: bentuk body PUT sesuai DTO.
// cutting -> PUT /cutting-inspections/{id}, lainnya -> PUT /inspections/{id}
export function toPayload(section, v, lineId, defectTypeIdOf = (x) => x) {
  if (section === "cutting") {
    return {
      processCheck: v.process,
      lineId,
      comment: v.comment || null,
      items: [{
        buyerName: v.buyer, styleCode: v.style, colorName: v.color,
        defectTypeId: defectTypeIdOf(v.panel), lot: v.lot, operatorName: v.operator,
        quantityInspect: Number(v.qty),
        defects: [{ panel: v.panel, quantity: Number(v.defectQty) }],
      }],
    };
  }
  return {
    buyerName: v.buyer, styleCode: v.style, colorName: v.color, lineId,
    inspectedQuantity: Number(v.qty), transferQuantity: Number(v.transfer || 0),
    comment: v.comment || null,
    defects: Number(v.defectQty) > 0
      ? [{ defectTypeId: defectTypeIdOf(v.defectType), quantity: Number(v.defectQty) }]
      : [],
  };
}

/* ---------- data contoh ---------- */
const COLORS = ["Navy", "Black", "White", "Olive", "Grey"];
const OPERATORS = ["Dewi", "Rina", "Agus", "Sari", "Budi"];

function buildHistory(section) {
  const out = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(Date.now() - i * 864e5);
    const { checks } = userDay(section, toISO(d));
    checks.forEach((c, j) => {
      const s = i * 7 + j;
      const defectQty = String(c.status).toLowerCase() === "pass" ? 0 : 1 + (s % 3);
      const types = section === "cutting" ? PANELS : DEFECT_TYPES[section] ?? [];
      out.push({
        ...c,
        key: `${toISO(d)}-${j}-${c.id}`,
        label: `${d.getDate()} ${SHORT[d.getMonth()]}`,
        edited: s % 9 === 0,
        buyer: buyerOfStyle(c.style),
        color: COLORS[s % COLORS.length],
        lot: `LOT-${100 + (s % 40)}`,
        operator: OPERATORS[s % OPERATORS.length],
        process: PROCESS[s % PROCESS.length],
        panel: PANELS[s % PANELS.length],
        defectType: types[s % Math.max(1, types.length)] ?? "",
        defectQty,
        transfer: Math.max(0, c.qty - defectQty),
        comment: "",
      });
    });
  }
  return out;
}

/* ---------- lembar edit ---------- */
function EditSheet({ section, item, onClose, onSave }) {
  const fields = useMemo(() => fieldsFor(section), [section]);
  const [v, setV] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.k, String(item[f.k] ?? "")]))
  );
  const [err, setErr] = useState("");

  const set = (k, val) => { setV((o) => ({ ...o, [k]: val })); setErr(""); };

  const save = () => {
    for (const f of fields) {
      const val = String(v[f.k] ?? "").trim();
      if (f.required && !val) return setErr(`${f.label} is required.`);
      if (f.type === "number" && val !== "") {
        const n = Number(val);
        if (!Number.isInteger(n) || n < (f.min ?? 0)) return setErr(`${f.label} must be a whole number, minimum ${f.min ?? 0}.`);
      }
    }
    const qty = Number(v.qty);
    const defectQty = Number(v.defectQty || 0);
    if (defectQty > qty) return setErr("Defect quantity cannot be greater than inspected quantity.");
    if (section !== "cutting" && Number(v.transfer || 0) > qty) return setErr("Transfer quantity cannot be greater than inspected quantity.");
    if (section !== "cutting" && defectQty > 0 && !v.defectType) return setErr("Please select a defect type.");

    const patch = Object.fromEntries(
      fields.map((f) => [f.k, f.type === "number" ? Number(v[f.k] || 0) : String(v[f.k] ?? "").trim()])
    );
    patch.status = defectQty > 0 ? "Defect" : "Pass";
    onSave(patch);
  };

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
                {f.optional && <option value="">- pilih -</option>}
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea rows={3} value={v[f.k]} onChange={(e) => set(f.k, e.target.value)} />
            ) : (
              <input
                type={f.type}
                inputMode={f.type === "number" ? "numeric" : undefined}
                min={f.min}
                value={v[f.k]}
                onChange={(e) => set(f.k, e.target.value)}
              />
            )}
          </label>
        ))}

        {err && <p className="hs-err" role="alert">{err}</p>}

        <div className="hs-actions">
          <button type="button" className="hs-btn ghost" onClick={onClose}>Batal</button>
          <button type="button" className="hs-btn" onClick={save}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

export default function History({ user, section = "sewing", onBack }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [buyer, setBuyer] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [edits, setEdits] = useState({});
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  const base = useMemo(() => buildHistory(section), [section]);
  const all = useMemo(
    () => base.map((c) => (edits[c.key] ? { ...c, ...edits[c.key], edited: true } : c)),
    [base, edits]
  );
  const buyers = useMemo(() => [...new Set(all.map((c) => c.buyer))].sort(), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter(
      (c) =>
        (buyer === "all" || c.buyer === buyer) &&
        (!q ||
          `${c.id} ${c.buyer} ${c.style} ${c.color} ${c.label} ${c.time} ${c.status} ${c.edited ? "edited" : ""}`
            .toLowerCase()
            .includes(q))
    );
    if (sort === "oldest") list = [...list].reverse();
    return list;
  }, [all, query, buyer, sort]);

  const saveEdit = (patch) => {
    // TODO: await apiFetch(PUT, toPayload(section, patch, lineId)) lalu update state jika sukses
    setEdits((m) => ({ ...m, [editing.key]: patch }));
    setEditing(null);
    setToast("Changes saved.");
    setTimeout(() => setToast(""), 2200);
  };

  const title = user?.area ?? `${section.toUpperCase()}`;

  return (
    <main className="hs">
      <header className="hs-head">
        <button type="button" className="hs-back" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="hs-title">{title}</h1>
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
          <select className="hs-select" value={sort} aria-label="sort"
                  onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
          </select>
          <select className="hs-select" value={buyer} aria-label="Filter buyer"
                  onChange={(e) => { setBuyer(e.target.value); setShown(PAGE); }}>
            <option value="all">All Buyers</option>
            {buyers.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="hs-empty">No matching history found.</p>
      ) : (
        <>
          <ul className="hs-list">
            {rows.slice(0, shown).map((c) => (
              <li key={c.key} className="hs-card">
                <span className="hs-id">{c.id}</span>
                <span className="hs-badges">
                  {c.edited && <span className="hs-badge edited">Edited</span>}
                  <span className={`hs-badge ${String(c.status).toLowerCase() === "pass" ? "pass" : "other"}`}>
                    {c.status}
                  </span>
                </span>
                <span className="hs-meta">{c.label} - {c.time}</span>
                <span className="hs-meta r">{c.buyer} / {c.style} - {c.qty} pcs</span>
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
        <EditSheet section={section} item={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      )}
      {toast && <div className="hs-toast" role="status">{toast}</div>}
    </main>
  );
}