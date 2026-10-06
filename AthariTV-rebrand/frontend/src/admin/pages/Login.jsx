import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { AdminShell } from "../AdminLayout.jsx";
import { LogoMark } from "../../components/brand/Logo.jsx";
import { HomeLink } from "../components/HomeLink.jsx";

export default function Login() {
  const { status, login } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from || "/admin";
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(f.username.trim(), f.password); nav(from, { replace: true }); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <AdminShell><HomeLink /><div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="a-card w-full max-w-sm space-y-4 p-7">
        <div className="flex flex-col items-center gap-2 pb-2"><LogoMark size={46} /><h1 className="text-xl font-bold">Admin sign in</h1><p className="text-xs text-ad-mute">AthariTV content management</p></div>
        <div><label className="a-label" htmlFor="un">Username</label><input id="un" type="text" autoComplete="username" autoCapitalize="none" required className="a-input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
        <div><label className="a-label" htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" required className="a-input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        {err && <p role="alert" className="rounded-md bg-ad-danger/10 px-3 py-2 text-sm text-ad-danger">{err}</p>}
        <button className="a-btn-primary w-full !py-2.5" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm"><Link to="/admin/forgot-password" className="text-ad-brand hover:underline">Forgot password?</Link></p>
      </form>
    </div></AdminShell>
  );
}
