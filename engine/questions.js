/**
 * Prediction questions are built by code, so scoring is exact.
 * The LLM only chooses among these candidates; it never invents question logic.
 */
export const BANDS = { powerplay: [6, 11], middle: [5, 9], death: [7, 12] };
/** Phase boundaries in legal balls: powerplay ends at 36, the middle overs at 96. */
export const PHASE_END = { powerplay: 36, middle: 96 };
export const phaseOf = (lb) => (lb < PHASE_END.powerplay ? "powerplay" : lb < PHASE_END.middle ? "middle" : "death");
const phase = phaseOf;

/** @param {number} runs @param {{lo:number,hi:number}} p */
export function optionFor(runs, { lo, hi }) {
  return runs <= lo ? "low" : runs <= hi ? "mid" : "high";
}

/**
 * @param {object} match @param {object[]} states @param {object} st a stoppage
 * @returns {object[]} question specs, most generally useful first
 */
export function candidateQuestions(match, states, st) {
  const isBreak = st.type === "innings_break";
  const s = isBreak ? { legalBalls: 0, wickets: 0 } : states[st.afterSeq]; // 2nd innings starts fresh
  const maxBalls = match.maxOvers * match.ballsPerOver;
  const out = [];

  if (maxBalls - s.legalBalls >= 6) {
    const [lo, hi] = BANDS[phase(s.legalBalls)];
    const window = { fromSeq: st.afterSeq + 1, legalBalls: 6 };
    out.push({
      id: `${st.id}:runs6`, kind: "next6_runs", params: { lo, hi }, window,
      titleEn: "Runs in the next 6 balls?", titleHing: "Agli 6 gend mein kitne run?",
      options: [
        { id: "low", labelEn: `${lo} or fewer`, labelHing: `${lo} ya usse kam` },
        { id: "mid", labelEn: `${lo + 1} to ${hi}`, labelHing: `${lo + 1} se ${hi}` },
        { id: "high", labelEn: `${hi + 1}+`, labelHing: `${hi + 1} ya zyada` },
      ],
    });
    if (s.wickets < 10) {
      out.push({
        id: `${st.id}:wkt6`, kind: "next6_wicket", window,
        titleEn: "A wicket in the next 6 balls?", titleHing: "Agli 6 gend mein wicket girega?",
        options: [
          { id: "yes", labelEn: "Yes, a wicket", labelHing: "Haan, wicket girega" },
          { id: "no", labelEn: "No wicket", labelHing: "Nahi, wicket nahi" },
        ],
      });
    }
  }

  if (st.type === "review" && st.review) {
    out.push({
      id: `${st.id}:review`, kind: "review_outcome", window: { atSeq: st.review.atSeq },
      titleEn: "Will the on-field decision stand?", titleHing: "Kya on-field decision wahi rahega?",
      options: [
        { id: "stays", labelEn: "Decision stays", labelHing: "Decision wahi rahega" },
        { id: "changes", labelEn: "Decision changes", labelHing: "Decision badlega" },
      ],
    });
  }

  if (isBreak && match.outcome?.winner) {
    out.push({
      id: `${st.id}:chase`, kind: "chase_result", window: { untilMatchEnd: true },
      titleEn: "Will they chase it down?", titleHing: "Kya chase ho jayega?",
      options: [
        { id: "yes", labelEn: "Yes, they chase it", labelHing: "Haan, chase ho jayega" },
        { id: "no", labelEn: "No, they fall short", labelHing: "Nahi, chase nahi hoga" },
      ],
    });
  }
  return out;
}
