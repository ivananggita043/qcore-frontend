import { apiFetch } from "./client.js";
import { loadSession } from "../auth/session.js";

// prefix backend mengikuti role yang sedang login
const base = () => (loadSession()?.user?.role === "super_admin" ? "/super-admin" : "/admin");

const lower = (v) => (v ? String(v).toLowerCase() : null);

const fromApi = (u) => ({
  id: u.id,
  nama: u.nama ?? "",
  username: u.username ?? "",
  nik: u.nik ?? "",
  role: lower(u.role) ?? "user",
  section: lower(u.section),
  lineIds: u.lineIds ?? [],
  active: u.active !== false,
});

const lineFromApi = (l) => ({
  id: l.id,
  name: l.name ?? String(l.id),
  section: lower(l.section),
  active: l.active !== false,
});

// bentuk data form -> body request backend
const toApi = (f) => {
  const body = {
    nama: f.nama.trim(),
    username: f.username.trim(),
    nik: f.nik.trim() || null,
    role: f.role.toUpperCase(),
    section: f.role === "super_admin" || !f.section ? null : f.section.toUpperCase(),
    lineIds: f.role === "user" ? f.lineIds : [],
  };
  if (f.password) body.password = f.password;
  return body;
};

export async function fetchUsers(signal) {
  const data = await apiFetch(`${base()}/users/all`, { signal });
  return (data ?? []).map(fromApi);
}

export async function fetchLines(signal) {
  const data = await apiFetch(`${base()}/lines/all`, { signal });
  return (Array.isArray(data) ? data : []).map(lineFromApi);
}

export async function fetchUser(id, signal) {
  const data = await apiFetch(`${base()}/users/${id}`, { signal });
  return fromApi(data);
}

// /auth/me bisa dipakai semua role
export async function fetchMe(signal) {
  return apiFetch("/auth/me", { signal });
}

export const createUser = (form) =>
  apiFetch(`${base()}/users`, { method: "POST", body: toApi(form) });

export const updateUser = (id, form) =>
  apiFetch(`${base()}/users/${id}`, { method: "PUT", body: toApi(form) });

export const setUserActive = (id, active) =>
  apiFetch(`${base()}/users/${id}/status?active=${active}`, { method: "PATCH" });

export const deleteUser = (id) =>
  apiFetch(`${base()}/users/${id}`, { method: "DELETE" });