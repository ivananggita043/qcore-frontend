import { useState } from "react";
import SplashScreen from "./components/SplashScreen.jsx";
import Login from "./components/Login.jsx";
import DashboardUser from "./components/DashboardUser.jsx";
import NewQcCheck from "./components/NewQcCheck.jsx";

export default function App() {
  const [screen, setScreen] = useState("splash");

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
        onNewCheck={() => setScreen("newcheck")}
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