import { useEffect, useState } from "react";
import { useAttendance } from "../api/attendance.js";
import "./AttendanceCard.css";

const pad = (n) => String(n).padStart(2, "0");
const clock = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
};
const duration = (min) => {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}min` : `${m}min`;
};

/* Tiga kondisi: none = belum check in, in = sedang bekerja, out = sudah check out.
   Kartu memakai gaya yang sama dengan kartu lain di dashboard; kondisi ditandai
   garis di sisi kiri dan label status. */
export default function AttendanceCard() {
  const {
    att,
    loading,
    loadError,
    busy,
    accuracy,
    error,
    reload,
    checkIn,
    checkOut,
  } = useAttendance(true);
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const state = loading
    ? "load"
    : !att && loadError
      ? "fail"
      : !att
        ? "none"
        : att.checkOutAt
          ? "out"
          : "in";

  const wait = accuracy ? `Locating… ±${accuracy} m` : "Getting location…";

  // perbarui lama kerja tiap 30 detik selama masih bekerja
  useEffect(() => {
    if (state !== "in") return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [state]);

  let pill = "Loading";
  let title = "Loading attendance…";
  let sub = "";
  if (state === "none") {
    pill = "Not checked in";
    title = "Start your shift";
    sub = "Tap Check in when you arrive";
  } else if (state === "in") {
    pill = "Working";
    title = `Checked in ${clock(att.checkInAt)}`;
    sub = `${duration((now - Date.parse(att.checkInAt)) / 60000)} on shift`;
  } else if (state === "out") {
    pill = "Done";
    title = `Checked out ${clock(att.checkOutAt)}`;
    const worked =
      att.effectiveMinutes ??
      att.workingMinutes ??
      (Date.parse(att.checkOutAt) - Date.parse(att.checkInAt)) / 60000;
    sub = `In ${clock(att.checkInAt)} · ${duration(worked)} worked`;
  } else if (state === "fail") {
    pill = "Error";
    title = "Could not load attendance";
    sub = loadError;
  }

  const doOut = async () => {
    await checkOut();
    setConfirm(false);
  };

  return (
    <section
      className={`att ${state}`}
      aria-label="Attendance"
      aria-live="polite"
    >
      <div className="att-top">
        <span className="att-label">Attendance</span>
        <span className="att-pill">{pill}</span>
      </div>

      <div className="att-row">
        <div className="att-main">
          <p className="att-title">{title}</p>
          {sub && <p className="att-sub">{sub}</p>}
        </div>
        
        {state === "fail" && (
          <button type="button" className="att-btn solid" onClick={reload}>
            Retry
          </button>
        )}

        {state === "none" && (
          <button
            type="button"
            className="att-btn solid"
            onClick={checkIn}
            disabled={busy}
          >
            {busy ? wait : "Check in"}
          </button>
        )}

        {state === "in" && !confirm && (
          <button
            type="button"
            className="att-btn"
            onClick={() => setConfirm(true)}
            disabled={busy}
          >
            Check out
          </button>
        )}

        {state === "in" && confirm && (
          <div
            className="att-confirm"
            role="alertdialog"
            aria-label="Confirm check out"
          >
            <p>Check out now? You cannot check in again today.</p>
            <div>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="yes"
                onClick={doOut}
                disabled={busy}
              >
                {busy ? wait : "Yes, check out"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="att-err" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
