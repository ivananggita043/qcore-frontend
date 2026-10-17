import { useCallback, useEffect, useMemo, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import UserForm from "./UserForm.jsx";
import { fetchUsers, fetchLines } from "../api/users.js";
import { SECTIONS } from "../config/sections.js";
import "./DashboardUser.css";
import "./Users.css";

const sectionLabel = (s) => SECTIONS[s]?.label ?? s ?? "";

function subtitle(u, lineName) {
  if (u.role === "super_admin") return "Super Admin";
  if (u.role === "admin") return `Admin · ${sectionLabel(u.section)}`;
  const names = u.lineIds.map((id) => lineName[id]).filter(Boolean);
  return `QC · ${sectionLabel(u.section)}${names.length ? ` · ${names.join(", ")}` : ""}`;
}

function Avatar() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="29" />
      <circle cx="32" cy="25" r="8" />
      <path d="M14 50c3-9 10-13 18-13s15 4 18 13" />
    </svg>
  );
}

export default function Users({ isSuper, mySection, meId, onBack }) {
  const [users, setUsers] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | admin | qc | inactive
  const [form, setForm] = useState(null); // { mode: "create" | "edit", target }
  const [toast, setToast] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [u, l] = await Promise.all([
        fetchUsers(signal),
        fetchLines(signal).catch(() => []),
      ]);
      setUsers(u);
      setLines(l);
    } catch (e) {
      if (e?.name !== "AbortError")
        setError(e?.message || "Cannot load user data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const lineName = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.id, l.name])),
    [lines],
  );

  const counts = useMemo(() => {
    const all = users ?? [];
    return {
      all: all.length,
      admin: all.filter((u) => u.role !== "user").length,
      qc: all.filter((u) => u.role === "user").length,
      inactive: all.filter((u) => !u.active).length,
    };
  }, [users]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => {
        if (filter === "admin" && u.role === "user") return false;
        if (filter === "qc" && u.role !== "user") return false;
        if (filter === "inactive" && u.active) return false;
        return (
          !q ||
          [u.nama, u.username, u.nik].some((v) => v.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [users, query, filter]);

  // siapa boleh mengubah siapa
  const canManage = (u) =>
    u.id !== meId &&
    (isSuper
      ? u.role !== "super_admin"
      : u.role === "user" && u.section === mySection);

  if (form) {
    return (
      <UserForm
        mode={form.mode}
        target={form.target}
        isSuper={isSuper}
        mySection={mySection}
        lines={lines}
        onBack={() => setForm(null)}
        onDone={(msg) => {
          setForm(null);
          setToast(msg);
          load();
        }}
      />
    );
  }

  const CHIPS = [
    { key: "all", label: "ALL" },
    { key: "admin", label: "ADMIN" },
    { key: "qc", label: "QC" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <main className="dash">
      <StatusBar />

      <div className="dash-inner us">
        <header className="us-head">
          <button
            type="button"
            className="us-back"
            aria-label="Back"
            onClick={onBack}
          >
            ‹
          </button>
          <h1 className="us-title">Users</h1>
          <button
            type="button"
            className="us-refresh"
            onClick={() => load()}
            disabled={loading}
            aria-label="reload user data"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            <span>{loading ? "Loading…" : "Reload"}</span>
          </button>
        </header>

        {toast && (
          <p className="us-toast" role="status">
            {toast}
          </p>
        )}

        <label className="us-search">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            placeholder="Search name, username, or NIK"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </label>

        <div className="us-chips" role="tablist" aria-label="Filter users">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              className={filter === c.key ? "on" : ""}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
              <span className="n">{counts[c.key]}</span>
            </button>
          ))}
        </div>

        <p className="us-note">
          {isSuper
            ? "You can manage admins and QC users."
            : "You can manage QC users in your section."}
        </p>

        {loading && !users && (
          <ul className="us-list" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="us-skel">
                <span />
                <div>
                  <i />
                  <i />
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="us-banner" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => load()}>
              Try Again
            </button>
          </div>
        )}

        {users && (
          <ul className="us-list">
            {shown.length === 0 && (
              <li className="us-empty">No matching users found.</li>
            )}
            {shown.map((u) => {
              const manage = canManage(u);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    className="us-row"
                    disabled={!manage}
                    onClick={() => setForm({ mode: "edit", target: u })}
                  >
                    <span className="us-av">
                      <Avatar />
                    </span>
                    <span className="us-info">
                      <strong>
                        {u.nama || u.username}
                        {u.id === meId && <em> (You)</em>}
                      </strong>
                      <span className="us-sub">{subtitle(u, lineName)}</span>
                      <span className="us-meta">
                        <span className={`us-badge ${u.active ? "on" : "off"}`}>
                          {u.active ? "Active" : "Inactive"}
                        </span>
                        <span className="us-uname">@{u.username}</span>
                      </span>
                    </span>
                    {manage && (
                      <span className="us-chev" aria-hidden="true">
                        ›
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="us-fab-dock">
          <button
            type="button"
            className="us-fab"
            aria-label="Add user"
            onClick={() => setForm({ mode: "create", target: null })}
          >
            +
          </button>
        </div>
      </div>
    </main>
  );
}
