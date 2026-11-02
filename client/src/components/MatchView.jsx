import { useEffect } from "react";
import { useStore } from "../store";
import ScoreBoard from "./ScoreBoard.jsx";
import Timeline from "./Timeline.jsx";
import CreaseCard from "./CreaseCard.jsx";
import Moments from "./Moments.jsx";
import BreakPanel from "./BreakPanel.jsx";

export default function MatchView({ id }) {
  const match = useStore((s) => s.match);
  const loading = useStore((s) => s.matchLoading);
  const error = useStore((s) => s.matchError);

  useEffect(() => {
    const s = useStore.getState();
    if (s.match?.id !== id && !s.matchLoading) s.loadMatch(id);
  }, [id]);

  if (error) {
    return (
      <div className="page"><div className="notice-box" role="alert">
        <h1>This match did not load</h1>
        <p className="muted">{error}</p>
        <p><button className="btn" onClick={() => useStore.getState().loadMatch(id)}>Try again</button>{" "}
          <a className="btn" href="#/matches">Back to matches</a></p>
      </div></div>
    );
  }
  if (!match || loading || match.id !== id) return <div className="page"><p className="muted" aria-busy="true">Loading match…</p></div>;

  return (
    <div className="match-grid">
      <ScoreBoard />
      <BreakPanel />
      <div className="lower">
        <Timeline />
        <div className="duo"><CreaseCard /><Moments /></div>
      </div>
    </div>
  );
}
