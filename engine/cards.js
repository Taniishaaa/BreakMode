import { reviewLines } from "./reviews.js";

/**
 * Template cards. These are used instantly on the client, as the fallback when the AI fails, and as the
 * whole product when no API key is set, so they have to be genuinely useful on their own.
 *
 * Every card answers the same three fan questions:
 *   recap          what just happened
 *   why_it_matters what it changes, with numbers from ctx.insights
 *   watch_next     what to look for in the next few balls, with a player and a threshold
 * Every number written here comes from ctx (see grounding.js), and nothing predicts the result.
 */
export const CARD_LIMITS = { headline: 100, recap: 200, why: 320, watch: 320, explainer: 240, uncertainty: 120 };

const plural = (n, one, many) => (n === 1 ? one : many);
const PHASE = { powerplay: "powerplay", middle: "middle overs", death: "death overs" };

/** Keep joining sentences until the limit; the first part is always kept. */
const fit = (parts, max) => {
  let out = "";
  for (const p of parts.filter(Boolean)) {
    const next = out ? `${out} ${p}` : p;
    if (next.length > max && out) break;
    out = next;
  }
  return out;
};

const hot = (crease) => [...crease].sort((a, b) => b.runs - a.runs || b.balls - a.balls)[0] ?? null;
const figure = (b) => `${b.name} (${b.runs} off ${b.balls}${b.strikeRate != null ? `, strike rate ${b.strikeRate}` : ""})`;

/** What the next 6 balls would do to the required rate (chase) or the run rate (first innings). */
function threshold(I, t, who) {
  const n = I.next;
  if (!n) return null;
  if (I.chase && n.rrrIfHigh != null && n.rrrIfLow != null) {
    return t(
      `${who}: ${n.high} or more in the next ${n.balls} balls brings the required rate down to ${n.rrrIfHigh}; ${n.low} or fewer lets it climb to ${n.rrrIfLow}.`,
      `${who}: agli ${n.balls} gend mein ${n.high} ya zyada run se required rate ${n.rrrIfHigh} tak aayega; ${n.low} ya kam par wo ${n.rrrIfLow} tak chadh jayega.`);
  }
  if (!I.chase && n.rateIfHigh != null) {
    return t(
      `${who}: ${n.high} or more in the next ${n.balls} balls lifts the run rate to ${n.rateIfHigh}; ${n.low} or fewer drops it to ${n.rateIfLow}.`,
      `${who}: agli ${n.balls} gend mein ${n.high} ya zyada run se run rate ${n.rateIfHigh} hoga; ${n.low} ya kam par ${n.rateIfLow} reh jayega.`);
  }
  return null;
}

function dismissal(W, bw, t) {
  const o = W.batter.name, f = W.fielders[0], k = W.kind;
  const made = t(`${o} made ${W.batter.runs} off ${W.batter.balls}.`, `${o} ne ${W.batter.runs} run banaye (${W.batter.balls} gend).`);
  let what;
  if (/caught and bowled/.test(k)) what = t(`${bw.name} takes a caught-and-bowled to remove ${o}.`, `${bw.name} ne apni hi gend par catch pakad ke ${o} ko out kiya.`);
  else if (/^caught/.test(k)) what = f ? t(`${f} catches ${o} off ${bw.name}.`, `${bw.name} ki gend par ${f} ne ${o} ka catch pakda.`) : t(`${o} is caught off ${bw.name}.`, `${bw.name} ki gend par ${o} catch out.`);
  else if (k === "bowled") what = t(`${bw.name} bowls ${o}.`, `${bw.name} ne ${o} ko bowled kiya.`);
  else if (k === "lbw") what = t(`${bw.name} traps ${o} lbw.`, `${bw.name} ne ${o} ko lbw kiya.`);
  else if (k === "run out") what = t(`${o} is run out${f ? `, with ${f} involved` : ""}.`, `${o} run out ho gaye${f ? ` (${f})` : ""}.`);
  else if (k === "stumped") what = t(`${o} is stumped off ${bw.name}.`, `${bw.name} ki gend par ${o} stumped.`);
  else what = t(`${o} is out (${k}).`, `${o} out hue (${k}).`);
  return `${what} ${made}`;
}

function wicketCard(ctx, t) {
  const s = ctx.state, I = ctx.insights, W = I.wicket, team = ctx.battingTeam, bw = I.bowler;
  const o = W.batter, p = W.partner, win = I.window;

  const recap = [dismissal(W, bw, t)];
  if (I.stand.balls > 0) {
    recap.push(t(`That ends a stand of ${I.stand.runs} off ${I.stand.balls} balls${p ? ` with ${p.name}` : ""}.`,
      `${I.stand.runs} run (${I.stand.balls} gend) ki partnership tooti${p ? ` (${p.name} ke saath)` : ""}.`));
  }
  if (win.wickets >= 2) recap.push(t(`That is ${win.wickets} wickets in the last ${win.balls} balls.`, `Pichli ${win.balls} gend mein ${win.wickets} wicket gire hain.`));
  else if (W.bowlerCredited) recap.push(t(`${bw.name} now has ${bw.wickets}/${bw.runs} from ${bw.overs} overs.`, `${bw.name} ke figures ab ${bw.wickets}/${bw.runs} (${bw.overs} over).`));
  else recap.push(t(`${team} are ${s.runs}/${s.wickets} after ${s.overs} overs.`, `${team} ${s.runs}/${s.wickets} (${s.overs} over).`));

  let why;
  if (I.chase) {
    why = I.rateGap > 0
      ? t(`${team} have ${I.wicketsInHand} wickets left and need ${s.runsNeeded} from ${s.ballsLeft} balls: ${s.requiredRate} an over, against the ${s.currentRate} they have managed so far. The required rate is ${I.rateGapAbs} above their pace, so there is little room for a slow start.`,
          `${team} ke ${I.wicketsInHand} wicket bache hain aur ${s.ballsLeft} gend mein ${s.runsNeeded} run chahiye: ${s.requiredRate} per over, jabki ab tak ${s.currentRate} ki raftaar rahi hai. Required rate unki raftaar se ${I.rateGapAbs} upar hai, isliye dheemi shuruaat ki gunjaish kam hai.`)
      : t(`${team} are scoring faster than the ${s.requiredRate} they need (${s.currentRate} so far), so ${s.runsNeeded} from ${s.ballsLeft} balls is still on the rate. The wicket costs them cover rather than runs: ${I.wicketsInHand} wickets are left.`,
          `${team} ${s.currentRate} per over se khel rahe hain, jo zaroori ${s.requiredRate} se tez hai, isliye ${s.ballsLeft} gend mein ${s.runsNeeded} run abhi rate par hain. Wicket se run nahi, cushion ghata hai: ${I.wicketsInHand} wicket bache hain.`);
  } else {
    const vsPar = {
      above: t("above par", "par se upar"), below: t("below par", "par se neeche"), inside: t("on par", "par par"),
    }[I.parStatus];
    why = t(`${team} are ${s.wickets} down, scoring ${s.currentRate} an over${I.pace ? ` (projected ${I.pace})` : ""}. A par over in the ${PHASE[I.phase]} is ${I.par.low} to ${I.par.high}, so they are ${vsPar} with ${I.wicketsInHand} wickets in hand.`,
      `${team} ${s.wickets} wicket down hain, ${s.currentRate} per over ki raftaar${I.pace ? ` (projected ${I.pace})` : ""}. ${PHASE[I.phase][0].toUpperCase()}${PHASE[I.phase].slice(1)} mein ek par over ${I.par.low} se ${I.par.high} run ka hota hai, isliye ve ${vsPar} hain, ${I.wicketsInHand} wicket haath mein.`);
  }

  const who = W.incoming ?? t("The new batter", "Naya batter");
  const join = t(`${who} joins ${p ? figure(p) : "the crease"}.`, `${who} ab ${p ? figure(p) : "crease par"} ke saath hain.`);
  const job = threshold(I, t, t(`${who}'s job`, `${who} ka kaam`))
    ?? t(`The first ${ctx.ballsPerOver} balls after a wicket set the tone.`, `Wicket ke baad ki pehli ${ctx.ballsPerOver} gend tone set karti hain.`);
  const pp = I.phase === "powerplay" && I.phaseBallsLeft > 0
    ? t(`${I.phaseBallsLeft} balls of the powerplay are left.`, `Powerplay ki ${I.phaseBallsLeft} gend baaki hain.`) : "";

  return {
    headline: t(`${o.name} out for ${o.runs}: ${team} ${s.runs}/${s.wickets}`, `${o.name} out, ${o.runs} par: ${team} ${s.runs}/${s.wickets}`),
    recap, why_it_matters: why, watch_next: fit([join, job, pp], CARD_LIMITS.watch),
  };
}

function momentumCard(ctx, t) {
  const s = ctx.state, I = ctx.insights, team = ctx.battingTeam, win = I.window, c = I.crease, h = hot(c);
  const tag = { batting: t("batters on top", "batters ka dabdaba"), bowling: t("bowlers on top", "gendbaazon ka dabdaba"), even: t("evenly poised", "barabar ki takkar") }[I.momentum];

  const recap = [t(`Last ${win.balls} balls: ${win.runs} runs, ${win.boundaries} ${plural(win.boundaries, "boundary", "boundaries")}, ${win.dots} dots${win.wickets ? `, ${win.wickets} ${plural(win.wickets, "wicket", "wickets")}` : ""}.`,
    `Pichli ${win.balls} gend: ${win.runs} run, ${win.boundaries} ${plural(win.boundaries, "boundary", "boundaries")}, ${win.dots} dot${win.wickets ? `, ${win.wickets} wicket` : ""}.`)];
  if (c.length === 2) {
    recap.push(t(`At the crease: ${c[0].name} ${c[0].runs} (${c[0].balls}) and ${c[1].name} ${c[1].runs} (${c[1].balls})${I.stand.balls ? `, together ${I.stand.runs} off ${I.stand.balls}` : ""}.`,
      `Crease par: ${c[0].name} ${c[0].runs} (${c[0].balls}) aur ${c[1].name} ${c[1].runs} (${c[1].balls})${I.stand.balls ? `, saath mein ${I.stand.runs} (${I.stand.balls} gend)` : ""}.`));
  }
  recap.push(I.chase
    ? t(`Need ${Math.max(s.runsNeeded, 0)} from ${s.ballsLeft} balls.`, `${s.ballsLeft} gend mein ${Math.max(s.runsNeeded, 0)} run chahiye.`)
    : t(`Run rate ${s.currentRate}${I.pace ? `, projected ${I.pace}` : ""}.`, `Run rate ${s.currentRate}${I.pace ? `, projected ${I.pace}` : ""}.`));

  const M = I.momentum, left = `${s.runsNeeded} from ${s.ballsLeft}`;
  let why;
  if (I.chase) {
    const lead = t(`In the last ${win.balls} balls ${team} have scored at ${win.rate} an over`, `Pichli ${win.balls} gend mein ${team} ne ${win.rate} per over ki raftaar se run banaye`);
    const tail = t(`${left} with ${I.wicketsInHand} wickets in hand.`, `${s.ballsLeft} gend mein ${s.runsNeeded} run, ${I.wicketsInHand} wicket haath mein.`);
    why = M === "batting"
      ? t(`${lead}, ahead of the ${s.requiredRate} they need. The equation is easing: ${tail}`, `${lead}, jo zaroori ${s.requiredRate} se tez hai. Equation halka ho raha hai: ${tail}`)
      : M === "bowling"
        ? t(`${lead}, short of the ${s.requiredRate} they need. The equation is tightening: ${tail}`, `${lead}, jo zaroori ${s.requiredRate} se kam hai. Equation tang ho raha hai: ${tail}`)
        : t(`${lead}, close to the ${s.requiredRate} they need. The equation is holding steady: ${tail}`, `${lead}, jo zaroori ${s.requiredRate} ke kareeb hai. Equation sthir hai: ${tail}`);
  } else {
    const lead = t(`${team} scored at ${win.rate} an over in the last ${win.balls} balls`, `${team} ne pichli ${win.balls} gend mein ${win.rate} per over ki raftaar se run banaye`);
    const hand = t(`${I.wicketsInHand} wickets are in hand.`, `${I.wicketsInHand} wicket haath mein hain.`);
    why = M === "batting"
      ? t(`${lead}, faster than their ${s.currentRate} for the innings, so they are accelerating. ${hand}`, `${lead}, jo innings ke ${s.currentRate} se tez hai, yaani raftaar badh rahi hai. ${hand}`)
      : M === "bowling"
        ? t(`${lead}, slower than their ${s.currentRate} for the innings, so the bowlers have squeezed the scoring. ${hand}`, `${lead}, jo innings ke ${s.currentRate} se dheema hai, yaani gendbaazon ne run rok diye hain. ${hand}`)
        : t(`${lead}, in line with their ${s.currentRate} for the innings, so the scoring has held steady. ${hand}`, `${lead}, jo innings ke ${s.currentRate} ke aaspaas hai, yaani scoring sthir rahi. ${hand}`);
  }

  const phase = I.phaseJustChanged
    ? (I.phase === "middle" ? t("The powerplay has just ended.", "Powerplay abhi khatam hua hai.") : t("The death overs begin now.", "Death overs ab shuru hote hain."))
    : I.phase === "powerplay" && I.phaseBallsLeft > 0 ? t(`${I.phaseBallsLeft} balls of the powerplay are left.`, `Powerplay ki ${I.phaseBallsLeft} gend baaki hain.`) : "";
  const watch = h
    ? fit([threshold(I, t, t(`${figure(h)} is the one to watch`, `${figure(h)} par nazar rakhein`)), phase], CARD_LIMITS.watch)
    : fit([phase], CARD_LIMITS.watch);

  return {
    headline: t(`${team} ${s.runs}/${s.wickets} after ${s.overs}: ${tag}`, `${team} ${s.runs}/${s.wickets} (${s.overs}): ${tag}`),
    recap, why_it_matters: why,
    watch_next: watch || t(`Watch the next ${ctx.ballsPerOver} balls.`, `Agli ${ctx.ballsPerOver} gend par nazar rakhein.`),
  };
}

function inningsBreakCard(ctx, t) {
  const s = ctx.state, I = ctx.insights, N = I.innings, team = ctx.battingTeam;
  const recap = [];
  if (N.top) recap.push(t(`${N.top.name} top-scored with ${N.top.runs} off ${N.top.balls}.`, `${N.top.name} ne sabse zyada ${N.top.runs} run banaye (${N.top.balls} gend).`));
  if (N.bestBowler) recap.push(t(`${N.bestBowler.name} was the pick of the bowlers with ${N.bestBowler.wickets}/${N.bestBowler.runs} from ${N.bestBowler.overs} overs.`,
    `Gendbaazon mein ${N.bestBowler.name} sabse behtar rahe: ${N.bestBowler.wickets}/${N.bestBowler.runs} (${N.bestBowler.overs} over).`));
  recap.push(t(`${N.boundaries} boundaries in the innings, and ${N.finish.runs} runs from the last ${N.finish.balls} balls.`,
    `Innings mein ${N.boundaries} boundaries, aur aakhri ${N.finish.balls} gend mein ${N.finish.runs} run.`));

  const why = t(`${N.chaser} need ${N.target} from ${ctx.maxOvers} overs: ${N.startRate} an over from the first ball, against the ${s.currentRate} that ${team} managed. ${N.fasterThanFirst ? "The chase has to be quicker than the first innings." : "That is a gentler rate than the first innings."}`,
    `${N.chaser} ko ${ctx.maxOvers} over mein ${N.target} run chahiye: pehli gend se ${N.startRate} per over, jabki ${team} ne ${s.currentRate} ki raftaar se banaye. ${N.fasterThanFirst ? "Chase pehli innings se tez karna padega." : "Ye pehli innings se halki raftaar hai."}`);
  const watch = t(`Watch for ${N.powerplayPar} on the board after ${I.powerplayOvers} overs: that keeps ${N.chaser} on the ${N.startRate} rate. Early wickets in the powerplay make it harder to hold.`,
    `${I.powerplayOvers} over ke baad ${N.powerplayPar} run board par dekhein: tab ${N.chaser} ${N.startRate} ke rate par rahenge. Powerplay mein jaldi wicket girne se ise nibhana mushkil hoga.`);

  return {
    headline: t(`${team} finish on ${s.runs}/${s.wickets}: ${N.target} to win`, `${team} ${s.runs}/${s.wickets} par ruke: jeetne ko ${N.target}`),
    recap: recap.slice(0, 3), why_it_matters: why, watch_next: watch,
  };
}

function reviewCard(ctx, t) {
  const s = ctx.state, I = ctx.insights, R = I.review, r = ctx.review, team = ctx.battingTeam;
  const b = R.batter, p = R.partner, bw = I.bowler;
  const word = { lbw: "lbw", caught_behind: "caught-behind", run_out: "run-out", wide: "wide", no_ball: "no-ball", unknown: null }[R.key];
  const dismissalType = ["lbw", "caught_behind", "run_out"].includes(R.key);

  const recap = [
    t(`${r.by} have asked for a review of the ${word ? `${word} ` : "on-field "}decision${r.bowler ? ` on ${r.bowler}'s delivery` : ""}.`,
      `${r.by} ne ${word ? `${word} ` : "on-field "}decision ka review manga hai${r.bowler ? ` (${r.bowler} ki gend)` : ""}.`),
    t(`${team} are ${s.runs}/${s.wickets} after ${s.overs} overs; ${b.name} has ${b.runs} off ${b.balls}.`,
      `${team} ${s.runs}/${s.wickets} (${s.overs} over); ${b.name} ${b.runs} run par (${b.balls} gend).`),
  ];
  if (p && I.stand.balls > 0) recap.push(t(`${b.name} and ${p.name} have added ${I.stand.runs} off ${I.stand.balls} together.`, `${b.name} aur ${p.name} ne saath mein ${I.stand.runs} run jode (${I.stand.balls} gend).`));

  let why;
  if (dismissalType) {
    why = I.chase
      ? t(`With ${I.wicketsInHand} wickets in hand and ${s.runsNeeded} needed from ${s.ballsLeft} balls, the ruling decides whether ${b.name} (${b.runs} off ${b.balls}) carries on or ${team} drop to ${R.wicketsInHandIfOut} wickets in hand.`,
          `${I.wicketsInHand} wicket haath mein aur ${s.ballsLeft} gend mein ${s.runsNeeded} run chahiye. Faisla tay karega ki ${b.name} (${b.runs} off ${b.balls}) khelte rahenge ya ${team} ke ${R.wicketsInHandIfOut} wicket haath mein bachenge.`)
      : t(`At ${s.runs}/${s.wickets}, the ruling decides whether ${b.name} (${b.runs} off ${b.balls}) carries on or ${team} drop to ${R.wicketsInHandIfOut} wickets in hand.`,
          `${s.runs}/${s.wickets} par, faisla tay karega ki ${b.name} (${b.runs} off ${b.balls}) khelte rahenge ya ${team} ke ${R.wicketsInHandIfOut} wicket haath mein bachenge.`);
  } else if (R.key === "wide" || R.key === "no_ball") {
    why = I.chase
      ? t(`The ruling decides whether this delivery counts as a legal ball or an extra. With ${s.runsNeeded} needed from ${s.ballsLeft} balls, every ball and every run counts.`,
          `Faisla tay karega ki ye gend legal hai ya extra. ${s.ballsLeft} gend mein ${s.runsNeeded} run chahiye, isliye har gend aur har run ginti hai.`)
      : t(`The ruling decides whether this delivery counts as a legal ball or an extra, a small swing at ${s.runs}/${s.wickets}.`,
          `Faisla tay karega ki ye gend legal hai ya extra, ${s.runs}/${s.wickets} par chhota sa swing.`);
  } else {
    why = t(`The ruling affects ${b.name}, who has ${b.runs} off ${b.balls}, and ${team}'s position of ${s.runs}/${s.wickets} with ${I.wicketsInHand} wickets in hand.`,
      `Faisla ${b.name} (${b.runs} off ${b.balls}) aur ${team} ki ${s.runs}/${s.wickets} wali position par asar daalega, ${I.wicketsInHand} wicket haath mein hain.`);
  }

  const watch = fit([
    t("The next ball shows the result.", "Agli gend result dikhayegi."),
    b.strikeRate != null && bw ? t(`Then watch ${b.name}, strike rate ${b.strikeRate}, against ${bw.name}, who has ${bw.wickets}/${bw.runs} from ${bw.overs} overs.`,
      `Phir ${b.name} (strike rate ${b.strikeRate}) ko dekhein, ${bw.name} ke saamne, jinke figures ${bw.wickets}/${bw.runs} (${bw.overs} over) hain.`) : "",
  ], CARD_LIMITS.watch);

  return {
    headline: t(`Review: ${r.by} challenge the call on ${b.name}`, `Review: ${r.by} ne ${b.name} ke call par challenge kiya`),
    recap: recap.slice(0, 3), why_it_matters: why, watch_next: watch,
    review_explainer: {
      under_review: t(`${r.by} have asked for a review.`, `${r.by} ne review manga hai.`),
      if_stays: reviewLines(r.kind).ifStays, if_changes: reviewLines(r.kind).ifChanges,
    },
  };
}

/**
 * Template card: instant on the client and the fallback whenever the AI fails. Never calls a model.
 * @param {object} ctx from buildContext  @param {"en"|"hinglish"} lang
 */
export function fallbackCard(ctx, lang = "en") {
  const t = (en, hing) => (lang === "hinglish" ? hing : en);
  const type = ctx.stoppage.type;
  const base = { chosen_question_id: ctx.candidates[0]?.id ?? "", uncertainties: ctx.missing };
  if (type === "innings_break") return { ...base, ...inningsBreakCard(ctx, t) };
  if (type === "review") return { ...base, ...reviewCard(ctx, t) };
  if (type === "wicket" && ctx.insights.wicket) return { ...base, ...wicketCard(ctx, t) };
  return { ...base, ...momentumCard(ctx, t) };
}

/** Small code-computed facts shown beside the card text. Never written by a model. */
export function insightChips(ctx, lang = "en") {
  const t = (en, hing) => (lang === "hinglish" ? hing : en);
  const s = ctx.state, I = ctx.insights, chips = [];
  const add = (label, value, tone) => { if (value != null && value !== "") chips.push({ label, value: String(value), tone }); };
  const type = ctx.stoppage.type;

  if (type === "innings_break") {
    const N = I.innings;
    add(t("Target", "Target"), N.target);
    add(t("Rate needed", "Zaroori rate"), N.startRate, N.fasterThanFirst ? "warn" : undefined);
    add(t("Powerplay par", "Powerplay par"), `${N.powerplayPar} ${t("after", "baad")} ${I.powerplayOvers}`);
    add(t("Boundaries", "Boundaries"), N.boundaries);
    return chips;
  }
  if (type === "review") {
    const R = I.review;
    add(t("Batter", "Batter"), `${R.batter.runs} ${t("off", "off")} ${R.batter.balls}`);
    if (R.partner && I.stand.balls > 0) add(t("Stand", "Partnership"), `${I.stand.runs} ${t("off", "off")} ${I.stand.balls}`);
    add(t("Wickets in hand", "Haath mein wicket"), I.wicketsInHand);
    if (I.chase) add(t("Need", "Chahiye"), `${Math.max(s.runsNeeded, 0)} ${t("off", "off")} ${s.ballsLeft}`);
    return chips;
  }
  if (type === "wicket" && I.wicket) {
    add(t("Stand ended", "Partnership"), I.stand.balls ? `${I.stand.runs} ${t("off", "off")} ${I.stand.balls}` : null);
    if (I.chase) {
      add(t("Need", "Chahiye"), `${Math.max(s.runsNeeded, 0)} ${t("off", "off")} ${s.ballsLeft}`);
      add(t("Required rate", "Zaroori rate"), s.requiredRate, I.rateGap > 0 ? "warn" : "good");
    } else {
      add(t("Run rate", "Run rate"), s.currentRate);
      add(t("Projected", "Projected"), I.pace);
    }
    add(t("Wickets in hand", "Haath mein wicket"), I.wicketsInHand);
    if (I.bowler) add(t("Bowler", "Gendbaaz"), `${I.bowler.wickets}/${I.bowler.runs}`);
    return chips;
  }
  add(t(`Last ${I.window.balls} balls`, `Pichli ${I.window.balls} gend`), `${I.window.runs} ${t("runs", "run")}`, I.momentum === "batting" ? "good" : I.momentum === "bowling" ? "warn" : undefined);
  add(t("Run rate", "Run rate"), s.currentRate);
  if (I.chase) {
    add(t("Required rate", "Zaroori rate"), s.requiredRate, I.rateGap > 0 ? "warn" : "good");
    add(t("Need", "Chahiye"), `${Math.max(s.runsNeeded, 0)} ${t("off", "off")} ${s.ballsLeft}`);
  } else add(t("Projected", "Projected"), I.pace);
  add(t("Wickets in hand", "Haath mein wicket"), I.wicketsInHand);
  return chips;
}
