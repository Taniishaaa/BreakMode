import { pool } from "./pool.js";

const toRow = (r) => r && ({
  id: r.id, userId: r.user_id, stoppageId: r.stoppage_id, questionId: r.question_id, optionId: r.option_id,
  correct: r.correct, points: r.points, why: r.why, resolvedAt: r.resolved_at,
});

const toAccount = (r) => ({ id: r.id, email: r.email, passwordHash: r.password_hash });

export const pgRepo = {
  kind: "postgres",
  async ensureUser(id) {
    await pool.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
  },
  async createAccount({ id, email, passwordHash }) {
    // ON CONFLICT DO NOTHING covers both the id and the case-insensitive email index; no row back means the email is taken
    const { rows } = await pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id, email, password_hash",
      [id, email, passwordHash]);
    return rows[0] ? toAccount(rows[0]) : null;
  },
  async findAccountByEmail(email) {
    const { rows } = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE lower(email) = lower($1)", [email]);
    return rows[0] ? toAccount(rows[0]) : null;
  },
  async findAccountById(id) {
    const { rows } = await pool.query("SELECT id, email, password_hash FROM users WHERE id = $1 AND email IS NOT NULL", [id]);
    return rows[0] ? toAccount(rows[0]) : null;
  },
  async ensureStoppage(matchId, s) {
    await pool.query(
      `INSERT INTO stoppages (id, match_id, type, after_seq, duration_sec, source, review)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [s.id, matchId, s.type, s.afterSeq, s.durationSec, s.source, s.review ? JSON.stringify(s.review) : null]);
  },
  async getPrediction(userId, stoppageId) {
    const { rows } = await pool.query(
      "SELECT * FROM predictions WHERE user_id=$1 AND stoppage_id=$2", [userId, stoppageId]);
    return toRow(rows[0]) ?? null;
  },
  async insertPrediction({ userId, stoppageId, questionId, optionId }) {
    await pool.query(
      `INSERT INTO predictions (user_id, stoppage_id, question_id, option_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, stoppage_id) DO NOTHING`,
      [userId, stoppageId, questionId, optionId]);
    return pgRepo.getPrediction(userId, stoppageId);
  },
  async markResolved(id, { correct, points, why }) {
    const { rows } = await pool.query(
      `UPDATE predictions SET correct=$2, points=$3, why=$4, resolved_at=now()
       WHERE id=$1 AND resolved_at IS NULL RETURNING *`, [id, correct, points, why]);
    if (rows[0]) return toRow(rows[0]);
    const cur = await pool.query("SELECT * FROM predictions WHERE id=$1", [id]);
    return toRow(cur.rows[0]) ?? null;
  },
  async listPredictions(userId) {
    const { rows } = await pool.query("SELECT * FROM predictions WHERE user_id=$1 ORDER BY id", [userId]);
    return rows.map(toRow);
  },
  async resetUser(userId) {
    await pool.query("DELETE FROM predictions WHERE user_id=$1", [userId]);
  },
  async getCard(stoppageId, lang, team) {
    const { rows } = await pool.query(
      "SELECT card FROM cards WHERE stoppage_id=$1 AND lang=$2 AND team=$3", [stoppageId, lang, team]);
    return rows[0]?.card ?? null;
  },
  async saveCard(stoppageId, lang, team, card, model) {
    await pool.query(
      `INSERT INTO cards (stoppage_id, lang, team, card, model) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (stoppage_id, lang, team) DO NOTHING`,
      [stoppageId, lang, team, JSON.stringify(card), model]);
  },
};
