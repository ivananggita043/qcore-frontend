// Decorative phone status bar from the Figma frame ("Atas").
// The icon is an approximation – swap in the exported SVG from Figma for an exact match.
export default function StatusBar({ time = "10.06" }) {
  return (
    <div className="status" aria-hidden="true">
      <span>{time}</span>
      <svg
        viewBox="0 0 68.66 11.33"
        fill="#262323"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="7.5" width="3" height="3.8" rx="0.8" />
        <rect x="4.6" y="5.5" width="3" height="5.8" rx="0.8" />
        <rect x="9.2" y="3.2" width="3" height="8.1" rx="0.8" />
        <rect x="13.8" y="0.5" width="3" height="10.8" rx="0.8" />
        <path d="M30.5 2.2c2.6 0 5 1 6.8 2.7l-1.2 1.3a7.5 7.5 0 0 0-11.2 0l-1.2-1.3a9.8 9.8 0 0 1 6.8-2.7zm0 3.6c1.6 0 3 .6 4.1 1.6l-1.3 1.4a3.9 3.9 0 0 0-5.6 0l-1.3-1.4a5.9 5.9 0 0 1 4.1-1.6zm0 3.5 1.7 1.8h-3.4z" />
        <rect x="43.2" y="0.8" width="21.5" height="10" rx="3" fill="none" stroke="#262323" strokeOpacity=".4" />
        <rect x="44.7" y="2.3" width="18.5" height="7" rx="1.8" />
        <path d="M66 4.2v3a1.7 1.7 0 0 0 0-3z" fillOpacity=".5" />
      </svg>
    </div>
  );
}
