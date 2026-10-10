import { useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { hourLabel, hourSlots } from "../config/sections.js";
import "./NewQcCheck.css";

const FIELDS = [
  { name: "buyer",   label: "Buyer",   placeholder: "e.g. VS" },
  { name: "style",   label: "Style",   placeholder: "Enter style" },
  { name: "color",   label: "Color",   placeholder: "Enter color" },
  { name: "inspect", label: "Inspect", placeholder: "Quantity to inspect", numeric: true },
  { name: "line",    label: "Line",    placeholder: "e.g. 3 or 3A" },
];

// Jam yang boleh dipilih: dari awal jam kerja sampai jam sekarang
// (jam yang belum tiba tidak bisa dipilih). Urutan: terbaru di atas.
function allowedHours() {
  const slots = hourSlots();
  const now = new Date().getHours();
  const max = Math.max(slots[0], Math.min(now, slots[slots.length - 1]));
  return slots.filter((h) => h <= max).reverse();
}

export default function NewQcCheck({ hourly = false, onBack, onStart }) {
  const [hours] = useState(allowedHours);
  const [hour, setHour] = useState(String(hours[0]));
  const [values, setValues] = useState({
    buyer: "", style: "", color: "", inspect: "", line: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const field = FIELDS.find((f) => f.name === name);
    const clean = field?.numeric ? value.replace(/\D/g, "") : value;
    setValues((v) => ({ ...v, [name]: clean }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onStart?.({
      ...values,
      inspect: Number(values.inspect),
      line: values.line.trim(),
      hour: hourly ? Number(hour) : null, // jam yang dipilih (null untuk section harian)
    });
  };

  return (
    <main className="newqc">
      <StatusBar />

      <header className="newqc-head">
        <button type="button" className="newqc-back" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10 2 2 10l8 8" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="newqc-title">New QC Check</h1>
      </header>

      <form className="newqc-form" onSubmit={handleSubmit}>
        {hourly && (
          <label className="nq-field">
            <span className="nq-label">Jam</span>
            <select name="hour" value={hour} onChange={(e) => setHour(e.target.value)}>
              {hours.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
            <span className="nq-hint">Boleh memilih jam sebelumnya untuk pengisian susulan.</span>
          </label>
        )}

        {FIELDS.map((f) => (
          <label key={f.name} className="nq-field">
            <span className="nq-label">{f.label}</span>
            <input
              name={f.name}
              type="text"
              inputMode={f.numeric ? "numeric" : "text"}
              pattern={f.numeric ? "[0-9]+" : undefined}
              placeholder={f.placeholder}
              value={values[f.name]}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </label>
        ))}

        <button type="submit" className="nq-submit">Start QC Check</button>
      </form>
    </main>
  );
}