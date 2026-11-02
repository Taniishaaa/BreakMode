# Deploy checklist

One Node service serves the API and the built React app. Hosted Postgres stores cards and predictions.

1. **Database.** Create a hosted Postgres (Neon and Supabase have free tiers; check current limits). Copy the connection
   string and make sure it ends with `?sslmode=require` (hosted databases need TLS).
2. **Web service.** On Render (or Railway), create a Web Service:
   - Build: `npm install --include=dev && npm run build`
   - Start: `npm start`
   - Health check path: `/api/health`
   - Env: `AUTH_SECRET` (a long random string, e.g. from `openssl rand -hex 32`), `DATABASE_URL`, `ANTHROPIC_API_KEY`, `LLM_MODEL`, and optionally `LLM_MAX_CALLS_PER_HOUR` (default 300).
     `PORT` is injected by the platform. Railway works the same way.
3. **Spend limit.** Set a monthly spend limit on the API key in the provider console. The server also caps model calls
   per hour with `LLM_MAX_CALLS_PER_HOUR`.
4. **Seed (optional).** The server creates its tables on start. To pre-create the stoppage rows from your machine:
   `DATABASE_URL=<hosted url> npm run db:seed`.
5. **Pre-warm the cards** so the demo is instant and independent of API latency:
   `DATABASE_URL=<hosted url> ANTHROPIC_API_KEY=<key> npm run warm` (add `-- --teams` to warm favourite-team variants).
   Anything printed as "template (not cached)" failed twice; run it again.
   To warm through the running site instead, add `-- --url https://<your-app> --email you@example.com --password <password>` (the account is created if it does not exist).
6. **Check** `https://<your-app>/api/health`. It should say `"store":"postgres"` and `"ai":true`. Then create an account on the site and open the demo match.
7. **Play the whole match on your phone** (signed in) over mobile data, once, before you present.

Free services sleep when idle. Open the page a minute before the demo.

Cards are cached by stoppage, language and team. If you change the prompt or the match data, clear the cache:
`TRUNCATE cards;` (and `TRUNCATE predictions;` if the match changed), then warm again.
