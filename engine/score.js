/**
 * 10 per correct answer, +5 per consecutive correct answer before it (capped at +20),
 * review polls x1.5. A miss resets the streak. Void questions are not scored here.
 */
export function scorePrediction({ correct, streakBefore, kind }) {
  if (!correct) return { points: 0, streakAfter: 0 };
  const bonus = Math.min(streakBefore * 5, 20);
  const mult = kind === "review_outcome" ? 1.5 : 1;
  return { points: Math.round((10 + bonus) * mult), streakAfter: streakBefore + 1 };
}

/**
 * Current streak from earlier resolved rows, oldest first.
 * Void rows (correct === null) are skipped and do not break a streak.
 * @param {{correct:boolean|null}[]} rows
 */
export function streakBefore(rows) {
  let n = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].correct === null) continue;
    if (rows[i].correct) n++; else break;
  }
  return n;
}

/** Totals for the History page. Rows are resolved predictions, oldest first. */
export function summarize(rows) {
  let points = 0, answered = 0, right = 0, run = 0, best = 0;
  for (const r of rows) {
    points += r.points ?? 0;
    if (r.correct === null) continue;
    answered++;
    if (r.correct) { right++; run++; best = Math.max(best, run); } else run = 0;
  }
  return { points, answered, correct: right, accuracy: answered ? right / answered : null,
           bestStreak: best, currentStreak: run };
}
