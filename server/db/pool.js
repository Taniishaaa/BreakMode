import pg from "pg";
import "dotenv/config";

const url = process.env.DATABASE_URL ?? "";
const local = /@(localhost|127\.0\.0\.1|db)(:|\/)/.test(url);
// Hosted Postgres (Neon, Supabase, Render) needs TLS. Put ?sslmode=require in the URL, or we add it for non-local hosts.
const ssl = !local && url && !/sslmode=/.test(url) ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({ connectionString: url, ssl });
