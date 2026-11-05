import { useEffect, useMemo, useState } from "react";
import "./InspectionDetail.css";

const MONTHS = [
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
const dateText = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const timeText = (ts) => {
  const d = new Date(ts);
  const wib = d.getTimezoneOffset() === -420 ? " WIB" : "";
  return `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}${wib}`;
};
const nice = (s) =>
  String(s ?? "")
    .replace(/^DEFECT_/, "")
    .replace(/_/g, " ");
const cap = (s) => (s ? s[0] + s.slice(1).toLowerCase() : "-");
const fmt = (n) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

// defect rate: makin kecil makin baik. Warna selalu disertai teks.
const level = (r) => (r <= 5 ? "good" : r <= 10 ? "warn" : "bad");
const LEVEL_TEXT = { good: "Good", warn: "Watch", bad: "High" };

function infoRows(section, c) {
  const rows = [
    ["Inspection ID", c.id],
    ["Buyer", c.buyer],
    ["Style", c.style],
    ["Color", c.color],
    ["Inspect", `${c.qty} pcs`],
  ];
  if (section === "washing")
    rows.push(
      ["Type", cap(c.washingType)],
      ["Handfeel", c.handfeel || "-"],
      ["Grade", c.grade || "-"],
    );
  if (section === "finishing" && c.process)
    rows.push(["Process", c.process === "WASH" ? "Wash" : "Non-Wash"]);
  if (section === "packing") rows.push(["Cartons checked", String(c.cartons)]);
  rows.push(["Date", dateText(c.ts)], ["Time", timeText(c.ts)]);
  if (c.slot) rows.push(["Hour", c.slot]);
  rows.push(["Line", c.lineName || "-"], ["Submitted by", c.by || "-"]);
  return rows;
}

export default function InspectionDetail({
  section,
  item,
  typesById,
  canEdit = true,
  canDelete,
  onBack,
  onEdit,
  onDelete,
  onSaveNotes,
}) {
  const c = item;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [c.key]);

  /* ---------- ringkasan angka ---------- */
  const defects = c.totalDefect;
  const rate = c.qty ? (defects / c.qty) * 100 : 0;
  const lv = level(rate);
  const transferCard = section === "sewing" || section === "finishing";

  /* ---------- defect dikelompokkan per area (atau kategori) ---------- */
  const groups = useMemo(() => {
    const m = new Map();
    (c.raw.defects ?? []).forEach((d) => {
      const t = typesById[d.defectTypeId];
      const area = t ? t.areaName || nice(t.category) || "Other" : "Unknown";
      const g = m.get(area) ?? { name: area, total: 0, types: [] };
      g.total += d.quantity;
      g.types.push({ name: t?.name ?? "Defect", count: d.quantity });
      m.set(area, g);
    });
    return [...m.values()]
      .map((g) => ({ ...g, types: g.types.sort((a, b) => b.count - a.count) }))
      .sort((a, b) => b.total - a.total);
  }, [c, typesById]);

  const [open, setOpen] = useState(undefined); // undefined = area teratas terbuka
  const openName = open === undefined ? groups[0]?.name : open;

  /* ---------- catatan ---------- */
  const [editNote, setEditNote] = useState(false);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [busy, setBusy] = useState(false);

  const startNote = () => {
    setNote(c.comment);
    setNoteErr("");
    setEditNote(true);
  };
  const saveNote = async () => {
    setBusy(true);
    setNoteErr("");
    try {
      await onSaveNotes(c, note);
      setEditNote(false);
    } catch (e) {
      setNoteErr(e?.message || "Failed to save notes. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- hapus ---------- */
  const [confirmDel, setConfirmDel] = useState(false);
  const [delErr, setDelErr] = useState("");
  const doDelete = async () => {
    setBusy(true);
    setDelErr("");
    try {
      await onDelete(c);
    } catch (e) {
      setDelErr(e?.message || "Failed to delete. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="idt">
      <div className="idt-wrap">
        <header className="idt-head">
          <button
            type="button"
            className="idt-back"
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
          <h1 className="idt-title">Result Detail</h1>
        </header>

        <div className="idt-grid">
          {/* kolom kiri: data, tombol, angka */}
          <div className="idt-col">
            <dl className="idt-info">
              {infoRows(section, c).map(([k, v]) => (
                <div key={k} className="idt-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            <div className="idt-actions">
              {canEdit && (
                <button
                  type="button"
                  className="idt-btn primary"
                  onClick={() => onEdit(c)}
                  disabled={busy}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit
                </button>
              )}

              {canDelete &&
                (!confirmDel ? (
                  <button
                    type="button"
                    className="idt-btn danger"
                    onClick={() => setConfirmDel(true)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                ) : (
                  <div
                    className="idt-confirm"
                    role="alertdialog"
                    aria-label="Confirm delete"
                  >
                    <p>
                      Delete <strong>{c.id}</strong>? This action cannot be
                      undone.
                    </p>
                    {delErr && (
                      <p className="idt-err" role="alert">
                        {delErr}
                      </p>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(false)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="yes"
                        onClick={doDelete}
                        disabled={busy}
                      >
                        {busy ? "Deleting…" : "Yes, delete"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="idt-stats">
              <div className="idt-stat">
                <strong className="bad">{fmt(defects)}</strong>
                <span>Defect Found</span>
              </div>
              <div className="idt-stat">
                <strong className={lv}>{fmt(rate)}%</strong>
                <span>% Defect</span>
                <em className={lv}>{LEVEL_TEXT[lv]}</em>
              </div>
              <div className="idt-stat">
                <strong className="ink">
                  {fmt(transferCard ? c.transfer : c.qty)}
                </strong>
                <span>{transferCard ? "QTY Transfer" : "QTY Inspect"}</span>
              </div>
            </div>
          </div>

          {/* kolom kanan: defect dan catatan */}
          <div className="idt-col">
            <section className="idt-card" aria-label="Most area defect">
              <h2>Most area defect</h2>
              {groups.length === 0 ? (
                <p className="idt-muted">
                  No defects recorded. This check passed.
                </p>
              ) : (
                <>
                  <p className="idt-hint">
                    Tap an area to see its defect types.
                  </p>
                  <ul className="idt-areas">
                    {groups.map((g) => {
                      const isOpen = openName === g.name;
                      return (
                        <li key={g.name}>
                          <button
                            type="button"
                            className={`idt-area ${isOpen ? "open" : ""}`}
                            aria-expanded={isOpen}
                            onClick={() => setOpen(isOpen ? null : g.name)}
                          >
                            <span className="nm">{g.name}</span>
                            <b>{g.total}</b>
                            <svg
                              className="chev"
                              width="14"
                              height="9"
                              viewBox="0 0 14 9"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="m1 1.5 6 6 6-6"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          {isOpen && (
                            <ul className="idt-types">
                              {g.types.map((t) => (
                                <li key={t.name}>
                                  <span>{t.name}</span>
                                  <b>{t.count}</b>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <section className="idt-card" aria-label="Notes">
              <div className="idt-cardhead">
                <h2>Notes</h2>
                {!editNote && canEdit && (
                  <button
                    type="button"
                    className="idt-mini"
                    onClick={startNote}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>

              {editNote ? (
                <>
                  <textarea
                    className="idt-note"
                    rows={4}
                    value={note}
                    maxLength={500}
                    aria-label="Notes"
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {noteErr && (
                    <p className="idt-err" role="alert">
                      {noteErr}
                    </p>
                  )}
                  <div className="idt-noteact">
                    <button
                      type="button"
                      onClick={() => setEditNote(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="yes"
                      onClick={saveNote}
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              ) : (
                <p className={c.comment ? "idt-text" : "idt-muted"}>
                  {c.comment || "No notes yet."}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
