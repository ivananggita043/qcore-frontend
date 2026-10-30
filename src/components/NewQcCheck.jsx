import { useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { hourLabel, hourSlots } from "../config/sections.js";
import "./NewQcCheck.css";

const FIELDS = [
  { name: "buyer", label: "Buyer", placeholder: "e.g. VS" },
  { name: "style", label: "Style", placeholder: "Enter style" },
  { name: "color", label: "Color", placeholder: "Enter color" },
  {
    name: "inspect",
    label: "Inspect",
    placeholder: "Quantity to inspect",
    numeric: true,
  },
];

function allowedHours() {
  const slots = hourSlots();
  const now = new Date().getHours();
  const max = Math.max(slots[0], Math.min(now, slots[slots.length - 1]));
  return slots.filter((h) => h <= max).reverse();
}

export default function NewQcCheck({
  hourly = false,
  withTransfer = false, // true untuk sewing
  withWashing = false, // true untuk washing
  lineIds = [], // dari session.user.lineIds
  onBack,
  onStart,
}) {
  const [wash, setWash] = useState({ handfeel: "", grade: "" });
  const [hours] = useState(allowedHours);
  const [hour, setHour] = useState(String(hours[0]));
  const [lineId, setLineId] = useState(lineIds[0] ?? "");
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    buyer: "",
    style: "",
    color: "",
    inspect: "",
    transfer: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numeric = name === "inspect" || name === "transfer";
    setValues((v) => ({
      ...v,
      [name]: numeric ? value.replace(/\D/g, "") : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!lineId)
      return setError(
        "This account has no line assigned. Please contact your admin.",
      );
    const inspect = Number(values.inspect);
    const transfer = Number(values.transfer);
    if (inspect < 1) return setError("Inspect must be at least 1.");
    if (withTransfer && transfer > inspect)
      return setError("Transfer cannot be more than Inspect.");
    if (withWashing && (!wash.handfeel.trim() || !wash.grade.trim()))
      return setError("Please fill in handfeel and grade.");

    const idx = lineIds.indexOf(lineId);
    onStart?.({
      buyer: values.buyer.trim(),
      style: values.style.trim(),
      color: values.color.trim(),
      inspect,
      transfer: withTransfer ? transfer : 0,
      lineId,
      line: lineIds.length > 1 ? String(idx + 1) : "", // kosong = tidak ditampilkan
      hour: hourly ? Number(hour) : null,
      handfeel: withWashing ? wash.handfeel.trim() : undefined,
      grade: withWashing ? wash.grade.trim() : undefined,
    });
  };

  return (
    <main className="newqc">
      <StatusBar />

      <header className="newqc-head">
        <button
          type="button"
          className="newqc-back"
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
        <h1 className="newqc-title">New QC Check</h1>
      </header>

      <form className="newqc-form" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            style={{ color: "#c62828", fontSize: 16, fontWeight: 600 }}
          >
            {error}
          </p>
        )}

        {hourly && (
          <label className="nq-field">
            <span className="nq-label">Hours</span>
            <select
              name="hour"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <span className="nq-hint">
              You can select previous hours for follow-up entries.
            </span>
          </label>
        )}

        {withWashing && (
          <>
            <label className="nq-field">
              <span className="nq-label">Handfeel</span>
              <input
                type="text"
                placeholder="e.g. Soft"
                maxLength={50}
                value={wash.handfeel}
                onChange={(e) =>
                  setWash((w) => ({ ...w, handfeel: e.target.value }))
                }
                autoComplete="off"
                required
              />
            </label>
            <label className="nq-field">
              <span className="nq-label">Grade</span>
              <input
                type="text"
                placeholder="e.g. 3-4 Darker"
                maxLength={50}
                value={wash.grade}
                onChange={(e) =>
                  setWash((w) => ({ ...w, grade: e.target.value }))
                }
                autoComplete="off"
                required
              />
            </label>
          </>
        )}

        {lineIds.length > 1 && (
          <label className="nq-field">
            <span className="nq-label">Line</span>
            <select value={lineId} onChange={(e) => setLineId(e.target.value)}>
              {lineIds.map((id, i) => (
                <option key={id} value={id}>
                  Line {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}

        {FIELDS.map((f) => (
          <label key={f.name} className="nq-field">
            <span className="nq-label">{f.label}</span>
            <input
              name={f.name}
              type="text"
              inputMode={f.numeric ? "numeric" : "text"}
              placeholder={f.placeholder}
              value={values[f.name]}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </label>
        ))}

        {withTransfer && (
          <label className="nq-field">
            <span className="nq-label">Transfer</span>
            <input
              name="transfer"
              type="text"
              inputMode="numeric"
              placeholder="Quantity to transfer"
              value={values.transfer}
              onChange={handleChange}
              autoComplete="off"
              required
            />
          </label>
        )}

        <button type="submit" className="nq-submit">
          Start QC Check
        </button>
      </form>
    </main>
  );
}
