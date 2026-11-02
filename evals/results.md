# Break Mode eval results

- Run: 2026-11-01T04:40:35.683Z
- Mode: **NO MODEL KEY. Live-model checks were skipped; only key-free checks ran.**
- Match: Mumbai Meteors vs Delhi Dynamos (synthetic demo)
- Cards generated: 0 (25 stoppages x 2 languages, no cache)

| Check | Result | Target | Status | Note |
|---|---|---|---|---|
| Grounded + valid on first attempt | skipped (no model key) | report | n/a |  |
| Fallback (template) rate | skipped (no model key) | report | n/a |  |
| Cards that predict the result | skipped (no model key) | 0 | n/a |  |
| Language checks | skipped (no model key) | 100% | n/a |  |
| Review cards with verdict words | skipped (no model key) | 0 | n/a |  |
| Missing review type: listed as unknown, not guessed | pass (fallback card) | pass | PASS | template card only; run with a key to test the model |
| Failure drill: every card falls back to a valid template | 100% (50/50) | 100% | PASS | model throws, and LLM_FORCE_FAIL=1 |
| Generation latency | skipped (no model key) | report | n/a |  |

## Why cards fell back

- No fallbacks in this run (or no live run).

## Human rating

Not collected yet. Give `evals/rating-cards.md` to 5 fans, ask them to rate each card's usefulness from 1 to 5, and ask what they would do in a break instead. Record the average and the sample size here, with the raw answers.

| Card | Average (1-5) | Raters |
|---|---|---|
| (fill in) | | |

## Limits

- Small sample: one match, 25 stoppages.
- Simulated timeouts and ad breaks are injected, so those cards test the writing, not real broadcast timing.
- Grounding checks catch invented numbers and some outcome claims, not every possible wrong statement.
