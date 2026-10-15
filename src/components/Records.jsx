import { useMemo, useRef, useState } from "react";
import { sectionDay } from "../mock/dashboardData.js";
import "./Records.css";

const ALL = ["cutting", "sewing", "washing", "finishing"];
const NAMES = { cutting: "Cutting", sewing: "Sewing", washing: "Washing", finishing: "Finishing" };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const num = (n) => Number(n).toLocaleString("id-ID");
const rate = (n) => `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const level = (p) => (p >= 90 ? "good" : p >= 80 ? "warn" : "bad");
const longDate = (iso) => { const d = fromISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

const TODAY_D = new Date();
const TODAY = toISO(TODAY_D);

function daysBetween(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(toISO(d));
  return out;
}

function agg(secs, isos) {
  let inspections = 0;
  let defects = 0;
  for (const iso of isos) {
    for (const s of secs) {
      const x = sectionDay(s, iso);
      inspections += x.inspections;
      defects += x.defects;
    }
  }
  return {
    inspections,
    defects,
    passRate: inspections ? +(((inspections - defects) / inspections) * 100).toFixed(1) : 0,
  };
}

function topDefectsOf(secs, isos, limit = 3) {
  const m = {};
  for (const iso of isos)
    for (const s of secs)
      sectionDay(s, iso).topDefects.forEach((d) => (m[d.name] = (m[d.name] || 0) + d.count));
  return Object.entries(m)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// daftar periode untuk Weekly / Monthly / Yearly (terbaru di atas, tidak melewati hari ini)
function buildPeriods(kind) {
  const out = [];
  if (kind === "weekly") {
    const dow = (TODAY_D.getDay() + 6) % 7; // Senin = 0
    const monday = addDays(TODAY_D, -dow);
    for (let i = 0; i < 8; i++) {
      const s = addDays(monday, -7 * i);
      const e = addDays(s, 6) > TODAY_D ? TODAY_D : addDays(s, 6);
      out.push({
        label: `${s.getDate()} ${SHORT[s.getMonth()]} – ${e.getDate()} ${SHORT[e.getMonth()]}`,
        sub: i === 0 ? "Minggu ini" : `${i} minggu lalu`,
        days: daysBetween(s, e),
      });
    }
  } else if (kind === "monthly") {
    for (let i = 0; i < 12; i++) {
      const s = new Date(TODAY_D.getFullYear(), TODAY_D.getMonth() - i, 1);
      const eFull = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      const e = eFull > TODAY_D ? TODAY_D : eFull;
      out.push({
        label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}`,
        sub: i === 0 ? "Bulan ini" : "",
        days: daysBetween(s, e),
      });
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const y = TODAY_D.getFullYear() - i;
      const s = new Date(y, 0, 1);
      const eFull = new Date(y, 11, 31);
      const e = eFull > TODAY_D ? TODAY_D : eFull;
      out.push({ label: String(y), sub: i === 0 ? "Tahun ini" : "", days: daysBetween(s, e) });
    }
  }
  return out;
}

export default function Records({ user, isSuper, section = "sewing", onBack }) {
  const [scope, setScope] = useState(isSuper ? "all" : section);
  const [open, setOpen] = useState({ today: true, detail: false, all: true });
  const [period, setPeriod] = useState("daily");
  const [picked, setPicked] = useState(TODAY);
  const dateRef = useRef(null);

  const secs = isSuper ? (scope === "all" ? ALL : [scope]) : [section];
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const step = (n) => {
    const next = toISO(addDays(fromISO(picked), n));
    if (next <= TODAY) setPicked(next);
  };
  const openCal = () => {
    const el = dateRef.current;
    if (el?.showPicker) el.showPicker();
    else el?.click();
  };

  const todayRows = useMemo(() => secs.map((s) => sectionDay(s, TODAY)), [secs.join()]);
  const todayTotal = useMemo(() => agg(secs, [TODAY]), [secs.join()]);

  const picked1 = useMemo(() => agg(secs, [picked]), [picked, secs.join()]);
  const pickedBy = useMemo(() => secs.map((s) => sectionDay(s, picked)), [picked, secs.join()]);
  const pickedTop = useMemo(() => topDefectsOf(secs, [picked]), [picked, secs.join()]);

  const periods = useMemo(
    () =>
      period === "daily"
        ? []
        : buildPeriods(period).map((p) => ({ ...p, ...agg(secs, p.days) })),
    [period, secs.join()]
  );

  return (
    <main className="rc">
      <header className="rc-head">
        <button type="button" className="rc-back" aria-label="Kembali" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="rc-title">QC Records</h1>
          <p className="rc-sub">
            {isSuper
              ? scope === "all" ? "Semua section" : NAMES[scope]
              : `${NAMES[section]} QC`}
          </p>
        </div>
      </header>

      {isSuper && (
        <div className="rc-chips" role="tablist" aria-label="Section">
          {["all", ...ALL].map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={scope === k}
              className={`rc-chip ${scope === k ? "on" : ""}`}
              onClick={() => setScope(k)}
            >
              {k === "all" ? "Semua" : NAMES[k]}
            </button>
          ))}
        </div>
      )}

      {/* ---------- 1. hari ini ---------- */}
      <Acc title="Records hari ini" hint={longDate(TODAY)} open={open.today} onToggle={() => toggle("today")}>
        {secs.length > 1 && (
          <div className="rc-total">
            <Stat v={num(todayTotal.inspections)} l="inspeksi" />
            <Stat v={num(todayTotal.defects)} l="defect" tone="red" />
            <Stat v={rate(todayTotal.passRate)} l="pass rate" tone="green" />
          </div>
        )}
        <ul className="rc-rows">
          {todayRows.map((r) => (
            <li key={r.section} className={`rc-row ${level(r.passRate)}`}>
              <div className="top">
                <span className="nm">{r.name}</span>
                <strong>{rate(r.passRate)}</strong>
              </div>
              <div className="bar" role="img" aria-label={`${r.name} ${rate(r.passRate)}`}>
                <i style={{ width: `${r.passRate}%` }} />
              </div>
              <div className="meta">
                <span>{num(r.inspections)} inspeksi</span>
                <span>{num(r.defects)} defect</span>
                <span>{r.activeQc} QC aktif</span>
              </div>
            </li>
          ))}
        </ul>
      </Acc>

      {/* ---------- 2. detail hasil ---------- */}
      <Acc title="Detail hasil hari ini" hint="Defect terbanyak" open={open.detail} onToggle={() => toggle("detail")}>
        {todayRows.map((r) => {
          const max = Math.max(1, ...r.topDefects.map((d) => d.count));
          return (
            <section key={r.section} className="rc-detail">
              <h3>{r.name}</h3>
              {r.defects === 0 ? (
                <p className="rc-none">Tidak ada defect.</p>
              ) : (
                <ul>
                  {r.topDefects.slice(0, 3).map((d) => (
                    <li key={d.name}>
                      <div className="top">
                        <span>{d.name}</span>
                        <strong>{d.count}</strong>
                      </div>
                      <div className="bar red"><i style={{ width: `${(d.count / max) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </Acc>

      {/* ---------- 3. semua waktu ---------- */}
      <Acc title="All Time" hint="Daily – Yearly" open={open.all} onToggle={() => toggle("all")}>
        <select className="rc-select" value={period} aria-label="Periode"
                onChange={(e) => setPeriod(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        {period === "daily" ? (
          <>
            <div className="rc-datebar">
              <button type="button" aria-label="Hari sebelumnya" onClick={() => step(-1)}>‹</button>
              <button type="button" className="rc-datechip" onClick={openCal}>
                {longDate(picked)}
              </button>
              <input
                ref={dateRef}
                className="rc-datenative"
                type="date"
                value={picked}
                max={TODAY}
                tabIndex={-1}
                aria-label="Pilih tanggal"
                onChange={(e) => e.target.value && setPicked(e.target.value)}
              />
              <button type="button" aria-label="Hari berikutnya" disabled={picked >= TODAY} onClick={() => step(1)}>›</button>
            </div>

            <div className="rc-day">
              <div className="rc-total">
                <Stat v={num(picked1.inspections)} l="inspeksi" />
                <Stat v={num(picked1.defects)} l="defect" tone="red" />
                <Stat v={rate(picked1.passRate)} l="pass rate" tone="green" />
              </div>
              {pickedBy.length > 1 && (
                <ul className="rc-mini">
                  {pickedBy.map((r) => (
                    <li key={r.section}>
                      <span>{r.name}</span>
                      <span>{num(r.inspections)} · {num(r.defects)} def</span>
                      <strong className={level(r.passRate)}>{rate(r.passRate)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {pickedTop.length > 0 && (
                <p className="rc-topdef">
                  <b>Defect terbanyak:</b> {pickedTop.map((d) => `${d.name} (${d.count})`).join(", ")}
                </p>
              )}
            </div>
          </>
        ) : (
          <ul className="rc-periods">
            {periods.map((p) => (
              <li key={p.label} className="rc-period">
                <div>
                  <strong>{p.label}</strong>
                  {p.sub && <small>{p.sub}</small>}
                </div>
                <div className="nums">
                  <span>{num(p.inspections)} inspeksi</span>
                  <span>{num(p.defects)} defect</span>
                </div>
                <b className={level(p.passRate)}>{rate(p.passRate)}</b>
              </li>
            ))}
          </ul>
        )}
      </Acc>
    </main>
  );
}

function Acc({ title, hint, open, onToggle, children }) {
  return (
    <section className="rc-acc">
      <button type="button" className="rc-acch" aria-expanded={open} onClick={onToggle}>
        <span>
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        <svg width="16" height="10" viewBox="0 0 14 9" fill="none" aria-hidden="true"
             style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="m1 1.5 6 6 6-6" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="rc-accb">{children}</div>}
    </section>
  );
}

function Stat({ v, l, tone }) {
  return (
    <div className={`rc-stat ${tone ?? ""}`}>
      <strong>{v}</strong>
      <span>{l}</span>
    </div>
  );
}