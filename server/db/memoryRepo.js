// In-memory repository: used when DATABASE_URL is not set (or Postgres is unreachable).
// Same interface as pgRepo. Data is lost on restart.
export function createMemoryRepo() {
  const users = new Set();
  const accounts = new Map(); // id -> { id, email, passwordHash }
  const preds = [];           // rows, in insertion order
  const cards = new Map();
  let nextId = 1;
  const copy = (r) => (r ? { ...r } : null);

  return {
    kind: "memory",
    async ensureUser(id) { users.add(id); },
    /** @returns the new account, or null if the email is already taken (case-insensitive) */
    async createAccount({ id, email, passwordHash }) {
      const taken = [...accounts.values()].some((a) => a.email.toLowerCase() === email.toLowerCase());
      if (taken) return null;
      const row = { id, email, passwordHash };
      accounts.set(id, row); users.add(id);
      return { ...row };
    },
    async findAccountByEmail(email) {
      return copy([...accounts.values()].find((a) => a.email.toLowerCase() === email.toLowerCase()));
    },
    async findAccountById(id) { return copy(accounts.get(id)); },
    async ensureStoppage() {},
    async getPrediction(userId, stoppageId) {
      return copy(preds.find((p) => p.userId === userId && p.stoppageId === stoppageId));
    },
    async insertPrediction({ userId, stoppageId, questionId, optionId }) {
      let row = preds.find((p) => p.userId === userId && p.stoppageId === stoppageId);
      if (!row) {
        row = { id: nextId++, userId, stoppageId, questionId, optionId,
                correct: null, points: null, why: null, resolvedAt: null };
        preds.push(row);
      }
      return copy(row);
    },
    async markResolved(id, { correct, points, why }) {
      const row = preds.find((p) => p.id === id);
      if (row && !row.resolvedAt) Object.assign(row, { correct, points, why, resolvedAt: new Date() });
      return copy(row);
    },
    async listPredictions(userId) { return preds.filter((p) => p.userId === userId).map(copy); },
    async resetUser(userId) {
      for (let i = preds.length - 1; i >= 0; i--) if (preds[i].userId === userId) preds.splice(i, 1);
    },
    async getCard(stoppageId, lang, team) { return cards.get(`${stoppageId}|${lang}|${team}`)?.card ?? null; },
    async saveCard(stoppageId, lang, team, card, model) {
      cards.set(`${stoppageId}|${lang}|${team}`, { card, model });
    },
  };
}
