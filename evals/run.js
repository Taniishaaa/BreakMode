// Eval harness. Generates a fresh (uncached) card for every stoppage in both languages and writes
// evals/results.md and evals/rating-cards.md.
//   npm run evals                  live model (needs ANTHROPIC_API_KEY)
//   npm run evals -- --limit 6     only the first 6 stoppages (cheap smoke run)
//   npm run evals -- --fake        FAKE model, only to test this pipeline. The report says so; it is NOT a result.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { match, states, stoppages } from "../server/data.js";
import { candidateQuestions, buildContext, fallbackCard, assertGrounded, assertNoSpoiler, OUTCOME, VERDICT } from "@bm/engine";
import { generateCard } from "../server/services/aiCard.js";
import { CardSchema } from "../server/services/validate.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const FAKE = args.includes("--fake");
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const LIVE = FAKE || Boolean(process.env.ANTHROPIC_API_KEY);
delete process.env.LLM_FORCE_FAIL; // the live run must not be forced to fail
const model = process.env.LLM_MODEL || "claude-haiku-5-5";

const HINDI = ["ko", "mein", "hai", "hain", "ka", "ki", "ke", "ab", "aur", "se", "par", "kya", "nahi", "hoga", "chahiye", "gend", "bilkul", "ye", "yeh"];
const HINDI_STRICT = ["ko", "mein", "hai", "hain", "chahiye", "nahi", "kya", "bilkul", "gend", "aur"];
const words = (t) => t.toLowerCase().match(/[a-z']+/g) ?? [];
const hindiCount = (t, list) => new Set(words(t).filter((w) => list.includes(w))).size;
const text = (c) => JSON.stringify(c);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}% (${n}/${d})` : "n/a");
const quantile = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const stops = stoppages.slice(0, limit);
const ctxFor = (st, team = "any") => buildContext(match, states, st, candidateQuestions(match, states, st), team);

// fake model: only used to exercise the pipeline
const fakeFor = (lang) => async ({ user }) => {
  const c = fallbackCard(JSON.parse(user).context);
  if (lang === "hinglish") c.watch_next = "Agle 6 gend mein dhyan do, ye ab tight hai.";
  return JSON.stringify(c);
};

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const rows = [];       // { st, lang, ctx, r }
if (LIVE) {
  const jobs = stops.flatMap((st) => ["hinglish", "en"].map((lang) => ({ st, lang })));
  const res = await pool(jobs, 4, async ({ st, lang }) => {
    const ctx = ctxFor(st);
    const r = await generateCard(ctx, lang, FAKE ? { callModel: fakeFor(lang) } : {});
    process.stdout.write(".");
    return { st, lang, ctx, r };
  });
  rows.push(...res);
  console.log();
}

const llm = rows.filter((x) => x.r.source === "llm");
const finalCards = rows.map((x) => x.r.card);
const checks = [];
const add = (name, result, target, pass, note = "") => checks.push({ name, result, target, pass, note });
const SKIP = "skipped (no model key)";

// 1-2 grounding and fallback
if (LIVE) {
  add("Grounded + valid on first attempt", pct(llm.filter((x) => x.r.attempts === 1).length, rows.length), "report", null);
  add("Grounded + valid on any attempt", pct(llm.length, rows.length), "report", null);
  add("Fallback (template) rate", pct(rows.length - llm.length, rows.length), "report", null);
} else {
  add("Grounded + valid on first attempt", SKIP, "report", null);
  add("Fallback (template) rate", SKIP, "report", null);
}

// 3 outcome predictions
if (LIVE) {
  const n = finalCards.filter((c) => OUTCOME.test(text(c))).length;
  add("Cards that predict the result", `${n}/${finalCards.length}`, "0", n === 0);
} else add("Cards that predict the result", SKIP, "0", null);

// 4 language (only model-written cards count; templates also come in both languages, so they pass these checks by construction)
if (LIVE) {
  const h = llm.filter((x) => x.lang === "hinglish"), e = llm.filter((x) => x.lang === "en");
  const hOk = h.filter((x) => hindiCount(text(x.r.card), HINDI) >= 2).length;
  const eOk = e.filter((x) => hindiCount(text(x.r.card), HINDI_STRICT) === 0).length;
  add("Hinglish cards use Hindi words (>= 2)", pct(hOk, h.length), "100%", h.length ? hOk === h.length : null, "model-written cards only");
  add("English cards contain no Hindi words", pct(eOk, e.length), "100%", e.length ? eOk === e.length : null, "model-written cards only");
} else add("Language checks", SKIP, "100%", null);

// 5 review no-spoiler
if (LIVE) {
  const rv = rows.filter((x) => x.st.type === "review");
  const leaked = rv.filter((x) => VERDICT.test(text(x.r.card))).length;
  add("Review cards with verdict words", `${leaked}/${rv.length}`, "0", rv.length ? leaked === 0 : null);
} else add("Review cards with verdict words", SKIP, "0", null);

// 6 missing-data probe
{
  const base = stoppages.find((s) => s.type === "review");
  if (base) {
    const st = { ...base, review: { ...base.review, kind: "unknown" } };
    const ctx = ctxFor(st);
    const r = await generateCard(ctx, "en", FAKE ? { callModel: fakeFor("en") } : LIVE ? {} : { callModel: async () => { throw new Error("no key"); } });
    const c = r.card;
    const body = [c.headline, ...c.recap, c.why_it_matters, c.watch_next, c.review_explainer?.under_review ?? ""].join(" ");
    const hasUnc = c.uncertainties.length > 0 && c.uncertainties.some((u) => /type of review|review type|kind/i.test(u));
    const claims = /\b(lbw|leg before|wide|no[- ]?ball|caught behind|run[- ]?out|stumping)\b/i.test(body);
    add("Missing review type: listed as unknown, not guessed", `${hasUnc && !claims ? "pass" : "FAIL"} (${r.source} card)`, "pass", hasUnc && !claims,
      LIVE ? "" : "template card only; run with a key to test the model");
  }
}

// 7 failure drill (needs no key)
{
  const jobs = stoppages.flatMap((st) => ["hinglish", "en"].map((lang) => ({ st, lang })));
  let ok = 0;
  for (const { st, lang } of jobs) {
    const ctx = ctxFor(st);
    const r1 = await generateCard(ctx, lang, { callModel: async () => { throw new Error("simulated outage"); } });
    process.env.LLM_FORCE_FAIL = "1";
    const r2 = await generateCard(ctx, lang, { callModel: async () => { throw new Error("must not be called"); } });
    delete process.env.LLM_FORCE_FAIL;
    const good = (r) => { try { CardSchema.parse(r.card); assertGrounded(r.card, ctx); if (ctx.review) assertNoSpoiler(r.card); return r.source === "fallback"; } catch { return false; } };
    if (good(r1) && good(r2)) ok++;
  }
  add("Failure drill: every card falls back to a valid template", pct(ok, jobs.length), "100%", ok === jobs.length, "model throws, and LLM_FORCE_FAIL=1");
}

// 8 latency
if (LIVE) {
  const ms = llm.map((x) => x.r.ms);
  add("Generation latency p50 / p95", ms.length ? `${quantile(ms, 0.5)} ms / ${quantile(ms, 0.95)} ms` : "n/a", "report", null, FAKE ? "fake model, meaningless" : "includes retries");
} else add("Generation latency", SKIP, "report", null);

// ---- failures detail
const reasons = {};
for (const x of rows) if (x.r.source === "fallback") { const k = (x.r.error ?? "unknown").slice(0, 80); reasons[k] = (reasons[k] ?? 0) + 1; }

const mode = FAKE ? "FAKE MODEL. This only tests the eval pipeline. These are NOT results about the AI."
  : LIVE ? `LIVE model: ${model}` : "NO MODEL KEY. Live-model checks were skipped; only key-free checks ran.";
const status = (p) => (p === null ? "n/a" : p ? "PASS" : "FAIL");
let md = `# Break Mode eval results\n\n- Run: ${new Date().toISOString()}\n- Mode: **${mode}**\n- Match: ${match.title}${match.synthetic && !/synthetic/i.test(match.title) ? " (synthetic demo data)" : ""}\n- Cards generated: ${rows.length} (${stops.length} stoppages x 2 languages, no cache)\n\n`;
md += `| Check | Result | Target | Status | Note |\n|---|---|---|---|---|\n`;
for (const c of checks) md += `| ${c.name} | ${c.result} | ${c.target} | ${status(c.pass)} | ${c.note} |\n`;
md += `\n## Why cards fell back\n\n`;
md += Object.keys(reasons).length ? Object.entries(reasons).map(([k, v]) => `- ${v}x ${k}`).join("\n") : "- No fallbacks in this run (or no live run).";
md += `\n\n## Human rating\n\nNot collected yet. Give \`evals/rating-cards.md\` to 5 fans, ask them to rate each card's usefulness from 1 to 5, and ask what they would do in a break instead. Record the average and the sample size here, with the raw answers.\n\n| Card | Average (1-5) | Raters |\n|---|---|---|\n| (fill in) | | |\n`;
md += `\n## Limits\n\n- Small sample: one match, ${stops.length} stoppages.\n- Simulated timeouts and ad breaks are injected, so those cards test the writing, not real broadcast timing.\n- Grounding checks catch invented numbers and some outcome claims, not every possible wrong statement.\n`;
fs.writeFileSync(path.join(dir, "results.md"), md);

// ---- rating sheet
const sheetRows = rows.length ? rows
  : stops.map((st) => ({ st, lang: "en", r: { source: "fallback", card: fallbackCard(ctxFor(st)) } }));
const pickOne = (type, n = 0) => sheetRows.filter((x) => x.st.type === type && x.lang === "en")[n];
const sample = [pickOne("wicket", 0), pickOne("strategic_timeout", 0), pickOne("ad_break", 0), pickOne("review", 0), pickOne("innings_break", 0), pickOne("wicket", 1)].filter(Boolean);
let rs = `# Cards for human rating\n\n${LIVE && !FAKE ? "" : "> These are template or fake-model cards, NOT real AI output. Re-run the evals with a key before using this sheet.\n\n"}Rate each card's usefulness during a break from 1 (useless) to 5 (very useful). Then answer: what would you do in this break instead?\n\n`;
sample.forEach((x, i) => {
  const c = x.r.card;
  rs += `## Card ${i + 1}: ${x.st.type.replace("_", " ")} (${x.r.source === "llm" ? "AI" : "template"})\n\n**${c.headline}**\n\n${c.recap.map((l) => `- ${l}`).join("\n")}\n\n${c.why_it_matters}\n\n*Watch next:* ${c.watch_next}\n\n`;
  if (c.review_explainer) rs += `*Under review:* ${c.review_explainer.under_review}\n- If it stays: ${c.review_explainer.if_stays}\n- If it changes: ${c.review_explainer.if_changes}\n\n`;
  rs += `Usefulness (1-5): ____\n\n`;
});
fs.writeFileSync(path.join(dir, "rating-cards.md"), rs);

console.log(md);
const hardFail = checks.some((c) => c.pass === false);
process.exit(hardFail ? 1 : 0);
