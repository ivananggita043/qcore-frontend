import { useState } from "react";
import SplashScreen from "./components/SplashScreen.jsx";
import Login from "./components/Login.jsx";
import DashboardUser from "./components/DashboardUser.jsx";
import NewQcCheck from "./components/NewQcCheck.jsx";
import QcStandard from "./components/QcStandard.jsx";
import CuttingCheck from "./components/CuttingCheck.jsx";
import Profile from "./components/Profile.jsx";
import DevSectionSwitcher from "./dev/DevSectionSwitcher.jsx"; // hapus saat tidak dipakai lagi
import { SECTIONS } from "./config/sections.js";

// Data contoh pengguna (nanti dari API setelah login)
const BASE_USER = {
  code: "QCSWGLN03",
  role: "QC Line",
  status: "Active",
  nik: "33563829274736",
  name: "Jane Doe",
  line: "3",
};

// Mode dev: section bisa dipilih lewat kotak DEV atau URL, mis. /?section=cutting
// Di build produksi selalu "sewing" (TODO: ambil dari API login).
function initialSection() {
  if (!import.meta.env.DEV) return "sewing";
  const q = new URLSearchParams(window.location.search).get("section");
  return q && q in SECTIONS ? q : "sewing";
}

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [job, setJob] = useState(null); // data dari form New QC Check
  const [section, setSection] = useState(initialSection);

  const cfg = SECTIONS[section];
  const user = {
    ...BASE_USER,
    section,
    process: cfg.label,
    area: `${cfg.label.toUpperCase()} . LINE ${BASE_USER.line}`,
  };

  // hanya dipanggil dari kotak DEV
  const changeSection = (next) => {
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState(null, "", url);
    if (["cutting", "newcheck", "qcsewing"].includes(screen)) {
      setJob(null);
      setScreen("dashboard");
    }
  };

  const renderScreen = () => {
    if (screen === "profile") {
      return <Profile user={user} onBack={() => setScreen("dashboard")} />;
    }

    if (screen === "cutting") {
      return (
        <CuttingCheck
          onBack={() => setScreen("dashboard")}
          onFinish={(data) => {
            // TODO: kirim ke API (waktu submit sebaiknya dicatat server)
            console.log("cutting QC:", data);
            setScreen("dashboard");
          }}
        />
      );
    }

    if (screen === "qcsewing" && job) {
      return (
        <QcStandard
          job={job}
          section={section}
          sectionLabel={cfg.label}
          onBack={() => setScreen("newcheck")}
          onSubmit={(data) => {
            // TODO: kirim ke API. Waktu submit sebaiknya dicatat server.
            console.log("submit QC:", { section, date: todayISO(), ...data });
            setJob(null);
            setScreen("dashboard");
          }}
        />
      );
    }

    if (screen === "newcheck") {
      return (
        <NewQcCheck
          hourly={cfg.frequency === "hourly"}
          onBack={() => setScreen("dashboard")}
          onStart={(data) => {
            setJob(data);
            setScreen("qcsewing");
          }}
        />
      );
    }

    if (screen === "dashboard") {
      return (
        <DashboardUser
          user={user}
          onNewCheck={() => setScreen(cfg.flow === "cutting" ? "cutting" : "newcheck")}
          onNavigate={(key) => key === "profile" && setScreen("profile")}
          onLogout={() => setScreen("login")}
        />
      );
    }

    if (screen === "login") {
      return (
        <Login
          onLogin={() => {
            // TODO: panggil API login, lalu pilih dashboard sesuai role/section
            setScreen("dashboard");
          }}
        />
      );
    }

    return <SplashScreen onContinue={() => setScreen("login")} />;
  };

  return (
    <>
      {renderScreen()}
      {import.meta.env.DEV && (
        <DevSectionSwitcher section={section} onChange={changeSection} />
      )}
    </>
  );
}