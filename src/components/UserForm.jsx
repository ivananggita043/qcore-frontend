import { useMemo, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import {
  createUser,
  updateUser,
  setUserActive,
  deleteUser,
  fetchUser,
  fetchLines,
} from "../api/users.js";
import { SECTIONS } from "../config/sections.js";
import "./DashboardUser.css";
import "./Users.css";

const SECTION_KEYS = Object.keys(SECTIONS);

export default function UserForm({ mode, target, isSuper, mySection, lines, onBack, onDone }) {
  const isEdit = mode === "edit";

  const [f, setF] = useState(() =>
    isEdit
      ? {
          nama: target.nama,
          username: target.username,
          nik: target.nik,
          role: target.role,
          section: target.section ?? "",
          lineIds: [...target.lineIds],
          password: "",
        }
      : {
          nama: "",
          username: "",
          nik: "",
          role: "user",
          section: isSuper ? "" : mySection,
          lineIds: [],
          password: "",
        }
  );
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lineList, setLineList] = useState(lines);
  const [live, setLive] = useState(target); // data user terbaru dari server
  const [refreshing, setRefreshing] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // admin biasa: role dan section terkunci
  const section = isSuper ? f.section : mySection;
  const roleLocked = !isSuper;

  const sectionLines = useMemo(
    () => lineList.filter((l) => l.active && l.section === section),
    [lineList, section]
  );

  const toggleLine = (id) =>
    set(
      "lineIds",
      f.lineIds.includes(id) ? f.lineIds.filter((x) => x !== id) : [...f.lineIds, id]
    );

  const validate = () => {
    if (!f.nama.trim()) return "Nama wajib diisi.";
    if (!f.username.trim()) return "Username wajib diisi.";
    if (/\s/.test(f.username)) return "Username tidak boleh mengandung spasi.";
    if (!isEdit && !f.password) return "Password wajib diisi.";
    if (f.password && f.password.length < 6) return "Password minimal 6 karakter.";
    if (!section) return "Pilih section.";
    if (f.role === "user" && f.lineIds.length === 0)
      return "Pilih minimal satu line untuk akun QC.";
    return "";
  };

  const run = async (action, doneMessage) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await action();
      onDone(doneMessage);
    } catch (e) {
      setError(e?.message || "Terjadi kesalahan. Coba lagi.");
      setBusy(false);
    }
  };

  // muat ulang data user dan daftar line dari server
  const refresh = async () => {
    setRefreshing(true);
    setError("");
    setInfo("");
    try {
      const [fresh, ls] = await Promise.all([
        isEdit ? fetchUser(target.id) : Promise.resolve(null),
        fetchLines().catch(() => null),
      ]);
      if (ls) setLineList(ls);
      if (fresh) {
        setLive(fresh);
        setF({
          nama: fresh.nama,
          username: fresh.username,
          nik: fresh.nik,
          role: fresh.role,
          section: fresh.section ?? "",
          lineIds: [...fresh.lineIds],
          password: "",
        });
      }
      setInfo(isEdit ? "Data user dimuat ulang dari server." : "Daftar line dimuat ulang.");
    } catch (e) {
      setError(e?.message || "Gagal memuat ulang. Coba lagi.");
    } finally {
      setRefreshing(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setInfo("");
      return setError(msg);
    }
    const payload = { ...f, section };
    run(
      () => (isEdit ? updateUser(target.id, payload) : createUser(payload)),
      isEdit ? "Perubahan disimpan." : "User baru ditambahkan."
    );
  };

  return (
    <main className="dash">
      <StatusBar />

      <form className="dash-inner us uf" onSubmit={save} noValidate>
        <header className="us-head">
          <button type="button" className="us-back" aria-label="Kembali" onClick={onBack}>
            ‹
          </button>
          <h1 className="us-title">{isEdit ? "Edit User" : "Tambah User"}</h1>
          <button
            type="button"
            className="us-refresh"
            onClick={refresh}
            disabled={refreshing || busy}
            aria-label="Muat ulang data"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            <span>{refreshing ? "Memuat…" : "Muat ulang"}</span>
          </button>
        </header>

        {error && <p className="uf-error" role="alert">{error}</p>}
        {info && <p className="uf-info" role="status">{info}</p>}

        <label className="uf-field">
          <span>Nama lengkap</span>
          <input
            value={f.nama}
            onChange={(e) => set("nama", e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="uf-field">
          <span>Username</span>
          <input
            value={f.username}
            maxLength={10}
            onChange={(e) => set("username", e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
          <p className="uf-hint">Maksimal 10 karakter, tanpa spasi.</p>
        </label>

        <label className="uf-field">
          <span>NIK (opsional)</span>
          <input
            value={f.nik}
            maxLength={30}
            inputMode="numeric"
            onChange={(e) => set("nik", e.target.value.replace(/\D/g, ""))}
          />
        </label>

        {/* Peran */}
        <div className="uf-field">
          <span>Peran</span>
          {roleLocked ? (
            <p className="uf-fixed">QC (Admin hanya dapat mengelola user QC)</p>
          ) : (
            <div className="uf-seg" role="radiogroup" aria-label="Peran">
              {[
                { key: "user", label: "QC" },
                { key: "admin", label: "Admin" },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={f.role === r.key}
                  className={f.role === r.key ? "on" : ""}
                  onClick={() => setF((p) => ({ ...p, role: r.key, lineIds: [] }))}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section */}
        <label className="uf-field">
          <span>Section</span>
          {isSuper ? (
            <select
              value={f.section}
              onChange={(e) => setF((p) => ({ ...p, section: e.target.value, lineIds: [] }))}
            >
              <option value="">Pilih section</option>
              {SECTION_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SECTIONS[k].label}
                </option>
              ))}
            </select>
          ) : (
            <p className="uf-fixed">{SECTIONS[mySection]?.label ?? mySection}</p>
          )}
        </label>

        {/* Line (khusus QC) */}
        {f.role === "user" && (
          <div className="uf-field">
            <span>Line</span>
            {!section ? (
              <p className="uf-hint">Pilih section dulu untuk melihat daftar line.</p>
            ) : sectionLines.length === 0 ? (
              <p className="uf-hint">
                Belum ada line aktif di section ini, atau daftar line gagal dimuat.
                Coba tombol Muat ulang.
              </p>
            ) : (
              <div className="uf-lines">
                {sectionLines.map((l) => (
                  <label
                    key={l.id}
                    className={`uf-line ${f.lineIds.includes(l.id) ? "on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={f.lineIds.includes(l.id)}
                      onChange={() => toggleLine(l.id)}
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Password */}
        <div className="uf-field">
          <span>{isEdit ? "Password baru" : "Password"}</span>
          <div className="uf-pass">
            <input
              type={showPass ? "text" : "password"}
              value={f.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              aria-label="Password"
            />
            <button type="button" onClick={() => setShowPass((s) => !s)}>
              {showPass ? "Sembunyi" : "Tampil"}
            </button>
          </div>
          <p className="uf-hint">
            {isEdit ? "Kosongkan jika password tidak diganti." : "Minimal 6 karakter."}
          </p>
        </div>

        <button type="submit" className="uf-save" disabled={busy || refreshing}>
          {busy ? "Memproses…" : isEdit ? "Simpan perubahan" : "Tambah user"}
        </button>

        {isEdit && (
          <>
            <button
              type="button"
              className="uf-secondary"
              disabled={busy || refreshing}
              onClick={() =>
                run(
                  () => setUserActive(target.id, !live.active),
                  live.active ? "Akun dinonaktifkan." : "Akun diaktifkan."
                )
              }
            >
              {live.active ? "Nonaktifkan akun" : "Aktifkan akun"}
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                className="uf-danger"
                disabled={busy || refreshing}
                onClick={() => setConfirmDelete(true)}
              >
                Hapus user
              </button>
            ) : (
              <div className="uf-confirm" role="alertdialog" aria-label="Konfirmasi hapus">
                <p>
                  Hapus <strong>{live.nama || live.username}</strong>? Tindakan ini tidak
                  dapat dibatalkan.
                </p>
                <div>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    Batal
                  </button>
                  <button
                    type="button"
                    className="yes"
                    disabled={busy}
                    onClick={() => run(() => deleteUser(target.id), "User dihapus.")}
                  >
                    Ya, hapus
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </main>
  );
}