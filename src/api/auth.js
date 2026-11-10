import { apiFetch, ApiError } from "./client.js";
import { decodeExp, saveSession } from "../auth/session.js";

export async function login(username, password) {
  let data;
  try {
    data = await apiFetch("/auth/login", {
      method: "POST",
      auth: false,
      body: { username: username.trim(), password },
    });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;

    // tidak ada koneksi / server mati
    if (e.status === 0) {
      throw new ApiError(
        "Cannot reach the server. Check your internet connection and try again.",
        0
      );
    }

    const msg = String(e.data?.message ?? "").toLowerCase();

    // Cek jenis akun lebih dulu, karena backend memakai status 401/403 untuk semuanya
    if (msg.includes("tidak aktif") || msg.includes("disabled") || msg.includes("inactive")) {
      throw new ApiError("Your account is inactive. Please contact your admin.", e.status);
    }
    if (msg.includes("terkunci") || msg.includes("locked")) {
      throw new ApiError("Your account is locked. Please contact your admin.", e.status);
    }
    if (
      e.status === 401 ||
      e.status === 403 ||
      msg.includes("salah") ||
      msg.includes("bad credentials")
    ) {
      throw new ApiError("Incorrect username or password. Please check and try again.", e.status);
    }
    if (e.status === 429) {
      throw new ApiError("Too many attempts. Please wait a moment and try again.", e.status);
    }
    if (e.status >= 500) {
      throw new ApiError("Something went wrong on the server. Please try again in a moment.", e.status);
    }
    throw e;
  }

  // backend baru: lines [{id,name}]; tetap kompatibel dengan versi lama (lineIds)
  const lines = data.lines ?? (data.lineIds ?? []).map((id) => ({ id, name: "" }));
  const session = {
    token: data.token,
    // token berlaku 1 jam di backend; dibaca dari token itu sendiri
    expiresAt: decodeExp(data.token) ?? Date.now() + 3600000,
    user: {
      id: data.id,
      nama: data.nama,
      username: data.username,
      role: String(data.role).toLowerCase(), // user | admin | super_admin
      section: data.section ? String(data.section).toLowerCase() : null,
      active: data.active,
      lineIds: lines.map((l) => l.id),
      lineNames: lines.map((l) => l.name),
    },
  };
  saveSession(session);
  return session;
}