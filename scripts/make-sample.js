// Generates a SYNTHETIC T20 chase in Cricsheet JSON format and converts it to
// data/match.json, so the app runs with no downloads. Not real cricket.
// Replace it with a real match: npm run convert -- path/to/cricsheet.json
import fs from "node:fs";
import { convertCricsheet } from "./convert.js";

const T1 = "Mumbai Meteors", T2 = "Delhi Dynamos";
const XI1 = ["A. Rao", "S. Menon", "K. Iyer", "R. Patel", "V. Singh", "D. Nair", "M. Shah", "T. Khan", "P. Joshi", "N. Gill", "H. Bose"];
const XI2 = ["I. Verma", "J. Kapoor", "L. Reddy", "B. Mehta", "C. Das", "G. Sinha", "O. Pillai", "Q. Ahuja", "U. Thakur", "W. Saxena", "Y. Chopra"];

function rng32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// outcome weights per phase: powerplay, middle, death
const W = [
  { dot: 30, 1: 28, 2: 6, 4: 15, 6: 5, W: 4, wd: 5, nb: 1, bye: 1, lb: 1 },
  { dot: 33, 1: 33, 2: 7, 4: 9, 6: 4, W: 4.5, wd: 4, nb: 1, bye: 1, lb: 1 },
  { dot: 24, 1: 26, 2: 8, 4: 13, 6: 9, W: 7, wd: 6, nb: 1.5, bye: 1, lb: 1 },
];
const pick = (r, table) => {
  const tot = Object.values(table).reduce((a, b) => a + b, 0);
  let x = r * tot;
  for (const [k, v] of Object.entries(table)) { if ((x -= v) < 0) return k; }
  return "dot";
};

function simInnings(r, bat, field, target) {
  const bowlers = field.slice(6, 11); // 5 bowlers, 4 overs each
  const overs = [];
  let runs = 0, wk = 0, legal = 0, s = 0, n = 1, next = 2, done = false;
  for (let o = 0; o < 20 && !done; o++) {
    const bowler = bowlers[o % 5], deliveries = [];
    const phase = o < 6 ? 0 : o < 16 ? 1 : 2;
    let inOver = 0;
    while (inOver < 6 && !done) {
      const out = pick(r(), W[phase]);
      let rb = 0, re = 0, extras = null, isLegal = true, wickets, swapRuns = 0;
      if (out === "1") { rb = 1; swapRuns = 1; }
      else if (out === "2") { rb = 2; }
      else if (out === "4") rb = 4;
      else if (out === "6") rb = 6;
      else if (out === "wd") { extras = { wides: 1 }; re = 1; isLegal = false; }
      else if (out === "nb") { extras = { noballs: 1 }; re = 1; isLegal = false; rb = r() < 0.5 ? 0 : r() < 0.5 ? 1 : 4; swapRuns = rb % 2; }
      else if (out === "bye") { extras = { byes: 1 }; re = 1; swapRuns = 1; }
      else if (out === "lb") { extras = { legbyes: 1 }; re = 1; swapRuns = 1; }
      else if (out === "W") {
        const x = r();
        const kind = x < 0.25 ? "bowled" : x < 0.7 ? "caught" : x < 0.85 ? "lbw" : x < 0.95 ? "run out" : "stumped";
        const fielders = kind === "caught" || kind === "run out" || kind === "stumped"
          ? [{ name: field[Math.floor(r() * 11)] }] : [];
        wickets = [{ player_out: bat[s], kind, fielders }];
      }
      const total = rb + re;
      deliveries.push({
        batter: bat[s], bowler, non_striker: bat[n],
        runs: { batter: rb, extras: re, total },
        ...(extras ? { extras } : {}),
        ...(wickets ? { wickets } : {}),
      });
      runs += total;
      if (isLegal) { legal++; inOver++; }
      if (wickets) { wk++; if (wk < 10) s = next++; else done = true; }
      else if (swapRuns % 2 === 1) [s, n] = [n, s];
      if (target != null && runs >= target) done = true;
    }
    if (inOver === 6) [s, n] = [n, s];
    overs.push({ over: o, deliveries });
  }
  return { overs, runs, wk, legal };
}

function addReview(innings, nth, by, decision, umpiresCall = false) {
  let c = 0;
  for (const ov of innings.overs) for (const d of ov.deliveries) {
    if (d.wickets && ++c === nth) {
      d.wickets[0].kind = "lbw"; d.wickets[0].fielders = [];
      d.review = { by, batter: d.wickets[0].player_out, decision, type: "lbw", umpires_call: umpiresCall, demo: true };
      return true;
    }
  }
  return false;
}

let found = null;
for (let seed = 1; seed < 200000 && !found; seed++) {
  const r = rng32(seed);
  const a = simInnings(r, XI1, XI2, null);
  if (a.runs < 155 || a.runs > 195) continue;
  const target = a.runs + 1;
  const b = simInnings(r, XI2, XI1, target);
  if (b.runs >= target && b.legal >= 108 && b.wk >= 5 && b.wk <= 8) found = { seed, a, b, target };
}
if (!found) throw new Error("no suitable synthetic chase found");

const { a, b, target } = found;
const inn1 = { team: T1, overs: a.overs };
const inn2 = { team: T2, overs: b.overs, target: { overs: 20, runs: target } };
addReview(inn1, 3, T1, "upheld");        // bowling side reviews a not-out lbw; overturned
addReview(inn2, 4, T2, "struck down");   // batting side reviews an lbw; out stands
const raw = {
  info: {
    teams: [T1, T2], dates: ["2026-01-01"], overs: 20, balls_per_over: 6,
    outcome: { winner: T2, by: { wickets: 10 - b.wk } },
  },
  innings: [inn1, inn2],
};
const match = { ...convertCricsheet(raw, "synthetic-demo"), synthetic: true,
  title: `${T1} vs ${T2} (synthetic demo)` };
fs.writeFileSync("data/match.json", JSON.stringify(match));
console.log(`seed ${found.seed}: ${T1} ${a.runs}/${a.wk}, ${T2} ${b.runs}/${b.wk} in ${b.legal} balls; ${match.events.length} deliveries`);
