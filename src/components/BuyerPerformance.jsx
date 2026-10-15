import { useMemo, useState } from "react";
import { buyerPerformance } from "../mock/dashboardData.js";
import "./BuyerPerformance.css";

const NAMES = { cutting: "Cutting", sewing: "Sewing", washing: "Washing", finishing: "Finishing" };
const LIMIT = 5;

// defect rate: makin kecil makin baik
const level = (r) => (r <= 5 ? "good" : r <= 10 ? "warn" : "bad");
const fmt = (n) => Number(n).toLocaleString("id-ID", { maximumFractionDigits: 1 });
const num = (n) => Number(n).toLocaleString("id-ID");

const SORTS = {
  worst:  (a, b) => b.rate - a.rate || b.inspections - a.inspections,
  best:   (a, b) => a.rate - b.rate || b.inspections - a.inspections,
  volume: (a, b) => b.inspections - a.inspections,
};

export default function BuyerPerformance({ sections, date }) {
  const [tab, setTab] = useState("buyer");
  const [sort, setSort] = useState("worst");
  const [scope, setScope] = useState("all");
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const secs = scope === "all" ? sections : [scope];
  const buyers = useMemo(() => buyerPerformance(secs, date), [secs.join(), date]);

  const rows = useMemo(() => {
    const list =
      tab === "buyer"
        ? buyers
        : buyers.flatMap((b) => b.styles.map((s) => ({ ...s, buyer: b.name })));
    return [...list].sort(SORTS[sort]);
  }, [buyers, tab, sort]);

  const max = Math.max(1, ...rows.map((r) => r.rate));
  const shown = showAll ? rows : rows.slice(0, LIMIT);

  const reset = () => { setOpen(null); setShowAll(false); };

  return (
    <section className="card bp">
      <h2 className="bp-title">Performa Buyer &amp; Style</h2>
      <p className="bp-sub">Peringkat berdasarkan defect rate</p>

      {sections.length > 1 && (
        <div className="bp-chips" role="tablist" aria-label="Section">
          {["all", ...sections].map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={scope === k}
              className={`bp-chip ${scope === k ? "on" : ""}`}
              onClick={() => { setScope(k); reset(); }}
            >
              {k === "all" ? "Semua" : NAMES[k]}
            </button>
          ))}
        </div>
      )}

      <div className="bp-tabs" role="tablist" aria-label="Kelompok">
        {[["buyer", "Buyer"], ["style", "Style"]].map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "on" : ""}
            onClick={() => { setTab(k); reset(); }}
          >
            {l}
          </button>
        ))}
      </div>

      <select
        className="bp-sort"
        value={sort}
        aria-label="Urutkan"
        onChange={(e) => { setSort(e.target.value); reset(); }}
      >
        <option value="worst">Defect rate tertinggi dulu</option>
        <option value="best">Defect rate terendah dulu</option>
        <option value="volume">Inspeksi terbanyak dulu</option>
      </select>

      {rows.length === 0 ? (
        <p className="bp-empty">Tidak ada data untuk tanggal ini.</p>
      ) : (
        <>
          <ul className="bp-list">
            {shown.map((r, i) => {
              const key = tab === "buyer" ? r.name : `${r.buyer}-${r.name}`;
              const expandable = tab === "buyer";
              const isOpen = open === key;
              return (
                <li key={key}>
                  <Row
                    rank={i + 1}
                    r={r}
                    sub={tab === "style" ? r.buyer : `${r.styles.length} style`}
                    max={max}
                    expandable={expandable}
                    open={isOpen}
                    onToggle={() => setOpen(isOpen ? null : key)}
                  />
                  {expandable && isOpen && (
                    <ul className="bp-sublist">
                      {[...r.styles].sort(SORTS[sort]).map((s, j) => (
                        <li key={s.name}>
                          <Row rank={j + 1} r={s} max={max} small />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {rows.length > LIMIT && (
            <button type="button" className="bp-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Tampilkan lebih sedikit" : `Lihat semua (${rows.length})`}
            </button>
          )}
          <p className="bp-legend">Defect rate: hijau ≤ 5% · oranye 5–10% · merah &gt; 10%</p>
        </>
      )}
    </section>
  );
}

function Row({ rank, r, sub, max, expandable, open, onToggle, small }) {
  const Tag = expandable ? "button" : "div";
  const props = expandable
    ? { type: "button", onClick: onToggle, "aria-expanded": open }
    : {};
  const up = r.delta > 0;
  return (
    <Tag className={`bp-row ${level(r.rate)} ${small ? "small" : ""}`} {...props}>
      <span className="rank">{rank}</span>
      <span className="main">
        <span className="top">
          <span className="nm">
            {r.name}
            {sub && <small>{sub}</small>}
          </span>
          <strong>{fmt(r.rate)}%</strong>
        </span>
        <span className="bar" role="img" aria-label={`${r.name} defect rate ${fmt(r.rate)} persen`}>
          <i style={{ width: `${Math.max(4, (r.rate / max) * 100)}%` }} />
        </span>
        <span className="meta">
          <span>{num(r.inspections)} inspeksi · {num(r.defects)} defect</span>
          {r.delta !== 0 && (
            <span className={up ? "worse" : "better"}>
              {up ? "↑" : "↓"} {fmt(Math.abs(r.delta))} poin
            </span>
          )}
        </span>
      </span>
      {expandable && (
        <svg className="chev" width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true"
             style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <path d="m1 1.5 6 6 6-6" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Tag>
  );
}