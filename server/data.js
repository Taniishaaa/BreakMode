import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildTimeline, detectStoppages } from "@bm/engine";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const EventSchema = z.object({
  seq: z.number().int(), innings: z.number().int().min(1).max(2), over: z.number().int(),
  batter: z.string(), nonStriker: z.string(), bowler: z.string(),
  runsBatter: z.number(), runsExtras: z.number(), runsTotal: z.number(),
  extraType: z.string().nullable(), legal: z.boolean(),
  wicket: z.object({ kind: z.string() }).passthrough().nullable(),
  review: z.object({ by: z.string() }).passthrough().nullable(),
});

const MatchSchema = z.object({
  id: z.string(), title: z.string(), teams: z.tuple([z.string(), z.string()]),
  ballsPerOver: z.number().int().positive(), maxOvers: z.number().int().positive(),
  outcome: z.any().nullable(),
  innings: z.array(z.object({ team: z.string(), target: z.any().nullable() })).length(2),
  events: z.array(EventSchema).min(1),
}).passthrough();

const ConfigSchema = z.object({
  wicketSec: z.number(), reviewSec: z.number(), timeoutSec: z.number(),
  adBreakSec: z.number(), inningsBreakSec: z.number(),
  timeoutsAfterOver: z.array(z.number().int()), adBreakAfterOvers: z.array(z.number().int()),
});

export const match = MatchSchema.parse(readJson("data/match.json"));
export const config = ConfigSchema.parse(readJson("data/stoppages.config.json"));
match.events.forEach((e, i) => {
  if (e.seq !== i) throw new Error(`match.json: event ${i} has seq ${e.seq}; seq must equal the index`);
});
export const states = buildTimeline(match);
export const stoppages = detectStoppages(match, config);
export const getStoppage = (id) => stoppages.find((s) => s.id === id) ?? null;
