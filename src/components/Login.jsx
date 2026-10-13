import { useState } from "react";
import StatusBar from "./StatusBar.jsx";
import { login } from "../api/auth.js";
import "./Login.css";

export default function Login({ notice = "", onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const session = await login(username, password);
      onLogin?.(session);
    } catch (err) {
      setError(err?.message || "Login gagal. Silakan coba lagi.");
      setPassword("");
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <StatusBar />

      <div className="login-inner">
        <div className="login-brand">
          <div className="login-pill" role="img" aria-label="Logo placeholder" />
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

          <a className="forgot" href="#">Forgot password?</a>

          {error && <p className="login-error" role="alert">{error}</p>}
          {!error && notice && <p className="login-notice" role="status">{notice}</p>}

          <button type="submit" className="signin" disabled={loading}>
            {loading ? "Memproses…" : "Sign in"}
          </button>
        </form>

        <p className="contact">
          Don’t have an account? <a href="#">Contact Admin</a>
        </p>
      </div>
    </main>
  );
}