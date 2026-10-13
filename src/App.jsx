import { useCallback, useEffect, useState } from "react";
import SplashScreen from "./components/SplashScreen.jsx";
import Login from "./components/Login.jsx";
import DashboardUser from "./components/DashboardUser.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import SuperAdminDashboard from "./components/SuperAdminDashboard.jsx";
import NewQcCheck from "./components/NewQcCheck.jsx";
import QcStandard from "./components/QcStandard.jsx";
import CuttingCheck from "./components/CuttingCheck.jsx";
import Success from "./components/Success.jsx";
import Profile from "./components/Profile.jsx";
import Report from "./components/Report.jsx";
import ComingSoon from "./components/ComingSoon.jsx";
import DevSectionSwitcher from "./dev/DevSectionSwitcher.jsx"; // hapus saat tidak dipakai lagi
import { SECTIONS, hourLabel } from "./config/sections.js";
import { PAGE_TITLE } from "./config/menus.js";
import { clearSession, loadSession } from "./auth/session.js";
import { setUnauthorizedHandler } from "./api/client.js";

const PROTECTED = [
  "dashboard", "profile", "newcheck", "qcsewing", "cutting", "success", "soon", "reports",
];
const ROLE_LABEL = { user: "QC Line", admin: "Admin", super_admin: "Super Admin" };

// Nomor inspeksi sementara (TODO: seharusnya dibuat oleh server)
const PREFIX = {
  cutting: "CUT", sewing: "SEW", washing: "WSH", finishing: "FIN", packing: "PCK",
};

// Hanya mode dev: role/section bisa diganti lewat kotak DEV atau URL,
// mis. /?section=cutting&role=admin. Di build produksi selalu null,
// sehingga role dan section murni dari akun yang login.
function fromQuery(key, allowed) {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search).get(key);
  return q && allowed.includes(q) ? q : null;
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
  const [session, setSession] = useState(loadSession); // dari sessionStorage (jika masih berlaku)
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState(null); // data dari form New QC Check
  const [result, setResult] = useState(null); // hasil submit untuk halaman sukses
  const [devSection, setDevSection] = useState(() => fromQuery("section", Object.keys(SECTIONS)));
  const [devRole, setDevRole] = useState(() => fromQuery("role", ["user", "admin", "super_admin"]));
  const [viewSection, setViewSection] = useState(null); // section yang sedang dibuka super admin
  const [soonPage, setSoonPage] = useState(null); // menu yang halamannya belum dibuat

  // Role dan section dari akun yang login (kecuali di-override kotak DEV)
  const su = session?.user;
  const roleKey = devRole ?? su?.role ?? "user";
  const isSuper = roleKey === "super_admin";
  const role = roleKey === "user" ? "user" : "admin"; // super_admin memakai tampilan admin saat membuka satu section
  const isAdmin = role === "admin";
  const section = viewSection ?? devSection ?? (su && SECTIONS[su.section] ? su.section : "sewing");
  const cfg = SECTIONS[section];
  const onSuperOverview = isSuper && !viewSection;

  const user = {
    id: su?.id,
    code: su?.username ?? "-",
    name: su?.nama ?? "-",
    nik: "-", // belum ada di respons login (tersedia lewat GET /auth/me)
    status: su && su.active === false ? "Inactive" : "Active",
    role: ROLE_LABEL[roleKey] ?? "QC Line",
    section,
    process: cfg.label,
    area: onSuperOverview
      ? "ALL SECTIONS"
      : isAdmin
      ? `${cfg.label.toUpperCase()} QC`
      : cfg.label.toUpperCase(),
    line: su?.lineIds?.length ? `${su.lineIds.length} line` : "-",
  };

  const handleLogout = useCallback((message = "") => {
    clearSession();
    setSession(null);
    setJob(null);
    setResult(null);
    setViewSection(null);
    setSoonPage(null);
    setNotice(message);
    setScreen("login");
  }, []);

  // keluar otomatis saat token kedaluwarsa (backend: 1 jam)
  useEffect(() => {
    if (!session) return;
    const ms = Math.max(session.expiresAt - Date.now(), 0);
    const t = setTimeout(
      () => handleLogout("Sesi login sudah berakhir. Silakan login lagi."),
      ms
    );
    return () => clearTimeout(t);
  }, [session, handleLogout]);

  // keluar bila server menolak token (401)
  useEffect(() => {
    setUnauthorizedHandler(() =>
      handleLogout("Sesi login sudah berakhir. Silakan login lagi.")
    );
    return () => setUnauthorizedHandler(null);
  }, [handleLogout]);

  // keluar dari layar pemeriksaan yang sedang terbuka saat role/section DEV diganti
  const leaveCheckScreens = () => {
    if (["cutting", "newcheck", "qcsewing", "success"].includes(screen)) {
      setJob(null);
      setResult(null);
      setScreen("dashboard");
    }
  };
  const changeSection = (next) => {
    if (next === "") {
      // pilihan "semua" (hanya super admin): kembali ke ringkasan
      setViewSection(null);
      leaveCheckScreens();
      return;
    }
    setDevSection(next);
    syncUrl("section", next);
    if (isSuper) setViewSection(next);
    leaveCheckScreens();
  };
  const changeRole = (next) => {
    setDevRole(next);
    syncUrl("role", next);
    setViewSection(null);
    leaveCheckScreens();
  };

  // menu hamburger untuk admin dan super admin
  const goAdminMenu = (key) => {
    if (key === "profile") return setScreen("profile");
    if (key === "reports") return setScreen("reports");
    if (key === "home") {
      if (isSuper) setViewSection(null);
      return setScreen("dashboard");
    }
    setSoonPage(key); // records, users (halamannya belum dibuat)
    setScreen("soon");
  };

  const renderScreen = () => {
    // halaman yang butuh login: tanpa sesi, kembali ke login
    const current = !session && PROTECTED.includes(screen) ? "login" : screen;

    if (current === "success" && result) {
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

    if (current === "reports") {
      return (
        <Report user={user} isSuper={isSuper} onBack={() => setScreen("dashboard")} />
      );
    }

    if (current === "soon") {
      return (
        <ComingSoon
          title={PAGE_TITLE[soonPage] ?? "Segera hadir"}
          onBack={() => setScreen("dashboard")}
        />
      );
    }

    if (current === "profile") {
      return <Profile user={user} onBack={() => setScreen("dashboard")} />;
    }

    if (current === "cutting") {
      return (
        <CuttingCheck
          onBack={() => setScreen("dashboard")}
          onFinish={(data) => {
            // TODO: kirim ke POST /cutting-inspections (waktu submit dicatat server)
            console.log("cutting QC:", data);
            setResult(buildCuttingResult(data));
            setScreen("success");
          }}
        />
      );
    }

    if (current === "qcsewing" && job) {
      return (
        <QcStandard
          job={job}
          section={section}
          sectionLabel={cfg.label}
          onBack={() => setScreen("newcheck")}
          onSubmit={(data) => {
            // TODO: kirim ke POST /inspections (waktu submit dicatat server)
            console.log("submit QC:", { section, date: todayISO(), ...data });
            setResult(buildStandardResult(section, cfg.label, data));
            setJob(null);
            setScreen("success");
          }}
        />
      );
    }

    if (current === "newcheck") {
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

    if (current === "dashboard") {
      const goProfile = (key) => key === "profile" && setScreen("profile");

      // super admin: ringkasan semua section
      if (onSuperOverview) {
        return (
          <SuperAdminDashboard
            user={user}
            onNavigate={goAdminMenu}
            onOpenSection={(key) => setViewSection(key)}
            onLogout={() => handleLogout()}
          />
        );
      }

      return isAdmin ? (
        <AdminDashboard
          user={user}
          onNavigate={goAdminMenu}
          onBack={isSuper ? () => setViewSection(null) : undefined}
          onLogout={() => handleLogout()}
        />
      ) : (
        <DashboardUser
          user={user}
          onNewCheck={() => setScreen(cfg.flow === "cutting" ? "cutting" : "newcheck")}
          onNavigate={goProfile}
          onLogout={() => handleLogout()}
        />
      );
    }

    if (current === "login") {
      return (
        <Login
          notice={notice}
          onLogin={(s) => {
            setSession(s);
            setNotice("");
            setScreen("dashboard");
          }}
        />
      );
    }

    return (
      <SplashScreen onContinue={() => setScreen(session ? "dashboard" : "login")} />
    );
  };

  return (
    <>
      {renderScreen()}
      {import.meta.env.DEV && (
        <DevSectionSwitcher
          role={roleKey}
          section={onSuperOverview ? "" : section}
          allowAll={isSuper}
          onRole={changeRole}
          onSection={changeSection}
        />
      )}
    </>
  );
}