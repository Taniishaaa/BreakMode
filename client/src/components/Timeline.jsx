import { useStore } from "../store";
import { label } from "@bm/engine";

const cls = (l) =>
  l === "W" ? "w" : l === "6" ? "six" : l === "4" ? "four" : l === "•" ? "zero" : l === "nb" || l.endsWith("wd") ? "ext" : "run";

const STOP_NAME = {
  wicket: "Wicket", review: "Review", strategic_timeout: "Strategic timeout",
  ad_break: "Ad break", innings_break: "Innings break",
};

/** A scorebook: one column per over, one bar per delivery. Gaps in the strip are the breaks. */
function Row({ inn, team }) {
  const { match, states, seq, byAfterSeq } = useStore();
  const evs = match.events.filter((e) => e.innings === inn && e.seq <= seq);
  const overs = Array.from({ length: match.maxOvers }, (_, o) => evs.filter((e) => e.over === o));
  const last = evs.at(-1);
  const total = last ? states[last.seq] : null;

  return (
    <div className="trow">
      <div className="thead">
        <span className="tteam">{team}</span>
        <span className="ttotal">{total ? `${total.runs}/${total.wickets}` : "–"}</span>
      </div>
      <div className="tstrip" style={{ "--overs": match.maxOvers }}>
        {overs.map((balls, o) => (
          <div key={o} className={`over ${balls.length ? "" : "blank"}`}>
            {balls.length === 0 && Array.from({ length: 6 }, (_, i) => <span key={i} className="tb ghost" />)}
            {balls.map((e) => {
              const st = byAfterSeq[e.seq];
              return (
                <span key={e.seq} className="tcell">
                  <span className={`tb ${cls(label(e))}`} title={`${e.batter}: ${label(e)}`} />
                  {st && <i className={`stop ${st.type} ${st.source}`} title={`${STOP_NAME[st.type]}${st.source === "injected" ? " (simulated)" : ""}`} />}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="taxis" style={{ "--overs": match.maxOvers }} aria-hidden="true">
        {overs.map((_, o) => <span key={o}>{(o + 1) % 5 === 0 ? o + 1 : ""}</span>)}
      </div>
    </div>
  );
}

export default function Timeline() {
  const match = useStore((s) => s.match);
  return (
    <section className="timeline" aria-label="Ball-by-ball scorebook">
      <div className="section-head">
        <h2>Scorebook</h2>
        <p className="legend">
          <span><i className="stop data" />Break from match data</span>
          <span><i className="stop injected" />Simulated break</span>
        </p>
      </div>
      {[1, 2].map((inn) => <Row key={inn} inn={inn} team={match.innings[inn - 1].team} />)}
    </section>
  );
}
