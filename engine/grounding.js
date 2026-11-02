/** Checks that AI card text only uses numbers present in the context we supplied. */
export const numbersIn = (t) => (t.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

const SKIP_KEYS = new Set(["id", "kind"]); // internal ids such as "w-41:runs6" are not facts

export function allowedNumbers(ctx) {
  const set = new Set();
  const walk = (v, key) => {
    if (SKIP_KEYS.has(key)) return;
    if (typeof v === "number") set.add(v);
    else if (typeof v === "string") numbersIn(v).forEach((n) => set.add(n));
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(ctx);
  return set;
}

export const OUTCOME = /\b(will win|will lose|going to win|going to lose|is sure to|jeet jayega|jeetegi|haar jayega|haar jayegi)\b/i;

/** Throws if the card is not grounded in ctx. Number tolerance allows 10.3 against 10.25. */
export function assertGrounded(card, ctx) {
  const text = JSON.stringify({ ...card, chosen_question_id: undefined });
  const ok = [...allowedNumbers(ctx)];
  const bad = numbersIn(text).filter((n) => !ok.some((a) => Math.abs(a - n) < 0.051));
  if (bad.length) throw new Error(`Numbers not in context: ${[...new Set(bad)].join(", ")}`);
  if (ctx.candidates.length === 0) {
    if (card.chosen_question_id) throw new Error("chosen_question_id must be empty when there are no candidates");
  } else if (!ctx.candidates.some((c) => c.id === card.chosen_question_id)) {
    throw new Error("chosen_question_id is not a candidate");
  }
  if (OUTCOME.test(text)) throw new Error("Predicts the match outcome");
}

/** Player names the card may refer to at this moment (anyone at the crease, the incoming batter, the bowler). */
export function playerNames(ctx) {
  const I = ctx.insights ?? {};
  return [...new Set([
    ...(ctx.atCrease ?? []).map((b) => b.name), I.wicket?.incoming, I.wicket?.batter?.name, I.bowler?.name,
    ctx.review?.batter, ctx.review?.bowler,
  ].filter(Boolean))];
}

const mentions = (text, name) => {
  const t = text.toLowerCase(), n = name.toLowerCase();
  return t.includes(n) || t.includes(n.split(/\s+/).at(-1)); // "S. Menon" is also written "Menon"
};

/**
 * Usefulness gate: a card must tell the fan something specific, not a generic summary.
 * why_it_matters has to use a number from the match, and watch_next has to name a player and give a threshold.
 */
export function assertSpecific(card, ctx) {
  if (numbersIn(card.why_it_matters).length < 1) throw new Error("why_it_matters must use at least one number from the context");
  if (numbersIn(card.watch_next).length < 1) throw new Error("watch_next must give a concrete number or threshold from the context");
  const names = playerNames(ctx);
  if (ctx.stoppage.type !== "innings_break" && names.length && !names.some((n) => mentions(card.watch_next, n))) {
    throw new Error("watch_next must name a player from the context");
  }
}
