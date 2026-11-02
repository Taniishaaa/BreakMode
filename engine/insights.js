import { BANDS, PHASE_END, phaseOf } from "./questions.js";
import { oversStr } from "./timeline.js";
import { reviewKey } from "./reviews.js";

/**
 * Grounded match facts for one stoppage. Pure code, no model: the template card writes from these,
 * and the AI card is given the same object, so every number a card may quote is computed here once.
 *
 * It reads the state at st.afterSeq. The only look-ahead is the NAME of the incoming batter after a wicket
 * (a fan watching the broadcast sees who walks out); no later score, ball or review result is read.
 */
const r2 = (n) => Math.round(n * 100) / 100;
const perOver = (runs, balls, bpo) => (balls > 0 ? r2(runs / (balls / bpo)) : null);
const strikeRate = (runs, balls) => (balls > 0 ? Math.round((runs / balls) * 100) : null);
const isBoundary = (e) => e.runsBatter === 4 || e.runsBatter === 6;

/** Runs, boundaries, dots and wickets over the most recent `n` legal balls. */
function windowOf(evs, n, bpo) {
  const w = { balls: 0, runs: 0, boundaries: 0, dots: 0, wickets: 0 };
  for (let i = evs.length - 1; i >= 0 && w.balls < n; i--) {
    const e = evs[i];
    w.runs += e.runsTotal;
    if (e.wicket) w.wickets++;
    if (isBoundary(e)) w.boundaries++;
    if (e.legal) { w.balls++; if (e.runsTotal === 0) w.dots++; }
  }
  w.rate = perOver(w.runs, w.balls, bpo);
  return w;
}

/** The current stand: everything since the previous wicket. `endsWithWicket` means evs' last ball is the wicket. */
function standOf(evs, endsWithWicket) {
  const before = endsWithWicket ? evs.slice(0, -1) : evs;
  let start = 0;
  for (let i = before.length - 1; i >= 0; i--) if (before[i].wicket) { start = i + 1; break; }
  const seg = evs.slice(start);
  return { runs: seg.reduce((a, e) => a + e.runsTotal, 0), balls: seg.filter((e) => e.legal).length };
}

function incomingAfter(match, afterSeq, innings, known) {
  for (let i = afterSeq + 1; i < match.events.length; i++) {
    const e = match.events[i];
    if (e.innings !== innings) return null;
    for (const n of [e.batter, e.nonStriker]) if (!known.has(n)) return n;
  }
  return null;
}

export function buildInsights(match, states, st) {
  const s = states[st.afterSeq];
  const bpo = match.ballsPerOver, maxBalls = match.maxOvers * bpo;
  const isBreak = st.type === "innings_break";
  const evs = match.events.filter((e) => e.innings === s.innings && e.seq <= st.afterSeq);
  const last = evs.at(-1);
  const isWicket = st.type === "wicket" && !!last?.wicket;
  const out = isWicket ? last.wicket.playerOut : null;
  const justOut = last?.wicket?.playerOut ?? null; // whoever left on the last ball, for any stoppage type

  const batter = (name) => {
    const b = s.batters[name] ?? { runs: 0, balls: 0 };
    return { name, runs: b.runs, balls: b.balls, strikeRate: strikeRate(b.runs, b.balls) };
  };
  const bowler = (name) => {
    const w = s.bowlers[name] ?? { runs: 0, balls: 0, wickets: 0 };
    const quota = match.maxOvers % 5 === 0 ? (match.maxOvers / 5) * bpo : null; // 4 overs in a T20
    return {
      name, wickets: w.wickets, runs: w.runs, overs: oversStr(w.balls, bpo), economy: perOver(w.runs, w.balls, bpo),
      oversLeft: quota != null ? oversStr(Math.max(quota - w.balls, 0), bpo) : null,
    };
  };

  const crease = isBreak ? [] : s.atCrease.filter((n) => n !== justOut).map(batter);
  const phase = phaseOf(s.legalBalls);
  const phaseEnd = phase === "death" ? maxBalls : PHASE_END[phase];
  const chase = s.target != null && !isBreak;
  const wicketsInHand = 10 - s.wickets;
  const win = windowOf(evs, bpo * 2, bpo);

  const benchmark = chase ? s.rrr : s.crr;
  const diff = win.rate != null && benchmark != null && win.balls >= bpo ? win.rate - benchmark : 0;
  const momentum = diff > 1.5 ? "batting" : diff < -1.5 ? "bowling" : "even";

  const [lo, hi] = BANDS[phase];
  const canProject = !isBreak && maxBalls - s.legalBalls >= bpo;
  const rrrAfter = (r) => {
    const left = s.ballsLeft - bpo, need = s.runsNeeded - r;
    return left > 0 && need > 0 ? r2(need / (left / bpo)) : null;
  };
  const rateAfter = (r) => r2((s.runs + r) / ((s.legalBalls + bpo) / bpo));
  const next = canProject ? {
    balls: bpo, low: lo, high: hi + 1,
    rrrIfLow: chase ? rrrAfter(lo) : null, rrrIfHigh: chase ? rrrAfter(hi + 1) : null,
    rateIfLow: chase ? null : rateAfter(lo), rateIfHigh: chase ? null : rateAfter(hi + 1),
  } : null;

  const stand = standOf(evs, isWicket);
  const lastBowler = last ? bowler(st.type === "review" && st.review?.bowler ? st.review.bowler : last.bowler) : null;

  const insights = {
    phase, phaseBallsLeft: Math.max(phaseEnd - s.legalBalls, 0),
    phaseJustChanged: s.legalBalls > 0 && Object.values(PHASE_END).includes(s.legalBalls),
    powerplayOvers: PHASE_END.powerplay / bpo,
    chase, wicketsInHand,
    window: win, momentum,
    par: { low: lo + 1, high: hi },
    parStatus: !chase && s.crr > hi ? "above" : !chase && s.crr < lo + 1 ? "below" : "inside",
    pace: !chase && !isBreak && s.legalBalls >= bpo * 2 ? Math.round(s.crr * match.maxOvers) : null,
    rateGap: chase && s.rrr != null ? r2(s.rrr - s.crr) : null,
    rateGapAbs: chase && s.rrr != null ? Math.abs(r2(s.rrr - s.crr)) : null,
    stand, crease, bowler: isBreak ? null : lastBowler,
    ballsLeftInOver: s.legalBalls % bpo ? bpo - (s.legalBalls % bpo) : 0,
    next,
  };

  if (isWicket) {
    const partner = crease[0] ?? null;
    insights.wicket = {
      batter: batter(out), kind: last.wicket.kind, fielders: last.wicket.fielders ?? [],
      bowlerCredited: !["run out", "retired hurt", "retired out", "obstructing the field"].includes(last.wicket.kind),
      partner, fallNumber: s.wickets,
      incoming: incomingAfter(match, st.afterSeq, s.innings, new Set([...Object.keys(s.batters), ...s.atCrease])),
    };
  }

  if (st.type === "review" && st.review) {
    const who = batter(st.review.batter);
    const partner = crease.find((c) => c.name !== who.name) ?? null;
    insights.review = {
      batter: who, partner, key: reviewKey(st.review.kind),
      byBattingSide: st.review.by === match.innings[s.innings - 1].team,
      wicketsInHandIfOut: Math.max(wicketsInHand - 1, 0),
    };
  }

  if (isBreak) {
    const batters = Object.entries(s.batters).map(([name, b]) => ({ name, ...b, strikeRate: strikeRate(b.runs, b.balls) }));
    const top = batters.sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0] ?? null;
    const bowlers = Object.keys(s.bowlers).filter((n) => s.bowlers[n].balls >= bpo).map(bowler)
      .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
    const target = match.innings[1]?.target?.runs ?? s.runs + 1;
    const startRate = r2(target / match.maxOvers);
    insights.innings = {
      top, bestBowler: bowlers[0] ?? null,
      boundaries: evs.filter(isBoundary).length,
      finish: windowOf(evs, bpo * 5, bpo), // the last five overs
      chaser: match.innings[1]?.team ?? null, target, startRate,
      powerplayPar: Math.round(startRate * (PHASE_END.powerplay / bpo)),
      fasterThanFirst: startRate > s.crr,
    };
  }
  return insights;
}
