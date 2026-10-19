import { SECTIONS } from "../config/sections.js";

const SECTION_KEYS = Object.keys(SECTIONS);
const ROLES = ["user", "admin", "super_admin"];

// Alat bantu pengembangan: pilih role dan section tanpa mengubah kode.
// Hanya dirender saat `npm run dev` (lihat App.jsx).
// allowAll: untuk super_admin, tambah pilihan "semua" (= ringkasan semua section).
export default function DevSectionSwitcher({ section, role, onSection, onRole, allowAll = false }) {
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
  const sel = { font: "inherit", padding: "2px 4px", borderRadius: 4 };

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 9999,
        display: "grid",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(0, 0, 0, 0.75)",
        color: "#fff",
        font: "11px/1 system-ui, sans-serif",
      }}
    >
      <label style={row}>
        DEV · role
        <select value={role} onChange={(e) => onRole(e.target.value)} style={sel}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label style={row}>
        DEV · section
        <select value={section} onChange={(e) => onSection(e.target.value)} style={sel}>
          {allowAll && <option value="">semua</option>}
          {SECTION_KEYS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}