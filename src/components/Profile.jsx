import { useEffect, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { fetchMe } from "../api/users.js";
import "./Profile.css";

const DETAILS = [
  { key: "nik",     label: "NIK" },
  { key: "name",    label: "Nama" },
  { key: "process", label: "Process" },
  { key: "line",    label: "Line" },
];

export default function Profile({ user, onBack }) {
  const active = user.status?.toLowerCase() === "active";

  // undefined = memuat, string = hasil dari /auth/me
  const [nik, setNik] = useState(undefined);

  useEffect(() => {
    const ac = new AbortController();
    fetchMe(ac.signal)
      .then((me) => setNik(me?.nik || ""))
      .catch((e) => {
        if (e.name !== "AbortError") setNik("");
      });
    return () => ac.abort();
  }, []);

  const data = {
    ...user,
    nik: nik === undefined ? "Memuat…" : nik || user.nik || "-",
  };

  return (
    <main className="profile">
      <StatusBar />

      <header className="pf-head">
        <button type="button" className="pf-back" aria-label="Back" onClick={onBack}>
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path
              d="M10 2 2 10l8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="pf-title">Profile</h1>
      </header>

      <div className="pf-body">
        <section className="pf-hero">
          <div className="pf-avatar" aria-hidden="true">
            <svg width="88" height="88" viewBox="0 0 96 96" fill="none"
                 stroke="currentColor" strokeWidth="7" strokeLinecap="round">
              <circle cx="48" cy="48" r="44" />
              <circle cx="48" cy="38" r="13" />
              <path d="M22 76c4-12 14-18 26-18s22 6 26 18" />
            </svg>
          </div>

          <div className="pf-id">
            <p className="pf-code">{data.code}</p>
            <p className="pf-role">{data.role}</p>
            <span className={`pf-status ${active ? "on" : "off"}`}>
              <i aria-hidden="true" />
              {data.status}
            </span>
          </div>
        </section>

        <dl className="pf-card">
          {DETAILS.map((d) => (
            <div key={d.key} className="pf-row">
              <dt>{d.label}</dt>
              <dd>{data[d.key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}