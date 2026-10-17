import { useEffect, useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import "./Success.css";

const TZ = "Asia/Jakarta";

const fmtTime = (d) =>
  d.toLocaleTimeString("id-ID", {
    timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const fmtDate = (d) =>
  d.toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });

export default function Success({ result, onDashboard }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleRef = useRef(null);

  // pindahkan fokus ke judul agar pembaca layar langsung membacakannya
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const when = new Date(result.submittedAt);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(result.id.replace("#", ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard tidak tersedia: abaikan */
    }
  };

  return (
    <main className="sx">
      <StatusBar />

      <div className="sx-inner">
        <svg className="sx-icon" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="sx-ring" cx="60" cy="60" r="57" fill="none" strokeWidth="5" />
          <circle className="sx-circle" cx="60" cy="60" r="50" />
          <path className="sx-check" d="M36 62 L53 78 L85 44" pathLength="48"
                fill="none" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h1 className="sx-title" ref={titleRef} tabIndex={-1}>
          QC Submitted<br />Successfully!
        </h1>
        <p className="sx-live" role="status">QC submitted successfully!</p>

        <div className="sx-id">
          <span className="lbl">Inspection</span>
          <strong>{result.id}</strong>
          <button type="button" onClick={copyId} aria-label="Copy inspection number">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        <dl className="sx-card">
          <div><dt>Time</dt><dd>{fmtTime(when)} WIB</dd></div>
          <div><dt>Date</dt><dd>{fmtDate(when)}</dd></div>
        </dl>

        {open && (
          <section id="sx-details" className="sx-details" aria-label="Detail inspeksi">
            <dl>
              {result.rows.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <p className="sx-sub">Summary</p>
            {result.lines.length === 0 ? (
              <p className="sx-none">No defects recorded.</p>
            ) : (
              <ul>
                {result.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            )}
          </section>
        )}

        <div className="sx-actions">
          <button type="button" className="sx-primary" aria-expanded={open}
                  aria-controls="sx-details" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide Details" : "View Details"}
          </button>
          <button type="button" className="sx-secondary" onClick={onDashboard}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}