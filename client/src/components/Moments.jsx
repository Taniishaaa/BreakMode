import { useMemo } from "react";
import { label } from "@bm/engine";
import { useStore } from "../store";

const BREAK = {
  wicket: "Wicket briefing", review: "Review", strategic_timeout: "Strategic timeout", ad_break: "Ad break", innings_break: "Innings break",
};

/** Wickets, boundaries and breaks so far, newest first. */
export default function Moments() {
  const { match, states, seq, byAfterSeq } = useStore();

  const items = useMemo(() => {
    const out = [];
    for (let i = 0; i <= seq; i++) {
      const e = match.events[i], l = label(e), over = states[i].overs;
      if (e.wicket) {
        const how = e.wicket.kind + (e.wicket.fielders?.[0] ? ` ${e.wicket.fielders[0]}` : "");
        out.push({ key: `e${i}`, kind: "w", over, text: `${e.wicket.playerOut} out, ${how}${/run out/.test(e.wicket.kind) ? "" : ` b ${e.bowler}`}` });
      } else if (l === "6" || l === "4") {
        out.push({ key: `e${i}`, kind: l === "6" ? "six" : "four", over, text: `${e.batter} hits ${l === "6" ? "a six" : "a four"} off ${e.bowler}` });
      }
      const st = byAfterSeq[i];
      if (st && st.type !== "wicket") {
        out.push({ key: `s${i}`, kind: "brk", over, text: `${BREAK[st.type]}${st.source === "injected" ? " (simulated)" : ""}` });
      }
    }
    return out.reverse().slice(0, 40);
  }, [match, states, seq, byAfterSeq]);

  return (
    <section className="moments" aria-label="Key moments">
      <div className="section-head"><h2>Key moments</h2></div>
      {items.length === 0
        ? <p className="muted">Wickets, boundaries and breaks show up here as they happen.</p>
        : (
          <ol>
            {items.map((m) => (
              <li key={m.key} className={m.kind}>
                <span className="mo-over">{m.over}</span>
                <span className="mo-mark" aria-hidden="true" />
                <span className="mo-text">{m.text}</span>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
