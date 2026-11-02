# Break Mode

**When cricket play stops, Break Mode fills the gap.** A wicket, a strategic timeout, an ad break, a DRS review or the
innings break triggers a short briefing (English or Hinglish) that answers three questions: **what just happened**, **why it matters**
(using the match numbers) and **what to watch next** (a named player and a threshold for the next few balls), plus a one-tap
prediction. Predictions are scored automatically once play resumes, with a plain line explaining why you gained or lost points.

Sign in with an email and password, pick the match from the **Matches** page, and it replays a T20 chase ball by ball, so it runs anywhere with no live feed.

> **Heads up:** the bundled `data/match.json` is a **synthetic** demo match (not real cricket) so the app runs with no downloads.
> See [Use a real match](#use-a-real-match) to swap in a real Cricsheet file.

## Contents
[Features](#features) · [Quick start](#quick-start) · [Turn on AI cards](#turn-on-ai-cards) · [Postgres](#use-postgres-optional) ·
[Real match](#use-a-real-match) · [Production and deploy](#production-build-and-deploy) · [Scripts](#scripts) ·
[Environment variables](#environment-variables) · [API](#api) · [Project structure](#project-structure) · [How it works](#how-it-works) ·
[Problem and evidence](#the-problem-and-the-evidence) · [Evaluation](#evaluation) · [Troubleshooting](#troubleshooting) ·
[Limitations](#known-limitations) · [Next steps](#next-steps) · [Final checklist](#final-checklist)

## Features
- Email and password accounts (scrypt-hashed passwords, signed 7-day session tokens); every prediction belongs to the signed-in account
- A Matches page listing the demo replay; opening it shows the full-screen match view
- All replay controls sit in the top bar: Start / Pause / Resume, Replay, Skip break, Speed, Language and favourite team
- Deterministic ball-by-ball replay with a live scoreboard, required and current run rate, and the last 12 balls
- Scorebook of every delivery, one column per over, with stoppage markers (amber solid = from match data, amber dotted = simulated)
- Break cards for wickets, DRS reviews, strategic timeouts, ad breaks and the innings break
- Briefings that explain rather than summarise: a wicket says what the stand was, what the side now needs, and what the incoming batter has to do. Every number comes from a deterministic insights layer (`engine/insights.js`), not from the model
- AI-written cards (Anthropic API) in English or Hinglish, framed for your favourite team. A card must be grounded, specific (numbers and a named player) and spoiler-free, otherwise it is retried once and then replaced by an equally structured template card
- One-tap predictions (runs or a wicket in the next 6 balls, review outcome, chase result) scored exactly by code
- Points toast with a plain "why" line, and a "Predictions" page with points, accuracy and best streak
- Review cards that never reveal the decision: the page stops one ball before the result
- Anti-hallucination checks: every number in an AI card must come from the data it was given
- Works with no API key and no database (template cards, in-memory store)

## Quick start
Requirements: **Node.js 20 or newer** and npm. No database or API key needed for the first run.

```bash
git clone <your-repo-url> break-mode && cd break-mode     # or unzip and cd into the folder
npm install                 # installs all workspaces (engine, server, client)
```

Then start two terminals from the project root:

```bash
npm run dev:server          # terminal 1: API on http://localhost:3001
npm run dev:client          # terminal 2: app on http://localhost:5173  <- open this
```

Open http://localhost:5173, press **Start replay**. Play pauses at every stoppage and a card slides up. Tap an answer, then keep
watching: when play reaches the result, a toast shows your points and why. Use **Skip break** to move faster, **Speed** to
change the replay pace, and **My predictions** to see your history. **Restart** clears your predictions so you can play again.

Without an API key you get template cards (the tag on the card says `template`). To get AI cards, continue below.

## Turn on AI cards
1. Create an API key in the Anthropic console and set a monthly spend limit on it.
2. Copy the env file and add the key:
   ```bash
   cp .env.example .env        # Windows: copy .env.example .env
   ```
   Set `ANTHROPIC_API_KEY=...` in `.env`. Check current model names in the API docs and set `LLM_MODEL` if you want a different one.
3. Restart `npm run dev:server`. Cards now say `AI` once generated. Check http://localhost:3001/api/health: `"ai":true`.

Generated cards are cached per stoppage, language and team (in memory, or in Postgres if configured), so each card is written once.
`LLM_FORCE_FAIL=1` in `.env` forces template cards, which is the failure drill for your demo.

## Use Postgres (optional)
Without `DATABASE_URL` the server uses an in-memory store (data is lost on restart). To persist cards and predictions, point `DATABASE_URL` at any Postgres (a local install, or a free hosted one on Neon or Supabase):

```bash
cp .env.example .env                 # then uncomment the DATABASE_URL line in .env
npm run db:seed                      # creates tables and loads the stoppages (safe to re-run)
npm run dev:server                   # logs "Using Postgres."
```
If Postgres is unreachable the server logs a warning and falls back to memory, so it never fails to start. `/api/health` reports
`"store":"postgres"` or `"store":"memory"`.

## Use a real match
1. Download a T20 JSON file from https://cricsheet.org/downloads/ and check its licence and attribution terms.
2. Pick a **chase** with a mid-innings collapse and a close finish. To find files with DRS reviews:
   `grep -l '"review"' *.json | head` (Windows PowerShell: `Select-String -Path *.json -Pattern '"review"' -List`).
3. Convert it (this overwrites `data/match.json`):
   ```bash
   npm run convert -- path/to/match.json
   ```
   The command prints the number of deliveries, wickets and reviews, and the outcome.
4. **Compare the final totals and result with the published scorecard.** If they differ, `target.runs` is probably off by one.
   Also check `over` numbering (0-indexed in Cricsheet) and the `review` fields in your file.
6. Check the review mapping in `engine/resolve.js` against a review whose real result you know:
   `upheld` means the review succeeded (the on-field decision changed); umpire's call keeps the decision.

If your file has no reviews, add one by hand to a delivery in `data/match.json` (the UI labels these "demo marker"):
```json
"review": { "by": "Team name", "batter": "Name", "decision": "struck down", "type": "lbw", "demo": true }
```
Timeouts and ad breaks are not in real data. They are simulated from `data/stoppages.config.json` (after which overs, how long)
and labelled "simulated" in the UI. Edit that file to match the competition's rules. To regenerate the synthetic demo match: `npm run sample`.

## Production build and deploy
One process serves the API and the built React app:
```bash
npm run build        # builds client/dist
npm start            # http://localhost:3001 (set PORT to change)
```
For a public link (Render or Railway plus hosted Postgres on Neon or Supabase), spend limits and pre-warming the card cache, follow
[`DEPLOY.md`](DEPLOY.md). To rehearse your demo, follow [`DEMO.md`](DEMO.md).

## Scripts
| Command | What it does |
|---|---|
| `npm install` | Installs all workspaces |
| `npm run dev:server` | API on :3001 with auto-reload |
| `npm run dev:client` | Vite dev server on :5173, proxies `/api` to :3001 |
| `npm run build` | Builds the client into `client/dist` |
| `npm start` | Runs the server (serves `client/dist` too if built) |
| `npm run convert -- file.json` | Converts a Cricsheet match into `data/match.json` |
| `npm run sample` | Regenerates the synthetic demo match |
| `npm run db:seed` | Creates tables and upserts stoppages in Postgres |
| `npm run warm` | Pre-generates and caches every AI card (needs `DATABASE_URL` and `ANTHROPIC_API_KEY`); `-- --url https://app` warms via a running server, `-- --teams` adds favourite-team variants |
| `npm run evals` | Generates fresh cards and writes `evals/results.md` and `evals/rating-cards.md`; `-- --limit 6` |

## Environment variables
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Server port |
| `AUTH_SECRET` | random per start | Signs session tokens. Set a long random value in production, otherwise users are signed out on every restart |
| `DATABASE_URL` | empty | Postgres connection string. Empty means in-memory store |
| `ANTHROPIC_API_KEY` | empty | Enables AI cards. Empty means template cards only |
| `LLM_MODEL` | `claude-haiku-5-5` | Model used for cards. Check current names in the API docs |
| `LLM_MAX_CALLS_PER_HOUR` | `300` | Spend guard: model calls per hour before cards fall back |
| `LLM_FORCE_FAIL` | empty | `1` forces template cards (failure drill) |

## API
| Method and path | Body or query | Returns |
|---|---|---|
| `GET /api/health` | none | `{ ok, store: "postgres"\|"memory", ai }` |
| `POST /api/auth/register` | `{ email, password }` (8 to 128 characters) | `{ token, user }`; `409` if the email is taken (10 attempts a minute) |
| `POST /api/auth/login` | `{ email, password }` | `{ token, user }`; `401` with one message for an unknown email or a wrong password |

Everything below needs the header `Authorization: Bearer <token>`; without it the API answers `401`.

| Method and path | Body or query | Returns |
|---|---|---|
| `GET /api/auth/me` | none | `{ user }` |
| `GET /api/matches` | none | `{ matches }` (id, title, teams, counts of breaks, wickets and reviews) |
| `GET /api/matches/:id`, `GET /api/match` | none | `{ match, stoppages }` |
| `POST /api/break` | `{ stoppageId, lang: "hinglish"\|"en", team }` | `{ card, insights, source: "llm"\|"cache"\|"fallback", questions }` (rate limited to 30/min) |
| `POST /api/predictions` | `{ stoppageId, questionId, optionId }` | the locked prediction (one per account per stoppage) |
| `POST /api/predictions/resolve` | `{ stoppageId, seq }` | `{ status, correct, points, why, correctOptionId }`; `409` if `seq` has not reached the result |
| `GET /api/history` | none | `{ items, totals: { points, accuracy, bestStreak, ... } }` |
| `POST /api/reset` | none | clears the signed-in account's predictions |

All bodies are validated with Zod and bad input returns a `400` with a short message. The user is always taken from the token, never from the
request body. The browser keeps the token in `localStorage` (`bm_token`).

## Project structure
```
break-mode/
  package.json  .env.example  DEPLOY.md  DEMO.md
  data/        match.json (synthetic demo)  stoppages.config.json
  scripts/     convert.js (Cricsheet -> match.json)  make-sample.js  warm.js
  engine/      pure JS shared by client and server
               timeline.js  stoppages.js  questions.js  resolve.js  score.js
               insights.js (match facts for a break)  cards.js (template cards, chips)
               context.js  grounding.js  reviews.js
  server/      index.js  data.js  routes/api.js
               services/  auth.js  matches.js  aiCard.js  breakCards.js  predictions.js  validate.js  budget.js
               db/        schema.sql  seed.js  pool.js  pgRepo.js  memoryRepo.js
  client/      Vite + React app (src/App.jsx, store.js, components/: AuthPage, MatchesPage, TopBar, MatchView, BreakPanel, ...)
  evals/       run.js  results.md  rating-cards.md
```

## How it works
**Flow.** The browser owns the replay clock and sends its position (`seq`) with requests; the server computes everything from the
match file. When play reaches a stoppage: (1) the client shows a template card instantly and asks `/api/break` for the AI card;
(2) the fan taps an option and `/api/predictions` locks it; (3) when the replay reaches the result, the client calls
`/api/predictions/resolve`, the engine scores it, and a toast shows the points and the reason.

**Stoppages.** Wickets and reviews come from the match data. Strategic timeouts, ad breaks and the innings break are simulated from
config. A review stoppage starts one ball **before** the reviewed delivery, so the score strip never shows the result early.
If two stoppages land on the same ball the priority is: innings break, review, wicket, timeout, ad break.

**Questions and scoring.** Questions are built by code, so resolution is exact. A "next 6 balls" window counts legal balls only
(wides and no-balls are re-bowled), and is void if the innings ends first.
10 points per correct answer, +5 per earlier consecutive correct answer (capped at +20), review polls x1.5. A miss resets the streak;
void questions score 0 and do not break it.

**AI cards.** The model receives only the state at the break point (never later deliveries, never a review's result) and writes
the headline, recap, why it matters and what to watch. It also picks the most relevant of the code-built questions.
Its JSON is checked in order: Zod schema, grounding (every number must appear in the context), no match-outcome predictions,
no verdict hints on review cards. One failure triggers a single retry with the error fed back; a second failure gives the template card.
The review "if it stays / if it changes" lines come from an authored table in `engine/reviews.js`, not the model.
**Check that table against the current Laws of Cricket and the competition's playing conditions before you present.**

**Principles.**
1. The score engine and scoring are deterministic and never depend on the LLM.
2. The AI only explains, and it says what it does not know.
3. A broken AI call never breaks the card: there is always a template fallback.

**Architecture.**
```
Browser (React + Vite + Zustand)
  Sign in · Matches · Top bar controls · Scoreboard · Scorebook · Briefing rail · Prediction · Points toast · History
  Replay clock -> current seq; shared engine computes the score locally
        │ REST
        ▼
Express (one service: API + built client)
  /api/auth/*  /api/matches  /api/break  /api/predictions  /api/predictions/resolve  /api/history  /api/reset  /api/health
  breakCards: context -> model -> Zod -> grounding -> spoiler check -> authored review lines
              └── any failure, twice -> template fallback card
        │
        ▼
PostgreSQL (or in-memory if unavailable): stoppages · cards (cache) · users · predictions
```
Cards are generated once and served to many: a card depends on the match state, not the fan, so it is cached by
(stoppage, language, team) and concurrent requests share one model call.

## The problem and the evidence
Cricket stops a lot: timeouts, ad breaks, new batters, DRS reviews. Fans reach for their phones in those gaps, and nothing on the
second screen is built for those moments.

| Evidence | What it suggests |
|---|---|
| An IPL fan study: 44% switch to their phone when an ad break starts, 60% feel there are too many ads | Stoppages are when attention moves to the phone |
| The same study: 64.5% say they are glued to their phone in tense matches | The phone is part of match-watching |
| Strategic timeouts run roughly two and a half minutes | Dead time is built into the format |
| A May 2026 wide review in an SRH vs RCB match was delayed by a technical problem, about five minutes by one outlet | Stoppages can be long and unplanned |
| Dream11 says broadcasters are the first screen and it fills the gaps where attention drifts | The product direction matches |

**What we do not know.** Most figures come from consultancy and ad-tech studies, not representative surveys, and they were not
independently re-checked here. We also do not know how many fans want match content in a break rather than food or messages.
Treat this as a hypothesis to test.

Existing products (JioHotstar's in-stream questions, Cricket Australia's AI Insights) answer when the fan asks. Neither is designed
around the stoppage as the trigger.

## Evaluation
```bash
npm run evals                  # live model; needs ANTHROPIC_API_KEY
npm run evals -- --limit 6     # cheap smoke run on the first 6 stoppages
```
It generates a fresh, uncached card for every stoppage in both languages and writes `evals/results.md`. Checks: grounding (first
attempt and any attempt), fallback rate, no outcome predictions, language (Hinglish uses Hindi words, English does not), review
no-spoiler, missing-review-type probe, failure drill (model errors and `LLM_FORCE_FAIL`), and latency p50/p95.
The report says whether it ran live or without a key, and lists why cards fell back.

**The `evals/results.md` in this repo is a no-key stub: the live-model checks are marked skipped.** Run `npm run evals` with your key
and report what you get, including failures. `--fake` exists only to test the eval pipeline itself and labels its output as not real.
Human rating (5 fans x 6 cards, 1 to 5) is collected by hand with `evals/rating-cards.md`; regenerate that file with a key first.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Page says "Could not load the match" | The server is not running. Start `npm run dev:server` (and open the client on :5173) |
| `Cannot find package '@bm/engine'` | Run `npm install` in the project root (not inside a subfolder) |
| Cards always say `template` | No `ANTHROPIC_API_KEY`, `LLM_FORCE_FAIL=1`, the hourly budget was hit, or the model answers failed validation twice. Check the server log and `/api/health` |
| `Postgres unavailable ... falling back` | The database is not running or the URL is wrong; hosted URLs need `?sslmode=require` |
| `db:seed` says DATABASE_URL is not set | Copy `.env.example` to `.env` first |
| `409 Too early` when scoring | The replay has not reached the result yet; this is the server refusing to reveal it early |
| Already predicted this break | One prediction per stoppage. Press **Restart** to clear your predictions and replay |
| `429 Too many requests` | Rate limit (30 card requests a minute). Wait, or pre-warm with `npm run warm` |
| Port 3001 or 5173 in use | Set `PORT` in `.env` (and update the proxy in `client/vite.config.js`), or stop the other process |

## Known limitations
- The bundled match is synthetic. Timeouts and ad breaks are simulated; only wickets and reviews exist in real data.
- The server trusts the replay position the client reports (it refuses early results, but a determined user could lie). A production version would own the clock.
- The review type is often missing in real data; the card then says it is unknown rather than guessing.
- Grounding catches invented numbers and some outcome claims, not every wrong statement.
- Predictions are free-to-play points only, with no stakes.
- Accounts have no email verification, password reset or sign-out-everywhere (tokens are stateless and last 7 days).
- Only one match is bundled and the eval sample is small.

## Next steps
Swap the replay for a live-feed adapter that emits the same events. Wickets and reviews arrive as data; ad breaks and timeouts need a
broadcast signal or a rule-based guess, which is an open production question. Then test with 5 to 10 real fans ("what do you do in a
break?"), consider a friends' leaderboard, and more languages.

## Final checklist
- [ ] `npm install && npm run dev:server` starts cleanly and you can sign in
- [ ] Real match converted and totals compared with the scorecard (or the synthetic label kept visible)
- [ ] Review table lines checked against the current Laws
- [ ] `npm run evals` run with a live key; `evals/results.md` committed; human ratings filled in
- [ ] Deployed; `/api/health` shows `postgres` and `"ai":true`; cards pre-warmed with `npm run warm`; played once on your phone
- [ ] 2-minute demo recorded; no secrets committed (`.env` is git-ignored)

If time runs short, cut in this order: innings-break card, review card, history polish, Hinglish. Never cut the
grounding checks or the fallback.

## Credits and sources
Ball-by-ball data format: [Cricsheet](https://cricsheet.org/article/introducing-the-cricsheet-register-and-a-new-data-format-json)
(check its licence and attribution terms before publishing real match data). Evidence from the original plan:
[Folk Frequency, Inside IPL](https://www.medianews4u.com/ipls-most-underused-opportunity-lies-in-break-moments-when-audience-attention-is-high-but-unfocused-gayatri-sapru-folk-frequency/),
[Social Samosa IPL viewing study](https://www.socialsamosa.com/report/43-5-tolerate-ads-ipl-17-say-match-less-enjoyable-10955952),
[TimesLive on IPL length](https://www.timeslive.co.za/sport/cricket/2026-05-06-the-numbers-show-it-the-ipl-is-boring/),
[CricTracker on the IPL 2026 DRS delay](https://www.crictracker.com/cricket-news/ipl-2026-drs-aajaye-to-utha-dena-fans-left-impatient-as-drs-for-wide-delayed-due-to-technical-outage/),
[Impact on Dream11's second-screen pivot](https://www.impactonnet.com/impact-stories/dream11s-new-game-making-sports-social-again-12742.html).
