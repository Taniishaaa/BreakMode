import { candidateQuestions, buildContext } from "@bm/engine";
import { fail } from "./errors.js";
import { generateCard } from "./aiCard.js";

/**
 * Generate once, serve many: a card depends on the match state, not on the fan,
 * so it is cached by (stoppage, language, team). Only real AI cards are cached.
 */
export function createBreakService({ repo, match, states, stoppages, generate = generateCard }) {
  const byId = new Map(stoppages.map((s) => [s.id, s]));
  const inflight = new Map();
  const singleFlight = (key, fn) => {
    if (!inflight.has(key)) inflight.set(key, fn().finally(() => inflight.delete(key)));
    return inflight.get(key);
  };
  const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { console.error("cache:", e.message); return fallback; } };

  return {
    async getBreak({ stoppageId, lang, team = "any" }) {
      const st = byId.get(stoppageId) ?? fail(404, "Unknown stoppage");
      if (team !== "any" && !match.teams.includes(team)) fail(400, "Unknown team");
      const questions = candidateQuestions(match, states, st);

      const cached = await safe(() => repo.getCard(stoppageId, lang, team), null);
      if (cached) return { card: cached, source: "cache", questions };

      const out = await singleFlight(`${stoppageId}|${lang}|${team}`, async () => {
        const ctx = buildContext(match, states, st, questions, team);
        const r = await generate(ctx, lang);
        if (r.source === "llm") {
          await safe(() => repo.ensureStoppage(match.id, st), null);
          await safe(() => repo.saveCard(stoppageId, lang, team, r.card, process.env.LLM_MODEL || "claude-haiku-5-5"), null);
        }
        return r;
      });
      return { card: out.card, source: out.source, questions };
    },
  };
}
