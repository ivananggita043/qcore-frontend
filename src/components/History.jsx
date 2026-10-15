import { useMemo, useState } from "react";
import { userDay } from "../mock/dashboardData.js";
import "./History.css";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DAYS = 14;  // riwayat 14 hari terakhir
const PAGE = 30;  // jumlah kartu per tampilan

// Data contoh (ganti dengan GET /inspections nanti). Urutan: terbaru di atas.
function buildHistory(section) {
  const out = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(Date.now() - i * 864e5);
    const { checks } = userDay(section, toISO(d));
    checks.forEach((c, j) => {
      out.push({
        ...c,
        label: `${d.getDate()} ${SHORT[d.getMonth()]}`,
        edited: (i * 7 + j) % 9 === 0,
      });
    });
  }
  return out;
}

export default function History({ user, section = "sewing", onBack }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [buyer, setBuyer] = useState("all");
  const [shown, setShown] = useState(PAGE);

  const all = useMemo(() => buildHistory(section), [section]);
  const buyers = useMemo(() => [...new Set(all.map((c) => c.style))].sort(), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter(
      (c) =>
        (buyer === "all" || c.style === buyer) &&
        (!q ||
          `${c.id} ${c.style} ${c.label} ${c.time} ${c.status} ${c.edited ? "edited" : ""}`
            .toLowerCase()
            .includes(q))
    );
    if (sort === "oldest") list = [...list].reverse();
    return list;
  }, [all, query, buyer, sort]);

  const title = user?.area ?? `${section.toUpperCase()}`;

  return (
    <main className="hs">
      <header className="hs-head">
        <button type="button" className="hs-back" aria-label="Kembali" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="hs-title">{title}</h1>
      </header>

      <div className="hs-tools">
        <label className="hs-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search by buyer, style, or color..."
            aria-label="Cari riwayat"
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          />
        </label>

        <div className="hs-filters">
          <select className="hs-select" value={sort} aria-label="Urutkan"
                  onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
          </select>
          <select className="hs-select" value={buyer} aria-label="Filter buyer"
                  onChange={(e) => { setBuyer(e.target.value); setShown(PAGE); }}>
            <option value="all">All Buyer</option>
            {buyers.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="hs-empty">Tidak ada riwayat yang cocok.</p>
      ) : (
        <>
          <ul className="hs-list">
            {rows.slice(0, shown).map((c, i) => (
              <li key={i} className="hs-card">
                <span className="hs-id">{c.id}</span>
                <span className="hs-badges">
                  {c.edited && <span className="hs-badge edited">Edited</span>}
                  <span className={`hs-badge ${c.status.toLowerCase() === "pass" ? "pass" : "other"}`}>
                    {c.status}
                  </span>
                </span>
                <span className="hs-meta">{c.label} - {c.time}</span>
                <span className="hs-meta r">{c.style} - {c.qty} pcs</span>
              </li>
            ))}
          </ul>

          {shown < rows.length && (
            <button type="button" className="hs-more" onClick={() => setShown((n) => n + PAGE)}>
              Tampilkan lagi ({rows.length - shown})
            </button>
          )}
        </>
      )}
    </main>
  );
}