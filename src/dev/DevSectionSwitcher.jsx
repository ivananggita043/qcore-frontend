const SECTIONS = ["cutting", "sewing", "washing", "finishing"];

// Alat bantu pengembangan: pilih section tanpa mengubah kode.
// Hanya dirender saat `npm run dev` (lihat App.jsx).
export default function DevSectionSwitcher({ section, onChange }) {
  return (
    <label
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(0, 0, 0, 0.75)",
        color: "#fff",
        font: "11px/1 system-ui, sans-serif",
      }}
    >
      DEV · section
      <select
        value={section}
        onChange={(e) => onChange(e.target.value)}
        style={{ font: "inherit", padding: "2px 4px", borderRadius: 4 }}
      >
        {SECTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </label>
  );
}