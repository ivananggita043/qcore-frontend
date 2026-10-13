import StatusBar from "./StatusBar.jsx";
import "./DashboardUser.css";
import "./ComingSoon.css";

export default function ComingSoon({ title, onBack }) {
  return (
    <main className="dash">
      <StatusBar />
      <div className="dash-inner soon">
        <button type="button" className="soon-back" onClick={onBack}>
          ‹ Kembali
        </button>
        <h1 className="soon-title">{title}</h1>
        <div className="soon-card">
          <p className="soon-big">Segera hadir</p>
          <p className="soon-text">
            Halaman ini sedang disiapkan dan akan tersedia setelah desain dan
            endpoint backend-nya siap.
          </p>
        </div>
      </div>
    </main>
  );
}