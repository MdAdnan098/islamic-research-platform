import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { AdminShell } from "../AdminLayout.jsx";
import { HomeLink } from "../components/HomeLink.jsx";
import { useToast } from "../components/ui.jsx";
import { LogoMark } from "../../components/brand/Logo.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const MODES = {
  register: { title: "Create admin account", sub: "Needs the admin secret key", btn: "Create account", busy: "Creating…", ok: "Account created. You can sign in now." },
  reset: { title: "Reset password", sub: "Use the admin secret key to set a new password", btn: "Set new password", busy: "Saving…", ok: "Password updated. You can sign in now." },
};

function Field({ id, label, type, ...p }) {
  const [shown, setShown] = useState(false);
  if (type !== "password") return <div><label className="a-label" htmlFor={id}>{label}</label><input id={id} required className="a-input" type={type} {...p} /></div>;
  // Password-type fields get a small show/hide eye (display only; the value is unchanged).
  return (
    <div>
      <label className="a-label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} required className="a-input !pr-10" type={shown ? "text" : "password"} {...p} />
        <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={shown} title={shown ? "Hide" : "Show"} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ad-mute hover:text-ad-ink">
          <Icon name={shown ? "eyeOff" : "eye"} size={16} />
        </button>
      </div>
    </div>
  );
}

/** Hidden admin pages: /admin/register and /admin/forgot-password (not linked from the public site). */
export default function AdminAccess({ mode }) {
  const m = MODES[mode];
  const nav = useNavigate();
  const [f, setF] = useState({ username: "", secretKey: "", password: "", confirm: "" });
  const toast = useToast();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (f.password.length < 12) return toast("Password must be at least 12 characters.", "error");
    if (f.password !== f.confirm) return toast("Passwords do not match.", "error");
    setBusy(true);
    try {
      const username = f.username.trim();
      if (mode === "register") await adminApi.register(username, f.password, f.secretKey);
      else await adminApi.resetPassword(username, f.secretKey, f.password);
      setDone(true); toast(m.ok);
      setTimeout(() => nav("/admin/login", { replace: true }), 1500);
    } catch (ex) { toast(ex.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <AdminShell><HomeLink /><div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="a-card w-full max-w-sm space-y-4 p-7">
        <div className="flex flex-col items-center gap-2 pb-2"><LogoMark size={46} /><h1 className="text-xl font-bold">{m.title}</h1><p className="text-center text-xs text-ad-mute">{m.sub}</p></div>
        <Field id="un" label="Username" type="text" autoComplete="username" autoCapitalize="none" value={f.username} onChange={set("username")} />
        <Field id="sk" label="Admin secret key" type="password" autoComplete="off" value={f.secretKey} onChange={set("secretKey")} />
        <Field id="pw" label={mode === "reset" ? "New password" : "Password"} type="password" autoComplete="new-password" minLength={12} value={f.password} onChange={set("password")} />
        <Field id="cf" label="Confirm password" type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} />
        <button className="a-btn-primary w-full !py-2.5" disabled={busy || done}>{busy ? m.busy : m.btn}</button>
        <p className="text-center text-sm"><Link to="/admin/login" className="text-ad-brand hover:underline">Back to sign in</Link></p>
      </form>
    </div></AdminShell>
  );
}
