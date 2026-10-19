import { useMemo, useRef, useState } from "react";
import { MENU_SUPER } from "../config/menus.js";
import { superDay } from "../mock/dashboardData.js";
import StatusBar from "./StatusBar";
import MenuDrawer from "./MenuDrawer";
import "./AdminDashboard.css";
import "./SuperAdminDashboard.css";
import BuyerPerformance from "./BuyerPerformance.jsx";
import { SECTIONS } from "../config/sections.js";

/* ---------- helper tanggal ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (s) => { const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Good Morning";
  if (h < 15) return "Good Afternoon";
  if (h < 18) return "Good Evening";
  return "Good Night";
};
const num = (n) => Number(n).toLocaleString("en-US");                 // 1234 -> 1.234
const pct = (n) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`; // 98.8 -> 98.8%

const TODAY = toISO(new Date());

const level = (p) => (p >= 90 ? "good" : p >= 80 ? "warn" : "bad");

export default function SuperAdminDashboard({ user, onNavigate, onOpenSection, onLogout }) {
  const [date, setDate] = useState(TODAY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState("home");
  const dateRef = useRef(null);

  const { kpi, sections, topDefects } = useMemo(() => superDay(date), [date]);
  const isToday = date === TODAY;
  const maxDefect = Math.max(1, ...topDefects.map((d) => d.count));

  const openCalendar = () => {
    const el = dateRef.current;
    if (el?.showPicker) el.showPicker();
    else el?.click();
  };

  return (
    <main className="dash">
      <StatusBar />

      <div className="dash-inner">
        <header className="dash-head">
          <div>
            <h1 className="dash-greeting">
              {greeting()}, <span className="code">SprAdm!</span>
            </h1>
            <p className="dash-area">
              {isToday ? "Here’s today QC overview" : "QC overview"}
            </p>
          </div>
          <button
            type="button"
            className="burger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span /><span /><span />
          </button>
        </header>

        {/* Pilih tanggal */}
        <div className="datepick">
          <button type="button" className="date-chip" onClick={openCalendar}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="0.5" y="1.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" />
              <rect x="0" y="3" width="12" height="2" fill="currentColor" />
            </svg>
            {longDate(date)}
          </button>
          <input
            ref={dateRef}
            className="date-native"
            type="date"
            value={date}
            max={TODAY}
            tabIndex={-1}
            aria-label="Choose date"
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>

        {/* KPI */}
        <div className="sa-kpis">
          <Kpi label="Total Inspection" value={num(kpi.inspections.value)} delta={kpi.inspections.delta} upIsGood />
          <Kpi label="Pass Rate" value={pct(kpi.passRate.value)} delta={kpi.passRate.delta} upIsGood tone="green" decimals />
          <Kpi label="Defects" value={num(kpi.defects.value)} delta={kpi.defects.delta} upIsGood={false} tone="red" />
          <Kpi label="Active QC" value={num(kpi.activeQc.value)} delta={kpi.activeQc.delta} upIsGood />
        </div>

        {/* Quality performance */}
        <h2 className="recent-title">Quality Performance</h2>

        {sections.length === 0 ? (
          <p className="empty">No data for this date.</p>
        ) : (
          <>
            <ul className="card sa-sections">
              {sections.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    className={`sa-section ${level(s.pct)}`}
                    onClick={() => onOpenSection?.(s.key)}
                    aria-label={`Lihat detail ${s.name}, ${s.pct} persen`}
                  >
                    <div className="top">
                      <span className="nm">{s.name}</span>
                      <strong>{s.pct}%</strong>
                    </div>
                    <div className="bar" role="img" aria-label={`${s.name} ${s.pct} persen`}>
                      <i style={{ width: `${s.pct}%` }} />
                    </div>
                    <div className="meta">
                      <span>{num(s.inspections)} inspections</span>
                      <span>{num(s.defects)} defect</span>
                      <span className="more" aria-hidden="true">Detail ›</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <p className="perf-legend">Green 90% above · Yellow 80–89% · Red below 80%</p>
          </>
        )}

        {/* Defect terbanyak */}
        {topDefects.length > 0 && (
          <>
            <h2 className="recent-title">Top Defects</h2>
            <ul className="card sa-top">
              {topDefects.map((d, i) => (
                <li key={d.name}>
                  <span className="rank">{i + 1}</span>
                  <div className="grow">
                    <div className="top">
                      <span className="nm">{d.name}</span>
                      <strong>{d.count}</strong>
                    </div>
                    <div className="bar red">
                      <i style={{ width: `${(d.count / maxDefect) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <BuyerPerformance sections={Object.keys(SECTIONS)} date={date} />
      </div>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        items={MENU_SUPER}
        active={page}
        onSelect={(key) => { setPage(key); onNavigate?.(key); }}
        onLogout={onLogout}
      />
    </main>
  );
}

function Kpi({ label, value, delta, upIsGood, tone }) {
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const good = dir === "flat" ? null : (dir === "up") === upIsGood;
  const text = `${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="card sa-kpi">
      <p className="lbl">{label}</p>
      <p className={`val ${tone ?? ""}`}>{value}</p>
      <p className={`delta ${good === null ? "flat" : good ? "good" : "bad"}`}>
        <span aria-hidden="true">{dir === "up" ? "↑" : dir === "down" ? "↓" : "–"}</span>
        {" "}{text}
        <span className="vs"> vs yesterday</span>
      </p>
    </div>
  );
}