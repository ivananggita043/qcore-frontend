import { useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import MenuDrawer from "./MenuDrawer.jsx";
import "./DashboardUser.css";
import "./AdminDashboard.css";

/* ---------- helper tanggal ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (s) => { const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const shortDate = (s) => { const d = fromISO(s); return `${d.getDate()} ${SHORT[d.getMonth()]}`; };

const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Good morning";
  if (h < 15) return "Good afternoon";
  if (h < 18) return "Good evening";
  return "Good night";
};

/* ---------- data contoh (ganti dengan API) ---------- */
const TODAY = toISO(new Date());
const YESTERDAY = toISO(new Date(Date.now() - 864e5));
const MOCK = {
  [TODAY]: {
    overview: { inspections: 1, defect: 13, passRate: 98, total: 40 },
    lines: [
      { name: "Line 01", pct: 89 },
      { name: "Line 02", pct: 89 },
      { name: "Line 03", pct: 89 },
      { name: "Line 04", pct: 89 },
    ],
  },
  [YESTERDAY]: {
    overview: { inspections: 2, defect: 4, passRate: 97, total: 80 },
    lines: [
      { name: "Line 01", pct: 93 },
      { name: "Line 02", pct: 86 },
      { name: "Line 03", pct: 78 },
      { name: "Line 04", pct: 95 },
    ],
  },
};
const EMPTY = { overview: { inspections: 0, defect: 0, passRate: 0, total: 0 }, lines: [] };

// 90% ke atas hijau, 80-89% oranye, di bawah 80% merah
const level = (p) => (p >= 90 ? "good" : p >= 80 ? "warn" : "bad");

const MENU = [
  { key: "home",    label: "HOME",       icon: "home" },
  { key: "records", label: "QC RECORDS", icon: "records" },
  { key: "users",   label: "USERS",      icon: "users" },
  { key: "profile", label: "PROFILE",    icon: "profile" },
];

export default function AdminDashboard({ user, onNavigate, onLogout }) {
  const [date, setDate] = useState(TODAY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState("home");
  const dateRef = useRef(null);

  const { overview, lines } = MOCK[date] ?? EMPTY;
  const isToday = date === TODAY;

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
              {greeting()}, <span className="code">Admin!</span>
            </h1>
            <p className="dash-area">{(user.process ?? "").toUpperCase()} QC</p>
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

        {/* Overview */}
        <section className="card summary">
          <h2 className="summary-title">
            {isToday ? "Today’s Overview" : `Overview – ${shortDate(date)}`}
          </h2>
          <div className="stats filled">
            <Stat value={overview.inspections} label="inspections" />
            <Stat value={overview.defect} label="defect" tone="red" />
            <Stat value={`${overview.passRate}%`} label="pass rate" tone="green" />
            <Stat value={overview.total} label="total amount" />
          </div>
        </section>

        {/* Performa per line */}
        <h2 className="recent-title">
          {isToday ? "Today’s Line Performance" : `Line Performance – ${shortDate(date)}`}
        </h2>

        {lines.length === 0 ? (
          <p className="empty">Tidak ada data untuk tanggal ini.</p>
        ) : (
          <>
            <ul className="card perf">
              {lines.map((l) => (
                <li key={l.name} className={`perf-row ${level(l.pct)}`}>
                  <div className="top">
                    <span className="nm">{l.name}</span>
                    <strong>{l.pct}%</strong>
                  </div>
                  <div className="bar" role="img" aria-label={`${l.name} ${l.pct} persen`}>
                    <i style={{ width: `${l.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="perf-legend">Hijau 90% ke atas · Oranye 80–89% · Merah di bawah 80%</p>
          </>
        )}
      </div>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        items={MENU}
        active={page}
        onSelect={(key) => { setPage(key); onNavigate?.(key); }}
        onLogout={onLogout}
      />
    </main>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}