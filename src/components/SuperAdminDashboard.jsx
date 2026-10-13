import { useRef, useState } from "react";
import { MENU_SUPER } from "../config/menus.js";
import StatusBar from "./StatusBar";
import MenuDrawer from "./MenuDrawer";
import "./AdminDashboard.css";
import "./SuperAdminDashboard.css";

/* ---------- helper tanggal ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (s) => { const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
};
const num = (n) => Number(n).toLocaleString("id-ID");                 // 1234 -> 1.234
const pct = (n) => `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`; // 98.8 -> 98,8%

/* ---------- data contoh (ganti dengan API) ---------- */
const TODAY = toISO(new Date());
const YESTERDAY = toISO(new Date(Date.now() - 864e5));

// delta: perubahan dibanding hari sebelumnya, dalam persen (positif = naik)
const MOCK = {
  [TODAY]: {
    kpi: {
      inspections: { value: 1234, delta: 32 },
      passRate:    { value: 98.8, delta: 1.5 },
      defects:     { value: 54,   delta: 8 },
      activeQc:    { value: 18,   delta: 3 },
    },
    sections: [
      { key: "cutting",   name: "Cutting",   pct: 89, inspections: 210, defects: 9 },
      { key: "sewing",    name: "Sewing",    pct: 89, inspections: 520, defects: 24 },
      { key: "washing",   name: "Washing",   pct: 89, inspections: 280, defects: 12 },
      { key: "finishing", name: "Finishing", pct: 89, inspections: 224, defects: 9 },
      // { key: "packing", name: "Packing", pct: 0, inspections: 0, defects: 0 },
    ],
    topDefects: [
      { name: "Skip Stitch", count: 14 },
      { name: "Broken Stitch", count: 11 },
      { name: "Uneven Hem", count: 8 },
    ],
  },
  [YESTERDAY]: {
    kpi: {
      inspections: { value: 935,  delta: -4 },
      passRate:    { value: 97.3, delta: -0.8 },
      defects:     { value: 50,   delta: -12 },
      activeQc:    { value: 17,   delta: 0 },
    },
    sections: [
      { key: "cutting",   name: "Cutting",   pct: 93, inspections: 190, defects: 5 },
      { key: "sewing",    name: "Sewing",    pct: 82, inspections: 400, defects: 26 },
      { key: "washing",   name: "Washing",   pct: 78, inspections: 190, defects: 12 },
      { key: "finishing", name: "Finishing", pct: 95, inspections: 155, defects: 7 },
    ],
    topDefects: [
      { name: "Broken Stitch", count: 15 },
      { name: "Skip Stitch", count: 12 },
      { name: "Stain", count: 7 },
    ],
  },
};
const EMPTY = {
  kpi: {
    inspections: { value: 0, delta: 0 },
    passRate: { value: 0, delta: 0 },
    defects: { value: 0, delta: 0 },
    activeQc: { value: 0, delta: 0 },
  },
  sections: [],
  topDefects: [],
};

const level = (p) => (p >= 90 ? "good" : p >= 80 ? "warn" : "bad");

const MENU = [
  { key: "home",    label: "HOME",       icon: "home" },
  { key: "records", label: "QC RECORDS", icon: "records" },
  { key: "users",   label: "USERS",      icon: "users" },
  { key: "profile", label: "PROFILE",    icon: "profile" },
];

export default function SuperAdminDashboard({ user, onNavigate, onOpenSection, onLogout }) {
  const [date, setDate] = useState(TODAY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState("home");
  const dateRef = useRef(null);

  const { kpi, sections, topDefects } = MOCK[date] ?? EMPTY;
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
          <p className="empty">Tidak ada data untuk tanggal ini.</p>
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
                      <span>{num(s.inspections)} inspeksi</span>
                      <span>{num(s.defects)} defect</span>
                      <span className="more" aria-hidden="true">Detail ›</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <p className="perf-legend">Hijau 90% ke atas · Oranye 80–89% · Merah di bawah 80%</p>
          </>
        )}

        {/* Defect terbanyak */}
        {topDefects.length > 0 && (
          <>
            <h2 className="recent-title">Defect Terbanyak</h2>
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
  const text = `${Math.abs(delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="card sa-kpi">
      <p className="lbl">{label}</p>
      <p className={`val ${tone ?? ""}`}>{value}</p>
      <p className={`delta ${good === null ? "flat" : good ? "good" : "bad"}`}>
        <span aria-hidden="true">{dir === "up" ? "↑" : dir === "down" ? "↓" : "–"}</span>
        {" "}{text}
        <span className="vs"> vs kemarin</span>
      </p>
    </div>
  );
}