import { useEffect, useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { CUTTING_PROCESSES, PANELS } from "../config/cuttingProcesses.js";
import "./CuttingCheck.css";

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

export default function CuttingCheck({ onBack, onFinish }) {
  const [step, setStep] = useState(0);
  const [session, setSession] = useState({ buyer: "", style: "", lot: "" });
  const [data, setData] = useState(() =>
    Object.fromEntries(CUTTING_PROCESSES.map((p) => [p.key, emptyProcess()]))
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const stepRefs = useRef([]);

  const proc = CUTTING_PROCESSES[step];
  const d = data[proc.key];
  const status = statusOf(d);
  const isLast = step === CUTTING_PROCESSES.length - 1;
  const checked = CUTTING_PROCESSES.filter(
    (p) => statusOf(data[p.key]) !== "pending"
  ).length;

  // geser stepper ke proses aktif & kembali ke atas halaman
  useEffect(() => {
    stepRefs.current[step]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
    window.scrollTo({ top: 0 });
  }, [step]);

  const patch = (changes) =>
    setData((all) => ({ ...all, [proc.key]: { ...all[proc.key], ...changes } }));
  const onDigits = (field) => (e) =>
    patch({ [field]: e.target.value.replace(/\D/g, "") });
  const stepPanel = (name, delta) =>
    patch({ panels: { ...d.panels, [name]: Math.max(0, d.panels[name] + delta) } });
  const toggleDefect = (t) =>
    patch({
      defectTypes: d.defectTypes.includes(t)
        ? d.defectTypes.filter((x) => x !== t)
        : [...d.defectTypes, t],
    });
  const setSess = (k) => (e) => setSession((s) => ({ ...s, [k]: e.target.value }));

  const finish = () =>
    onFinish?.({
      section: "cutting",
      session,
      processes: CUTTING_PROCESSES.map((p) => ({
        process: p.label,
        status: statusOf(data[p.key]),
        defectPercent: percent(data[p.key]),
        ...data[p.key],
      })).filter((p) => p.status !== "pending"),
    });

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
          <Field label="Buyer Code" value={session.buyer} onChange={setSess("buyer")} />
          <Field label="Style Code" value={session.style} onChange={setSess("style")} />
        </div>

        <Field label="LOT" value={session.lot} onChange={setSess("lot")} />

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
                    <button type="button" aria-label={`Reduce ${name}`}
                            disabled={n === 0} onClick={() => stepPanel(name, -1)}>−</button>
                    <output>{n}</output>
                    <button type="button" aria-label={`Add ${name}`}
                            onClick={() => stepPanel(name, 1)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Field label="QTY INSP" inputMode="numeric" value={d.inspect} onChange={onDigits("inspect")} />
        <Field label="QTY DEFF" inputMode="numeric" value={d.defect} onChange={onDigits("defect")} />
        {d.inspect !== "" && Number(d.defect) > Number(d.inspect) && (
          <p className="cc-warn">QTY DEFF is greater than QTY INSP.</p>
        )}
        <Field label="% DEFF" className="ro" value={percent(d)} readOnly tabIndex={-1} />
        <Field label="Operator Name" value={d.operator}
               onChange={(e) => patch({ operator: e.target.value })} />

        {/* Detail defect */}
        <div className="cc-block">
          <p className="cc-cap">
            Detail Defect
            <small>
              {d.defectTypes.length > 0 ? `${d.defectTypes.length} selected` : "select if any"}
            </small>
          </p>
          <div className="cc-defects" role="group" aria-label="Detail defect">
            {proc.defects.map((t) => {
              const on = d.defectTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`cc-chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleDefect(t)}
                >
                  <i aria-hidden="true">
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5.2 4 7.7l4.5-5" stroke="#fff" strokeWidth="1.8"
                              strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </i>
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
          {d.defectTypes.includes("Other") && (
            <Field label="Other Description" value={d.otherNote}
                   onChange={(e) => patch({ otherNote: e.target.value })} />
          )}
        </div>

        {/* Navigasi */}
        <div className="cc-actions">
          <button type="button" className="cc-prev" disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}>Back</button>
          <button type="button" className="cc-next"
                  onClick={() => (isLast ? setConfirmEnd(true) : setStep((s) => s + 1))}>
            {isLast ? "Finish" : "Next"}
          </button>
          <button type="button" className="cc-end" onClick={() => setConfirmEnd(true)}>
            End Session
          </button>
        </div>
      </div>

      {confirmEnd && (
        <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-end-title">
          <div className="box">
            <h2 id="cc-end-title">End session?</h2>
            <p>
              {checked} from {CUTTING_PROCESSES.length} processes have been filled.
              Data will be saved and the session will be closed.
            </p>
            <div className="row">
              <button type="button" onClick={() => setConfirmEnd(false)}>Cancel</button>
              <button type="button" className="primary" onClick={finish}>End &amp; Submit</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}