import { optionFor } from "./questions.js";

/** Walk the "next N legal balls" window. Returns the totals and the last seq consumed. */
function walkWindow(match, spec) {
  const ev = match.events;
  let i = spec.window.fromSeq, legal = 0, runs = 0, wkts = 0, fours = 0, sixes = 0, extras = 0, lastSeq = null;
  const inn = ev[i]?.innings;
  while (i < ev.length && ev[i].innings === inn && legal < spec.window.legalBalls) {
    const e = ev[i];
    runs += e.runsTotal; extras += e.runsExtras;
    if (e.wicket) wkts++;
    if (e.runsBatter === 4) fours++;
    if (e.runsBatter === 6) sixes++;
    if (e.legal) legal++;
    lastSeq = e.seq;
    i++;
  }
  const complete = legal >= spec.window.legalBalls;
  const lastOfInnings = inn == null ? ev.length - 1 : Math.max(...ev.filter((e) => e.innings === inn).map((e) => e.seq));
  return { complete, runs, wkts, fours, sixes, extras, lastSeq, lastOfInnings };
}

/**
 * The replay position (seq) at which a question can be resolved and revealed.
 * @returns {number}
 */
export function resolveAtSeq(match, spec) {
  if (spec.kind === "review_outcome") return spec.window.atSeq;
  if (spec.kind === "chase_result") return match.events.length - 1;
  const w = walkWindow(match, spec);
  return w.complete ? w.lastSeq : w.lastOfInnings;
}

/** @returns {{status:"resolved"|"void", correctOptionId?:string, facts?:object, reason?:string}} */
export function resolveQuestion(match, spec) {
  if (spec.kind === "review_outcome") {
    const e = match.events[spec.window.atSeq];
    // "upheld" = the review succeeded, so the on-field decision changed. Umpire's call keeps it.
    // VERIFY this mapping against a review whose result you know from the real match.
    const overturned = e.review.decision === "upheld" && !e.review.umpiresCall;
    return { status: "resolved", correctOptionId: overturned ? "changes" : "stays",
             facts: { decision: e.review.decision, umpiresCall: !!e.review.umpiresCall, overturned } };
  }
  if (spec.kind === "chase_result") {
    const o = match.outcome;
    if (!o?.winner) return { status: "void", reason: "The match had no result" };
    const won = o.winner === match.innings[1].team;
    return { status: "resolved", correctOptionId: won ? "yes" : "no", facts: { winner: o.winner, by: o.by ?? null } };
  }
  const w = walkWindow(match, spec);
  if (!w.complete) return { status: "void", reason: "The innings ended first" };
  const correctOptionId = spec.kind === "next6_runs" ? optionFor(w.runs, spec.params) : w.wkts > 0 ? "yes" : "no";
  return { status: "resolved", correctOptionId,
           facts: { runs: w.runs, wkts: w.wkts, fours: w.fours, sixes: w.sixes, extras: w.extras } };
}

const plural = (n, w, pl = `${w}s`) => `${n} ${n === 1 ? w : pl}`;

/** Plain-English "why" line, built by code (never by the model). */
export function explain(spec, res, optionId, optionLabel) {
  if (res.status === "void") return `Void: ${res.reason}.`;
  const f = res.facts;
  const right = optionId === res.correctOptionId;
  const lead = right ? "Right" : "Not this time";
  if (spec.kind === "review_outcome") {
    return `${lead}: the review ${f.overturned ? "changed" : "kept"} the on-field decision${f.umpiresCall ? " (umpire's call)" : ""}.`;
  }
  if (spec.kind === "chase_result") {
    const by = f.by?.wickets != null ? ` by ${plural(f.by.wickets, "wicket")}` : f.by?.runs != null ? ` by ${plural(f.by.runs, "run")}` : "";
    return `${lead}: you picked "${optionLabel}". ${f.winner} won${by}.`;
  }
  const bits = [
    plural(f.runs, "run"),
    f.wkts ? plural(f.wkts, "wicket") : null,
    f.fours ? plural(f.fours, "four") : null,
    f.sixes ? plural(f.sixes, "six", "sixes") : null,
    f.extras ? plural(f.extras, "extra") : null,
  ].filter(Boolean);
  return `${lead}: you picked "${optionLabel}". The next 6 balls gave ${bits.join(", ")}.`;
}
