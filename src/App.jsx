
import { useState } from "react";
import axios from "axios";
import AudioDetection from "./AudioDetection.jsx";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import {
  AudioWaveform,
  ShieldCheck,
  Mic,
  LayoutDashboard,
  LogOut,
  LockKeyhole,
  Mail,
  UserRound,
  ArrowRight,
} from "lucide-react";
import "./App.css";

const API = "http://localhost:8081/api/auth";

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-icon">
          <AudioWaveform size={28} />
        </div>
        <span>VoiceGuard AI</span>
      </div>

      <div className="auth-card">{children}</div>

      <p className="auth-footer">
        AI Voice Clone Detection System
      </p>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/login`, {
        email,
        password,
      });

      localStorage.setItem("voiceguard_token", response.data.token);
      localStorage.setItem(
        "voiceguard_user",
        JSON.stringify({
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          role: response.data.role,
        })
      );

      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.status === 401
          ? "Invalid email or password."
          : err.response?.data?.message ||
            "Unable to connect to the server. Check Spring Boot."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-symbol">
        <ShieldCheck size={30} />
      </div>

      <p className="eyebrow">WELCOME BACK</p>
      <h1>Sign in to VoiceGuard</h1>
      <p className="muted">
        Verify suspicious voices with AI-powered analysis.
      </p>

      <form onSubmit={handleLogin}>
        <label>Email address</label>
        <div className="input-wrap">
          <Mail size={18} />
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <label>Password</label>
        <div className="input-wrap">
          <LockKeyhole size={18} />
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button className="primary-button" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowRight size={18} />}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account? <Link to="/register">Create one</Link>
      </p>
    </AuthLayout>
  );
}

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/register`, form);
      navigate("/login", {
        state: { registered: true },
      });
  
} catch (err) {
  console.error("Registration error:", err);

  const data = err.response?.data;

  setError(
    typeof data === "string"
      ? data
      : data?.message ||
        data?.error ||
        (err.response
          ? `Registration failed: HTTP ${err.response.status}`
          : "Cannot connect to Spring Boot. Check port 8081.")
  );
} finally {
  setLoading(false);
}
  }

  return (
    <AuthLayout>
      <div className="auth-symbol">
        <UserRound size={30} />
      </div>

      <p className="eyebrow">GET STARTED</p>
      <h1>Create your account</h1>
      <p className="muted">
        Protect yourself against AI voice impersonation.
      </p>

      <form onSubmit={handleRegister}>
        <label>Full name</label>
        <div className="input-wrap">
          <UserRound size={18} />
          <input
            name="name"
            placeholder="Your name"
            value={form.name}
            onChange={updateField}
            required
          />
        </div>

        <label>Email address</label>
        <div className="input-wrap">
          <Mail size={18} />
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={updateField}
            required
          />
        </div>

        <label>Password</label>
        <div className="input-wrap">
          <LockKeyhole size={18} />
          <input
            type="password"
            name="password"
            placeholder="At least 6 characters"
            value={form.password}
            onChange={updateField}
            minLength={6}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button className="primary-button" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
          {!loading && <ArrowRight size={18} />}
        </button>
      </form>

      <p className="auth-switch">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

function Dashboard() {
  const user = JSON.parse(
    localStorage.getItem("voiceguard_user") || "{}"
  );
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("voiceguard_token");
    localStorage.removeItem("voiceguard_user");
    navigate("/login");
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <AudioWaveform size={26} />
          <span>VoiceGuard AI</span>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <div className="nav-item active">
          <LayoutDashboard size={19} />
          Dashboard
        </div>

        <div className="nav-item">
          <Mic size={19} />
          Voice Detection
          <span className="coming-soon">Next</span>
        </div>

        <div className="sidebar-bottom">
          <div className="user-info">
            <div className="avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user.name || "User"}</strong>
              <small>{user.email || ""}</small>
            </div>
          </div>

          <button className="logout-button" onClick={logout}>
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / OVERVIEW</span>
            <h2>Dashboard</h2>
          </div>
          <div className="secure-badge">
            <ShieldCheck size={17} />
            Authentication enabled
          </div>
        </header>

        <section className="welcome-panel">
          <div className="welcome-copy">
            <span className="eyebrow">YOUR VOICE SECURITY CENTER</span>
            <h1>Welcome, {user.name || "User"}!</h1>
            <p>
              Analyze suspicious audio and investigate potential
              AI-generated voices from one place.
            </p>
          </div>
          <AudioWaveform className="welcome-wave" size={110} />
        </section>

        <section className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">Total analyses</span>
            <h2>0</h2>
            <p>Ready for your first scan</p>
          </div>
          <div className="stat-card">
            <span className="stat-label">AI-generated voices</span>
            <h2>—</h2>
            <p>Awaiting analysis data</p>
          </div>
          <div className="stat-card">
            <span className="stat-label">Verified voices</span>
            <h2>—</h2>
            <p>Awaiting analysis data</p>
          </div>
        </section>

        <section className="analysis-panel">
          <div className="analysis-icon">
            <Mic size={28} />
          </div>
          <div className="analysis-copy">
            <h3>Start a voice analysis</h3>
            <p>
              Upload a voice recording to check it with our detection
              model. This feature will be connected in the next step.
            </p>
          </div>
          <button
  className="primary-button analysis-button"
  onClick={() => navigate("/analyze")}
>
  Get started <ArrowRight size={18} />
</button>
        </section>

        <p className="disclaimer">
          AI results are indicators, not definitive proof of voice
          authenticity.
        </p>
      </main>
    </div>
  );
}

function ProtectedDashboard() {
  const token = localStorage.getItem("voiceguard_token");
  return token ? <Dashboard /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route
  path="/analyze"
  element={
    localStorage.getItem("voiceguard_token")
      ? <AudioDetection />
      : <Navigate to="/login" replace />
  }
/>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
