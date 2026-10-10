import { useState } from "react";
import SplashScreen from "./components/SplashScreen.jsx";
import Login from "./components/Login.jsx";
import DashboardUser from "./components/DashboardUser.jsx";
import NewQcCheck from "./components/NewQcCheck.jsx";
import Profile from "./components/Profile.jsx";

// Data contoh pengguna (nanti dari API setelah login)
const USER = {
  code: "QCSWGLN03",
  area: "SEWING . LINE 3",
  role: "QC Line",
  status: "Active",
  nik: "33563829274736",
  name: "Jane Doe",
  process: "Sewing",
  line: "3",
};

export default function App() {
  const [screen, setScreen] = useState("splash");

  if (screen === "profile") {
    return <Profile user={USER} onBack={() => setScreen("dashboard")} />;
  }

  if (screen === "newcheck") {
    return (
      <NewQcCheck
        onBack={() => setScreen("dashboard")}
        onStart={(data) => {
          // TODO: kirim data ke API, lalu buka halaman pemeriksaan
          console.log("start QC:", data);
          setScreen("dashboard");
        }}
      />
    );
  }

  if (screen === "dashboard") {
    return (
      <DashboardUser
        user={USER}
        onNewCheck={() => setScreen("newcheck")}
        onNavigate={(key) => key === "profile" && setScreen("profile")}
        onLogout={() => setScreen("login")}
      />
    );
  }

  if (screen === "login") {
    return (
      <Login
        onLogin={({ username, password }) => {
          // TODO: panggil API login, lalu pilih dashboard sesuai role
          setScreen("dashboard");
        }}
      />
    );
  }

  return <SplashScreen onContinue={() => setScreen("login")} />;
}