import { useMemo, useState } from "react";
import { AQL_OPTIONS, DEFAULT_AQL, finalPlan, finalResult } from "../config/aql.js";
import "./FinalCheck.css";

const digits = (s) => s.replace(/\D/g, "");
const num = (n) => Number(n).toLocaleString("en-US");

const CLASSES = [
  { key: "critical", label: "Critical", hint: "Unsafe or illegal to sell. None allowed." },
  { key: "major", label: "Major", hint: "Hurts function or appearance." },
  { key: "minor", label: "Minor", hint: "Small flaw, still sellable." },
];

export default function FinalCheck({ onBack, onFinish }) {
  const [f, setF] = useState({
    buyer: "", style: "", color: "", po: "", lotQty: "", inspected: "", comment: "",
  });
  const [aql, setAql] = useState(DEFAULT_AQL);
  const [counts, setCounts] = useState({ critical: 0, major: 0, minor: 0 });
  const [tried, setTried] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setNum = (k) => (e) => setF((p) => ({ ...p, [k]: digits(e.target.value) }));
  const bump = (k, d) => setCounts((p) => ({ ...p, [k]: Math.max(0, p[k] + d) }));

  const plan = useMemo(() => finalPlan(f.lotQty, aql), [f.lotQty, aql]);
  const result = plan ? finalResult(plan, counts) : null;
  const inspected = f.inspected === "" ? plan?.sample ?? 0 : Number(f.inspected);
  const tooFew = plan && inspected < plan.sample;

  const missing = {
    buyer: !f.buyer.trim(),
    style: !f.style.trim(),
    po: !f.po.trim(),
    lotQty: !plan,
  };
  const invalid = Object.values(missing).some(Boolean) || tooFew;

  const submit = () => {
    setTried(true);
    if (invalid) return;
    onFinish?.({
      session: { buyer: f.buyer.trim(), style: f.style.trim(), color: f.color.trim(), po: f.po.trim(), lotQty: Number(f.lotQty) },
      aql: { major: aql.major, minor: aql.minor, sample: plan.sample, majorAccept: plan.major.accept, minorAccept: plan.minor.accept },
      inspected,
      counts,
      result: result.pass ? "pass" : "fail",
      reasons: result.reasons,
      comment: f.comment.trim(),
    });
  };

  const err = (k) => tried && missing[k];

  return (
    <main className="fc">
      <div className="fc-wrap">
        <header className="fc-head">
          <button type="button" className="fc-back" onClick={onBack} aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div>
            <h1 className="fc-title">QC Final</h1>
            <p className="fc-sub">Final inspection of one lot</p>
          </div>
        </header>

        <section className="fc-card" aria-labelledby="fc-h-lot">
          <h2 id="fc-h-lot">1. Lot details</h2>
          <div className="fc-grid">
            <label className={`fc-field ${err("buyer") ? "bad" : ""}`}>
              <span>Buyer</span>
              <input value={f.buyer} onChange={set("buyer")} autoComplete="off" placeholder="e.g. Calvin Klein" />
              {err("buyer") && <em>Required</em>}
            </label>
            <label className={`fc-field ${err("style") ? "bad" : ""}`}>
              <span>Style</span>
              <input value={f.style} onChange={set("style")} autoComplete="off" placeholder="e.g. CK-1101" />
              {err("style") && <em>Required</em>}
            </label>
            <label className={`fc-field ${err("po") ? "bad" : ""}`}>
              <span>PO number</span>
              <input value={f.po} onChange={set("po")} autoComplete="off" placeholder="e.g. PO-88421" />
              {err("po") && <em>Required</em>}
            </label>
            <label className="fc-field">
              <span>Color</span>
              <input value={f.color} onChange={set("color")} autoComplete="off" placeholder="Optional" />
            </label>
            <label className={`fc-field ${err("lotQty") ? "bad" : ""}`}>
              <span>Lot quantity (pcs)</span>
              <input value={f.lotQty} onChange={setNum("lotQty")} inputMode="numeric" autoComplete="off" placeholder="e.g. 5000" />
              {err("lotQty") && <em>Enter the total pieces in this lot</em>}
            </label>
          </div>
        </section>

        <section className="fc-card" aria-labelledby="fc-h-aql">
          <h2 id="fc-h-aql">2. Sample to inspect</h2>
          <div className="fc-grid two">
            <label className="fc-field">
              <span>Major AQL</span>
              <select value={aql.major} onChange={(e) => setAql((p) => ({ ...p, major: e.target.value }))}>
                {AQL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="fc-field">
              <span>Minor AQL</span>
              <select value={aql.minor} onChange={(e) => setAql((p) => ({ ...p, minor: e.target.value }))}>
                {AQL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          {plan ? (
            <>
              <div className="fc-tiles">
                <div className="fc-tile main"><span className="lb">Pieces to inspect</span><b>{num(plan.sample)}</b></div>
                <div className="fc-tile"><span className="lb">Critical</span><b>0</b><span className="un">allowed</span></div>
                <div className="fc-tile"><span className="lb">Major</span><b>{plan.major.accept}</b><span className="un">allowed</span></div>
                <div className="fc-tile"><span className="lb">Minor</span><b>{plan.minor.accept}</b><span className="un">allowed</span></div>
              </div>
              <label className={`fc-field ${tried && tooFew ? "bad" : ""}`}>
                <span>Pieces actually inspected</span>
                <input
                  value={f.inspected}
                  onChange={setNum("inspected")}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={String(plan.sample)}
                />
                {tooFew && <em>At least {num(plan.sample)} pieces are needed for a valid result</em>}
              </label>
            </>
          ) : (
            <p className="fc-empty">Enter the lot quantity to see how many pieces to inspect.</p>
          )}
        </section>

        <section className="fc-card" aria-labelledby="fc-h-def">
          <h2 id="fc-h-def">3. Defects found</h2>
          <ul className="fc-steps">
            {CLASSES.map((c) => (
              <li key={c.key}>
                <div className="txt">
                  <strong>{c.label}</strong>
                  <span>{c.hint}</span>
                </div>
                <div className="ctl" role="group" aria-label={`${c.label} defects`}>
                  <button type="button" onClick={() => bump(c.key, -1)} disabled={counts[c.key] === 0} aria-label={`Decrease ${c.label}`}>−</button>
                  <output aria-live="polite">{counts[c.key]}</output>
                  <button type="button" onClick={() => bump(c.key, 1)} aria-label={`Increase ${c.label}`}>+</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {result && (
          <section className={`fc-result ${result.pass ? "pass" : "fail"}`} aria-live="polite">
            <p className="lb">Result</p>
            <p className="big">
              <span aria-hidden="true">{result.pass ? "✓" : "✕"}</span> {result.pass ? "PASS" : "FAIL"}
            </p>
            {result.pass ? (
              <p className="why">All defect counts are within the allowed limits.</p>
            ) : (
              <ul className="why">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            )}
          </section>
        )}

        <section className="fc-card">
          <label className="fc-field">
            <span>Comment (optional)</span>
            <textarea rows={3} value={f.comment} onChange={set("comment")} placeholder="Notes about this lot" />
          </label>
        </section>

        {tried && invalid && <p className="fc-warn" role="alert">Please complete the fields marked in red.</p>}
        <button type="button" className="fc-submit" onClick={submit}>Submit final check</button>
      </div>
    </main>
  );
}