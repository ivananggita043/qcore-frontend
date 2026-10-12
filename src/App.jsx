import { useState } from "react";
import SplashScreen from "./components/SplashScreen.jsx";
import Login from "./components/Login.jsx";
import DashboardUser from "./components/DashboardUser.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import NewQcCheck from "./components/NewQcCheck.jsx";
import QcStandard from "./components/QcStandard.jsx";
import CuttingCheck from "./components/CuttingCheck.jsx";
import Success from "./components/Success.jsx";
import Profile from "./components/Profile.jsx";
import DevSectionSwitcher from "./dev/DevSectionSwitcher.jsx"; // hapus saat tidak dipakai lagi
import { SECTIONS, hourLabel } from "./config/sections.js";

// Data contoh pengguna (nanti dari API setelah login)
const BASE_USER = {
  code: "QCSWGLN03",
  status: "Active",
  nik: "33563829274736",
  name: "Jane Doe",
  line: "3",
};

// Nomor inspeksi sementara (TODO: seharusnya dibuat oleh server)
const PREFIX = { cutting: "CUT", sewing: "SEW", washing: "WSH", finishing: "FIN" };

// Mode dev: section dan role bisa dipilih lewat kotak DEV atau URL,
// mis. /?section=cutting&role=admin. Di build produksi nilainya tetap
// (TODO: ambil dari API login, jangan pernah dari URL).
function fromQuery(key, allowed, fallback) {
  if (!import.meta.env.DEV) return fallback;
  const q = new URLSearchParams(window.location.search).get(key);
  return q && allowed.includes(q) ? q : fallback;
}

function syncUrl(key, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const makeInspectionId = (section) =>
  `#${PREFIX[section]}${Math.random().toString(16).slice(2, 7).toUpperCase()}`;

function buildStandardResult(section, label, data) {
  const total = data.defects.reduce((s, d) => s + d.count, 0);
  return {
    id: makeInspectionId(section),
    section,
    submittedAt: new Date().toISOString(),
    rows: [
      ["Section", label],
      ["Buyer / Style", `${data.buyer} / ${data.style}`],
      ["Color", data.color],
      ["Line", data.line],
      ...(data.hour != null ? [["Jam", hourLabel(data.hour)]] : []),
      ["QTY INSP", String(data.inspect)],
      ["Total defect", String(total)],
    ],
    lines: data.defects.map(
      (d) => `${d.category}${d.area ? ` · ${d.area}` : ""} · ${d.type} ×${d.count}`
    ),
  };
}

function buildCuttingResult(data) {
  const totalDef = data.processes.reduce((s, p) => s + (Number(p.defect) || 0), 0);
  return {
    id: makeInspectionId("cutting"),
    section: "cutting",
    submittedAt: new Date().toISOString(),
    rows: [
      ["Section", "Cutting"],
      ["Buyer / Style", `${data.session.buyer || "-"} / ${data.session.style || "-"}`],
      ["LOT", data.session.lot || "-"],
      ["Proses terisi", String(data.processes.length)],
      ["Total QTY DEFF", String(totalDef)],
    ],
    lines: data.processes.map(
      (p) =>
        `${p.process}: ${p.status === "ok" ? "OK" : "Defect"} · INSP ${p.inspect || 0} · DEFF ${p.defect || 0}` +
        (p.defectTypes.length ? ` · ${p.defectTypes.join(", ")}` : "")
    ),
  };
}

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [job, setJob] = useState(null); // data dari form New QC Check
  const [result, setResult] = useState(null); // hasil submit untuk halaman sukses
  const [section, setSection] = useState(() =>
    fromQuery("section", Object.keys(SECTIONS), "sewing")
  );
  const [role, setRole] = useState(() => fromQuery("role", ["user", "admin"], "user"));

  const cfg = SECTIONS[section];
  const isAdmin = role === "admin";
  const user = {
    ...BASE_USER,
    section,
    role: isAdmin ? "Admin" : "QC Line",
    code: isAdmin ? `ADM${PREFIX[section]}01` : BASE_USER.code,
    process: cfg.label,
    area: isAdmin
      ? `${cfg.label.toUpperCase()} QC`
      : `${cfg.label.toUpperCase()} . LINE ${BASE_USER.line}`,
  };

  // keluar dari layar pemeriksaan yang sedang terbuka saat role/section diganti
  const leaveCheckScreens = () => {
    if (["cutting", "newcheck", "qcsewing", "success"].includes(screen)) {
      setJob(null);
      setResult(null);
      setScreen("dashboard");
    }
  };

  // hanya dipanggil dari kotak DEV
  const changeSection = (next) => {
    setSection(next);
    syncUrl("section", next);
    leaveCheckScreens();
  };
  const changeRole = (next) => {
    setRole(next);
    syncUrl("role", next);
    leaveCheckScreens();
  };

  const renderScreen = () => {
    if (screen === "success" && result) {
      return (
        <Success
          result={result}
          onDashboard={() => {
            setResult(null);
            setScreen("dashboard");
          }}
        />
      );
    }

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
            setResult(buildCuttingResult(data));
            setScreen("success");
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
            setResult(buildStandardResult(section, cfg.label, data));
            setJob(null);
            setScreen("success");
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
      const goProfile = (key) => key === "profile" && setScreen("profile");
      return isAdmin ? (
        <AdminDashboard
          user={user}
          onNavigate={goProfile}
          onLogout={() => setScreen("login")}
        />
      ) : (
        <DashboardUser
          user={user}
          onNewCheck={() => setScreen(cfg.flow === "cutting" ? "cutting" : "newcheck")}
          onNavigate={goProfile}
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
        <DevSectionSwitcher
          section={section}
          role={role}
          onSection={changeSection}
          onRole={changeRole}
        />
      )}
    </>
  );
}