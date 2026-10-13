import { getToken } from "../auth/session.js";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// dipanggil saat server menjawab 401 untuk permintaan yang memakai token
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export async function apiFetch(path, { method = "GET", body, auth = true, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError(
      "Server tidak terjangkau. Periksa koneksi atau pastikan backend berjalan.",
      0
    );
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.ok) return data;

  if (res.status === 401 && auth && onUnauthorized) onUnauthorized();

  const message =
    data?.message ||
    (res.status >= 500
      ? "Server tidak merespons dengan benar."
      : `Permintaan gagal (${res.status}).`);
  throw new ApiError(message, res.status, data);
}