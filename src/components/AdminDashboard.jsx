import { useMemo, useRef, useState } from "react";
import { MENU_ADMIN, MENU_SUPER } from "../config/menus.js";
import { adminDay } from "../mock/dashboardData.js";
import StatusBar from "./StatusBar.jsx";
import MenuDrawer from "./MenuDrawer.jsx";
import "./DashboardUser.css";
import "./AdminDashboard.css";
import BuyerPerformance from "./BuyerPerformance.jsx";
import { useCuttingDay } from "../api/cutting.js";
import "./StatsLineDefects.css";
import { useInspectionDay } from "../api/inspectionReports.js";

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

const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return "Good morning";
  if (h < 15) return "Good afternoon";
  if (h < 18) return "Good evening";
  return "Good night";
};

const TODAY = toISO(new Date());

// 90% ke atas hijau, 80-89% oranye, di bawah 80% merah
const level = (p) => (p >= 90 ? "good" : p >= 80 ? "warn" : "bad");
const INSPECTION_LIVE = ["sewing", "washing", "finishing", "packing"]; // tambahkan packing nanti
const EMPTY = {
  overview: { inspections: 0, defect: 0, passRate: 0, total: 0 },
  lines: [],
};

export default function AdminDashboard({
  user,
  section,
  onNavigate,
  onBack,
  onLogout,
}) {
  const [date, setDate] = useState(TODAY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState("home");
  const dateRef = useRef(null);

  const sec = String(
    section ?? user.section ?? user.process ?? "sewing",
  ).toLowerCase();
  const isCutting = sec === "cutting";
  const isInsp = INSPECTION_LIVE.includes(sec);
  const isLive = isCutting || isInsp;
  const liveCut = useCuttingDay(date, isCutting);
  const liveInsp = useInspectionDay(sec, date, isInsp);
  const live = isCutting ? liveCut : liveInsp;
  const mock = useMemo(() => adminDay(sec, date), [sec, date]);
  const {
    overview,
    lines,
    processes = [],
    topDefects = [],
    washingTypes = [],
  } = isLive ? (live.data ?? EMPTY) : mock;
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
        {onBack && (
          <button type="button" className="sa-back" onClick={onBack}>
            ‹ All sections
          </button>
        )}
        <header className="dash-head">
          <div>
            <h1 className="dash-greeting">
              {greeting()}, <span className="code">Admin!</span>
            </h1>
            <p className="dash-area">{sec.toUpperCase()} QC</p>
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

        {/* Overview */}
        <section className="card summary">
          <h2 className="summary-title">
            {isToday ? "Today’s Overview" : `Overview – ${shortDate(date)}`}
          </h2>
          <div className="stats filled">
            <Stat value={overview.inspections} label="inspections" />
            <Stat value={overview.defect} label="defect" tone="red" />
            <Stat
              value={`${overview.passRate}%`}
              label="pass rate"
              tone="green"
            />
            <Stat value={overview.total} label="total amount" />
          </div>
        </section>

        {/* Performa per line */}
        <h2 className="recent-title">
          {isCutting
            ? isToday
              ? "Today’s Process Performance"
              : `Process Performance – ${shortDate(date)}`
            : isToday
              ? "Today’s Line Performance"
              : `Line Performance – ${shortDate(date)}`}
        </h2>

        {isLive && live.loading && <p className="empty">Loading…</p>}
        {isLive && live.error && (
          <p className="empty" role="alert">
            {live.error}
          </p>
        )}

        {lines.length === 0 ? (
          !(isLive && (live.loading || live.error)) && (
            <p className="empty">No data for this date.</p>
          )
        ) : (
          <>
            <ul className="card perf">
              {lines.map((l) => (
                <li key={l.name} className={`perf-row ${level(l.pct)}`}>
                  <div className="top">
                    <span className="nm">{l.name}</span>
                    <strong>{l.pct}%</strong>
                  </div>
                  <div
                    className="bar"
                    role="img"
                    aria-label={`${l.name} ${l.pct} percent`}
                  >
                    <i style={{ width: `${l.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="perf-legend">
              Green 90% above · Orange 80–89% · Red below 80%
            </p>
          </>
        )}
        {isCutting && processes.length > 0 && (
          <>
            <h2 className="recent-title">Top 3 Defects per Process</h2>
            <ul className="card sld-list" style={{ padding: 14 }}>
              {processes.map((p) => {
                const max = Math.max(1, ...p.top.map((d) => d.count));
                return (
                  <li key={p.name} className="sld-line">
                    <div className="sld-head">
                      <span className="sld-nm">{p.name}</span>
                      <span className="sld-rate">{p.rate}%</span>
                    </div>
                    <span className="sld-meta">
                      {p.inspected} pcs inspected · {p.defects} defects
                    </span>
                    {p.top.length === 0 ? (
                      <p className="hs-meta">No defects found.</p>
                    ) : (
                      <ol className="sld-top">
                        {p.top.map((d, k) => (
                          <li key={d.name}>
                            <div className="row">
                              <span>
                                {k + 1}. {d.name}
                              </span>
                              <b>{d.count}</b>
                            </div>
                            <div className="bar">
                              <i
                                style={{ width: `${(d.count / max) * 100}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {isInsp && topDefects.length > 0 && (
          <>
            <h2 className="recent-title">Top 3 Defects</h2>
            <ul className="card sa-top">
              {topDefects.map((d, i) => {
                const max = Math.max(1, topDefects[0].count);
                return (
                  <li key={d.name}>
                    <span className="rank">{i + 1}</span>
                    <div className="grow">
                      <div className="top">
                        <span className="nm">{d.name}</span>
                        <strong>{d.count}</strong>
                      </div>
                      <div className="bar red">
                        <i style={{ width: `${(d.count / max) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {sec === "washing" && washingTypes.length > 0 && (
          <>
            <h2 className="recent-title">Bulk vs Repair</h2>
            <ul className="card perf">
              {washingTypes.map((w) => (
                <li key={w.name} className={`perf-row ${level(w.pct)}`}>
                  <div className="top">
                    <span className="nm">{w.name}</span>
                    <strong>{w.pct}%</strong>
                  </div>
                  <div
                    className="bar"
                    role="img"
                    aria-label={`${w.name} ${w.pct} percent`}
                  >
                    <i style={{ width: `${w.pct}%` }} />
                  </div>
                  <p className="sld-meta" style={{ margin: "6px 0 0" }}>
                    {w.inspections} inspections · {w.qty} pcs · {w.defects}{" "}
                    defects
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        {!isLive && <BuyerPerformance sections={[sec]} date={date} />}
      </div>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        items={onBack ? MENU_SUPER : MENU_ADMIN}
        active={page}
        onSelect={(key) => {
          setPage(key);
          onNavigate?.(key);
        }}
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
