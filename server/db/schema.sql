-- match.json stays the source of truth; the database holds only what changes.
CREATE TABLE IF NOT EXISTS stoppages (
  id TEXT PRIMARY KEY, match_id TEXT NOT NULL, type TEXT NOT NULL,
  after_seq INT NOT NULL, duration_sec INT, source TEXT, review JSONB
);

-- AI card cache. team is 'any' when no favourite team is chosen.
CREATE TABLE IF NOT EXISTS cards (
  stoppage_id TEXT REFERENCES stoppages(id), lang TEXT, team TEXT,
  card JSONB NOT NULL, model TEXT, created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (stoppage_id, lang, team)
);

CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now());
-- Email + password accounts (the password column holds a scrypt hash, never the password).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY, user_id UUID REFERENCES users(id),
  stoppage_id TEXT REFERENCES stoppages(id), question_id TEXT, option_id TEXT,
  correct BOOLEAN, points INT, why TEXT, resolved_at TIMESTAMPTZ,
  UNIQUE (user_id, stoppage_id)
);
