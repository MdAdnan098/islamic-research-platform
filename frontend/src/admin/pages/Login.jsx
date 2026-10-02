import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { AdminShell } from "../AdminLayout.jsx";
import { LogoMark } from "../../components/brand/Logo.jsx";

export default function Login() {
  const { status, login } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from || "/admin";
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(f.email.trim(), f.password); nav(from, { replace: true }); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <AdminShell><div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="a-card w-full max-w-sm space-y-4 p-7">
        <div className="flex flex-col items-center gap-2 pb-2"><LogoMark size={46} /><h1 className="text-lg font-semibold">Admin sign in</h1><p className="text-xs text-ad-mute">Fahm-e-Salaf content management</p></div>
        <div><label className="a-label" htmlFor="em">Email</label><input id="em" type="email" autoComplete="username" required className="a-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="a-label" htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" required className="a-input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        {err && <p role="alert" className="rounded-md bg-ad-danger/10 px-3 py-2 text-sm text-ad-danger">{err}</p>}
        <button className="a-btn-primary w-full !py-2.5" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div></AdminShell>
  );
}
