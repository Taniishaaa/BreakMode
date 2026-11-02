import { useMemo } from "react";
import { buildInsights } from "@bm/engine";
import { useStore } from "../store";

/** Who is batting and bowling right now, from the engine's own numbers. */
export default function CreaseCard() {
  const { match, states, seq } = useStore();
  const I = useMemo(() => (seq >= 0 ? buildInsights(match, states, { type: "tick", afterSeq: seq }) : null), [match, states, seq]);

  return (
    <section className="crease" aria-label="At the crease">
      <div className="section-head"><h2>At the crease</h2></div>
      {!I ? <p className="muted">Batters and the bowler appear once the replay starts.</p> : (
        <>
          <table>
            <thead><tr><th>Batter</th><th>R</th><th>B</th><th>SR</th></tr></thead>
            <tbody>
              {I.crease.map((b) => (
                <tr key={b.name}><td>{b.name}</td><td>{b.runs}</td><td>{b.balls}</td><td>{b.strikeRate ?? "–"}</td></tr>
              ))}
            </tbody>
          </table>
          {I.stand.balls > 0 && <p className="stand">Stand: <b>{I.stand.runs}</b> off <b>{I.stand.balls}</b> balls</p>}
          {I.bowler && (
            <table>
              <thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
              <tbody>
                <tr><td>{I.bowler.name}</td><td>{I.bowler.overs}</td><td>{I.bowler.runs}</td><td>{I.bowler.wickets}</td><td>{I.bowler.economy ?? "–"}</td></tr>
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
