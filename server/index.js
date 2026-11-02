import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import api from "./routes/api.js";

const app = express();
app.set("trust proxy", 1); // behind Render/Railway proxies, so rate limits see real IPs
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" });
  next();
});
app.use(express.json({ limit: "50kb" }));
app.use("/api", api);

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, "index.html"))); // SPA fallback
} else {
  app.use((_req, res) =>
    res.status(404).send("Client not built. Run `npm run dev:client` for development or `npm run build` for production."));
}

// never leak stack traces
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request too large" });
  if (err?.name === "ZodError") return res.status(400).json({ error: "Invalid request", details: err.issues?.map((i) => `${i.path.join(".")}: ${i.message}`) });
  if (err?.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Break Mode server on http://localhost:${port}`));
