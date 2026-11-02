import { buildInsights } from "./insights.js";

/**
 * Everything the model may see. It is built ONLY from state at st.afterSeq:
 * nothing from later deliveries (including a reviewed delivery's result) is included.
 */
export function buildContext(match, states, st, specs, team = "any") {
  const s = states[st.afterSeq];
  const isBreak = st.type === "innings_break";
  const e = match.events[st.afterSeq];
  const out = e?.wicket?.playerOut;
  const battingTeam = match.innings[s.innings - 1].team;
  const insights = buildInsights(match, states, st);
  const missing = ["pitch conditions", "player form", "weather"];
  if (st.type === "wicket" && !insights.wicket?.incoming) missing.push("incoming batter");
  if (st.review && st.review.kind === "unknown") missing.push("type of review");

  return {
    stoppage: { type: st.type, source: st.source },
    teams: match.teams, battingTeam, favouriteTeam: team,
    innings: s.innings,
    maxOvers: match.maxOvers, ballsPerOver: match.ballsPerOver,
    state: {
      runs: s.runs, wickets: s.wickets, overs: s.overs, ballsLeft: s.ballsLeft,
      target: s.target, runsNeeded: s.runsNeeded, currentRate: s.crr, requiredRate: s.rrr,
    },
    upcomingTarget: isBreak ? match.innings[1]?.target?.runs ?? s.runs + 1 : null,
    lastBalls: s.recent,
    dismissal: st.type === "wicket" && e?.wicket
      ? { batter: out, how: e.wicket.kind, bowler: e.bowler, fielders: e.wicket.fielders ?? [] } : null,
    atCrease: isBreak ? [] : s.atCrease.filter((n) => n !== out)
      .map((n) => ({ name: n, ...(s.batters[n] ?? { runs: 0, balls: 0 }) })),
    candidates: specs.map((q) => ({ id: q.id, kind: q.kind, options: q.options.map((o) => o.labelEn) })),
    review: st.review ? { by: st.review.by, batter: st.review.batter, bowler: st.review.bowler, kind: st.review.kind } : null,
    insights,
    missing,
  };
}
