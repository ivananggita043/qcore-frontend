import { useMemo, useRef, useState } from "react";
import {
  statsTrend,
  statsHourly,
  statsDefects,
  statsLines,
  statsVolume,
} from "../mock/dashboardData.js";
import "./Stats.css";

const ALL = ["cutting", "sewing", "washing", "finishing"];
const NAMES = { cutting: "Cutting", sewing: "Sewing", washing: "Washing", finishing: "Finishing" };
// warna mengikuti section (tetap, tidak berubah saat filter berganti)
const COLORS = { cutting: "#2a78d6", sewing: "#eb6834", washing: "#1baf7a", finishing: "#eda100" };
const BAR = "#2a78d6";
const BAR_SEL = "#184f95";
const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PERIODS = [7, 30, 90];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const dlabel = (iso) => { const d = parse(iso); return `${d.getDate()} ${SHORT[d.getMonth()]}`; };
const num = (n) => Number(n).toLocaleString("id-ID");
const pct = (n) => `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

const TODAY_D = new Date();
const TODAY = toISO(TODAY_D);

/* ---------- skala sumbu ---------- */
function scale(v) {
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
  const step = steps.find((s) => s * 4 >= v) ?? steps[steps.length - 1];
  return { max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => step * i) };
}

/* ---------- grafik garis ---------- */
function LineChart({ dates, series }) {
  const W = 360, H = 220, l = 38, t = 14, b = 28;
  const r = series.length > 1 ? 66 : 12;
  const n = dates.length;
  const { max, ticks } = scale(Math.max(0.5, ...series.flatMap((s) => s.values)));
  const x = (i) => l + (W - l - r) * (n <= 1 ? 0 : i / (n - 1));
  const y = (v) => t + (H - t - b) * (1 - v / max);

  const [idx, setIdx] = useState(null);
  const ref = useRef(null);
  const sel = idx == null ? n - 1 : Math.min(idx, n - 1);

  const pick = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - l) / (W - l - r)) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  // label di ujung garis, dijaga tidak bertumpuk
  const ends = series
    .map((s) => ({ s, y: y(s.values[n - 1]) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) {
    if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
  }

  const ticksX = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div>
      {series.length > 1 && (
        <ul className="st-legend">
          {series.map((s) => (
            <li key={s.section}><i style={{ background: s.color }} />{s.name}</li>
          ))}
        </ul>
      )}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="st-svg"
        role="img"
        aria-label="Grafik tren defect rate"
        style={{ touchAction: "pan-y" }}
        onPointerDown={pick}
        onPointerMove={pick}
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={l} x2={W - r} y1={y(tv)} y2={y(tv)} className="grid" />
            <text x={l - 6} y={y(tv) + 4} textAnchor="end" className="tick">{tv}%</text>
          </g>
        ))}
        {ticksX.map((i, k) => (
          <text key={i} x={x(i)} y={H - 8} className="tick"
                textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
            {dlabel(dates[i])}
          </text>
        ))}
        {series.map((s) => (
          <path
            key={s.section}
            d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}
            fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {series.length > 1 &&
          ends.map(({ s, y: ly }) => (
            <text key={s.section} x={W - r + 6} y={ly + 4} className="endlabel">{s.name}</text>
          ))}
        <line x1={x(sel)} x2={x(sel)} y1={t} y2={H - b} className="cross" />
        {series.map((s) => (
          <circle key={s.section} cx={x(sel)} cy={y(s.values[sel])} r="4.5"
                  fill={s.color} stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div className="st-readout" aria-live="polite">
        <strong>{dlabel(dates[sel])}</strong>
        <ul>
          {series.map((s) => (
            <li key={s.section}>
              <i style={{ background: s.color }} />
              {series.length > 1 ? `${s.name}: ` : "Defect rate: "}
              <b>{pct(s.values[sel])}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- grafik batang vertikal ---------- */
function BarChart({ items, fmt, noun, defaultIndex, labelEvery = 1, ariaLabel }) {
  const W = 360, H = 200, l = 38, r = 8, t = 18, b = 28;
  const n = items.length;
  const { max, ticks } = scale(Math.max(0.5, ...items.map((i) => i.value)));
  const slot = (W - l - r) / n;
  const bw = Math.max(2, slot * 0.62);
  const y = (v) => t + (H - t - b) * (1 - v / max);

  const top = items.reduce((m, it, i) => (it.value > items[m].value ? i : m), 0);
  const [idx, setIdx] = useState(null);
  const sel = idx == null ? Math.min(defaultIndex ?? top, n - 1) : Math.min(idx, n - 1);
  const cur = items[sel];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="st-svg" role="img" aria-label={ariaLabel}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={l} x2={W - r} y1={y(tv)} y2={y(tv)} className="grid" />
            <text x={l - 6} y={y(tv) + 4} textAnchor="end" className="tick">{fmt(tv, true)}</text>
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
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" className="tick">{it.label}</text>
              )}
              <rect x={l + slot * i} y={t} width={slot} height={H - t - b} fill="transparent"
                    style={{ cursor: "pointer" }} onClick={() => setIdx(i)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setIdx(i)} />
            </g>
          );
        })}
        {n <= 12 && (
          <text x={l + slot * top + slot / 2} y={y(items[top].value) - 6} textAnchor="middle" className="toplabel">
            {fmt(items[top].value)}
          </text>
        )}
      </svg>
      <div className="st-readout" aria-live="polite">
        <strong>{cur.title}</strong>
        <ul><li>{noun}: <b>{fmt(cur.value)}</b></li>{cur.sub && <li>{cur.sub}</li>}</ul>
      </div>
    </div>
  );
}

/* ---------- halaman ---------- */
export default function Stats({ isSuper, section = "sewing", onBack }) {
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState(isSuper ? "all" : section);
  const [table, setTable] = useState(false);

  const secs = isSuper ? (scope === "all" ? ALL : [scope]) : [section];
  const key = secs.join();
  const prevEnd = toISO(addDays(TODAY_D, -days));

  const trend = useMemo(() => statsTrend(secs, TODAY, days), [key, days]);
  const prev = useMemo(() => statsTrend(secs, prevEnd, days), [key, days]);
  const hourly = useMemo(() => statsHourly(secs, TODAY, days), [key, days]);
  const defects = useMemo(() => statsDefects(secs, TODAY, days), [key, days]);
  const lines = useMemo(() => statsLines(secs, TODAY, days), [key, days]);
  const volume = useMemo(() => statsVolume(secs, TODAY, days), [key, days]);

  const series = trend.series.map((s) => ({ ...s, color: COLORS[s.section] }));
  const diff = +(trend.totals.rate - prev.totals.rate).toFixed(1);
  const trendHead =
    diff === 0
      ? `Defect rate ${pct(trend.totals.rate)}, sama seperti periode lalu`
      : `Defect rate ${pct(trend.totals.rate)}, ${diff > 0 ? "naik" : "turun"} ${pct(Math.abs(diff))
          .replace("%", "")} poin dari periode lalu`;

  const worstHour = hourly.hours.reduce((m, h) => (h.rate > m.rate ? h : m), hourly.hours[0]);
  const hourItems = hourly.hours.map((h) => ({
    label: pad(h.hour),
    value: h.rate,
    title: `Pukul ${pad(h.hour)}.00–${pad(h.hour + 1)}.00`,
    sub: `${num(h.inspections)} inspeksi · ${num(h.defects)} defect`,
  }));

  const volItems = volume.dates.map((iso, i) => ({
    label: dlabel(iso),
    value: volume.values[i],
    title: dlabel(iso),
  }));
  const volAvg = Math.round(volume.values.reduce((a, b) => a + b, 0) / (volume.values.length || 1));

  const maxLine = Math.max(0.1, ...lines.rows.map((r) => r.rate));
  const maxDef = Math.max(1, ...defects.rows.map((r) => r.count));

  return (
    <main className="st">
      <header className="st-head">
        <button type="button" className="st-back" aria-label="Kembali" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="st-title">Statistik</h1>
          <p className="st-sub">
            {isSuper ? (scope === "all" ? "Semua section" : NAMES[scope]) : `${NAMES[section]} QC`}
          </p>
        </div>
      </header>

      <div className="st-periods" role="tablist" aria-label="Periode">
        {PERIODS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={days === p}
                  className={days === p ? "on" : ""} onClick={() => setDays(p)}>
            {p} hari
          </button>
        ))}
      </div>

      {isSuper && (
        <div className="st-chips" role="tablist" aria-label="Section">
          {["all", ...ALL].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={scope === k}
                    className={`st-chip ${scope === k ? "on" : ""}`} onClick={() => setScope(k)}>
              {k === "all" ? "Semua" : NAMES[k]}
            </button>
          ))}
        </div>
      )}

      {/* 1. tren */}
      <section className="card st-card">
        <h2>{trendHead}</h2>
        <p className="st-note">Defect rate harian, {days} hari terakhir</p>
        <LineChart dates={trend.dates} series={series} />
        <button type="button" className="st-link" onClick={() => setTable((v) => !v)}>
          {table ? "Sembunyikan tabel" : "Lihat sebagai tabel"}
        </button>
        {table && (
          <div className="st-table" tabIndex={0}>
            <table>
              <thead>
                <tr><th>Tanggal</th>{series.map((s) => <th key={s.section}>{s.name}</th>)}</tr>
              </thead>
              <tbody>
                {[...trend.dates].reverse().map((iso, k) => {
                  const i = trend.dates.length - 1 - k;
                  return (
                    <tr key={iso}>
                      <td>{dlabel(iso)}</td>
                      {series.map((s) => <td key={s.section}>{pct(s.values[i])}</td>)}
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
            ? `Defect paling sering muncul pukul ${pad(worstHour.hour)}.00`
            : "Defect per jam"}
        </h2>
        <p className="st-note">Defect rate per jam kerja (Sewing &amp; Washing)</p>
        {hourly.applicable ? (
          <BarChart
            items={hourItems}
            fmt={(v) => pct(v)}
            noun="Defect rate"
            labelEvery={1}
            ariaLabel="Defect rate per jam"
          />
        ) : (
          <p className="st-empty">Section ini dicek harian, jadi tidak ada data per jam.</p>
        )}
      </section>

      {/* 3. jenis defect */}
      <section className="card st-card">
        <h2>
          {defects.rows[0]
            ? `${defects.rows[0].name} paling banyak (${pct(defects.rows[0].share)})`
            : "Jenis defect"}
        </h2>
        <p className="st-note">Jenis defect terbanyak · kumulatif menunjukkan porsi gabungan</p>
        <ul className="st-hbars">
          {defects.rows.map((d, i) => (
            <li key={d.name}>
              <div className="row">
                <span className="nm">{i + 1}. {d.name}</span>
                <b>{num(d.count)}</b>
              </div>
              <div className="bar"><i style={{ width: `${(d.count / maxDef) * 100}%` }} /></div>
              <div className="meta">{pct(d.share)} dari total · kumulatif {d.cum}%</div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. perbandingan */}
      <section className="card st-card">
        <h2>
          {lines.rows[0]
            ? `${lines.rows[0].name} defect rate tertinggi (${pct(lines.rows[0].rate)})`
            : "Perbandingan"}
        </h2>
        <p className="st-note">
          {lines.kind === "section" ? "Perbandingan antar section" : "Perbandingan antar line"}, {days} hari terakhir
        </p>
        <ul className="st-hbars">
          {lines.rows.map((r) => (
            <li key={r.name}>
              <div className="row">
                <span className="nm">{r.name}</span>
                <b>{pct(r.rate)}</b>
              </div>
              <div className="bar"><i style={{ width: `${Math.max(3, (r.rate / maxLine) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. volume */}
      <section className="card st-card">
        <h2>Rata-rata {num(volAvg)} inspeksi per hari</h2>
        <p className="st-note">Jumlah check per hari, {days} hari terakhir</p>
        <BarChart
          items={volItems}
          fmt={(v) => num(v)}
          noun="Inspeksi"
          defaultIndex={volItems.length - 1}
          labelEvery={days === 7 ? 1 : days === 30 ? 6 : 15}
          ariaLabel="Volume inspeksi per hari"
        />
      </section>
    </main>
  );
}