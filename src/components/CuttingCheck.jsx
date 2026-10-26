import { useEffect, useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { CUTTING_PROCESSES } from "../config/cuttingProcesses.js";
import { fetchDefectTypes, createCuttingInspection, PROCESS_ENUM } from "../api/cutting.js";
import "./CuttingCheck.css";

const emptyStyle = () => ({
  buyer: "",
  style: "",
  color: "",
  lot: "",
  inspect: "",
  defect: "",
  operator: "",
  defectTypes: [], // berisi id jenis defect (satu saja)
  otherNote: "",
});

const emptyProcess = () => ({ styles: [emptyStyle()] });

// pending (kosong) -> started (sebagian terisi) -> ok / defect
const styleStatus = (s) => {
  const insp = Number(s.inspect) || 0;
  const def = Number(s.defect) || 0;
  if (def > 0) return "defect";
  if (insp > 0) return "ok";
  return s.operator.trim() !== "" || s.defect !== "" || s.defectTypes.length > 0 ? "started" : "pending";
};

const percent = (s) => {
  const i = Number(s.inspect) || 0;
  const f = Number(s.defect) || 0;
  return i ? `${Math.round((f / i) * 1000) / 10}%` : "";
};

function Field({ label, className = "", ...input }) {
  const filled = String(input.value ?? "") !== "";
  return (
    <label className={`cc-f ${className}`}>
      <span>{label}</span>
      <input className={filled ? "filled" : ""} autoComplete="off" {...input} />
    </label>
  );
}

export default function CuttingCheck({ onBack, onFinish, lineIds = [] }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() =>
    Object.fromEntries(CUTTING_PROCESSES.map((p) => [p.key, emptyProcess()]))
  );
  const [lineId, setLineId] = useState(lineIds[0] ?? "");
  const [types, setTypes] = useState({}); // jenis defect per proses (dari database)
  const [typesError, setTypesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stepRefs = useRef([]);
  const lastRef = useRef(null);
  const grew = useRef(false);

  const proc = CUTTING_PROCESSES[step];
  const d = data[proc.key];
  const typeList = types[proc.key] ?? [];
  const nameOf = (key, id) => (types[key] ?? []).find((t) => t.id === id)?.name ?? id;

  const filledStyles = d.styles.filter((s) => styleStatus(s) !== "pending");
  const canSwitch = filledStyles.length === 0; // ganti pilihan proses hanya jika belum ada isian

  const stepState = (p) =>
    data[p.key].styles.some((s) => styleStatus(s) !== "pending") ? "started" : "pending";
  const bannerState = d.styles.some((s) => styleStatus(s) === "defect") ? "defect" : "";

  // geser stepper ke proses aktif & kembali ke atas halaman
  useEffect(() => {
    stepRefs.current[step]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    window.scrollTo({ top: 0 });
    setError("");
  }, [step]);

  // muat jenis defect proses ini dari backend
  useEffect(() => {
    if (types[proc.key]) return;
    const ctrl = new AbortController();
    setTypesError("");
    fetchDefectTypes(proc.key, ctrl.signal)
      .then((list) => setTypes((t) => ({ ...t, [proc.key]: list })))
      .catch((e) => {
        if (e?.name !== "AbortError") setTypesError(e.message || "Failed to load defect types.");
      });
    return () => ctrl.abort();
  }, [proc.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // setelah Add New Style, geser ke form baru
  useEffect(() => {
    if (grew.current) {
      grew.current = false;
      lastRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [d.styles.length]);

  /* ---------- ubah data ---------- */
  const upd = (i, change) =>
    setData((all) => {
      const p = all[proc.key];
      const styles = p.styles.map((s, idx) =>
        idx === i ? { ...s, ...(typeof change === "function" ? change(s) : change) } : s
      );
      return { ...all, [proc.key]: { ...p, styles } };
    });

  const onDigits = (i, field) => (e) => upd(i, { [field]: e.target.value.replace(/\D/g, "") });
  const onText = (i, field) => (e) => upd(i, { [field]: e.target.value });
  const toggleDefect = (i, id) =>
    upd(i, (s) => ({ defectTypes: s.defectTypes[0] === id ? [] : [id] }));

  const addStyle = () => {
    grew.current = true;
    setData((all) => {
      const p = all[proc.key];
      return { ...all, [proc.key]: { ...p, styles: [...p.styles, emptyStyle()] } };
    });
  };
  const removeStyle = (i) =>
    setData((all) => {
      const p = all[proc.key];
      return { ...all, [proc.key]: { ...p, styles: p.styles.filter((_, idx) => idx !== i) } };
    });

  /* ---------- pilih proses lain ---------- */
  const selectProcess = (i) => {
    if (i === step) return;
    if (!canSwitch) return setError("Submit this process first before choosing another one.");
    const nextKey = CUTTING_PROCESSES[i].key;
    // isi otomatis identitas style dari proses ini ke proses tujuan (jika masih kosong)
    setData((all) => {
      const target = all[nextKey];
      const pristine = target.styles.every(
        (s) => styleStatus(s) === "pending" && !s.buyer && !s.style && !s.color && !s.lot
      );
      if (!pristine) return all;
      const carried = all[proc.key].styles
        .filter((s) => s.buyer || s.style || s.color || s.lot)
        .map((s) => ({ ...emptyStyle(), buyer: s.buyer, style: s.style, color: s.color, lot: s.lot }));
      return carried.length ? { ...all, [nextKey]: { ...target, styles: carried } } : all;
    });
    setStep(i);
  };

  /* ---------- kirim proses lalu akhiri sesi ---------- */
  const submitProcess = async () => {
    setError("");
    if (!lineId) return setError("Your account has no cutting line. Contact your admin.");
    if (filledStyles.length === 0) return setError("Fill in at least one style before submitting.");

    const seen = new Set();
    for (let i = 0; i < d.styles.length; i++) {
      const s = d.styles[i];
      if (styleStatus(s) === "pending") continue;
      const tag = `Style ${i + 1}`;
      for (const [k, label] of [["buyer", "Buyer Code"], ["style", "Style Code"], ["color", "Color"], ["lot", "LOT"]])
        if (!s[k].trim()) return setError(`${tag}: ${label} is required.`);
      const key = [s.buyer, s.style, s.color, s.lot].map((x) => x.trim().toLowerCase()).join("|");
      if (seen.has(key)) return setError(`${tag}: same Buyer, Style, Color and LOT is already added.`);
      seen.add(key);
      if (!Number(s.inspect)) return setError(`${tag}: QTY INSP is required.`);
      if (s.defect === "") return setError(`${tag}: QTY DEFF is required (enter 0 if there is none).`);
      if (Number(s.defect) > Number(s.inspect)) return setError(`${tag}: QTY DEFF is greater than QTY INSP.`);
      if (Number(s.defect) > 0 && s.defectTypes.length !== 1)
        return setError(`${tag}: select one defect type.`);
      if (!s.operator.trim()) return setError(`${tag}: operator name is required.`);
    }

    const notes = d.styles
      .map((s, i) => (s.otherNote.trim() ? `Style ${i + 1}: ${s.otherNote.trim()}` : ""))
      .filter(Boolean)
      .join("; ");

    setBusy(true);
    try {
      await createCuttingInspection({
        processCheck: PROCESS_ENUM[proc.key],
        lineId,
        comment: notes || null,
        items: filledStyles.map((s) => ({
          buyerName: s.buyer.trim(),
          styleCode: s.style.trim(),
          colorName: s.color.trim(),
          lot: s.lot.trim(),
          operatorName: s.operator.trim(),
          quantityInspect: Number(s.inspect),
          quantityDefect: Number(s.defect),
          defectTypeId: Number(s.defect) > 0 ? s.defectTypes[0] : null,
        })),
      });

      onFinish?.({
        section: "cutting",
        processes: [
          {
            process: proc.label,
            styles: filledStyles.map((s) => ({
              buyer: s.buyer.trim(),
              style: s.style.trim(),
              color: s.color.trim(),
              lot: s.lot.trim(),
              operator: s.operator.trim(),
              inspect: Number(s.inspect) || 0,
              defect: Number(s.defect) || 0,
              defectTypes: s.defectTypes.map((id) => nameOf(proc.key, id)),
            })),
          },
        ],
      });
    } catch (e) {
      setError(e?.message || "Failed to send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="cc">
      <StatusBar />

      <header className="cc-head">
        <button type="button" className="cc-hback" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="cc-title">New QC Check</h1>
      </header>

      <p className="cc-hint">Choose a process, fill it in, then tap Submit. Submitting ends the session.</p>

      {/* Pilihan proses */}
      <nav className="cc-steps" aria-label="Process check">
        <ol>
          {CUTTING_PROCESSES.map((p, i) => (
            <li
              key={p.key}
              ref={(el) => (stepRefs.current[i] = el)}
              className={`cc-step ${stepState(p)} ${i === step ? "current" : ""}`}
            >
              <button
                type="button"
                aria-pressed={i === step}
                aria-current={i === step ? "step" : undefined}
                onClick={() => selectProcess(i)}
              >
                <span className="dot"></span>
                <span className="lbl">{p.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="cc-body">
        <div className={`cc-banner ${bannerState}`}>{proc.label}</div>

        {lineIds.length > 1 && (
          <label className="cc-f">
            <span>Line</span>
            <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
              {lineIds.map((id, i) => (
                <option key={id} value={id}>Line {i + 1}</option>
              ))}
            </select>
          </label>
        )}

        <fieldset className="cc-set" disabled={busy}>
          {d.styles.map((s, i) => {
            const otherSelected = typeList.some((t) => t.name === "Other" && s.defectTypes.includes(t.id));
            return (
              <section
                key={i}
                className="cc-style"
                ref={i === d.styles.length - 1 ? lastRef : null}
                aria-label={`Style ${i + 1}`}
              >
                <div className="cc-id">
                  <span className="cc-no">{i + 1}</span>
                  <Field label="Buyer Code" value={s.buyer} onChange={onText(i, "buyer")} />
                  <Field label="Style Code" value={s.style} onChange={onText(i, "style")} />
                </div>

                <Field label="LOT" value={s.lot} onChange={onText(i, "lot")} />
                <Field label="Color" value={s.color} onChange={onText(i, "color")} />

                <Field label="QTY INSP" inputMode="numeric" value={s.inspect} onChange={onDigits(i, "inspect")} />
                <Field label="QTY DEFF" inputMode="numeric" value={s.defect} onChange={onDigits(i, "defect")} />
                {s.inspect !== "" && Number(s.defect) > Number(s.inspect) && (
                  <p className="cc-warn">QTY DEFF is greater than QTY INSP.</p>
                )}
                <Field label="% DEFF" className="ro" value={percent(s)} readOnly tabIndex={-1} />
                <Field label="Operator Name" value={s.operator} onChange={onText(i, "operator")} />

                {/* Detail defect */}
                <div className="cc-block">
                  <p className="cc-cap">
                    Detail Defect
                    <small>
                      {Number(s.defect) > 0
                        ? s.defectTypes.length > 0 ? "1 selected" : "select one"
                        : "only if there are defects"}
                    </small>
                  </p>
                  {typesError && <p className="cc-warn">{typesError}</p>}
                  <div className="cc-defects" role="group" aria-label="Detail defect">
                    {typeList.map((t) => {
                      const on = s.defectTypes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`cc-chip ${on ? "on" : ""}`}
                          aria-pressed={on}
                          onClick={() => toggleDefect(i, t.id)}
                        >
                          <i aria-hidden="true">
                            {on && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5.2 4 7.7l4.5-5" stroke="#fff" strokeWidth="1.8"
                                      strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </i>
                          <span>{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {otherSelected && (
                    <Field label="Other Description" value={s.otherNote} onChange={onText(i, "otherNote")} />
                  )}
                </div>

                {i > 0 && (
                  <button type="button" className="cc-remove" onClick={() => removeStyle(i)}>
                    Remove style {i + 1}
                  </button>
                )}
              </section>
            );
          })}

          <button type="button" className="cc-add" onClick={addStyle}>
            + Add New Style
          </button>
        </fieldset>

        {error && <p className="cc-warn cc-err" role="alert">{error}</p>}

        <div className="cc-actions">
          <button type="button" className="cc-submit" onClick={submitProcess} disabled={busy}>
            {busy ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    </main>
  );
}