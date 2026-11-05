import { useEffect, useMemo, useState } from "react";
import {
  PREFIX,
  SECTION_ENUM,
  deleteInspection,
  fetchMyInspections,
  loadDefectTypes,
  updateInspection,
} from "../api/inspections.js";
import { fetchLines } from "../api/users.js";
import InspectionDetail from "./InspectionDetail.jsx";
import "./History.css";

const SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];
const pad = (n) => String(n).padStart(2, "0");
// tanggal lokal "YYYY-MM-DD" dari timestamp
const isoOf = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const PAGE = 30;

/* ---------- field yang bisa diedit per section ---------- */
const BASIC = [
  { k: "buyer", label: "Buyer", type: "text", required: true },
  { k: "style", label: "Style", type: "text", required: true },
  { k: "color", label: "Color", type: "text", required: true },
  {
    k: "qty",
    label: "Inspected qty (pcs)",
    type: "number",
    min: 1,
    required: true,
  },
];

function fieldsFor(section) {
  const f = [...BASIC];
  if (section === "sewing" || section === "finishing")
    f.push({
      k: "transfer",
      label: "Transfer (pcs)",
      type: "number",
      min: 0,
      required: true,
    });
  if (section === "washing")
    f.push(
      {
        k: "washingType",
        label: "Washing type",
        type: "select",
        options: ["BULK", "REPAIR"],
        required: true,
      },
      { k: "handfeel", label: "Handfeel", type: "text", required: true },
      { k: "grade", label: "Grade", type: "text", required: true },
    );
  if (section === "finishing")
    f.push({
      k: "process",
      label: "Process",
      type: "select",
      options: ["WASH", "NON_WASH"],
    });
  if (section === "packing")
    f.push({
      k: "cartons",
      label: "Cartons checked today",
      type: "number",
      min: 0,
      required: true,
    });
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
    by: x.submittedByName ?? "",
    lineName: x.lineName ?? "",
    lineName: x.lineName ?? "",
    by: x.submittedByName ?? "",
    totalDefect:
      x.totalDefect ?? (x.defects ?? []).reduce((a, d) => a + d.quantity, 0),
  };
}

const niceCat = (c) =>
  String(c ?? "")
    .replace(/^DEFECT_/, "")
    .replace(/_/g, " ");
const defectLabel = (t) =>
  t ? `${t.areaName || niceCat(t.category)} · ${t.name}` : "Defect";

// nilai form -> body PUT (defect dikirim ulang apa adanya)
function toBody(section, row, v, lineId, defects) {
  const body = {
    buyerName: v.buyer,
    styleCode: v.style,
    colorName: v.color,
    lineId,
    inspectedQuantity: Number(v.qty),
    transferQuantity:
      section === "sewing" || section === "finishing"
        ? Number(v.transfer)
        : row.transfer,
    comment: v.comment || null,
    defects: (defects ?? row.raw.defects ?? []).map((d) => ({
      defectTypeId: d.defectTypeId,
      quantity: Number(d.quantity),
    })),
  };
  if (row.slot) body.inspectionTimeSlot = row.slot;
  if (section === "washing") {
    body.washingType = v.washingType;
    body.handfeel = v.handfeel;
    body.grade = v.grade;
  }
  if (section === "finishing") body.process = v.process || undefined;
  if (section === "packing") body.qtyCheckCartonToday = Number(v.cartons);
  return body;
}

/* ---------- lembar edit ---------- */
function EditSheet({
  section,
  item,
  lineIds,
  lineIdOf,
  defectNames,
  defectTypes,
  onClose,
  onSave,
}) {
  const fields = useMemo(() => fieldsFor(section), [section]);
  const [v, setV] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.k, String(item[f.k] ?? "")])),
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [defs, setDefs] = useState(() =>
    (item.raw.defects ?? []).map((d) => ({
      defectTypeId: d.defectTypeId,
      quantity: String(d.quantity),
    })),
  );
  const [dq, setDq] = useState("");

  const setQty = (id, val) =>
    setDefs((l) =>
      l.map((d) =>
        d.defectTypeId === id ? { ...d, quantity: val.replace(/\D/g, "") } : d,
      ),
    );
  const removeDef = (id) => {
    setDefs((l) => l.filter((d) => d.defectTypeId !== id));
    setErr("");
  };
  const addDef = (id) => {
    if (!id) return;
    setDefs((l) => [...l, { defectTypeId: id, quantity: "1" }]);
    setDq("");
    setErr("");
  };

  // defect yang masih bisa ditambahkan, dikelompokkan per area/kategori
  const groups = useMemo(() => {
    const used = new Set(defs.map((d) => d.defectTypeId));
    const sec = SECTION_ENUM[section];
    const q = dq.trim().toLowerCase();
    const m = new Map();
    Object.values(defectTypes ?? {})
      .filter((t) => t.section === sec && !used.has(t.id))
      .forEach((t) => {
        const g = t.areaName || niceCat(t.category);
        if (q && !`${t.name} ${g}`.toLowerCase().includes(q)) return;
        if (!m.has(g)) m.set(g, []);
        m.get(g).push(t);
      });
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => ({
        name,
        list: list.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [defectTypes, defs, section, dq]);

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
          return setErr(
            `${f.label} must be a whole number, minimum ${f.min ?? 0}.`,
          );
      }
    }
    const qty = Number(v.qty);
    for (const d of defs) {
      if (!(Number(d.quantity) >= 1))
        return setErr(
          `${defectLabel(defectTypes?.[d.defectTypeId])}: quantity must be at least 1.`,
        );
    }
    const totalDefect = defs.reduce((s, d) => s + Number(d.quantity), 0);
    if (totalDefect > qty)
      return setErr(
        `Total defects (${totalDefect}) cannot be greater than inspected qty (${qty}).`,
      );
    if (
      (section === "sewing" || section === "finishing") &&
      Number(v.transfer) > qty
    )
      return setErr(
        "Transfer quantity cannot be greater than inspected quantity.",
      );
    const lineId = lineIdOf ? lineIdOf(item) : lineIds[0];
    if (!lineId)
      return setErr(
        "This record cannot be edited here because its line is unknown. Please contact your admin.",
      );
    const clean = Object.fromEntries(
      Object.entries(v).map(([k, val]) => [k, String(val).trim()]),
    );
    setBusy(true);
    try {
      await onSave(toBody(section, item, clean, lineId, defs));
    } catch (e) {
      setErr(e?.message || "Failed to save. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="hs-overlay" onClick={onClose}>
      <div
        className="hs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Edit check"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="hs-sheet-title">Edit {item.id}</h2>
        <p className="hs-sheet-sub">
          {section.toUpperCase()} - {item.label} - {item.time}
        </p>

        {fields.map((f) => (
          <label key={f.k} className="hs-field">
            <span>
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.type === "select" ? (
              <select value={v[f.k]} onChange={(e) => set(f.k, e.target.value)}>
                <option value="">- select -</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                rows={3}
                value={v[f.k]}
                onChange={(e) => set(f.k, e.target.value)}
              />
            ) : (
              <input
                type={f.type === "number" ? "text" : f.type}
                inputMode={f.type === "number" ? "numeric" : undefined}
                value={v[f.k]}
                onChange={(e) =>
                  set(
                    f.k,
                    f.type === "number"
                      ? e.target.value.replace(/\D/g, "")
                      : [
                            "buyer",
                            "style",
                            "color",
                            "handfeel",
                            "grade",
                          ].includes(f.k)
                        ? e.target.value.toUpperCase()
                        : e.target.value,
                  )
                }
              />
            )}
          </label>
        ))}

        <div className="hs-field">
          <span>
            Defects (total{" "}
            {defs.reduce((s, d) => s + Number(d.quantity || 0), 0)})
          </span>

          {defs.length === 0 && (
            <p className="hs-meta">No defects. Add one below if needed.</p>
          )}

          <ul className="hs-defs">
            {defs.map((d) => (
              <li key={d.defectTypeId} className="hs-def">
                <span className="hs-def-name">
                  {defectLabel(defectTypes?.[d.defectTypeId]) === "Defect" &&
                  defectNames[d.defectTypeId]
                    ? defectNames[d.defectTypeId]
                    : defectLabel(defectTypes?.[d.defectTypeId])}
                </span>
                <input
                  className="hs-def-qty"
                  inputMode="numeric"
                  aria-label="Defect quantity"
                  value={d.quantity}
                  onChange={(e) => setQty(d.defectTypeId, e.target.value)}
                />
                <button
                  type="button"
                  className="hs-def-del"
                  aria-label="Remove defect"
                  onClick={() => removeDef(d.defectTypeId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <input
            type="search"
            className="hs-def-search"
            placeholder="Search defect to add…"
            aria-label="Search defect to add"
            autoComplete="off"
            value={dq}
            onChange={(e) => setDq(e.target.value)}
          />

          {dq.trim() &&
            (groups.length === 0 ? (
              <p className="hs-meta">No matching defect found.</p>
            ) : (
              <div
                className="hs-def-results"
                role="listbox"
                aria-label="Defect results"
              >
                {groups.map((g) => (
                  <div key={g.name}>
                    <p className="hs-def-group">{g.name}</p>
                    {g.list.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        className="hs-def-opt"
                        onClick={() => addDef(t.id)}
                      >
                        + {t.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
        </div>

        {err && (
          <p className="hs-err" role="alert">
            {err}
          </p>
        )}

        <div className="hs-actions">
          <button
            type="button"
            className="hs-btn ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hs-btn"
            onClick={save}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- halaman ---------- */
export default function InspectionHistory({
  user,
  section = "washing",
  lineIds = [],
  isAdmin = false,
  onBack,
}) {
  const [state, setState] = useState({ list: [], loading: true, error: "" });
  const [defectTypes, setDefectTypes] = useState({}); // id -> {id,name,category,areaName}
  const [adminLines, setAdminLines] = useState([]);
  const [detailKey, setDetailKey] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [buyer, setBuyer] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ list: [], loading: true, error: "" });
    fetchMyInspections(section, ctrl.signal)
      .then((list) => setState({ list, loading: false, error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({
          list: [],
          loading: false,
          error: e.message || "Failed to load history.",
        });
      });
    loadDefectTypes()
      .then((all) =>
        setDefectTypes(Object.fromEntries(all.map((t) => [t.id, t]))),
      )
      .catch(() => {});
    if (isAdmin)
      fetchLines(ctrl.signal)
        .then(setAdminLines)
        .catch(() => {});
    return () => ctrl.abort();
  }, [section, isAdmin]);

  const all = useMemo(
    () => state.list.map((x) => toRow(section, x)).sort((a, b) => b.ts - a.ts),
    [state.list, section],
  );
  const buyers = useMemo(
    () => [...new Set(all.map((c) => c.buyer))].sort(),
    [all],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter((c) => {
      const day = isoOf(c.ts);
      return (
        (buyer === "all" || c.buyer === buyer) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!q ||
          `${c.id} ${c.buyer} ${c.style} ${c.color} ${c.label} ${c.time} ${c.by} ${c.lineName}`
            .toLowerCase()
            .includes(q))
      );
    });
    if (sort === "oldest") list = [...list].reverse();
    return list;
  }, [all, query, buyer, sort, from, to]);

  const detail = detailKey ? all.find((c) => c.key === detailKey) : null;
  const defectNames = useMemo(
    () =>
      Object.fromEntries(Object.values(defectTypes).map((t) => [t.id, t.name])),
    [defectTypes],
  );

  // user biasa hanya boleh melihat data sewing; admin boleh edit semua
  const canEdit = isAdmin || section !== "sewing";

  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  // admin: cari ID dari nama line. QC: hanya aman bila akun punya satu line.
  const lineIdOf = (item) => {
    if (isAdmin) {
      const n = norm(item.lineName);
      return adminLines.find((l) => norm(l.name) === n)?.id;
    }
    return lineIds.length === 1 ? lineIds[0] : undefined;
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };
  const replaceItem = (saved) =>
    setState((s) => ({
      ...s,
      list: s.list.map((x) => (x.id === saved.id ? saved : x)),
    }));

  const saveNotes = async (row, note) => {
    const lineId = lineIdOf(row);
    if (!lineId)
      throw new Error(
        "Line is unknown, so notes cannot be saved. Please contact your admin.",
      );
    const v = Object.fromEntries(
      fieldsFor(section).map((f) => [f.k, String(row[f.k] ?? "")]),
    );
    v.comment = note.trim();
    replaceItem(
      await updateInspection(row.key, toBody(section, row, v, lineId)),
    );
    flash("Notes saved.");
  };

  const doDelete = async (row) => {
    await deleteInspection(row.key);
    setState((s) => ({ ...s, list: s.list.filter((x) => x.id !== row.key) }));
    setDetailKey(null);
    flash("Check deleted.");
  };

  const saveEdit = async (body) => {
    const saved = await updateInspection(editing.key, body);
    replaceItem(saved);
    setEditing(null);
    flash("Changes saved.");
  };

  if (detail)
    return (
      <>
        <InspectionDetail
          section={section}
          item={detail}
          typesById={defectTypes}
          canDelete={isAdmin}
          onBack={() => setDetailKey(null)}
          onEdit={setEditing}
          onDelete={doDelete}
          onSaveNotes={saveNotes}
          canEdit={canEdit}
        />
        {editing && (
          <EditSheet
            section={section}
            item={editing}
            lineIdOf={lineIdOf}
            defectNames={defectNames}
            onClose={() => setEditing(null)}
            onSave={saveEdit}
            defectTypes={defectTypes}
          />
        )}
        {toast && (
          <div className="hs-toast" role="status">
            {toast}
          </div>
        )}
      </>
    );

  return (
    <main className="hs">
      <header className="hs-head">
        <button
          type="button"
          className="hs-back"
          aria-label="Back"
          onClick={onBack}
        >
          <svg
            width="12"
            height="20"
            viewBox="0 0 12 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 2 2 10l8 8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="hs-title">{user?.area ?? section.toUpperCase()}</h1>
      </header>

      <div className="hs-tools">
        <label className="hs-search">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search by buyer, style, or color..."
            aria-label="Search history"
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        <div className="hs-filters">
          <select
            className="hs-select"
            value={sort}
            aria-label="sort"
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
          </select>
          <select
            className="hs-select"
            value={buyer}
            aria-label="Filter buyer"
            onChange={(e) => {
              setBuyer(e.target.value);
              setShown(PAGE);
            }}
          >
            <option value="all">All Buyers</option>
            {buyers.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div className="hs-dates">
            <label className="hs-date">
              <span>From</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setShown(PAGE);
                }}
              />
            </label>
            <label className="hs-date">
              <span>To</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setShown(PAGE);
                }}
              />
            </label>
            {(from || to) && (
              <button
                type="button"
                className="hs-date-clear"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setShown(PAGE);
                }}
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {state.loading && all.length === 0 ? (
        <p className="hs-empty">Loading…</p>
      ) : state.error ? (
        <p className="hs-empty" role="alert">
          {state.error}
        </p>
      ) : rows.length === 0 ? (
        <p className="hs-empty">No matching history found.</p>
      ) : (
        <>
          <ul className="hs-list">
            {rows.slice(0, shown).map((c) => (
              <li
                key={c.key}
                className="hs-card click"
                role="button"
                tabIndex={0}
                aria-label={`Open detail ${c.id}`}
                onClick={() => setDetailKey(c.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailKey(c.key);
                  }
                }}
              >
                <span className="hs-id">{c.id}</span>
                <span className="hs-badges">                  
                  <span className="hs-badge buyer">{c.buyer}</span>
                </span>
                <span className="hs-meta">
                  {c.label} - {c.time}
                </span>
                <span className="hs-meta r">
                  {c.style} - {c.qty} pcs
                </span>
              </li>
            ))}
          </ul>
          {shown < rows.length && (
            <button
              type="button"
              className="hs-more"
              onClick={() => setShown((n) => n + PAGE)}
            >
              Show more ({rows.length - shown})
            </button>
          )}
        </>
      )}

      {toast && (
        <div className="hs-toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
