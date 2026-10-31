import { useEffect, useMemo, useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import {
  SECTIONS,
  WORK_HOURS,
  hourLabel,
  hourSlots,
} from "../config/sections.js";
import { userDay, buyerOfStyle } from "../mock/dashboardData.js";
import "./DashboardUser.css";
import { useCuttingInspections, cuttingUserDay } from "../api/cutting.js";
import { useInspections, inspectionUserDay } from "../api/inspections.js";

/* ---------- helper tanggal ---------- */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const longDate = (s) => {
  const d = fromISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const shortDate = (s) => {
  const d = fromISO(s);
  return `${d.getDate()} ${SHORT[d.getMonth()]}`;
};

const TODAY = toISO(new Date());

const MENU = [
  { key: "home", label: "HOME", icon: "home" },
  { key: "records", label: "QC RECORDS", icon: "records" },
  { key: "profile", label: "PROFILE", icon: "profile" },
];

export default function DashboardUser({
  user = { code: "QCSWGLN03", area: "SEWING . LINE 3", section: "sewing" },
  onLogout,
  onNavigate,
  onNewCheck,
  onHistory,
}) {
  const [date, setDate] = useState(TODAY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState("home");
  const dateRef = useRef(null);

  const isCutting = user.section === "cutting";
  const isLive = ["sewing", "washing", "finishing", "packing"].includes(
    user.section,
  );
  const live = useCuttingInspections(isCutting);
  const liveInsp = useInspections(user.section, isLive);

  const { summary, checks } = useMemo(
    () =>
      isCutting
        ? cuttingUserDay(live.list, date)
        : isLive
          ? inspectionUserDay(liveInsp.list, user.section, date)
          : userDay(user.section ?? "sewing", date),
    [isCutting, isLive, live.list, liveInsp.list, user.section, date],
  );
  const hourly = SECTIONS[user.section]?.frequency === "hourly";

  // Slot jam yang ditampilkan: semua jam yang sudah tiba (hari ini)
  // atau seluruh jam kerja (tanggal lampau), terbaru di atas.
  const nowHour = new Date().getHours();
  const lastDue =
    date === TODAY ? Math.min(nowHour, WORK_HOURS.end - 1) : WORK_HOURS.end - 1;
  const slots = hourSlots()
    .filter((h) => h <= lastDue || checks.some((c) => c.hour === h))
    .reverse();

  // tutup drawer dengan tombol Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const openCalendar = () => {
    const el = dateRef.current;
    if (el?.showPicker) el.showPicker();
    else el?.click();
  };

  return (
    <main className="dash">
      <StatusBar />

      <div className="dash-inner">
        {/* Header */}
        <header className="dash-head">
          <div>
            <h1 className="dash-greeting">
              Good day, <span className="code">{user.code}!</span>
            </h1>
            <p className="dash-area">{user.area}</p>
          </div>
          <button
            type="button"
            className="burger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        {/* Pilih tanggal */}
        <div className="datepick">
          <button type="button" className="date-chip" onClick={openCalendar}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect
                x="0.5"
                y="1.5"
                width="11"
                height="10"
                rx="1.5"
                fill="none"
                stroke="currentColor"
              />
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

        {/* Ringkasan */}
        <section className="card summary">
          <h2 className="summary-title">
            {date === TODAY ? "Today’s QC" : `QC – ${shortDate(date)}`}
          </h2>
          <div className="stats">
            <Stat value={summary.inspections} label="inspections" />
            <Stat value={summary.defect} label="defect" red />
            <Stat value={`${summary.defectPct}%`} label="% defect" red />
            <Stat
              value={summary.qty}
              label={
                ["sewing", "finishing"].includes(user.section)
                  ? "QTY Transfer"
                  : "QTY Inspect"
              }
            />
          </div>
        </section>

        <button type="button" className="btn-primary" onClick={onNewCheck}>
          {user.section === "final" ? "+ New Inspect" : "+ New QC Check"}
        </button>
        <button type="button" className="btn-outline" onClick={onHistory}>
          History
        </button>

        {/* Daftar check */}
        <h2 className="recent-title">
          {hourly ? "Checks per Hour" : "Recent Check"}
        </h2>

        {(isCutting ? live : isLive ? liveInsp : null)?.loading && (
          <p className="empty">Loading…</p>
        )}
        {(isCutting ? live : isLive ? liveInsp : null)?.error && (
          <p className="empty" role="alert">
            {(isCutting ? live : liveInsp).error}
          </p>
        )}

        {hourly ? (
          slots.length === 0 ? (
            <p className="empty">No data for this date.</p>
          ) : (
            <div className="hours">
              {slots.map((h) => {
                const list = checks.filter((c) => c.hour === h);
                if (list.length === 0) {
                  return (
                    <div key={h} className="hour-row">
                      <b>{hourLabel(h)}</b>
                      <small>Not filled yet</small>
                    </div>
                  );
                }
                return (
                  <section key={h} className="hour-group">
                    <h3 className="hour-head">
                      <span>{hourLabel(h)}</span>
                      <small>{list.length} check</small>
                    </h3>
                    <ul className="checks">
                      {list.map((c, i) => (
                        <CheckCard key={i} c={c} date={date} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )
        ) : checks.length === 0 ? (
          <p className="empty">No QC checks on this date.</p>
        ) : (
          <ul className="checks">
            {checks.map((c, i) => (
              <CheckCard key={i} c={c} date={date} />
            ))}
          </ul>
        )}
      </div>

      {/* Drawer burger */}
      <div
        className={`overlay ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <nav
        className={`drawer ${menuOpen ? "open" : ""}`}
        aria-hidden={!menuOpen}
        aria-label="Main menu"
      >
        <div className="drawer-head">
          <div className="avatar">
            <MenuIcon name="profile" size={32} />
          </div>
          <div className="drawer-who">
            <p className="drawer-name">{user.code}</p>
            <p className="drawer-area">{user.area}</p>
          </div>
          <button
            type="button"
            className="drawer-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M3 3l12 12M15 3L3 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <ul className="drawer-list">
          {MENU.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                className={`drawer-item ${page === m.key ? "active" : ""}`}
                aria-current={page === m.key ? "page" : undefined}
                onClick={() => {
                  setPage(m.key);
                  setMenuOpen(false);
                  onNavigate?.(m.key);
                }}
              >
                <MenuIcon name={m.icon} />
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="logout" onClick={onLogout}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4H5v16h4" />
            <path d="M16 8l4 4-4 4" />
            <path d="M20 12H9" />
          </svg>
          <span>LOG OUT</span>
        </button>
      </nav>
    </main>
  );
}

function CheckCard({ c, date }) {
  return (
    <li className="card check">
      <span className="check-id">{c.id}</span>
      <span className="check-buyer">{c.buyer ?? buyerOfStyle(c.style)}</span>
      <span className="check-meta">
        {shortDate(date)} - {c.time}
        {c.process ? ` - ${c.process}` : ""}
      </span>
      <span className="check-meta r">
        {c.style} - {c.qty} pcs
      </span>
    </li>
  );
}

function Stat({ value, label, red }) {
  return (
    <div className={`stat ${red ? "red" : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function MenuIcon({ name, size = 24 }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "home")
    return (
      <svg {...p}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
        <path d="M10 19.5v-5h4v5" />
      </svg>
    );
  if (name === "records")
    return (
      <svg {...p}>
        <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" />
        <path d="M9 9.5h.01M15 14.5h.01M15 9.5l-6 5" />
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18c1.2-2 3.2-3 5.5-3s4.3 1 5.5 3" />
    </svg>
  );
}
