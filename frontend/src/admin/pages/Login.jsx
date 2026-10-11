import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { AdminShell } from "../AdminLayout.jsx";
import { LogoMark } from "../../components/brand/Logo.jsx";
import { HomeLink } from "../components/HomeLink.jsx";
import { useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";

export default function Login() {
  const { status, login, logout } = useAuth();
  const inFlight = useRef(false);
  const nav = useNavigate();
  const from = useLocation().state?.from || "/admin";
  const [f, setF] = useState({ username: "", password: "" });
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // A still-valid session is shown explicitly instead of silently redirecting, so nothing looks like an automatic sign-in.
  if (status === "authed") {
    return (
      <AdminShell><HomeLink /><div className="grid min-h-screen place-items-center p-4">
        <div className="a-card w-full max-w-sm space-y-4 p-7 text-center">
          <h1 className="text-xl font-bold">Aap pehle se signed in hain</h1>
          <button type="button" className="a-btn-primary w-full !py-2.5" onClick={() => nav(from, { replace: true })}>Dashboard par jayein</button>
          <button type="button" className="a-btn w-full !py-2.5" onClick={() => logout()}>Sign out</button>
        </div>
      </div></AdminShell>
    );
  }

  // Runs ONLY from the form's submit event (Sign in click, or Enter inside the form). Typing never calls it.
  async function submit(e) {
    e.preventDefault();
    if (inFlight.current) return; // one request at a time, even on a double click / double Enter
    inFlight.current = true;
    setBusy(true);
    try { await login(f.username.trim(), f.password); toast("Login successful"); nav(from, { replace: true }); }
    catch (ex) { toast(ex.message, "error"); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return (
    <AdminShell><HomeLink /><div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="a-card w-full max-w-sm space-y-4 p-7">
        <div className="flex flex-col items-center gap-2 pb-2"><LogoMark size={46} /><h1 className="text-xl font-bold">Admin sign in</h1><p className="text-xs text-ad-mute">AthariTV content management</p></div>
        <div><label className="a-label" htmlFor="un">Username</label><input id="un" type="text" autoComplete="username" autoCapitalize="none" required className="a-input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
        <div>
          <label className="a-label" htmlFor="pw">Password</label>
          <div className="relative">
            <input id="pw" type={showPw ? "text" : "password"} autoComplete="current-password" required className="a-input !pr-10" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw} title={showPw ? "Hide" : "Show"} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ad-mute hover:text-ad-ink"><Icon name={showPw ? "eyeOff" : "eye"} size={16} /></button>
          </div>
        </div>
        <button type="submit" className="a-btn-primary w-full !py-2.5" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm"><Link to="/admin/forgot-password" className="text-ad-brand hover:underline">Forgot password?</Link></p>
      </form>
    </div></AdminShell>
  );
}
