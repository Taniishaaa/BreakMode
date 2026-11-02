// Rebuilds the stoppages table from data/match.json. Safe to re-run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { match, stoppages } from "../data.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(fs.readFileSync(path.join(dir, "schema.sql"), "utf8"));
    for (const s of stoppages) {
      await client.query(
        `INSERT INTO stoppages (id, match_id, type, after_seq, duration_sec, source, review)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET match_id=EXCLUDED.match_id, type=EXCLUDED.type,
           after_seq=EXCLUDED.after_seq, duration_sec=EXCLUDED.duration_sec,
           source=EXCLUDED.source, review=EXCLUDED.review`,
        [s.id, match.id, s.type, s.afterSeq, s.durationSec, s.source, s.review ? JSON.stringify(s.review) : null],
      );
    }
    await client.query("COMMIT");
    console.log(`Seeded ${stoppages.length} stoppages for ${match.id}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
