import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { match, states, stoppages } from "../data.js";
import { createMemoryRepo } from "../db/memoryRepo.js";
import { createPredictionService } from "./predictions.js";
import { createBreakService } from "./breakCards.js";
import { createAuthService } from "./auth.js";

async function pickRepo() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set: using the in-memory store (data is lost on restart).");
    return createMemoryRepo();
  }
  try {
    const { pool } = await import("../db/pool.js");
    const { pgRepo } = await import("../db/pgRepo.js");
    const schema = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../db/schema.sql"), "utf8");
    await pool.query(schema); // idempotent
    console.log("Using Postgres.");
    return pgRepo;
  } catch (e) {
    console.error(`Postgres unavailable (${e.message}); falling back to the in-memory store.`);
    return createMemoryRepo();
  }
}

export const repo = await pickRepo();
const ctx = { repo, match, states, stoppages };
export const predictions = createPredictionService(ctx);
export const breaks = createBreakService(ctx);

function authSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  console.warn("AUTH_SECRET is not set: using a random one, so everyone is signed out whenever the server restarts. Set it in production.");
  return crypto.randomBytes(32).toString("hex");
}
export const auth = createAuthService({ repo, secret: authSecret() });
