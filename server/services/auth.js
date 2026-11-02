import crypto from "node:crypto";
import { promisify } from "node:util";
import { fail } from "./errors.js";

const scrypt = promisify(crypto.scrypt);
const b64 = (buf) => Buffer.from(buf).toString("base64url");
const DAY = 24 * 60 * 60 * 1000;

/** scrypt$<salt>$<hash>, both hex. scrypt is built into Node, so there is no extra dependency. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [kind, saltHex, keyHex] = String(stored ?? "").split("$");
  if (kind !== "scrypt" || !saltHex || !keyHex) return false;
  const want = Buffer.from(keyHex, "hex");
  const got = await scrypt(password, Buffer.from(saltHex, "hex"), want.length);
  return crypto.timingSafeEqual(got, want);
}

/** Signed, expiring session token: base64url(payload).base64url(HMAC-SHA256). Stateless, so a restart keeps sessions. */
export function createTokens(secret, { ttlMs = 7 * DAY, now = Date.now } = {}) {
  const sign = (body) => b64(crypto.createHmac("sha256", secret).update(body).digest());
  return {
    issue(userId) {
      const body = b64(JSON.stringify({ sub: userId, exp: now() + ttlMs }));
      return `${body}.${sign(body)}`;
    },
    /** @returns {string|null} the user id, or null if the token is malformed, tampered with or expired */
    verify(token) {
      const [body, sig, extra] = String(token ?? "").split(".");
      if (!body || !sig || extra !== undefined) return null;
      const want = Buffer.from(sign(body)), got = Buffer.from(sig);
      if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
      try {
        const { sub, exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        return typeof sub === "string" && typeof exp === "number" && exp > now() ? sub : null;
      } catch { return null; }
    },
  };
}

const publicUser = (a) => ({ id: a.id, email: a.email });

/** Email + password accounts. The repo stores the hash; this service never returns it. */
export function createAuthService({ repo, secret, ttlMs, now }) {
  const tokens = createTokens(secret, { ttlMs, now });
  // Verified against when the email is unknown, so "no such account" costs the same time as "wrong password".
  const dummy = hashPassword("not-a-real-password");
  const session = (account) => ({ token: tokens.issue(account.id), user: publicUser(account) });

  return {
    async register({ email, password }) {
      if (await repo.findAccountByEmail(email)) fail(409, "An account with this email already exists. Sign in instead.");
      const account = await repo.createAccount({ id: crypto.randomUUID(), email, passwordHash: await hashPassword(password) });
      if (!account) fail(409, "An account with this email already exists. Sign in instead."); // lost a race with another sign-up
      return session(account);
    },

    async login({ email, password }) {
      const account = await repo.findAccountByEmail(email);
      const ok = await verifyPassword(password, account?.passwordHash ?? (await dummy));
      if (!account || !ok) fail(401, "Incorrect email or password.");
      return session(account);
    },

    /** Resolves a bearer token to its account, or throws 401. */
    async authenticate(token) {
      const id = tokens.verify(token);
      const account = id ? await repo.findAccountById(id) : null;
      if (!account) fail(401, "Please sign in again.");
      return publicUser(account);
    },
  };
}
