import { useMemo, useState } from "react";
import { statsBuyerStyle } from "../mock/dashboardData.js";
import "./StatsBuyerStyle.css";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const dlabel = (iso) => { const d = parse(iso); return `${d.getDate()} ${SHORT[d.getMonth()]}`; };
const num = (n) => Number(n).toLocaleString("en-US");
const pct = (n) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

// defect rate: smaller is better
const level = (r) => (r <= 5 ? ["good", "Low"] : r <= 10 ? ["warn", "Watch"] : ["bad", "High"]);

const SORTS = {
  worst: (a, b) => b.rate - a.rate || b.inspections - a.inspections,
  best: (a, b) => a.rate - b.rate || b.inspections - a.inspections,
  volume: (a, b) => b.inspections - a.inspections,
};

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";

/* ---------- grafik tren: item terpilih vs rata-rata section ---------- */
function Trend({ dates, item, base, name }) {
  const W = 340, H = 180, L = 38, R = 12, T = 12, B = 28;
  const [idx, setIdx] = useState(null);

  const vals = [...item, ...base].filter((v) => v != null);
  const top = Math.max(5, Math.ceil(Math.max(0, ...vals) / 5) * 5);
  const x = (i) => L + (dates.length < 2 ? 0 : (i * (W - L - R)) / (dates.length - 1));
  const y = (v) => T + (1 - v / top) * (H - T - B);

  // garis putus saat tidak ada data (mis. hari Minggu)
  const path = (s) => {
    let d = "";
    let pen = false;
    s.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (dates.length - 1));
    setIdx(Math.max(0, Math.min(dates.length - 1, i)));
  };

  const ticks = [0, top / 2, top];
  const xl = [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
  const cur = idx ?? dates.length - 1;

  return (
    <>
      <ul className="sbs-legend">
        <li><i style={{ background: BLUE }} />{name}</li>
        <li><i className="dash" style={{ borderColor: ORANGE }} />Section average</li>
      </ul>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sbs-svg"
        role="img"
        aria-label={`Daily defect rate of ${name} compared with the section average`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setIdx(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e3e8" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b6b6b">{t}%</text>
          </g>
        ))}
        {xl.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}
                fontSize="11" fill="#6b6b6b">{dlabel(dates[i])}</text>
        ))}
        <path d={path(base)} fill="none" stroke={ORANGE} strokeWidth="2" strokeDasharray="5 4" />
        <path d={path(item)} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinejoin="round" />
        {idx != null && <line x1={x(idx)} x2={x(idx)} y1={T} y2={H - B} stroke="#9d9d9d" strokeWidth="1" />}
        {item[cur] != null && <circle cx={x(cur)} cy={y(item[cur])} r="4" fill={BLUE} stroke="#fff" strokeWidth="1.5" />}
      </svg>
      <p className="sbs-read" aria-live="polite">
        <b>{dlabel(dates[cur])}</b>
        {" · "}{item[cur] == null ? "no data" : `${name} ${pct(item[cur])}`}
        {" · "}Section {base[cur] == null ? "no data" : pct(base[cur])}
      </p>
    </>
  );
}

export default function StatsBuyerStyle({ section, days, endISO }) {
  const [tab, setTab] = useState("buyer");
  const [sort, setSort] = useState("worst");
  const [pick, setPick] = useState(null);
  const [table, setTable] = useState(false);

  const data = useMemo(() => statsBuyerStyle(section, endISO, days), [section, endISO, days]);
  const rows = useMemo(
    () => [...(tab === "buyer" ? data.buyers : data.styles)].sort(SORTS[sort]),
    [data, tab, sort]
  );

  const keyOf = (r) => (tab === "buyer" ? r.name : `${r.buyer}|${r.name}`);
  const sel = rows.find((r) => keyOf(r) === pick) ?? rows[0];
  const max = Math.max(1, ...rows.map((r) => r.rate));
  const sectionRate = data.section.rate;
  const diff = sel ? +(sel.rate - sectionRate).toFixed(1) : 0;
  const [lv, lvText] = sel ? level(sel.rate) : ["good", ""];
  const maxDef = sel ? Math.max(1, ...sel.topDefects.map((d) => d.count)) : 1;

  return (
    <section className="card sbs" aria-labelledby="sbs-title">
      <h2 id="sbs-title">Buyer &amp; style statistics</h2>
      <p className="sbs-note">Defect rate per buyer or style over the last {days} days. Tap a row for details.</p>

      <div className="sbs-tabs" role="tablist" aria-label="Group by">
        {[["buyer", "Buyer"], ["style", "Style"]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k}
                  className={tab === k ? "on" : ""}
                  onClick={() => { setTab(k); setPick(null); setTable(false); }}>
            {l}
          </button>
        ))}
      </div>

      <select className="sbs-sort" value={sort} aria-label="Sort"
              onChange={(e) => { setSort(e.target.value); setPick(null); }}>
        <option value="worst">Highest defect rate first</option>
        <option value="best">Lowest defect rate first</option>
        <option value="volume">Most inspections first</option>
      </select>

      {rows.length === 0 ? (
        <p className="sbs-empty">No data for this period.</p>
      ) : (
        <>
          <ul className="sbs-list">
            {rows.map((r) => {
              const on = sel && keyOf(r) === keyOf(sel);
              const [l, t] = level(r.rate);
              return (
                <li key={keyOf(r)}>
                  <button type="button" className={`sbs-row ${l} ${on ? "on" : ""}`}
                          aria-pressed={on} onClick={() => { setPick(keyOf(r)); setTable(false); }}>
                    <span className="top">
                      <span className="nm">
                        {r.name}
                        <small>{tab === "style" ? r.buyer : `${r.styles.length} style`}</small>
                      </span>
                      <strong>{pct(r.rate)}</strong>
                    </span>
                    <span className="bar"><i style={{ width: `${Math.max(4, (r.rate / max) * 100)}%` }} /></span>
                    <span className="meta">
                      <span>{num(r.inspections)} inspections · {num(r.defects)} defects</span>
                      <span className="tag">{t}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="sbs-legend2">Defect rate: Low ≤ 5% · Watch 5–10% · High &gt; 10%</p>

          {sel && (
            <div className="sbs-detail">
              <h3>
                {sel.name}
                {sel.buyer && <small>{sel.buyer}</small>}
              </h3>

              <div className="sbs-kpis">
                <div><strong>{num(sel.inspections)}</strong><span>inspections</span></div>
                <div><strong>{num(sel.defects)}</strong><span>defects</span></div>
                <div className={lv}><strong>{pct(sel.rate)}</strong><span>defect rate · {lvText}</span></div>
              </div>
              <p className="sbs-vs">
                {diff === 0
                  ? "Same as the section average"
                  : `${Math.abs(diff)} points ${diff > 0 ? "above" : "below"} the section average (${pct(sectionRate)})`}
              </p>

              <Trend dates={data.dates} item={sel.series} base={data.section.series} name={sel.name} />

              <button type="button" className="sbs-link" onClick={() => setTable((v) => !v)}>
                {table ? "Hide table" : "View as table"}
              </button>
              {table && (
                <div className="sbs-table" tabIndex={0}>
                  <table>
                    <thead>
                      <tr><th>Date</th><th>{sel.name}</th><th>Section</th></tr>
                    </thead>
                    <tbody>
                      {data.dates.map((d, i) => (
                        <tr key={d}>
                          <td>{dlabel(d)}</td>
                          <td>{sel.series[i] == null ? "–" : pct(sel.series[i])}</td>
                          <td>{data.section.series[i] == null ? "–" : pct(data.section.series[i])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sel.topDefects.length > 0 && (
                <>
                  <h4>Top defects</h4>
                  <ul className="sbs-defects">
                    {sel.topDefects.map((d) => (
                      <li key={d.name}>
                        <span className="top"><span>{d.name}</span><strong>{num(d.count)}</strong></span>
                        <span className="bar"><i style={{ width: `${(d.count / maxDef) * 100}%` }} /></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {sel.styles && (
                <>
                  <h4>Styles under {sel.name}</h4>
                  <ul className="sbs-mini">
                    {[...sel.styles].sort(SORTS.worst).map((s) => (
                      <li key={s.name}>
                        <span>{s.name}</span>
                        <span>{num(s.inspections)} insp.</span>
                        <strong className={level(s.rate)[0]}>{pct(s.rate)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}