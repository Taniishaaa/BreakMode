import { useMemo } from "react";
import { useStore } from "../store";
import { Crest } from "./ui.jsx";

const chipClass = (l) =>
  l === "W" ? "ball w" : l === "4" || l === "6" ? "ball b" : l.endsWith("wd") || l === "nb" ? "ball x" : l === "•" ? "ball d" : "ball";

function Side({ team, idx, line, live }) {
  return (
    <div className={`side ${live ? "live" : ""}`}>
      <Crest name={team} idx={idx} size="md" />
      <div className="side-text">
        <span className="side-name">{team}</span>
        {line.score
          ? <span className="side-score"><b>{line.score}</b>{line.overs && <small>({line.overs})</small>}</span>
          : <span className="side-wait">{line.note}</span>}
      </div>
    </div>
  );
}

export default function ScoreBoard() {
  const { match, states, seq } = useStore();
  const { play } = useStore.getState();
  const s = seq >= 0 ? states[seq] : null;
  const [a, b] = match.teams;

  const firstInningsEnd = useMemo(() => {
    for (let i = match.events.length - 1; i >= 0; i--) if (match.events[i].innings === 1) return states[i];
    return null;
  }, [match, states]);

  const lineFor = (idx) => {
    if (!s) return { note: "Yet to bat" };
    if (s.innings - 1 === idx) return { score: `${s.runs}/${s.wickets}`, overs: `${s.overs} ov` };
    if (idx === 0) return { score: `${firstInningsEnd.runs}/${firstInningsEnd.wickets}`, overs: `${firstInningsEnd.overs} ov` };
    return { note: "Yet to bat" };
  };
  const batIdx = s ? s.innings - 1 : -1;

  return (
    <section className="scoreband" aria-label="Scoreboard">
      <div className="band-top">
        <span className="live-badge"><i aria-hidden="true" />Live demo replay</span>
        {match.synthetic && <span className="note">Synthetic match data, not real cricket.</span>}
      </div>

      <div className="sides" aria-live="polite">
        <Side team={a} idx={0} line={lineFor(0)} live={batIdx === 0} />
        <span className="vs" aria-hidden="true">v</span>
        <Side team={b} idx={1} line={lineFor(1)} live={batIdx === 1} />
      </div>

      {!s ? (
        <div className="idle">
          <p>Press start. Play pauses at wickets, reviews, timeouts and ad breaks, and a briefing appears.</p>
          <button className="btn primary" onClick={play}>Start replay</button>
        </div>
      ) : (
        <>
          <dl className="readouts">
            {s.target != null && (
              <>
                <div><dt>Target</dt><dd>{s.target}</dd></div>
                <div className="hot"><dt>Need</dt><dd>{Math.max(s.runsNeeded, 0)}</dd><span>off {s.ballsLeft} balls</span></div>
              </>
            )}
            <div><dt>Run rate</dt><dd>{s.crr.toFixed(2)}</dd></div>
            {s.rrr != null && <div className={s.rrr > s.crr ? "warn" : "good"}><dt>Required</dt><dd>{s.rrr.toFixed(2)}</dd></div>}
          </dl>
          <div className="last" aria-label="Last 12 balls">
            <span className="last-label">Last 12 balls</span>
            <div className="balls">{s.recent.map((l, i) => <span key={i} className={chipClass(l)}>{l}</span>)}</div>
          </div>
        </>
      )}
    </section>
  );
}
