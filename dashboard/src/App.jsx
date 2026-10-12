import { useEffect, useState } from "react";
import Sessions from "./Sessions.jsx";
import Heatmap from "./Heatmap.jsx";
import { API } from "./api.js";

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };

  if (name === "sessions") {
    return <svg {...common}><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M8 8h8M8 12h5M8 16h3" /><circle cx="17" cy="15.5" r="2.5" /></svg>;
  }
  if (name === "heatmap") {
    return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.3" /><path d="M12 1.5v3M22.5 12h-3M12 22.5v-3M1.5 12h3" /></svg>;
  }
  if (name === "chevron") {
    return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  }
  if (name === "refresh") {
    return <svg {...common}><path d="M20 7v5h-5" /><path d="M4.8 9A7.5 7.5 0 0 1 18 6.5L20 12M4 17v-5h5" /><path d="M19.2 15A7.5 7.5 0 0 1 6 17.5L4 12" /></svg>;
  }
  if (name === "database") {
    return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
  }
  return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function App() {
  const [tab, setTab] = useState("sessions");
  const [authStatus, setAuthStatus] = useState("checking");
  const [secretConfigured, setSecretConfigured] = useState(true);
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authRole, setAuthRole] = useState("admin");
  const [loginRole, setLoginRole] = useState("admin");
  const [loginMode, setLoginMode] = useState("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const isSessions = tab === "sessions";
  const isLocalEnvironment = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    let active = true;
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not check admin session.");
        if (!active) return;
        setSecretConfigured(data.secretConfigured !== false);
        setAdminConfigured(data.adminConfigured !== false);
        if (data.authenticated && data.role === "user") {
          window.location.replace("/demo.html");
          return;
        }
        if (data.authenticated && data.role === "admin") {
          setAuthUsername(data.username || "admin");
          setAuthRole("admin");
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("login");
          if (data.secretConfigured === false) {
            setLoginError("Authentication is not configured. Add SESSION_SECRET in Vercel.");
          }
        }
      })
      .catch((error) => {
        if (!active) return;
        setAuthStatus("login");
        setLoginError(error.message || "Could not connect to the authentication API.");
      });
    return () => { active = false; };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword, role: loginRole })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Login failed (${response.status})`);
      const authenticatedRole = data.user?.role || loginRole;
      setLoginPassword("");
      setLoginError("");
      if (authenticatedRole === "user") {
        window.location.replace("/demo.html");
        return;
      }
      setAuthUsername(data.user?.username || loginUsername);
      setAuthRole("admin");
      setAuthStatus("authenticated");
      setTab("sessions");
    } catch (error) {
      setLoginError(error.message || "Login failed. Please try again.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Registration failed (" + response.status + ")");
      setLoginPassword("");
      setLoginError("");
      window.location.replace("/demo.html");
      return;
    } catch (error) {
      setLoginError(error.message || "Could not create user account.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setAuthUsername("");
      setAuthRole("admin");
      setLoginRole("admin");
      setLoginMode("login");
      setAuthStatus("login");
      setLoginPassword("");
      setLoginError("");
    }
  }

  if (authStatus === "checking") {
    return <div className="auth-shell"><div className="auth-card auth-loading"><span className="loading-indicator" /> Checking account session…</div></div>;
  }

  if (authStatus !== "authenticated") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none">
                <path d="M5 7.5H23" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
                <path d="M14 7.5V22.5" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
                <circle cx="22.2" cy="21.5" r="1.4" fill="currentColor" />
              </svg>
            </div>
            <div className="brand-copy">
              <strong><span className="brand-initial">t</span>race<span className="brand-period">.</span></strong>
              <small>PRODUCT ANALYTICS</small>
            </div>
          </div>
          <div className="auth-eyebrow">PRIVATE WORKSPACE</div>
          <h1>{loginRole === "admin" ? "Admin sign in" : loginMode === "register" ? "Create user account" : "User sign in"}</h1>
          <p className="auth-description">
            {loginMode === "register"
              ? "Create an account to use the tracked demo website. Your page views and clicks will be recorded for the administrator."
              : loginRole === "admin"
                ? "Administrator access to sessions, visitor journeys and click heatmaps."
                : "Sign in to use the tracked demo website. Your page views and clicks will be recorded for the administrator."}
          </p>
          <div className="auth-role-switch" role="group" aria-label="Account type">
            <button type="button" className={loginRole === "user" ? "selected" : ""} onClick={() => { setLoginRole("user"); setLoginMode("login"); setLoginError(""); }}>User</button>
            <button type="button" className={loginRole === "admin" ? "selected" : ""} onClick={() => { setLoginRole("admin"); setLoginMode("login"); setLoginError(""); }}>Admin</button>
          </div>
          {loginError && <p className="error auth-error" role="alert">{loginError}</p>}
          {!secretConfigured && <p className="auth-hint">Authentication is not configured. Add SESSION_SECRET in Vercel Environment Variables.</p>}
          {loginRole === "admin" && !adminConfigured && <p className="auth-hint">Admin login is not configured. Add ADMIN_USERNAME and ADMIN_PASSWORD in Vercel Environment Variables.</p>}
          <form className="auth-form" onSubmit={loginMode === "register" ? handleRegister : handleLogin}>
            <label>
              <span>Username</span>
              <input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} name="username" autoComplete="username" minLength={3} maxLength={32} required />
            </label>
            <label>
              <span>Password</span>
              <input value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} name="password" type="password" autoComplete={loginMode === "register" ? "new-password" : "current-password"} minLength={loginMode === "register" ? 8 : undefined} required />
            </label>
            <button className="auth-submit" type="submit" disabled={loginBusy || !secretConfigured || (loginRole === "admin" && !adminConfigured)}>
              {loginBusy ? "Please wait…" : loginMode === "register" ? "Create user account" : "Sign in as " + loginRole}
            </button>
          </form>
          {loginRole === "user" && (
            <div className="auth-mode-toggle">
              {loginMode === "register" ? (
                <span>Already have an account? <button type="button" onClick={() => { setLoginMode("login"); setLoginError(""); }}>Sign in</button></span>
              ) : (
                <span>New user? <button type="button" onClick={() => { setLoginMode("register"); setLoginError(""); }}>Create account</button></span>
              )}
            </div>
          )}
          <div className="auth-bottom">
            <span>Just visiting?</span>
            <a href="/demo.html">Open tracked demo ↗</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="product-shell">
      <aside className="sidebar">
        <div className="brand-lockup" aria-label="Trace analytics">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" fill="none">
              <path d="M5 7.5H23" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
              <path d="M14 7.5V22.5" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
              <circle cx="22.2" cy="21.5" r="1.4" fill="currentColor" />
            </svg>
          </div>
          <div className="brand-copy">
            <strong><span className="brand-initial">t</span>race<span className="brand-period">.</span></strong>
            <small>PRODUCT ANALYTICS</small>
          </div>
        </div>

        <div className="workspace-card">
          <div className="workspace-avatar">LD</div>
          <div className="workspace-copy">
            <small>WORKSPACE</small>
            <strong>{isLocalEnvironment ? "Local development" : "Trace workspace"}</strong>
          </div>
          <span className="workspace-chevron"><Icon name="chevron" size={14} /></span>
        </div>

        <div className="sidebar-section-label">ANALYTICS</div>
        <nav className="sidebar-nav" aria-label="Analytics views">
          <button
            type="button"
            className={`side-nav-item ${isSessions ? "active" : ""}`}
            aria-current={isSessions ? "page" : undefined}
            onClick={() => setTab("sessions")}
          >
            <Icon name="sessions" />
            <span>Sessions</span>
            {isSessions && <span className="active-rail" />}
          </button>
          <button
            type="button"
            className={`side-nav-item ${!isSessions ? "active" : ""}`}
            aria-current={!isSessions ? "page" : undefined}
            onClick={() => setTab("heatmap")}
          >
            <Icon name="heatmap" />
            <span>Click heatmap</span>
            {!isSessions && <span className="active-rail" />}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-card">
            <div className="connection-icon"><Icon name="database" size={17} /></div>
            <div>
              <strong>{isLocalEnvironment ? "Local environment" : "Connected environment"}</strong>
              <span>{isLocalEnvironment ? "API · localhost:4000" : "API · same domain"}</span>
            </div>
            <span className="connection-dot" title="Local environment" />
          </div>
          <div className="sidebar-footnote">SESSION INSIGHTS <span>·</span> v1.0</div>
        </div>
      </aside>

      <div className="main-column">
        <header className="utility-bar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <Icon name="chevron" size={13} />
            <strong>Analytics</strong>
          </div>
          <div className="utility-status">
            <span className="environment-pill"><span /> {isLocalEnvironment ? "Local preview" : "Live environment"}</span>
            <span className="auth-role-chip">{authRole === "admin" ? "ADMIN" : "USER"}</span>
            <div className="user-avatar" aria-label={authRole === "admin" ? "Administrator" : "User"}>{(authUsername || "U").slice(0, 1).toUpperCase()}</div>
            <button type="button" className="logout-button" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <main className="page-container">
          <section className="page-intro">
            <div>
              <div className="page-eyebrow">Behaviour analytics</div>
              <h1>Understand your visitors.</h1>
              <p>Review session activity and see where people interact with your pages.</p>
            </div>
            <div className="page-intro-actions">
              <a className="ghost demo-launch" href="/demo.html" target="_blank" rel="noreferrer">
                <span>Open tracked demo</span>
                <span aria-hidden="true">↗</span>
              </a>
              <div className="refresh-note">
                <span className="refresh-note-dot" />
                <div><strong>Session data</strong><small>Refreshes every 10 seconds</small></div>
              </div>
            </div>
          </section>

          <section className="view-heading">
            <div>
              <h2>{isSessions ? "Sessions" : "Click heatmap"}</h2>
              <p>{isSessions ? "Explore visits and the sequence of events in each session." : "Compare click activity across the pages your tracker has recorded."}</p>
            </div>
            <div className="view-count-label">{isSessions ? "SESSION EXPLORER" : "INTERACTION MAP"}</div>
          </section>

          <section className="view-content">
            {isSessions ? <Sessions /> : <Heatmap />}
          </section>

          <footer className="page-footer">
            <span><strong>trace.</strong> Behaviour analytics</span>
            <span>{isLocalEnvironment ? "Local prototype" : "Live application"} · Data collected by your tracking script</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
