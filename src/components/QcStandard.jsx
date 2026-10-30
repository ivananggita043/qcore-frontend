import { useEffect, useMemo, useRef, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { hourLabel } from "../config/sections.js";
import { categoriesFor } from "../config/defects.js";
import "./QcStandard.css";

const lineLabel = (l) => (/^\d$/.test(String(l)) ? `0${l}` : l);
const keyOf = (cat, area, type) => [cat.key, area ?? "", type].join("|");
const has = (text, q) => text.toLowerCase().includes(q.trim().toLowerCase());

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="qs-searchwrap">
      <input
        className="qs-search"
        type="search"
        inputMode="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          className="qs-clear"
          aria-label="Delete search"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
    </div>
  );
}

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
  const [areaQuery, setAreaQuery] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  // key -> { category, area, type, count }
  const [counts, setCounts] = useState({});
  const typesRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cat = categories.find((c) => c.key === catKey) ?? categories[0];
  const isAreaType = cat.kind === "areaType";
  const areas = isAreaType ? cat.areas.filter((a) => has(a, areaQuery)) : [];
  const types = cat.types.filter((t) => has(t, typeQuery));
  const showTypeSearch = cat.types.length > 6; // kategori pendek tidak perlu pencarian

  const entries = Object.entries(counts);
  const total = entries.reduce((s, [, e]) => s + e.count, 0);
  const catTotal = (c) =>
    entries
      .filter(([, e]) => e.category === c.label)
      .reduce((s, [, e]) => s + e.count, 0);
  const areaTotal = (a) =>
    entries
      .filter(([, e]) => e.category === cat.label && e.area === a)
      .reduce((s, [, e]) => s + e.count, 0);
  const countOf = (a, type) => counts[keyOf(cat, a, type)]?.count ?? 0;

  // setelah area dipilih, geser layar ke daftar defect type
  useEffect(() => {
    if (area)
      typesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [area]);

  const change = (a, type, delta) =>
    setCounts((prev) => {
      const key = keyOf(cat, a, type);
      const next = Math.max(0, (prev[key]?.count ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[key];
      else copy[key] = { category: cat.label, area: a, type, count: next };
      return copy;
    });

  // isi jumlah langsung dengan angka
  const setCount = (a, type, raw) =>
    setCounts((prev) => {
      const key = keyOf(cat, a, type);
      const n = Math.min(9999, Number(String(raw).replace(/\D/g, "")) || 0);
      const copy = { ...prev };
      if (n === 0) delete copy[key];
      else copy[key] = { category: cat.label, area: a, type, count: n };
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
    setAreaQuery("");
    setTypeQuery("");
  };

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit?.({
        ...job,
        defects: Object.values(counts).map(
          ({ category, area: a, type, count }) => ({
            category,
            area: a,
            type,
            count,
          }),
        ),
      });
    } catch (e) {
      setError(e?.message || "Failed to submit. Please try again.");
      setBusy(false);
    }
  };

  const renderTypes = (forArea) =>
    types.length === 0 ? (
      <p className="qs-empty">no defect type found.</p>
    ) : (
      <ul className="qs-list">
        {types.map((t) => {
          const n = countOf(forArea, t);
          return (
            <li key={t} className={`qs-item ${n > 0 ? "has" : ""}`}>
              <span className="qs-area">{t}</span>
              <div className="qs-step">
                <button
                  type="button"
                  aria-label={`Kurangi ${t}`}
                  disabled={n === 0}
                  onClick={() => change(forArea, t, -1)}
                >
                  −
                </button>
                <input
                  className="qs-num"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={`Jumlah ${t}`}
                  value={n === 0 ? "" : n}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCount(forArea, t, e.target.value)}
                />
                <button
                  type="button"
                  aria-label={`Tambah ${t}`}
                  onClick={() => change(forArea, t, 1)}
                >
                  +
                </button>
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
        <button
          type="button"
          className="qs-back"
          aria-label="Back"
          onClick={onBack}
        >
          <svg
            width="12"
            height="20"
            viewBox="0 0 12 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 2 2 10l8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
          {job.line && (
            <>
              {" "}
              <span className="b">LN {lineLabel(job.line)}</span>
            </>
          )}
        </p>
        {job.hour != null && (
          <p className="qs-hour">Jam {hourLabel(job.hour)}</p>
        )}
        {job.washingType && (
          <p className="qs-hour">
            {job.washingType === "BULK" ? "Bulk" : "Repair"} · Handfeel{" "}
            {job.handfeel} · Grade {job.grade}
          </p>
        )}

        {/* Kategori (turun ke baris berikutnya, tanpa geser samping) */}
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
            <p className="qs-sub">1. Pilih Defect Area</p>
            {area ? (
              <div className="qs-picked-bar">
                <span>{area}</span>
                <button type="button" onClick={() => setArea(null)}>
                  Ganti area
                </button>
              </div>
            ) : (
              <>
                <SearchBox
                  value={areaQuery}
                  onChange={setAreaQuery}
                  placeholder="Cari defect area…"
                />
                {areas.length === 0 ? (
                  <p className="qs-empty">No defect areas found.</p>
                ) : (
                  <div
                    className="qs-areas"
                    role="group"
                    aria-label="Defect area"
                  >
                    {areas.map((a) => {
                      const n = areaTotal(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          className={`qs-area-chip ${n > 0 ? "has" : ""}`}
                          onClick={() => {
                            setArea(a);
                            setAreaQuery("");
                          }}
                        >
                          <span>{a}</span>
                          {n > 0 && <em>{n}</em>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <p className="qs-sub" ref={typesRef}>
              2. Hitung Defect Type
            </p>
            {area ? (
              <>
                {showTypeSearch && (
                  <SearchBox
                    value={typeQuery}
                    onChange={setTypeQuery}
                    placeholder="Cari defect type…"
                  />
                )}
                {renderTypes(area)}
              </>
            ) : (
              <p className="qs-empty">Please select a defect area first.</p>
            )}
          </>
        ) : (
          <>
            <p className="qs-sub">Count Defect Types</p>
            {showTypeSearch && (
              <SearchBox
                value={typeQuery}
                onChange={setTypeQuery}
                placeholder="Find defect type…"
              />
            )}
            {renderTypes(null)}
          </>
        )}

        {/* Ringkasan yang sudah dicatat */}
        {entries.length > 0 && (
          <section className="qs-recorded">
            <p className="qs-sub">Already recorded ({total})</p>
            <ul>
              {entries.map(([key, e]) => (
                <li key={key}>
                  <span>
                    <b>{e.category}</b>
                    {e.area ? ` · ${e.area}` : ""} · {e.type}
                  </span>
                  <strong>×{e.count}</strong>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => removeEntry(key)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="qs-foot">
        {error && (
          <p
            role="alert"
            style={{
              color: "#c62828",
              fontWeight: 600,
              fontSize: 16,
              margin: "0 auto 8px",
              maxWidth: 420,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="button"
          className="qs-submit"
          disabled={busy}
          onClick={handleSubmit}
        >
          {busy
            ? "Submitting…"
            : `Submit${total > 0 ? ` (${total} defect)` : ""}`}
        </button>
      </footer>
    </main>
  );
}
