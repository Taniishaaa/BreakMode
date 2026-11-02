import { useEffect } from "react";
import { useStore } from "../store";

function Toast({ t }) {
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), 8000);
    return () => clearTimeout(id);
  }, [t.id]);
  const head = t.status === "resolved" ? (t.points > 0 ? `+${t.points} points` : "No points")
    : t.status === "void" ? "Void" : "Problem";
  return (
    <div className={`toast ${t.status} ${t.points > 0 ? "win" : ""}`} role="status" onClick={() => dismiss(t.id)}>
      <b>{head}</b>
      <span>{t.why}</span>
    </div>
  );
}

export default function PointsToast() {
  const toasts = useStore((s) => s.toasts);
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <Toast key={t.id} t={t} />)}</div>;
}
