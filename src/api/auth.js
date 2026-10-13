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
    if (!(e instanceof ApiError) || e.status === 0) throw e;

    // Backend saat ini mengembalikan status 500 (bukan 401) untuk password
    // salah, jadi kita mengenalinya dari pesan error.
    const msg = String(e.data?.message ?? "").toLowerCase();
    if (e.status === 401 || e.status === 403 || msg.includes("bad credentials")) {
      throw new ApiError("Username atau password salah.", e.status);
    }
    if (msg.includes("disabled")) {
      throw new ApiError("Akun ini nonaktif. Hubungi admin.", e.status);
    }
    if (e.status >= 500) {
      throw new ApiError(
        e.data?.message
          ? "Terjadi gangguan di server. Coba lagi nanti."
          : "Server tidak terjangkau atau sedang bermasalah.",
        e.status
      );
    }
    throw e;
  }

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
      lineIds: data.lineIds ?? [],
    },
  };
  saveSession(session);
  return session;
}