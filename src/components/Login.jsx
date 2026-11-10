import { useEffect, useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { login } from "../api/auth.js";
import "./Login.css";

export default function Login({ notice = "", onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [help, setHelp] = useState(null); // null | "forgot" | "contact"

  useEffect(() => {
    if (!help) return;
    const onKey = (e) => e.key === "Escape" && setHelp(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [help]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!username.trim()) return setError("Please enter your username.");
    if (!password) return setError("Please enter your password.");
    setError("");
    setLoading(true);
    try {
      const session = await login(username, password);
      onLogin?.(session);
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
      setPassword("");
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <StatusBar />

      <div className="login-inner">
        <div className="login-brand">
          <div
            className="login-pill"
            role="img"
            aria-label="Logo placeholder"
          />
          <p className="login-brandname">
            <span className="dress">Dress</span> <span className="num">2</span>
          </p>
        </div>

        <header className="login-head">
          <h1 className="login-title">
            <span className="welcome">Welcome</span>{" "}
            <span className="back">Back!</span>
          </h1>
          <p className="login-subtitle">Sign in to your account</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={10}
              placeholder="enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <button
            type="button"
            className="forgot"
            onClick={() => setHelp("forgot")}
          >
            Forgot password?
          </button>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          {!error && notice && (
            <p className="login-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="signin" disabled={loading}>
            {loading ? "Processing…" : "Sign in"}
          </button>
        </form>

        <p className="contact">
          Don’t have an account?{" "}
          <button
            type="button"
            className="contact-link"
            onClick={() => setHelp("contact")}
          >
            Contact Admin
          </button>
        </p>
      </div>
      {help && (
        <div className="lg-overlay" onClick={() => setHelp(null)}>
          <div
            className="lg-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lg-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="lg-modal-title" className="lg-modal-title">
              {help === "forgot" ? "Forgot your password?" : "Need an account?"}
            </h2>
            <p className="lg-modal-text">
              {help === "forgot"
                ? "Passwords can only be reset by your admin. Please contact your admin directly, and tell them your username."
                : "Accounts are created by your admin. Please contact your admin directly to get access."}
            </p>
            <button
              type="button"
              className="lg-modal-btn"
              autoFocus
              onClick={() => setHelp(null)}
            >
              OK, I understand
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
