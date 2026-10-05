import { Component } from "react";
import { useLocation } from "react-router-dom";

/** Shows the real error instead of a blank white page, and resets when the route changes. */
class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(error, info) { console.error("UI crash:", error, info?.componentStack); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ maxWidth: 560, margin: "15vh auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#27272a" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Kuch gadbad ho gayi</h1>
        <p style={{ marginTop: 8, color: "#71717a" }}>Page khul nahi paya. Neeche likha error screenshot lekar bhej dein.</p>
        <pre style={{ marginTop: 16, padding: 12, background: "#f4f4f5", borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{String(error?.message || error)}</pre>
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={() => (window.location.href = "/")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d4d4d8", background: "#fff", cursor: "pointer" }}>Home par jayein</button>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 8, border: 0, background: "#4f46e5", color: "#fff", cursor: "pointer" }}>Dobara try karein</button>
        </div>
      </div>
    );
  }
}

export function ErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
