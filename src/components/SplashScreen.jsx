import StatusBar from "./StatusBar.jsx";
import "./SplashScreen.css";

export default function SplashScreen({ onContinue }) {
  return (
    <button
      type="button"
      className="screen"
      onClick={onContinue}
      aria-label="DRESS 2 – Quality Control Management System"
    >
      <StatusBar />

      <div className="logo-block">
        <div className="logo-pill" role="img" aria-label="Logo placeholder" />
        <h1 className="title">
          <span className="dress">Dress</span> <span className="num">2</span>
        </h1>
        <p className="tagline">
          Quality Control
          <br />
          Management System
        </p>
      </div>
    </button>
  );
}
