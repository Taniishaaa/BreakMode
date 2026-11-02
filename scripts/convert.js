// Convert a Cricsheet JSON match file into data/match.json (Break Mode format).
// Usage: npm run convert -- path/to/match.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @param {object} raw parsed Cricsheet JSON @param {string} id */
export function convertCricsheet(raw, id) {
  const events = [];
  let seq = 0;
  raw.innings.forEach((inn, i) => {
    inn.overs.forEach((ov) => {
      ov.deliveries.forEach((d) => {
        const extras = d.extras ?? {};
        const w = d.wickets?.[0]; // two wickets on one ball is very rare; ignored
        events.push({
          seq: seq++,
          innings: i + 1,
          over: ov.over, // 0-indexed in Cricsheet
          batter: d.batter, nonStriker: d.non_striker, bowler: d.bowler,
          runsBatter: d.runs.batter, runsExtras: d.runs.extras, runsTotal: d.runs.total,
          extraType: Object.keys(extras)[0] ?? null, // wides|noballs|byes|legbyes|penalty
          legal: !("wides" in extras) && !("noballs" in extras),
          wicket: w ? { kind: w.kind, playerOut: w.player_out,
                        fielders: (w.fielders ?? []).map((f) => f.name) } : null,
          review: d.review ? {
            by: d.review.by, batter: d.review.batter,
            decision: d.review.decision, umpiresCall: !!d.review.umpires_call,
            type: d.review.type ?? null,
            ...(d.review.demo ? { demo: true } : {}),
          } : null,
        });
      });
    });
  });
  return {
    id,
    title: `${raw.info.teams[0]} vs ${raw.info.teams[1]}`,
    date: raw.info.dates?.[0] ?? null,
    teams: raw.info.teams,
    ballsPerOver: raw.info.balls_per_over ?? 6,
    maxOvers: raw.info.overs ?? 20,
    outcome: raw.info.outcome ?? null,
    innings: raw.innings.map((i) => ({ team: i.team, target: i.target ?? null })),
    events,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: npm run convert -- path/to/match.json"); process.exit(1); }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const match = convertCricsheet(raw, path.basename(file, ".json"));
  fs.writeFileSync("data/match.json", JSON.stringify(match));
  const revs = match.events.filter((e) => e.review).length;
  const wkts = match.events.filter((e) => e.wicket).length;
  console.log(`${match.events.length} deliveries, ${wkts} wickets, ${revs} reviews written to data/match.json`);
  console.log("Outcome:", JSON.stringify(match.outcome));
}
