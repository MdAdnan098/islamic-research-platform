import { Component, lazy, Suspense, useEffect, useState } from "react";
import { isNativeApp } from "../../lib/nativeApp.js";

/**
 * Mounts the Android update check, and ONLY inside the Android app. On the website in an ordinary browser this renders
 * nothing and the update code is never even downloaded (it is a separate lazy chunk). Any error in the update code is
 * swallowed: a problem with the update check must never take the rest of the app down.
 */
const AppUpdateGate = lazy(() => import("./AppUpdateGate.jsx"));

class Silent extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn("App update check disabled:", err?.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function AppUpdateLoader() {
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(isNativeApp()); }, []);
  if (!native) return null;
  return <Silent><Suspense fallback={null}><AppUpdateGate /></Suspense></Silent>;
}
