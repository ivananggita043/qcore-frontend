import { useMemo, useState } from "react";
import { statsBuyerStyle } from "../mock/dashboardData.js";
import "./StatsBuyerStyle.css";

const num = (n) => Number(n).toLocaleString("en-US");
const pct = (n) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const LIMIT = 5;

export default function StatsBuyerStyle({ section, days, endISO }) {
  const [tab, setTab] = useState("buyer");
  const [all, setAll] = useState(false);

  const data = useMemo(() => statsBuyerStyle(section, endISO, days), [section, endISO, days]);
  const rows = useMemo(
    () =>
      [...(tab === "buyer" ? data.buyers : data.styles)].sort(
        (a, b) => b.rate - a.rate || b.inspections - a.inspections
      ),
    [data, tab]
  );

  const max = Math.max(0.1, ...rows.map((r) => r.rate));
  const shown = all ? rows : rows.slice(0, LIMIT);

  return (
    <section className="card st-card">
      <h2>
        {rows[0]
          ? `${rows[0].name} has the highest defect rate (${pct(rows[0].rate)})`
          : "Buyer & style"}
      </h2>
      <p className="st-note">
        {tab === "buyer" ? "Comparison between buyers" : "Comparison between styles"}, highest first
      </p>

      <div className="sbs-tabs" role="tablist" aria-label="Group by">
        {[["buyer", "Buyer"], ["style", "Style"]].map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "on" : ""}
            onClick={() => { setTab(k); setAll(false); }}
          >
            {l}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="st-empty">No data for this period.</p>
      ) : (
        <>
          <ul className="st-hbars">
            {shown.map((r) => (
              <li key={tab === "buyer" ? r.name : `${r.buyer}|${r.name}`}>
                <div className="row">
                  <span className="nm">
                    {r.name}
                    {tab === "style" && <small className="sbs-sub">{r.buyer}</small>}
                  </span>
                  <b>{pct(r.rate)}</b>
                </div>
                <div className="bar">
                  <i style={{ width: `${Math.max(3, (r.rate / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>

          {rows.length > LIMIT && (
            <button type="button" className="sbs-more" onClick={() => setAll((v) => !v)}>
              {all ? "Show less" : `View all (${rows.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}