const KEY = "usg.session";

// membaca waktu kedaluwarsa (exp) dari token JWT, dalam milidetik
export function decodeExp(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return json.exp ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* penyimpanan tidak tersedia: sesi hanya hidup selama halaman terbuka */
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token || !s.expiresAt || s.expiresAt <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}

export const getToken = () => loadSession()?.token ?? null;