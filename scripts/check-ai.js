// Checks that your ANTHROPIC_API_KEY and LLM_MODEL work from this machine, and how long one call takes.
//   npm run check:ai
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const model = process.env.LLM_MODEL || "claude-haiku-5-5";
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is empty in .env"); process.exit(1); }
console.log(`Calling ${model} ...`);
const t0 = Date.now();
try {
  const res = await new Anthropic({ maxRetries: 0 }).messages.create(
    { model, max_tokens: 20, messages: [{ role: "user", content: "Reply with the single word: ok" }] },
    { timeout: 15000 });
  console.log(`OK in ${Date.now() - t0} ms. Reply: ${res.content.find((b) => b.type === "text")?.text}`);
} catch (e) {
  console.error(`FAILED after ${Date.now() - t0} ms: ${e.status ?? ""} ${e.message}`);
  process.exit(1);
}