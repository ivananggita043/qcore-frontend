import { useMemo, useState } from "react";
import { statsLineDefects } from "../mock/dashboardData.js";
import "./StatsLineDefects.css";

const num = (n) => Number(n).toLocaleString("en-US");
const pct = (n) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const LIMIT = 4;

export default function StatsLineDefects({ section = "sewing", days, endISO }) {
  const [all, setAll] = useState(false);
  const rows = useMemo(() => statsLineDefects(section, endISO, days), [section, endISO, days]);
  const shown = all ? rows : rows.slice(0, LIMIT);

  return (
    <section className="card st-card wide">
      <h2>Top 3 defects per line</h2>
      <p className="st-note">Lines sorted by the highest defect rate</p>

      <ul className="sld-list">
        {shown.map((l, i) => {
          const max = Math.max(1, ...l.top.map((d) => d.count));
          return (
            <li key={l.name} className="sld-line">
              <div className="sld-head">
                <span className="sld-nm">
                  <b>{i + 1}.</b> {l.name}
                </span>
                <span className="sld-rate">{pct(l.rate)}</span>
              </div>
              <span className="sld-meta">
                {num(l.inspections)} inspections · {num(l.defects)} defects
              </span>

              {l.top.length === 0 ? (
                <p className="st-empty">No defects found.</p>
              ) : (
                <ol className="sld-top">
                  {l.top.map((d, k) => (
                    <li key={d.name}>
                      <div className="row">
                        <span>
                          {k + 1}. {d.name}
                        </span>
                        <b>{num(d.count)}</b>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${(d.count / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length > LIMIT && (
        <button type="button" className="sbs-more" onClick={() => setAll((v) => !v)}>
          {all ? "Show less" : `View all (${rows.length} lines)`}
        </button>
      )}
    </section>
  );
}