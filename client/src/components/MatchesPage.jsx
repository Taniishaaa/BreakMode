import { useEffect, useState } from "react";
import { api } from "../api";
import { Crest, pct } from "./ui.jsx";

function MatchCard({ m }) {
  const [a, b] = m.teams;
  return (
    <a className="fixture" href={`#/match/${encodeURIComponent(m.id)}`} aria-label={`Open ${a} v ${b}`}>
      <div className="fixture-top">
        <span className="live-badge"><i aria-hidden="true" />Live demo replay</span>
        <span className="fmt">{m.format}</span>
      </div>
      <div className="fixture-teams">
        <div className="fteam"><Crest name={a} idx={0} size="lg" /><span>{a}</span></div>
        <span className="fvs">v</span>
        <div className="fteam"><Crest name={b} idx={1} size="lg" /><span>{b}</span></div>
      </div>
      <ul className="fixture-facts">
        <li><b>{m.breaks}</b> break briefings</li>
        <li><b>{m.wickets}</b> wickets</li>
        <li><b>{m.reviews}</b> DRS {m.reviews === 1 ? "review" : "reviews"}</li>
      </ul>
      <div className="fixture-foot">
        <span className="open">Open match</span>
        {m.synthetic && <span className="note">Synthetic data, not a real match.</span>}
      </div>
    </a>
  );
}

const STEPS = [
  ["Play stops", "A wicket, review, timeout or ad break pauses the replay."],
  ["You get a briefing", "What happened, why it matters and what to watch next."],
  ["You call the next balls", "Pick an answer. Points arrive when play resumes."],
];

export default function MatchesPage() {
  const [matches, setMatches] = useState(null);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.matches().then((r) => setMatches(r.matches)).catch((e) => setError(e.message));
    api.history().then(setRecord).catch(() => {});
  }, []);

  const t = record?.totals;
  return (
    <div className="page matches-page">
      <header className="page-head">
        <h1>Matches</h1>
        <p className="muted">Open a match to replay it ball by ball with Break Mode.</p>
      </header>

      <div className="matches-grid">
        <section aria-label="Available matches">
          {error && <p className="error">Could not load matches: {error}</p>}
          {!matches && !error && <div className="fixture skeleton" aria-busy="true" />}
          {matches?.map((m) => <MatchCard key={m.id} m={m} />)}
        </section>

        <aside className="side-stack">
          <section className="panel-lite">
            <h2>Your record</h2>
            {t && t.answered > 0 ? (
              <div className="record">
                <div><b>{t.points}</b><span>points</span></div>
                <div><b>{pct(t.accuracy)}</b><span>accuracy</span></div>
                <div><b>{t.bestStreak}</b><span>best streak</span></div>
              </div>
            ) : <p className="muted">No scored predictions yet. Open the match and answer a break question.</p>}
          </section>

          <section className="panel-lite">
            <h2>How a break works</h2>
            <ol className="steps">
              {STEPS.map(([title, text]) => <li key={title}><b>{title}</b><span>{text}</span></li>)}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
