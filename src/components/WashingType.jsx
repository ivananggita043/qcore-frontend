import StatusBar from "./StatusBar.jsx";
import "./NewQcCheck.css";
import "./WashingType.css";

const TYPES = [
  { key: "BULK", title: "Bulk", desc: "Regular washing of production lots" },
  { key: "REPAIR", title: "Repair", desc: "Re-washing of garments that failed QC" },
];

export default function WashingType({ onBack, onPick }) {
  return (
    <main className="newqc">
      <StatusBar />
      <header className="newqc-head">
        <button type="button" className="newqc-back" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="newqc-title">Washing Type</h1>
      </header>

      <div className="wt">
        <p className="wt-sub">What kind of washing are you checking?</p>
        {TYPES.map((t) => (
          <button key={t.key} type="button" className="wt-card" onClick={() => onPick(t.key)}>
            <strong>{t.title}</strong>
            <span>{t.desc}</span>
          </button>
        ))}
      </div>
    </main>
  );
}