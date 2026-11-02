// Pre-generate and cache every break card, so the demo is instant and independent of API latency.
//   npm run warm                         warms the Postgres in DATABASE_URL directly (needs ANTHROPIC_API_KEY)
//   npm run warm -- --url https://app --email you@x.com --password secret
//                                        warms through a running server's API instead (rate-limit aware).
//                                        The API needs a login; the account is created if it does not exist.
//   add --teams to also warm the "favourite team" variants
import "dotenv/config";
import { match, stoppages } from "../server/data.js";

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const base = urlIdx >= 0 ? args[urlIdx + 1]?.replace(/\/$/, "") : null;
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const teams = args.includes("--teams") ? ["any", ...match.teams] : ["any"];
const langs = ["hinglish", "en"];
const jobs = stoppages.flatMap((st) => langs.flatMap((lang) => teams.map((team) => ({ st, lang, team }))));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let getBreak;
if (base) {
  const email = arg("--email") ?? process.env.WARM_EMAIL, password = arg("--password") ?? process.env.WARM_PASSWORD;
  if (!email || !password) { console.error("--url needs a login: pass --email and --password (or set WARM_EMAIL and WARM_PASSWORD)."); process.exit(1); }
  const post = (path, body, token) => fetch(`${base}/api${path}`, {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let res = await post("/auth/login", { email, password });
  if (res.status === 401) res = await post("/auth/register", { email, password }); // first run: create the account
  if (!res.ok) { console.error(`Could not sign in (HTTP ${res.status}). Check the email and password.`); process.exit(1); }
  const { token } = await res.json();
  getBreak = async ({ stoppageId, lang, team }) => {
    for (let tries = 0; tries < 6; tries++) {
      const res = await post("/break", { stoppageId, lang, team }, token);
      if (res.status === 429) { await sleep(Number(res.headers.get("retry-after") ?? 5) * 1000 + 500); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
    throw new Error("rate limited too long");
  };
} else {
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set. Warming only helps when cards are stored in Postgres."); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set, so every card would be a template."); process.exit(1); }
  const { breaks, repo } = await import("../server/services/index.js");
  if (repo.kind !== "postgres") { console.error("Postgres is unreachable, refusing to warm the in-memory store."); process.exit(1); }
  getBreak = (b) => breaks.getBreak(b);
}

const tally = { llm: 0, cache: 0, fallback: 0, error: 0 };
const bad = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { st, lang, team } = jobs[next++];
    try {
      const r = await getBreak({ stoppageId: st.id, lang, team });
      tally[r.source === "llm" ? "llm" : r.source === "cache" ? "cache" : "fallback"]++;
      if (r.source === "fallback") bad.push(`${st.id} ${lang} ${team}: template used (not cached)`);
    } catch (e) {
      tally.error++; bad.push(`${st.id} ${lang} ${team}: ${e.message}`);
    }
    process.stdout.write(`\r${next}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: base ? 1 : 3 }, worker));
console.log(`\nwarmed ${jobs.length} cards: ${tally.llm} new AI, ${tally.cache} already cached, ${tally.fallback} template (not cached), ${tally.error} errors`);
if (bad.length) { console.log("Needs attention (run again to retry):\n  " + bad.join("\n  ")); process.exitCode = 1; }
process.exit(process.exitCode ?? 0);
