import { useState } from "react";
import StatusBar from "./StatusBar.jsx";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin?.({ username, password });
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
              placeholder="enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              required
            />
          </label>

          <a className="forgot" href="#">Forgot password?</a>

          <button type="submit" className="signin">Sign in</button>
        </form>

        <p className="contact">
          Don’t have an account? <a href="#">Contact Admin</a>
        </p>
      </div>
    </main>
  );
}