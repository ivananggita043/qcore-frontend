import { useEffect } from "react";
import "./DashboardUser.css";

export default function MenuDrawer({
  open,
  onClose,
  user,
  items,
  active,
  onSelect,
  onLogout,
}) {
  // tutup dengan tombol Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      <nav
        className={`drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
        aria-label="Main menu"
      >
        <div className="drawer-head">
          <div className="avatar">
            <MenuIcon name="profile" size={32} />
          </div>
          <div className="drawer-who">
            <p className="drawer-name">{user.code}</p>
            <p className="drawer-area">{user.area}</p>
          </div>
          <button
            type="button"
            className="drawer-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M3 3l12 12M15 3L3 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <ul className="drawer-list">
          {items.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                className={`drawer-item ${active === m.key ? "active" : ""}`}
                aria-current={active === m.key ? "page" : undefined}
                onClick={() => {
                  onSelect(m.key);
                  onClose();
                }}
              >
                <MenuIcon name={m.icon} />
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="logout" onClick={onLogout}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4H5v16h4" />
            <path d="M16 8l4 4-4 4" />
            <path d="M20 12H9" />
          </svg>
          <span>LOG OUT</span>
        </button>
      </nav>
    </>
  );
}

function MenuIcon({ name, size = 24 }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "home")
    return (
      <svg {...p}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
        <path d="M10 19.5v-5h4v5" />
      </svg>
    );
  if (name === "records")
    return (
      <svg {...p}>
        <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" />
        <path d="M9 9.5h.01M15 14.5h.01M15 9.5l-6 5" />
      </svg>
    );
  if (name === "users")
    return (
      <svg {...p}>
        <circle cx="9" cy="9" r="3.2" />
        <path d="M3 19c.8-3 3-4.5 6-4.5s5.2 1.5 6 4.5" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M16 14c2.6.1 4.3 1.4 5 4" />
      </svg>
    );
  if (name === "report")
    return (
      <svg {...p}>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 17v-3M12 17v-5M15 17v-2" />
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18c1.2-2 3.2-3 5.5-3s4.3 1 5.5 3" />
    </svg>
  );
}
