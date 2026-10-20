import { useState } from "react";
import { SECTIONS } from "../config/sections.js";
import StatusBar from "./StatusBar.jsx";
import "./DashboardUser.css";
import "./Report.css";

/* ---------- helper tanggal ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmt = (d) => `${d.getDate()} ${SHORT[d.getMonth()]} ${d.getFullYear()}`;

// minggu kerja: Jumat sampai Kamis, hari Minggu libur (6 hari kerja)
const WEEK_START = 5;   // 0=Minggu, 1=Senin, ... 5=Jumat
const OFF_DAYS = [0];   // 0 = Minggu libur

function weekRange(iso) {
  const d = fromISO(iso);
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() - WEEK_START + 7) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start, end];
}

function workingDays(start, end) {
  let n = 0;
  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
    if (!OFF_DAYS.includes(t.getDay())) n++;
  }
  return n;
}

const TODAY = toISO(new Date());
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(THIS_YEAR - i));

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const SECTION_OPTIONS = [
  { key: "all", label: "All" },
  ...Object.entries(SECTIONS).map(([key, s]) => ({ key, label: s.label })),
];

const SHEETS = [
  { name: "Summary", desc: "Total inspections, defects, pass rate" },
  { name: "Per Line", desc: "Performance per line" },
  { name: "Inspection List", desc: "All inspection data" },
  { name: "Defect Details", desc: "Defect per area and type" },
  { name: "Per Hour", desc: "Sewing and Washing only", only: ["sewing", "washing"] },
  { name: "AQL Result", desc: "Final only: sample size, limits and Pass/Fail per lot", only: ["final"] },
];

export default function Report({ user, isSuper, onBack }) {
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState(TODAY);
  const [week, setWeek] = useState(TODAY);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [year, setYear] = useState(YEARS[0]);
  const [sectionKey, setSectionKey] = useState("all");
  const [notice, setNotice] = useState("");

  // admin biasa hanya boleh section-nya sendiri
  const fixedSection = !isSuper;
  const activeSection = fixedSection ? user.section : sectionKey;
  const sectionLabel = fixedSection
    ? user.process
    : SECTION_OPTIONS.find((s) => s.key === sectionKey)?.label;

  const sheets = SHEETS.filter(
    (s) => !s.only || activeSection === "all" || s.only.includes(activeSection)
  );

  // label periode dan bagian nama file
  let periodLabel = "";
  let filePart = "";
  if (period === "daily") {
    const d = fromISO(date);
    periodLabel = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    filePart = date;
  } else if (period === "weekly") {
    const [s, e] = weekRange(week);
    periodLabel = `${fmt(s)} – ${fmt(e)}`;
    filePart = `${toISO(s)}_${toISO(e)}`;
  } else if (period === "monthly") {
    const [y, m] = month.split("-").map(Number);
    periodLabel = `${MONTHS[m - 1]} ${y}`;
    filePart = month;
  } else {
    periodLabel = `Tahun ${year}`;
    filePart = year;
  }
  const fileName = `QC-Report_${activeSection === "all" ? "All" : sectionLabel}_${filePart}.xlsx`;

  const download = () => {
    // TODO: panggil endpoint report backend, lalu unduh file .xlsx
    setNotice("This is a design preview. Excel download will work once the backend is ready.");
    setTimeout(() => setNotice(""), 5000);
  };

  return (
    <main className="dash">
      <StatusBar />

      <div className="dash-inner rp">
        <button type="button" className="rp-back" onClick={onBack}>
          ‹ Back
        </button>

        <h1 className="rp-title">Report</h1>
        <p className="rp-sub">Download the QC report as an Excel file.</p>

        {/* 1. Periode */}
        <h2 className="rp-step"><span>1</span> Select period</h2>
        <div className="rp-seg" role="tablist" aria-label="Period type">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              className={period === p.key ? "on" : ""}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="rp-card">
          {period === "daily" && (
            <label className="rp-field">
              <span>Date</span>
              <input type="date" value={date} max={TODAY}
                     onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          )}
          {period === "weekly" && (
            <>
              <label className="rp-field">
                <span>Pick any date in the week you want</span>
                <input type="date" value={week} max={TODAY}
                       onChange={(e) => e.target.value && setWeek(e.target.value)} />
              </label>
              <p className="rp-hint">Weeks run from Friday to Thursday: {periodLabel}</p>
            </>
          )}
          {period === "monthly" && (
            <label className="rp-field">
              <span>Month</span>
              <input type="month" value={month} max={TODAY.slice(0, 7)}
                     onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </label>
          )}
          {period === "yearly" && (
            <label className="rp-field">
              <span>Year</span>
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
        </div>

        {/* 2. Section */}
        <h2 className="rp-step"><span>2</span> Select section</h2>
        {fixedSection ? (
          <div className="rp-card rp-fixed">
            <strong>{sectionLabel}</strong>
            <span>Admin only can download their own section's report.</span>
          </div>
        ) : (
          <div className="rp-chips" role="radiogroup" aria-label="Section">
            {SECTION_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={sectionKey === s.key}
                className={sectionKey === s.key ? "on" : ""}
                onClick={() => setSectionKey(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* 3. Isi file */}
        <h2 className="rp-step"><span>3</span> Excel file contents</h2>
        <div className="rp-card rp-file">
          <div className="rp-file-head">
            <div className="rp-xls" aria-hidden="true">XLSX</div>
            <div>
              <p className="rp-file-name">{fileName}</p>
              <p className="rp-file-meta">{sectionLabel} · {periodLabel}</p>
            </div>
          </div>
          <ul className="rp-sheets">
            {sheets.map((s) => (
              <li key={s.name}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M3.5 9.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <strong>{s.name}</strong>
                  <span>{s.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {notice && <p className="rp-notice" role="status">{notice}</p>}

        <button type="button" className="rp-download" onClick={download}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" />
          </svg>
          Download Excel
        </button>
      </div>
    </main>
  );
}