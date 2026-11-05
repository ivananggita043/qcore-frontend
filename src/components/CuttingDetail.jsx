import { useEffect, useMemo, useState } from "react";
import "./InspectionDetail.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
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
const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const level = (r) => (r <= 5 ? "good" : r <= 10 ? "warn" : "bad");
const LEVEL_TEXT = { good: "Good", warn: "Watch", bad: "High" };

export default function CuttingDetail({
  item,
  canEdit = true,
  canDelete = false,
  onBack,
  onEdit,
  onDelete,
  onSaveNotes,
}) {
  const c = item;
  const items = c.raw.items ?? [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [c.key]);

  const inspect = items.reduce((s, i) => s + (i.quantityInspect || 0), 0);
  const defects = items.reduce((s, i) => s + (i.quantityDefect || 0), 0);
  const rate = inspect ? (defects / inspect) * 100 : 0;
  const lv = level(rate);

  // defect digabung per nama defect
  const types = useMemo(() => {
    const m = new Map();
    items.forEach((i) => {
      if (!(i.quantityDefect > 0)) return;
      const name = i.defectTypeName || "Defect";
      m.set(name, (m.get(name) ?? 0) + i.quantityDefect);
    });
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [items]);

  const rows = [
    ["Inspection ID", c.id],
    ["Process", c.process],
    ["Styles", String(items.length)],
    ["Date", dateText(c.ts)],
    ["Time", timeText(c.ts)],
    ["Line", c.raw.lineName || "-"],
    ["Submitted by", c.raw.submittedByName || "-"],
  ];

  /* ---------- catatan ---------- */
  const comment = c.raw.comment ?? "";
  const [editNote, setEditNote] = useState(false);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [busy, setBusy] = useState(false);

  const saveNote = async () => {
    setBusy(true);
    setNoteErr("");
    try {
      await onSaveNotes(c, note.trim());
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

  const pencil = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );

  return (
    <main className="idt">
      <div className="idt-wrap">
        <header className="idt-head">
          <button type="button" className="idt-back" aria-label="Back" onClick={onBack}>
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
              <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="idt-title">Result Detail</h1>
        </header>

        <div className="idt-grid">
          <div className="idt-col">
            <dl className="idt-info">
              {rows.map(([k, v]) => (
                <div key={k} className="idt-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            {(canEdit || canDelete) && (
              <div className="idt-actions">
                {canEdit && (
                  <button type="button" className="idt-btn primary" onClick={() => onEdit(c)} disabled={busy}>
                    {pencil} Edit
                  </button>
                )}
                {canDelete &&
                  (!confirmDel ? (
                    <button type="button" className="idt-btn danger" onClick={() => setConfirmDel(true)} disabled={busy}>
                      Delete
                    </button>
                  ) : (
                    <div className="idt-confirm" role="alertdialog" aria-label="Confirm delete">
                      <p>Delete <strong>{c.id}</strong>? This action cannot be undone.</p>
                      {delErr && <p className="idt-err" role="alert">{delErr}</p>}
                      <div>
                        <button type="button" onClick={() => setConfirmDel(false)} disabled={busy}>Cancel</button>
                        <button type="button" className="yes" onClick={doDelete} disabled={busy}>
                          {busy ? "Deleting…" : "Yes, delete"}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

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
                <strong className="ink">{fmt(inspect)}</strong>
                <span>QTY Inspect</span>
              </div>
            </div>
          </div>

          <div className="idt-col">
            <section className="idt-card" aria-label="Styles">
              <h2>Styles checked</h2>
              <ul className="idt-areas">
                {items.map((i, n) => (
                  <li key={i.id ?? n}>
                    <div style={{ padding: "10px 2px" }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>
                        {i.buyerName} / {i.styleCode} / {i.colorName}
                      </p>
                      <p className="idt-hint">LOT {i.lot} · Operator {i.operatorName}</p>
                      <p className="idt-hint">
                        Inspect {i.quantityInspect} · Defect {i.quantityDefect ?? 0}
                        {i.quantityDefect > 0 && i.defectTypeName ? ` · ${i.defectTypeName}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="idt-card" aria-label="Defect types">
              <h2>Defect types</h2>
              {types.length === 0 ? (
                <p className="idt-muted">No defects recorded. This check passed.</p>
              ) : (
                <ul className="idt-types" style={{ marginTop: 10 }}>
                  {types.map((t) => (
                    <li key={t.name}>
                      <span>{t.name}</span>
                      <b>{t.count}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="idt-card" aria-label="Notes">
              <div className="idt-cardhead">
                <h2>Notes</h2>
                {!editNote && canEdit && (
                  <button type="button" className="idt-mini"
                          onClick={() => { setNote(comment); setNoteErr(""); setEditNote(true); }}>
                    Edit
                  </button>
                )}
              </div>
              {editNote ? (
                <>
                  <textarea className="idt-note" rows={4} value={note} maxLength={500}
                            aria-label="Notes" onChange={(e) => setNote(e.target.value)} />
                  {noteErr && <p className="idt-err" role="alert">{noteErr}</p>}
                  <div className="idt-noteact">
                    <button type="button" onClick={() => setEditNote(false)} disabled={busy}>Cancel</button>
                    <button type="button" className="yes" onClick={saveNote} disabled={busy}>
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              ) : (
                <p className={comment ? "idt-text" : "idt-muted"}>{comment || "No notes yet."}</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
