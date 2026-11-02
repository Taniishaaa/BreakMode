import { assertGrounded, assertSpecific, assertNoSpoiler, applyReviewText, fallbackCard, CARD_LIMITS as L } from "@bm/engine";
import { createBudget } from "./budget.js";
import { CardSchema } from "./validate.js";

const MODEL = () => process.env.LLM_MODEL || "claude-haiku-5-5";

const system = (lang) => `You are a sharp cricket analyst writing a briefing card for a fan during a stoppage in play.
It must tell the fan something useful, never a generic summary like "a wicket has fallen".
Return ONLY one JSON object, no prose, no markdown fences.

THE CARD ANSWERS THREE QUESTIONS
1. "recap" = WHAT JUST HAPPENED (2-3 short strings). Be exact: who, how, and the figures. For a wicket name the
   batter, how they were dismissed, the bowler or fielder, what they scored and the stand that ended
   (context.insights.wicket, .stand, .window). For a review say what is being challenged and the situation.
   For a timeout or ad break describe the recent scoring and who is at the crease.
2. "why_it_matters" = WHY IT MATTERS. Explain what this changes for the batting side using at least two numbers
   from context.insights or context.state: wickets in hand, required rate against current rate (rateGap),
   par for the phase, recent scoring (window), or the target maths (innings). Describe the situation, not the result.
3. "watch_next" = WHAT TO WATCH NEXT. Name one specific player from the context and give one concrete threshold
   from context.insights.next (what "high" or "low" runs in the next balls does to the required or run rate).
   For a wicket, name the incoming batter (insights.wicket.incoming) and say what they need to do. If it is not
   known, say "the new batter". For the innings break use insights.innings.powerplayPar instead.

RULES
- Use only facts in the provided context. Never invent players, scores, stats or events.
  Do not talk about form, pitch, weather or head-to-head records: they are in "missing".
- Write every number as digits, exactly as given in the context. Do not calculate new numbers.
  Do not use ordinals such as "3rd" or "12th over".
- Never say who will win or lose. Describe pressure and what matters, not outcomes.
- If something is unknown (see "missing"), list it in "uncertainties". Do not guess it.
- If context.review is set, fill "review_explainer". Describe what is under review and what each
  outcome would mean. Do NOT say what the decision is or hint at it.
- Pick "chosen_question_id" from context.candidates, the most relevant question for this moment.
  If context.candidates is empty, use an empty string.
- If "previousError" is set, your last answer was rejected for that reason. Fix it.
- Language: ${lang === "hinglish"
    ? "Hinglish: casual Hindi and English mixed, written in Roman script. Keep player and team names as given."
    : "Plain, friendly English."}
- If favouriteTeam is not "any", frame the recap for that team's fans, but keep it factual.

LENGTH
headline up to ${L.headline} characters. Each recap string up to ${L.recap}. why_it_matters up to ${L.why}.
watch_next up to ${L.watch}.

JSON SHAPE
{"headline": str, "recap": [2-3 short strings], "why_it_matters": str, "watch_next": str,
 "review_explainer": {"under_review": str, "if_stays": str, "if_changes": str} (only for reviews),
 "chosen_question_id": str, "uncertainties": [str]}`;

export function extractJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error(`No JSON in response. The model said: "${text.slice(0, 160).replace(/\s+/g, " ")}"`);
  return JSON.parse(text.slice(a, b + 1));
}

let client = null;
const budget = createBudget(Number(process.env.LLM_MAX_CALLS_PER_HOUR) || 300);
/** Default model call (Anthropic SDK). Keep the key server-side only. */
async function callAnthropic({ system, user }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!budget.take()) throw new Error("Hourly model-call budget reached");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  client ??= new Anthropic({ maxRetries: 0 });
  const res = await client.messages.create(
    { model: MODEL(), max_tokens: 2000, system, messages: [{ role: "user", content: user }] },
    { timeout: 20000 });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text.trim()) throw new Error(`The model sent no text (stop_reason=${res.stop_reason}, blocks=${res.content.map((b) => b.type).join(",") || "none"})`);
  if (res.stop_reason === "max_tokens") throw new Error("The model's answer was cut off (max_tokens)");
  return text;
}

/**
 * Model JSON -> Zod -> grounding + usefulness checks -> one retry -> template fallback.
 * A broken AI call never breaks the card.
 * @returns {{card:object, source:"llm"|"fallback", attempts?:number, error?:string, ms:number}}
 */
export async function generateCard(ctx, lang, { callModel = callAnthropic } = {}) {
  const t0 = Date.now();
  const done = (o) => ({ ...o, ms: Date.now() - t0 });
  if (process.env.LLM_FORCE_FAIL === "1") return done({ card: fallbackCard(ctx, lang), source: "fallback", error: "forced" });

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callModel({
        system: system(lang),
        user: JSON.stringify({ context: ctx, previousError: lastError }),
      });
      const parsed = CardSchema.parse(extractJson(text));
      if (ctx.review && !parsed.review_explainer) throw new Error("review_explainer is required for a review");
      assertGrounded(parsed, ctx);
      if (ctx.review) assertNoSpoiler(parsed); // a leaked verdict is the worst failure, so it is checked first
      assertSpecific(parsed, ctx); // a number in "why", a named player and a threshold in "watch"
      // the if-stays / if-changes lines come from the authored table, never from the model
      console.log(`AI card ok (${ctx.stoppage?.type}, ${lang}) in ${Date.now() - t0} ms`);
      return done({ card: applyReviewText(parsed, ctx), source: "llm", attempts: attempt + 1 });
    } catch (err) {
      lastError = String(err.message).slice(0, 300);
      console.warn(`AI attempt ${attempt + 1} failed after ${Date.now() - t0} ms (${ctx.stoppage?.type}, ${lang}): ${lastError}`);
    }
  }
  return done({ card: fallbackCard(ctx, lang), source: "fallback", error: lastError });
}