import { useEffect, useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { CUTTING_PROCESSES, PANELS } from "../config/cuttingProcesses.js";
import "./CuttingCheck.css";
import {
  fetchDefectTypes,
  createCuttingInspection,
  PROCESS_ENUM,
} from "../api/cutting.js";

const emptyProcess = () => ({
  panels: Object.fromEntries(PANELS.map((p) => [p, 0])),
  inspect: "",
  defect: "",
  operator: "",
  defectTypes: [],
  otherNote: "",
});

// pending (kosong) -> started (sebagian terisi) -> ok / defect
const statusOf = (d) => {
  const insp = Number(d.inspect) || 0;
  const def = Number(d.defect) || 0;
  if (def > 0 || d.defectTypes.length > 0) return "defect";
  if (insp > 0) return "ok";
  const touched =
    d.operator.trim() !== "" || Object.values(d.panels).some((n) => n > 0);
  return touched ? "started" : "pending";
};

const percent = (d) => {
  const i = Number(d.inspect) || 0;
  const f = Number(d.defect) || 0;
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
  const [session, setSession] = useState({
    buyer: "",
    style: "",
    color: "",
    lot: "",
  });
  const [data, setData] = useState(() =>
    Object.fromEntries(CUTTING_PROCESSES.map((p) => [p.key, emptyProcess()])),
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [lineId, setLineId] = useState(lineIds[0] ?? "");
  const [types, setTypes] = useState({}); // daftar jenis defect per proses (dari database)
  const [typesError, setTypesError] = useState("");
  const [sent, setSent] = useState({}); // proses yang sudah terkirim
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stepRefs = useRef([]);

  const proc = CUTTING_PROCESSES[step];
  const d = data[proc.key];
  const status = statusOf(d);
  const isLast = step === CUTTING_PROCESSES.length - 1;
  const checked = CUTTING_PROCESSES.filter(
    (p) => statusOf(data[p.key]) !== "pending",
  ).length;

  // geser stepper ke proses aktif & kembali ke atas halaman
  useEffect(() => {
    if (types[proc.key]) return;
    const ctrl = new AbortController();
    setTypesError("");
    fetchDefectTypes(proc.key, ctrl.signal)
      .then((list) => setTypes((t) => ({ ...t, [proc.key]: list })))
      .catch((e) => {
        if (e?.name !== "AbortError")
          setTypesError(e.message || "Failed to load defect types.");
      });
    return () => ctrl.abort();
  }, [proc.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (changes) =>
    setData((all) => ({
      ...all,
      [proc.key]: { ...all[proc.key], ...changes },
    }));
  const onDigits = (field) => (e) =>
    patch({ [field]: e.target.value.replace(/\D/g, "") });

  const stepPanel = (name, delta) =>
    patch({
      panels: { ...d.panels, [name]: Math.max(0, d.panels[name] + delta) },
    });

  const toggleDefect = (id) =>
    patch({ defectTypes: d.defectTypes[0] === id ? [] : [id] });

  const setSess = (k) => (e) =>
    setSession((s) => ({ ...s, [k]: e.target.value }));

  const typeList = types[proc.key] ?? [];
  const otherSelected = typeList.some(
    (t) => t.name === "Other" && d.defectTypes.includes(t.id),
  );
  const nameOf = (key, id) =>
    (types[key] ?? []).find((t) => t.id === id)?.name ?? id;
  const sumPanels = (x) => Object.values(x.panels).reduce((a, b) => a + b, 0);

  const finish = () =>
    onFinish?.({
      section: "cutting",
      session,
      processes: CUTTING_PROCESSES.map((p) => ({
        process: p.label,
        status: statusOf(data[p.key]),
        defectPercent: percent(data[p.key]),
        ...data[p.key],
        defectTypes: data[p.key].defectTypes.map((id) => nameOf(p.key, id)),
      })).filter((p) => p.status !== "pending"),
    });

  const submit = async () => {
    setError("");
    const sendList = CUTTING_PROCESSES.filter(
      (p) => statusOf(data[p.key]) === "defect",
    );

    if (!lineId)
      return setError("Your account has no cutting line. Contact your admin.");
    for (const [k, label] of [
      ["buyer", "Buyer Code"],
      ["style", "Style Code"],
      ["color", "Color"],
      ["lot", "LOT"],
    ])
      if (!session[k].trim()) return setError(`${label} is required.`);
    if (sendList.length === 0)
      return setError(
        "Nothing to send yet. Only processes with defects can be submitted for now.",
      );

    for (const p of sendList) {
      const x = data[p.key];
      const total = sumPanels(x);
      if (!Number(x.inspect))
        return setError(`${p.label}: QTY INSPECT is required.`);
      if (x.defectTypes.length !== 1)
        return setError(`${p.label}: select one defect type.`);
      if (!x.operator.trim())
        return setError(`${p.label}: operator name is required.`);
      if (total === 0)
        return setError(`${p.label}: add the defective panels with +.`);
      if (total > Number(x.inspect))
        return setError(`${p.label}: panel total is greater than QTY INSP.`);
      if (x.defect !== "" && Number(x.defect) !== total)
        return setError(
          `${p.label}: QTY DEFFECT must equal the panel total (${total}).`,
        );
    }

    setBusy(true);
    let current = "";
    try {
      for (const p of sendList) {
        if (sent[p.key]) continue;
        current = p.label;
        const x = data[p.key];
        await createCuttingInspection({
          processCheck: PROCESS_ENUM[p.key],
          lineId,
          comment: x.otherNote.trim() || null,
          items: [
            {
              buyerName: session.buyer.trim(),
              styleCode: session.style.trim(),
              colorName: session.color.trim(),
              defectTypeId: x.defectTypes[0],
              lot: session.lot.trim(),
              operatorName: x.operator.trim(),
              quantityInspect: Number(x.inspect),
              defects: PANELS.filter((n) => x.panels[n] > 0).map((n) => ({
                panel: n,
                quantity: x.panels[n],
              })),
            },
          ],
        });
        setSent((s) => ({ ...s, [p.key]: true }));
      }
      finish();
    } catch (e) {
      setError(
        `${current}: ${e?.message || "Failed to send. Please try again."}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="cc">
      <StatusBar />

      <header className="cc-head">
        <button
          type="button"
          className="cc-hback"
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
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="cc-title">New QC Check</h1>
      </header>

      <p className="cc-hint">Tap a check process to mark as OK or defect</p>

      {/* Stepper proses */}
      <nav className="cc-steps" aria-label="Process check">
        <ol>
          {CUTTING_PROCESSES.map((p, i) => {
            const st = statusOf(data[p.key]);
            return (
              <li
                key={p.key}
                ref={(el) => (stepRefs.current[i] = el)}
                className={`cc-step ${st} ${i === step ? "current" : ""}`}
              >
                <button
                  type="button"
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  <span className="dot">
                    {st === "ok" ? "✓" : st === "defect" ? "!" : i + 1}
                  </span>
                  <span className="lbl">{p.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="cc-body">
        <div className={`cc-banner ${status}`}>{proc.label}</div>

        <div className="cc-id">
          <span className="cc-no">{step + 1}</span>
          <Field
            label="Buyer Code"
            value={session.buyer}
            onChange={setSess("buyer")}
          />
          <Field
            label="Style Code"
            value={session.style}
            onChange={setSess("style")}
          />
        </div>

        <Field label="LOT" value={session.lot} onChange={setSess("lot")} />

        <Field
          label="Color"
          value={session.color}
          onChange={setSess("color")}
        />

        {lineIds.length > 1 && (
          <label className="cc-f">
            <span>Line</span>
            <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
              {lineIds.map((id, i) => (
                <option key={id} value={id}>
                  Line {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Panel */}
        <div className="cc-block">
          <p className="cc-cap">PANEL</p>
          <div className="cc-panels">
            {PANELS.map((name) => {
              const n = d.panels[name];
              return (
                <div key={name} className={`cc-pill ${n > 0 ? "on" : ""}`}>
                  <span className="nm">{name}</span>
                  <div className="ctl">
                    <button
                      type="button"
                      aria-label={`Reduce ${name}`}
                      disabled={n === 0}
                      onClick={() => stepPanel(name, -1)}
                    >
                      −
                    </button>
                    <output>{n}</output>
                    <button
                      type="button"
                      aria-label={`Add ${name}`}
                      onClick={() => stepPanel(name, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Field
          label="QTY INSPECT"
          inputMode="numeric"
          value={d.inspect}
          onChange={onDigits("inspect")}
        />
        <Field
          label="QTY DEFFECT"
          inputMode="numeric"
          value={d.defect}
          onChange={onDigits("defect")}
        />
        {d.inspect !== "" && Number(d.defect) > Number(d.inspect) && (
          <p className="cc-warn">QTY DEFFECT is greater than QTY INSPECT.</p>
        )}
        <Field
          label="% DEFFECT"
          className="ro"
          value={percent(d)}
          readOnly
          tabIndex={-1}
        />
        <Field
          label="Operator Name"
          value={d.operator}
          onChange={(e) => patch({ operator: e.target.value })}
        />

        {/* Detail defect */}
        <div className="cc-block">
          <p className="cc-cap">
            Detail Defect
            <small>
              {d.defectTypes.length > 0 ? "1 selected" : "select one"}
            </small>
          </p>
          {typesError && <p className="cc-warn">{typesError}</p>}
          <div className="cc-defects" role="group" aria-label="Detail defect">
            {typeList.map((t) => {
              const on = d.defectTypes.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`cc-chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleDefect(t.id)}
                >
                  <i aria-hidden="true">
                    {on && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M1.5 5.2 4 7.7l4.5-5"
                          stroke="#fff"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </i>
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
          {otherSelected && (
            <Field
              label="Other Description"
              value={d.otherNote}
              onChange={(e) => patch({ otherNote: e.target.value })}
            />
          )}
        </div>

        {/* Navigasi */}
        <div className="cc-actions">
          <button
            type="button"
            className="cc-prev"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className="cc-next"
            onClick={() =>
              isLast ? setConfirmEnd(true) : setStep((s) => s + 1)
            }
          >
            {isLast ? "Finish" : "Next"}
          </button>
          <button
            type="button"
            className="cc-end"
            onClick={() => setConfirmEnd(true)}
          >
            End Session
          </button>
        </div>
      </div>

      {confirmEnd && (
        <div
          className="cc-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-end-title"
        >
          <div className="box">
            <h2 id="cc-end-title">End session?</h2>
            <p>
              {checked} from {CUTTING_PROCESSES.length} processes have been
              filled. Only processes with defects are sent for now.
            </p>
            {error && (
              <p className="cc-warn" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "Sending…" : "End & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
