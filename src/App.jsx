import { useState } from "react";
import SplashScreen from "./components/SplashScreen.jsx";
import Login from "./components/Login.jsx";
import DashboardUser from "./components/DashboardUser.jsx";
import NewQcCheck from "./components/NewQcCheck.jsx";
import QcSewing from "./components/QcSewing.jsx";
import CuttingCheck from "./components/CuttingCheck.jsx";
import Profile from "./components/Profile.jsx";
import DevSectionSwitcher from "./dev/DevSectionSwitcher.jsx"; // hapus saat tidak dipakai lagi

const SECTION_LABEL = {
  cutting: "Cutting",
  sewing: "Sewing",
  washing: "Washing",
  finishing: "Finishing",
};

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
  return q && q in SECTION_LABEL ? q : "sewing";
}

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [job, setJob] = useState(null); // data dari form New QC Check
  const [section, setSection] = useState(initialSection);

  const user = {
    ...BASE_USER,
    section,
    process: SECTION_LABEL[section],
    area: `${SECTION_LABEL[section].toUpperCase()} . LINE ${BASE_USER.line}`,
  };

  // hanya dipanggil dari kotak DEV
  const changeSection = (next) => {
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState(null, "", url); // tetap saat halaman di-refresh
    // keluar dari layar pemeriksaan yang sedang terbuka
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
        <QcSewing
          job={job}
          onBack={() => setScreen("newcheck")}
          onSubmit={(data) => {
            console.log("submit QC:", data);
            setJob(null);
            setScreen("dashboard");
          }}
        />
      );
    }

    if (screen === "newcheck") {
      return (
        <NewQcCheck
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
          onNewCheck={() =>
            setScreen(user.section === "cutting" ? "cutting" : "newcheck")
          }
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