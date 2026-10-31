import { useEffect, useMemo, useRef, useState } from "react";
import {
  statsTrend,
  statsHourly,
  statsDefects,
  statsLines,
  statsVolume,
  statsManpower,
} from "../mock/dashboardData.js";
import "./Stats.css";
import { SECTIONS } from "../config/sections.js";
import StatsBuyerStyle from "./StatsBuyerStyle.jsx";
import StatsLineDefects from "./StatsLineDefects.jsx";

const ALL = Object.keys(SECTIONS);
const NAMES = Object.fromEntries(
  Object.entries(SECTIONS).map(([k, v]) => [k, v.label]),
);
// fixed color per section (green & amber have low contrast, so the chart always has
// end labels + a legend + a table view)
const COLORS = {
  cutting: "#2a78d6",
  sewing: "#eb6834",
  washing: "#1baf7a",
  finishing: "#eda100",
  packing: "#7a56c9",
  final: "#d63f8e",
};
const BAR = "#2a78d6";
const BAR_SEL = "#184f95";
const SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const PERIODS = [7, 30, 90];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parse = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const dlabel = (iso) => {
  const d = parse(iso);
  return `${d.getDate()} ${SHORT[d.getMonth()]}`;
};
const num = (n) => Number(n).toLocaleString("en-US");
const pct = (n) =>
  `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

const TODAY_D = new Date();
const TODAY = toISO(TODAY_D);

/* ---------- lebar kontainer (grafik digambar sesuai lebar sebenarnya) ---------- */
function useWidth(initial = 320) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () =>
      setW(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ---------- skala sumbu ---------- */
function scale(v) {
  const steps = [
    0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500,
    5000,
  ];
  const step = steps.find((s) => s * 4 >= v) ?? steps[steps.length - 1];
  return { max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => step * i) };
}

/* ---------- grafik garis ---------- */
function LineChart({ dates, series }) {
  const [wrap, W] = useWidth();
  const H = W < 520 ? 240 : W < 800 ? 280 : 320;
  const multi = series.length > 1;
  const l = 48,
    t = 16,
    b = 34;
  const r = multi ? (W < 520 ? 100 : 116) : 16;
  const n = dates.length;
  const { max, ticks } = scale(
    Math.max(0.5, ...series.flatMap((s) => s.values)),
  );
  const x = (i) => l + (W - l - r) * (n <= 1 ? 0 : i / (n - 1));
  const y = (v) => t + (H - t - b) * (1 - v / max);

  const [idx, setIdx] = useState(null);
  const [hi, setHi] = useState(null); // series isolated by tapping the legend
  const svg = useRef(null);
  const sel = idx == null ? n - 1 : Math.min(idx, n - 1);

  const pick = (e) => {
    const box = svg.current.getBoundingClientRect();
    const px = e.clientX - box.left;
    const i = Math.round(((px - l) / (W - l - r)) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  // label di ujung garis, dijaga agar tidak bertumpuk
  const ends = series
    .map((s) => ({ s, y: y(s.values[n - 1]) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) {
    if (ends[k].y - ends[k - 1].y < 16) ends[k].y = ends[k - 1].y + 16;
  }

  const nTicks = W < 520 ? 3 : W < 800 ? 5 : 7;
  const ticksX = [
    ...new Set(
      Array.from({ length: nTicks }, (_, k) =>
        Math.round(((n - 1) * k) / (nTicks - 1)),
      ),
    ),
  ];

  return (
    <div ref={wrap}>
      {multi && (
        <ul className="st-legend">
          {series.map((s) => (
            <li key={s.section}>
              <button
                type="button"
                className={`st-lg ${hi === s.section ? "on" : ""}`}
                aria-pressed={hi === s.section}
                onClick={() => setHi(hi === s.section ? null : s.section)}
              >
                <i style={{ background: s.color }} />
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <svg
        ref={svg}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="st-svg"
        role="img"
        aria-label="Defect rate trend chart"
        style={{ touchAction: "pan-y" }}
        onPointerDown={pick}
        onPointerMove={(e) =>
          (e.pointerType === "mouse" || e.buttons) && pick(e)
        }
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={l} x2={W - r} y1={y(tv)} y2={y(tv)} className="grid" />
            <text x={l - 8} y={y(tv) + 5} textAnchor="end" className="tick">
              {tv}%
            </text>
          </g>
        ))}
        {ticksX.map((i, k) => (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            className="tick"
            textAnchor={
              k === 0 ? "start" : k === ticksX.length - 1 ? "end" : "middle"
            }
          >
            {dlabel(dates[i])}
          </text>
        ))}
        {series.map((s) => (
          <path
            key={s.section}
            d={s.values
              .map(
                (v, i) =>
                  `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
              )
              .join("")}
            fill="none"
            stroke={s.color}
            strokeWidth={series.length > 4 ? 2 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={hi && hi !== s.section ? 0.12 : 1}
          />
        ))}
        {multi &&
          ends.map(({ s, y: ly }) => (
            <g key={s.section} opacity={hi && hi !== s.section ? 0.25 : 1}>
              <path
                d={`M${x(n - 1)},${y(s.values[n - 1])}L${W - r + 10},${ly}`}
                stroke={s.color}
                strokeWidth="1.5"
                fill="none"
              />
              <circle cx={W - r + 16} cy={ly} r="5" fill={s.color} />
              <text x={W - r + 26} y={ly + 5} className="endlabel">
                {s.name}
              </text>
            </g>
          ))}
        <line x1={x(sel)} x2={x(sel)} y1={t} y2={H - b} className="cross" />
        {series.map((s) => (
          <circle
            key={s.section}
            cx={x(sel)}
            cy={y(s.values[sel])}
            r="5"
            fill={s.color}
            stroke="#fff"
            strokeWidth="2"
            opacity={hi && hi !== s.section ? 0.2 : 1}
          />
        ))}
      </svg>
      <div className="st-readout" aria-live="polite">
        <strong>{dlabel(dates[sel])}</strong>
        <ul>
          {series.map((s) => (
            <li key={s.section}>
              <i style={{ background: s.color }} />
              {multi ? `${s.name}: ` : "Defect rate: "}
              <b>{pct(s.values[sel])}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- grafik batang vertikal ---------- */
function BarChart({ items, fmt, noun, defaultIndex, ariaLabel }) {
  const [wrap, W] = useWidth();
  const H = W < 520 ? 220 : W < 800 ? 250 : 280;
  const l = 48,
    r = 8,
    t = 22,
    b = 34;
  const n = items.length;
  const { max, ticks } = scale(Math.max(0.5, ...items.map((i) => i.value)));
  const slot = (W - l - r) / n;
  const bw = Math.max(3, Math.min(48, slot * 0.64));
  const y = (v) => t + (H - t - b) * (1 - v / max);

  // jumlah label sumbu-x disesuaikan lebar agar tidak saling menimpa
  const lw = Math.max(...items.map((i) => String(i.label).length)) * 7.5 + 14;
  const every = Math.max(1, Math.ceil(lw / slot));

  const top = items.reduce(
    (m, it, i) => (it.value > items[m].value ? i : m),
    0,
  );
  const [idx, setIdx] = useState(null);
  const sel =
    idx == null ? Math.min(defaultIndex ?? top, n - 1) : Math.min(idx, n - 1);
  const cur = items[sel];

  return (
    <div ref={wrap}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="st-svg"
        role="img"
        aria-label={ariaLabel}
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={l} x2={W - r} y1={y(tv)} y2={y(tv)} className="grid" />
            <text x={l - 8} y={y(tv) + 5} textAnchor="end" className="tick">
              {fmt(tv, true)}
            </text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = l + slot * i + slot / 2;
          const h = Math.max(0, H - b - y(it.value));
          const rr = Math.min(4, h);
          const bx = cx - bw / 2;
          const by = y(it.value);
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${bx},${by + h} L${bx},${by + rr} Q${bx},${by} ${bx + rr},${by} L${bx + bw - rr},${by} Q${bx + bw},${by} ${bx + bw},${by + rr} L${bx + bw},${by + h} Z`}
                  fill={i === sel ? BAR_SEL : BAR}
                />
              )}
              {i % every === 0 && (
                <text x={cx} y={H - 10} textAnchor="middle" className="tick">
                  {it.label}
                </text>
              )}
              <rect
                x={l + slot * i}
                y={t}
                width={slot}
                height={H - t - b}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => setIdx(i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setIdx(i)}
              />
            </g>
          );
        })}
        {slot >= 22 && (
          <text
            x={l + slot * top + slot / 2}
            y={y(items[top].value) - 7}
            textAnchor="middle"
            className="toplabel"
          >
            {fmt(items[top].value)}
          </text>
        )}
      </svg>
      <div className="st-readout" aria-live="polite">
        <strong>{cur.title}</strong>
        <ul>
          <li>
            {noun}: <b>{fmt(cur.value)}</b>
          </li>
          {cur.sub && <li>{cur.sub}</li>}
        </ul>
      </div>
    </div>
  );
}

function Manpower({ data, showBreakdown }) {
  const body = (
    <>
      <span className="lb">QC Manpower</span>
      <strong className="val">{data.total}</strong>
      <span className="un">active QC staff</span>
    </>
  );
  if (!showBreakdown) return <div className="st-mp">{body}</div>;
  return (
    <details className="st-mp">
      <summary aria-label={`QC manpower ${data.total}, show per section`}>
        {body}
        <span className="chev" aria-hidden="true">
          Details ▾
        </span>
      </summary>
      <ul className="st-mp-list">
        {data.rows.map((r) => (
          <li key={r.section}>
            <span>{r.name}</span>
            <b>{r.count}</b>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ---------- halaman ---------- */
export default function Stats({ isSuper, section = "sewing", onBack }) {
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState(isSuper ? "all" : section);
  const [table, setTable] = useState(false);

  const secs = isSuper ? (scope === "all" ? ALL : [scope]) : [section];
  const key = secs.join();
  const byBuyer =
    secs.length === 1 && (secs[0] === "washing" || secs[0] === "finishing");
  const prevEnd = toISO(addDays(TODAY_D, -days));

  const trend = useMemo(() => statsTrend(secs, TODAY, days), [key, days]);
  const prev = useMemo(() => statsTrend(secs, prevEnd, days), [key, days]);
  const hourly = useMemo(() => statsHourly(secs, TODAY, days), [key, days]);
  const defects = useMemo(() => statsDefects(secs, TODAY, days), [key, days]);
  const lines = useMemo(() => statsLines(secs, TODAY, days), [key, days]);
  const volume = useMemo(() => statsVolume(secs, TODAY, days), [key, days]);
  const manpower = useMemo(() => statsManpower(secs), [key]);

  const series = trend.series.map((s) => ({ ...s, color: COLORS[s.section] }));
  const diff = +(trend.totals.rate - prev.totals.rate).toFixed(1);
  const trendHead =
    diff === 0
      ? "Defect rate is the same as last period"
      : `Defect rate ${diff > 0 ? "increased" : "decreased"} ${Math.abs(diff).toLocaleString("en-US")} pts from the previous period`;

  const worstHour = hourly.hours.reduce(
    (m, h) => (h.rate > m.rate ? h : m),
    hourly.hours[0],
  );
  const hourItems = hourly.hours.map((h) => ({
    label: pad(h.hour),
    value: h.rate,
    title: `Hour ${pad(h.hour)}.00–${pad(h.hour + 1)}.00`,
    sub: `${num(h.inspections)} inspections · ${num(h.defects)} defects`,
  }));

  const volItems = volume.dates.map((iso, i) => ({
    label: dlabel(iso),
    value: volume.values[i],
    title: dlabel(iso),
  }));
  const volAvg = Math.round(
    volume.values.reduce((a, b) => a + b, 0) / (volume.values.length || 1),
  );

  const maxLine = Math.max(0.1, ...lines.rows.map((r) => r.rate));
  const maxDef = Math.max(1, ...defects.rows.map((r) => r.count));

  const trendIcon = diff === 0 ? "■" : diff > 0 ? "▲" : "▼";
  const trendWord =
    diff === 0 ? "Stable" : diff > 0 ? "Worsening" : "Improving";
  const trendCls = diff === 0 ? "flat" : diff > 0 ? "bad" : "good";

  return (
    <main className="st">
      <div className="st-wrap">
        <header className="st-head">
          <button
            type="button"
            className="st-back"
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
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div>
            <h1 className="st-title">Statistics</h1>
            <p className="st-sub">
              {isSuper
                ? scope === "all"
                  ? "All sections"
                  : NAMES[scope]
                : `${NAMES[section]} QC`}
              {" · "}
              {days} days ago
            </p>
          </div>
          <Manpower data={manpower} showBreakdown={secs.length > 1} />
        </header>

        <div className="st-filters">
          <div className="st-periods" role="tablist" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={days === p}
                className={days === p ? "on" : ""}
                onClick={() => setDays(p)}
              >
                {p} days
              </button>
            ))}
          </div>

          {isSuper && (
            <div className="st-chips" role="tablist" aria-label="Section">
              {["all", ...ALL].map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={scope === k}
                  className={`st-chip ${scope === k ? "on" : ""}`}
                  onClick={() => setScope(k)}
                >
                  {k === "all" ? "All" : NAMES[k]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ringkasan angka */}
        <section className="st-kpis" aria-label="Summary">
          <div className="st-kpi main">
            <span className="lb">Defect rate</span>
            <span className="v">{pct(trend.totals.rate)}</span>
            <span className={`delta ${trendCls}`}>
              <i aria-hidden="true">{trendIcon}</i> {trendWord}
              {diff !== 0 && ` ${Math.abs(diff).toLocaleString("en-US")} pts`}
            </span>
          </div>
          <div className="st-kpi">
            <span className="lb">Total inspections</span>
            <span className="v">{num(trend.totals.inspections)}</span>
            <span className="un">checks</span>
          </div>
          <div className="st-kpi">
            <span className="lb">Total defects</span>
            <span className="v">{num(trend.totals.defects)}</span>
            <span className="un">defective checks</span>
          </div>
        </section>

        <div className="st-grid">
          {/* 1. tren */}
          <section className="card st-card wide">
            <h2>{trendHead}</h2>
            <p className="st-note">
              Daily defect rate. Tap or hover over the chart to see each day's
              value.
            </p>
            <LineChart dates={trend.dates} series={series} />
            <button
              type="button"
              className="st-link"
              onClick={() => setTable((v) => !v)}
            >
              {table ? "Hide table" : "View as table"}
            </button>
            {table && (
              <div className="st-table" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      {series.map((s) => (
                        <th key={s.section}>{s.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...trend.dates].reverse().map((iso, k) => {
                      const i = trend.dates.length - 1 - k;
                      return (
                        <tr key={iso}>
                          <td>{dlabel(iso)}</td>
                          {series.map((s) => (
                            <td key={s.section}>{pct(s.values[i])}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 2. per jam */}
          <section className="card st-card">
            <h2>
              {hourly.applicable
                ? `Defects peak at ${pad(worstHour.hour)}.00`
                : "Defect per hour"}
            </h2>
            <p className="st-note">
              Defect rate per working hour (Sewing dan Washing)
            </p>
            {hourly.applicable ? (
              <BarChart
                items={hourItems}
                fmt={(v) => pct(v)}
                noun="Defect rate"
                ariaLabel="Defect rate per hour"
              />
            ) : (
              <p className="st-empty">
                This section is checked daily, so there is no hourly data.
              </p>
            )}
          </section>

          {/* 3. jenis defect */}
          <section className="card st-card tall">
            <h2>
              {defects.rows[0]
                ? `${defects.rows[0].name} is the top defect (${pct(defects.rows[0].share)})`
                : "Defect types"}
            </h2>
            <p className="st-note">
              Top defect types. Cumulative shows the combined share of the top
              rankings.
            </p>
            <ul className="st-hbars">
              {defects.rows.map((d, i) => (
                <li key={d.name}>
                  <div className="row">
                    <span className="nm">
                      {i + 1}. {d.name}
                    </span>
                    <b>{num(d.count)}</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${(d.count / maxDef) * 100}%` }} />
                  </div>
                  <div className="meta">
                    {pct(d.share)} of total · cumulative {d.cum}%
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* 4. perbandingan */}
          {byBuyer ? (
            <StatsBuyerStyle section={secs[0]} days={days} endISO={TODAY} />
          ) : (
            <section className="card st-card">
              <h2>
                {lines.rows[0]
                  ? `${lines.rows[0].name} has the highest defect rate (${pct(lines.rows[0].rate)})`
                  : "Comparison"}
              </h2>
              <p className="st-note">
                {lines.kind === "section"
                  ? "Comparison between sections"
                  : "Comparison between lines"}
                , sorted by the highest rate
              </p>
              <ul className="st-hbars">
                {lines.rows.map((r) => (
                  <li key={r.name}>
                    <div className="row">
                      <span className="nm">{r.name}</span>
                      <b>{pct(r.rate)}</b>
                    </div>
                    <div className="bar">
                      <i
                        style={{
                          width: `${Math.max(3, (r.rate / maxLine) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 4b. top 3 defect per line (khusus sewing) */}
          {secs.length === 1 && secs[0] === "sewing" && (
            <StatsLineDefects section="sewing" days={days} endISO={TODAY} />
          )}

          {/* 5. volume */}
          <section className="card st-card wide">
            <h2>Average {num(volAvg)} inspections per day</h2>
            <p className="st-note">Number of checks per day</p>
            <BarChart
              items={volItems}
              fmt={(v) => num(v)}
              noun="Inspection"
              defaultIndex={volItems.length - 1}
              ariaLabel="Volume inspections per day"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
