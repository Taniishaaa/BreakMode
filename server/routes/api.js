import { Router } from "express";
import rateLimit from "express-rate-limit";
import { match, stoppages } from "../data.js";
import { predictions, breaks, auth, repo } from "../services/index.js";
import { listMatches, summary } from "../services/matches.js";
import { BreakBody, PredictBody, ResolveBody, RegisterBody, LoginBody } from "../services/validate.js";
import { fail } from "../services/errors.js";

const api = Router();
// sync throws (Zod parse errors) and async rejections both reach the error handler
const wrap = (fn) => async (req, res, next) => {
  try { res.json(await fn(req, res)); } catch (err) { next(err); }
};

const limiter = (limit, message = "Too many requests, slow down") =>
  rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false, message: { error: message } });
const generalLimit = limiter(300);
const breakLimit = limiter(30);
const authLimit = limiter(10, "Too many sign-in attempts. Wait a minute and try again.");

api.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
api.use(generalLimit);

api.get("/health", (_req, res) => res.json({ ok: true, store: repo.kind, ai: Boolean(process.env.ANTHROPIC_API_KEY) }));

// ---- accounts (email + password)
api.post("/auth/register", authLimit, wrap((req) => auth.register(RegisterBody.parse(req.body))));
api.post("/auth/login", authLimit, wrap((req) => auth.login(LoginBody.parse(req.body))));

/** Everything below needs `Authorization: Bearer <token>`. The fan is the token's account, never a body field. */
api.use(async (req, _res, next) => {
  try {
    const header = req.get("authorization") ?? "";
    req.user = await auth.authenticate(header.startsWith("Bearer ") ? header.slice(7) : "");
    next();
  } catch (err) { next(err); }
});

api.get("/auth/me", wrap((req) => ({ user: req.user })));

api.get("/matches", wrap(() => ({ matches: listMatches(match, stoppages) })));
api.get("/matches/:id", wrap((req) => {
  if (req.params.id !== match.id) fail(404, "Match not found");
  return { summary: summary(match, stoppages), match, stoppages };
}));
api.get("/match", wrap(() => ({ match, stoppages })));

api.post("/break", breakLimit, wrap((req) => breaks.getBreak(BreakBody.parse(req.body))));
api.post("/predictions", wrap((req) => predictions.save({ ...PredictBody.parse(req.body), userId: req.user.id })));
api.post("/predictions/resolve", wrap((req) => predictions.resolve({ ...ResolveBody.parse(req.body), userId: req.user.id })));
api.get("/history", wrap((req) => predictions.history(req.user.id)));
api.post("/reset", wrap((req) => predictions.reset(req.user.id)));

api.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default api;
