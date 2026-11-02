/**
 * Stoppage detection. Wickets and reviews come from the data; timeouts, ad breaks
 * and the innings break are injected from config and marked source:"injected".
 */
const PRIORITY = { innings_break: 5, review: 4, wicket: 3, strategic_timeout: 2, ad_break: 1 };

function lastSeqOfOver(events, innings, overIdx) {
  let last = null;
  for (const e of events) if (e.innings === innings && e.over === overIdx) last = e.seq;
  return last;
}

/** @param {object} match @param {object} cfg stoppages.config.json */
export function detectStoppages(match, cfg) {
  const ev = match.events, out = [];
  for (const e of ev) {
    if (e.review && e.seq > 0) {
      out.push({
        id: `r-${e.seq}`, type: "review",
        afterSeq: e.seq - 1, // stop BEFORE the result becomes visible
        durationSec: cfg.reviewSec, source: "data",
        review: {
          atSeq: e.seq, by: e.review.by, batter: e.review.batter, bowler: e.bowler,
          kind: e.review.type ?? "unknown", demo: !!e.review.demo,
        },
      });
    } else if (e.wicket) {
      out.push({ id: `w-${e.seq}`, type: "wicket", afterSeq: e.seq, durationSec: cfg.wicketSec, source: "data" });
    }
  }
  for (const inn of [1, 2]) {
    for (const n of cfg.timeoutsAfterOver) {
      const s = lastSeqOfOver(ev, inn, n - 1);
      if (s != null) out.push({ id: `t-${inn}-${n}`, type: "strategic_timeout", afterSeq: s,
        durationSec: cfg.timeoutSec, source: "injected" });
    }
    for (const n of cfg.adBreakAfterOvers) {
      const s = lastSeqOfOver(ev, inn, n - 1);
      if (s != null) out.push({ id: `a-${inn}-${n}`, type: "ad_break", afterSeq: s,
        durationSec: cfg.adBreakSec, source: "injected" });
    }
  }
  const inn1 = ev.filter((e) => e.innings === 1).map((e) => e.seq);
  if (inn1.length) out.push({ id: "ib", type: "innings_break", afterSeq: Math.max(...inn1),
    durationSec: cfg.inningsBreakSec, source: "injected" });

  // one stoppage per afterSeq; highest priority wins
  const byPos = new Map();
  for (const s of out) {
    const cur = byPos.get(s.afterSeq);
    if (!cur || PRIORITY[s.type] > PRIORITY[cur.type]) byPos.set(s.afterSeq, s);
  }
  return [...byPos.values()].sort((a, b) => a.afterSeq - b.afterSeq);
}
