/**
 * Deterministic state timeline. Nothing here ever touches an LLM.
 * states[seq] is the match state AFTER delivery `seq`.
 */
const NOT_BOWLER = new Set(["run out", "retired hurt", "retired out", "obstructing the field"]);

/** @param {number} legalBalls @param {number} bpo balls per over */
export function oversStr(legalBalls, bpo = 6) {
  return `${Math.floor(legalBalls / bpo)}.${legalBalls % bpo}`;
}

/** Short label for one delivery, used by the timeline and "last 12 balls". */
export function label(e) {
  if (e.wicket) return "W";
  if (e.extraType === "wides") return e.runsTotal > 1 ? `${e.runsTotal}wd` : "wd";
  if (e.extraType === "noballs") return "nb";
  if (e.runsBatter === 4) return "4";
  if (e.runsBatter === 6) return "6";
  return e.runsTotal === 0 ? "•" : String(e.runsTotal);
}

function fresh(match, inn) {
  return {
    innings: inn, seq: -1, runs: 0, wickets: 0, legalBalls: 0,
    target: inn === 2 ? match.innings[1]?.target?.runs ?? null : null,
    batters: {}, bowlers: {}, recent: [],
  };
}

function apply(match, s, e) {
  const maxBalls = match.maxOvers * match.ballsPerOver;
  const legalBalls = s.legalBalls + (e.legal ? 1 : 0);
  const runs = s.runs + e.runsTotal;
  const wickets = s.wickets + (e.wicket ? 1 : 0);

  const b = s.batters[e.batter] ?? { runs: 0, balls: 0 };
  const faced = e.extraType === "wides" ? 0 : 1;
  const batters = { ...s.batters, [e.batter]: { runs: b.runs + e.runsBatter, balls: b.balls + faced } };

  const w = s.bowlers[e.bowler] ?? { runs: 0, balls: 0, wickets: 0 };
  const byeLike = e.extraType === "byes" || e.extraType === "legbyes";
  const conceded = e.runsTotal - (byeLike ? e.runsExtras : 0);
  const credited = e.wicket && !NOT_BOWLER.has(e.wicket.kind) ? 1 : 0;
  const bowlers = {
    ...s.bowlers,
    [e.bowler]: { runs: w.runs + conceded, balls: w.balls + (e.legal ? 1 : 0), wickets: w.wickets + credited },
  };

  const ballsLeft = maxBalls - legalBalls;
  const runsNeeded = s.target != null ? s.target - runs : null;
  return {
    ...s, seq: e.seq, runs, wickets, legalBalls, batters, bowlers,
    recent: [...s.recent, label(e)].slice(-12),
    ballsLeft, runsNeeded,
    crr: legalBalls ? +(runs / (legalBalls / 6)).toFixed(2) : 0,
    rrr: runsNeeded != null && ballsLeft > 0 ? +(runsNeeded / (ballsLeft / 6)).toFixed(2) : null,
    overs: oversStr(legalBalls, match.ballsPerOver),
    atCrease: [e.batter, e.nonStriker],
  };
}

/** @returns {object[]} one state per delivery; states[seq] is the state after that delivery */
export function buildTimeline(match) {
  const states = [];
  let s = null, inn = 0;
  for (const e of match.events) {
    if (e.innings !== inn) { inn = e.innings; s = fresh(match, inn); }
    s = apply(match, s, e);
    states.push(s);
  }
  return states;
}
