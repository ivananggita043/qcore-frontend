import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "./client.js";
import { getToken } from "../auth/session.js";

const PATH = "/user/attendance";
const MAX_ACCURACY = 50; // meter, sama dengan batas di backend
const GPS_WAIT_MS = 20000;
/* Absensi QC
    GET  /user/attendance/today -> 404 jika belum check-in
    POST /user/attendance/check-in  { latitude, longitude, accuracy }
    POST /user/attendance/check-out { Latitude, Longitude, accuracy }
    Backend menolak jika akurasi GPS lebih dari 50 m atau lokasi di luar radius kantor (100m). */

// Absensi terakhir disimpan di memori, supaya kartu langsung benar saat kembali ke dashboard
// (dikunci per login dan per tanggal, lalu tetap diperbarui dari server).
let cache = null; // { key, att }
const cacheKey = () =>
  `${getToken() ?? ""}|${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" })}`;
const readCache = () => (cache && cache.key === cacheKey() ? cache.att : null);
const writeCache = (att) => {
  cache = { key: cacheKey(), att };
};

const geoMessage = (code) =>
    code === 1
        ? "Location acces is blocked. Allow location in your browser settings, then try again."
        : code === 3
            ? "Getting your location took too long. Move near a window and try again."
            : "Could not get your location. Please try again.";

// Ambil posisi terbaik: terus memantau sampai akurasi <= 50 m atau waktu habis.
export function getPosition(onProgress) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("This device cannot share its location."));
            return;
        }
        let best = null;
        let done = false;
        let id;
        let timer;
        const finish = (fn, value) => {
            if (done) return;
            done = true;
            navigator.geolocation.clearWatch(id);
            clearTimeout(timer);
            fn(value);
        };
        id = navigator.geolocation.watchPosition(
            (p) => {
                const c = p.coords;
                if (!best || c.accuracy < best.accuracy) {
                    best = { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy };
                }
                onProgress?.(Math.round(best.accuracy));
                if (best.accuracy <= MAX_ACCURACY) finish(resolve, best);
            },
            (e) => (best ? finish(resolve, best) : finish(reject, new Error(geoMessage(e.code)))),
            { enableHighAccuracy: true, timeout: GPS_WAIT_MS, maximumAge: 0 },
        );
        timer = setTimeout(
            () => (best ? finish(resolve, best) : finish(reject, new Error(geoMessage(3)))),
            GPS_WAIT_MS,
        );
    });
}

// pesan dari backend (Indonesia) -> teks yang jelas untuk oengguna
function friendly(message, pos) {
    if (/akurasi gps/i.test(message || "")) {
        const m = pos ? `GPS signal is too weak${Math.round(pos.accuracy)} m)` : "";
        return `GPS signal is too weak${m}. It must be within ${MAX_ACCURACY} m. Go outdoors or near a window and try again.`;
    }
    const r = /radius absensi (\d+)/i.exec(message || "");
    if (r) return `You are outside the attendance area. Check in within ${r[1]} m of the office.`;
    return message || "Request failed. Please try again.";
}

export function useAttendance(enabled = true) {
  const [att, setAtt] = useState(() => readCache());
  const [loading, setLoading] = useState(() => enabled && !readCache());
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState("");

  const update = useCallback((a) => {
    writeCache(a);
    setAtt(a);
  }, []);

  const load = useCallback(
    (signal) => {
      setLoadError("");
      return apiFetch(`${PATH}/today`, { signal })
        .then((a) => update(a ?? null))
        .catch((e) => {
          if (e?.name === "AbortError") return;
          if (e instanceof ApiError && e.status === 404) update(null); // belum check-in
          else setLoadError(e.message || "Failed to load attendance."); // jangan dianggap "belum check-in"
        });
    },
    [update],
  );

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    if (!readCache()) setLoading(true);
    load(ctrl.signal).finally(() => {
      if (!ctrl.signal.aborted) setLoading(false);
    });
    return () => ctrl.abort();
  }, [enabled, load]);

  const reload = useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const act = useCallback(
    async (kind) => {
      setBusy(true);
      setAccuracy(null);
      setError("");
      let pos = null;
      try {
        pos = await getPosition(setAccuracy);
        update(await apiFetch(`${PATH}/${kind}`, { method: "POST", body: pos }));
      } catch (e) {
        setError(friendly(e.message, pos));
        // status di server mungkin sudah berubah (mis. sudah check-in dari perangkat lain)
        if (e instanceof ApiError && !/akurasi|radius/i.test(e.message || "")) load();
      } finally {
        setBusy(false);
        setAccuracy(null);
      }
    },
    [load, update],
  );

  return {
    att,
    loading,
    loadError,
    busy,
    accuracy,
    error,
    reload,
    checkIn: () => act("check-in"),
    checkOut: () => act("check-out"),
  };
}