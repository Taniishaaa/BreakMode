import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page">
        <h1>Something went wrong</h1>
        <p className="muted">The app hit an unexpected error. Reloading usually fixes it.</p>
        <button className="btn primary" onClick={() => location.reload()}>Reload</button>
      </main>
    );
  }
}

createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);
