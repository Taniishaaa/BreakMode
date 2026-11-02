import { useEffect, useState } from "react";
import { api } from "../api";
import { pct } from "./ui.jsx";

const TYPE = { wicket: "Wicket", review: "Review", strategic_timeout: "Timeout", ad_break: "Ad break", innings_break: "Innings break" };

export default function History() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.history().then(setData).catch((e) => setError(e.message));
  }, []);

  const t = data?.totals;
  return (
    <div className="page history-page">
      <header className="page-head">
        <h1>My predictions</h1>
        <p className="muted">Every call you made during a break, and why it scored the way it did.</p>
      </header>

      {error && <p className="error">Could not load history: {error}</p>}
      {!data && !error && <p className="muted" aria-busy="true">Loading…</p>}
      {data && (
        <>
          <div className="record big">
            <div><b>{t.points}</b><span>points</span></div>
            <div><b>{pct(t.accuracy)}</b><span>accuracy ({t.correct}/{t.answered})</span></div>
            <div><b>{t.bestStreak}</b><span>best streak</span></div>
          </div>
          {data.items.length === 0 ? (
            <div className="empty">
              <p>No scored predictions yet.</p>
              <p className="muted">Open the match, answer a question during a break, and keep watching. Your points land here.</p>
              <a className="btn primary" href="#/matches">Go to matches</a>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Break</th><th>Your pick</th><th>Result</th><th>Points</th><th>Why</th></tr></thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.stoppageId}>
                      <td>{TYPE[r.type] ?? r.type}<br /><small>innings {r.innings}, {r.overs} overs</small></td>
                      <td>{r.pick}<br /><small>{r.question}</small></td>
                      <td className={r.correct === null ? "void" : r.correct ? "yes" : "no"}>{r.correct === null ? "Void" : r.correct ? "Right" : "Wrong"}</td>
                      <td>{r.points}</td>
                      <td>{r.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
