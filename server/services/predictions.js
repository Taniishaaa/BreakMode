import { candidateQuestions, resolveQuestion, resolveAtSeq, explain, scorePrediction, streakBefore, summarize } from "@bm/engine";
import { fail } from "./errors.js";

const view = (row) => !row ? null : ({
  id: row.id, stoppageId: row.stoppageId, questionId: row.questionId, optionId: row.optionId,
  status: !row.resolvedAt ? "locked" : row.correct === null ? "void" : "resolved",
  correct: row.correct, points: row.points, why: row.why,
});

const byResolution = (a, b) => (new Date(a.resolvedAt) - new Date(b.resolvedAt)) || (a.id - b.id);

/** All prediction logic. Scoring and explanations come from the engine only, never from a model. */
export function createPredictionService({ repo, match, states, stoppages }) {
  const byId = new Map(stoppages.map((s) => [s.id, s]));
  const stop = (id) => byId.get(id) ?? fail(404, "Unknown stoppage");
  const specOf = (st, qid) =>
    candidateQuestions(match, states, st).find((q) => q.id === qid) ?? fail(400, "Unknown question for this stoppage");

  return {
    /** One prediction per fan per stoppage. A repeat returns the existing row unchanged. */
    async save({ userId, stoppageId, questionId, optionId }) {
      const st = stop(stoppageId);
      const spec = specOf(st, questionId);
      if (!spec.options.some((o) => o.id === optionId)) fail(400, "Unknown option");
      await repo.ensureUser(userId);
      await repo.ensureStoppage(match.id, st);
      return view(await repo.insertPrediction({ userId, stoppageId, questionId, optionId }));
    },

    /** `seq` is the replay position the client has reached; resolving early is refused. */
    async resolve({ userId, stoppageId, seq }) {
      const st = stop(stoppageId);
      const row = await repo.getPrediction(userId, stoppageId) ?? fail(404, "No prediction for this stoppage");
      const spec = specOf(st, row.questionId);
      if (seq < resolveAtSeq(match, spec)) fail(409, "Too early: play has not reached this result yet");

      const res = resolveQuestion(match, spec);
      const label = spec.options.find((o) => o.id === row.optionId)?.labelEn ?? row.optionId;
      let saved;
      if (row.resolvedAt) saved = row;
      else if (res.status === "void") {
        saved = await repo.markResolved(row.id, { correct: null, points: 0, why: explain(spec, res, row.optionId, label) });
      } else {
        const correct = row.optionId === res.correctOptionId;
        const earlier = (await repo.listPredictions(userId))
          .filter((p) => p.resolvedAt && p.id !== row.id).sort(byResolution);
        const { points } = scorePrediction({ correct, streakBefore: streakBefore(earlier), kind: spec.kind });
        saved = await repo.markResolved(row.id, { correct, points, why: explain(spec, res, row.optionId, label) });
      }
      return { ...view(saved), correctOptionId: res.status === "resolved" ? res.correctOptionId : null };
    },

    async history(userId) {
      const rows = (await repo.listPredictions(userId)).filter((p) => p.resolvedAt).sort(byResolution);
      const items = rows.map((r) => {
        const st = byId.get(r.stoppageId);
        const spec = st ? candidateQuestions(match, states, st).find((q) => q.id === r.questionId) : null;
        return {
          stoppageId: r.stoppageId, type: st?.type ?? null, overs: st ? states[st.afterSeq]?.overs ?? null : null,
          innings: st ? states[st.afterSeq]?.innings ?? null : null,
          question: spec?.titleEn ?? r.questionId,
          pick: spec?.options.find((o) => o.id === r.optionId)?.labelEn ?? r.optionId,
          correct: r.correct, points: r.points ?? 0, why: r.why,
        };
      });
      return { items, totals: summarize(rows) };
    },

    async reset(userId) { await repo.resetUser(userId); return { ok: true }; },
  };
}
