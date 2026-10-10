import { useMemo, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { hourLabel } from "../config/sections.js";
import { categoriesFor } from "../config/defects.js";
import "./QcStandard.css";

const lineLabel = (l) => (/^\d$/.test(String(l)) ? `0${l}` : l);
const keyOf = (cat, area, type) => [cat.key, area ?? "", type].join("|");

export default function QcStandard({
  job,
  section = "sewing",
  sectionLabel = "Sewing",
  onBack,
  onSubmit,
}) {
  const categories = useMemo(() => categoriesFor(section), [section]);
  const [catKey, setCatKey] = useState(categories[0].key);
  const [area, setArea] = useState(null);
  const [query, setQuery] = useState("");
  // key -> { category, area, type, count }
  const [counts, setCounts] = useState({});

  const cat = categories.find((c) => c.key === catKey) ?? categories[0];
  const q = query.trim().toLowerCase();
  const match = (s) => s.toLowerCase().includes(q);

  const entries = Object.entries(counts);
  const total = entries.reduce((s, [, e]) => s + e.count, 0);
  const catTotal = (c) =>
    entries.filter(([, e]) => e.category === c.label).reduce((s, [, e]) => s + e.count, 0);
  const areaTotal = (a) =>
    entries
      .filter(([, e]) => e.category === cat.label && e.area === a)
      .reduce((s, [, e]) => s + e.count, 0);
  const countOf = (a, type) => counts[keyOf(cat, a, type)]?.count ?? 0;

  const change = (a, type, delta) =>
    setCounts((prev) => {
      const key = keyOf(cat, a, type);
      const next = Math.max(0, (prev[key]?.count ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[key];
      else copy[key] = { category: cat.label, area: a, type, count: next };
      return copy;
    });

  const removeEntry = (key) =>
    setCounts((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

  const selectCategory = (key) => {
    setCatKey(key);
    setArea(null);
    setQuery("");
  };

  const handleSubmit = () =>
    onSubmit?.({
      ...job,
      defects: Object.values(counts).map(({ category, area: a, type, count }) => ({
        category, area: a, type, count,
      })),
    });

  const isAreaType = cat.kind === "areaType";
  const areas = isAreaType ? cat.areas.filter(match) : [];
  const types = isAreaType ? cat.types : cat.types.filter(match);

  const TypeRows = ({ forArea }) => (
    <ul className="qs-list">
      {types.map((t) => {
        const n = countOf(forArea, t);
        return (
          <li key={t} className={`qs-item ${n > 0 ? "has" : ""}`}>
            <span className="qs-area">{t}</span>
            <div className="qs-step">
              <button type="button" aria-label={`Kurangi ${t}`} disabled={n === 0}
                      onClick={() => change(forArea, t, -1)}>−</button>
              <output aria-live="polite">{n}</output>
              <button type="button" aria-label={`Tambah ${t}`}
                      onClick={() => change(forArea, t, 1)}>+</button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <main className="qs">
      <StatusBar />

      <header className="qs-head">
        <button type="button" className="qs-back" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="qs-title">New QC Check {sectionLabel}</h1>
      </header>

      <div className="qs-main">
        <p className="qs-job">
          <span className="b">{job.buyer} -</span>{" "}
          <span className="o">{job.style}</span>{" "}
          <span className="b">{job.color} .</span>{" "}
          <span className="o">{job.inspect} PCS</span>{" "}
          <span className="b">LN {lineLabel(job.line)}</span>
        </p>
        {job.hour != null && <p className="qs-hour">Jam {hourLabel(job.hour)}</p>}

        <input
          className="qs-search"
          type="search"
          placeholder={isAreaType ? "cari area..." : "cari defect type..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={isAreaType ? "Cari area" : "Cari defect type"}
        />

        {/* Kategori */}
        <div className="qs-tabs" role="group" aria-label="Kategori">
          {categories.map((c) => {
            const n = catTotal(c);
            return (
              <button
                key={c.key}
                type="button"
                className={`qs-tab ${cat.key === c.key ? "active" : ""}`}
                aria-pressed={cat.key === c.key}
                onClick={() => selectCategory(c.key)}
              >
                {c.label}
                {n > 0 && <span className="qs-badge">{n}</span>}
              </button>
            );
          })}
        </div>

        {isAreaType ? (
          <>
            <p className="qs-sub">1. Defect Area</p>
            {areas.length === 0 ? (
              <p className="qs-empty">No areas found.</p>
            ) : (
              <div className="qs-areas" role="group" aria-label="Defect area">
                {areas.map((a) => {
                  const n = areaTotal(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      className={`qs-area-chip ${area === a ? "sel" : ""} ${n > 0 ? "has" : ""}`}
                      aria-pressed={area === a}
                      onClick={() => setArea(a)}
                    >
                      <span>{a}</span>
                      {n > 0 && <em>{n}</em>}
                    </button>
                  );
                })}
              </div>
            )}

            <p className="qs-sub">
              2. Defect Type {area && <span className="qs-picked">· {area}</span>}
            </p>
            {area ? <TypeRows forArea={area} /> : (
              <p className="qs-empty">Pilih defect area terlebih dahulu.</p>
            )}
          </>
        ) : types.length === 0 ? (
          <p className="qs-empty">No defect types found.</p>
        ) : (
          <>
            <p className="qs-sub">Defect Type</p>
            <TypeRows forArea={null} />
          </>
        )}

        {/* Ringkasan yang sudah dicatat */}
        {entries.length > 0 && (
          <section className="qs-recorded">
            <p className="qs-sub">Dicatat ({total})</p>
            <ul>
              {entries.map(([key, e]) => (
                <li key={key}>
                  <span>
                    <b>{e.category}</b>
                    {e.area ? ` · ${e.area}` : ""} · {e.type}
                  </span>
                  <strong>×{e.count}</strong>
                  <button type="button" aria-label="Hapus" onClick={() => removeEntry(key)}>×</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="qs-foot">
        <button type="button" className="qs-submit" onClick={handleSubmit}>
          Submit{total > 0 ? ` (${total} defect)` : ""}
        </button>
      </footer>
    </main>
  );
}