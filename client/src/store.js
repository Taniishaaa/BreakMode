import { create } from "zustand";
import { buildTimeline } from "@bm/engine";
import { api, setAuthHooks } from "./api";

const MIN_BREAK_MS = 12000; // long enough to read a card and tap an answer
let toastId = 0;

// ---- session token (per browser; losing it just means signing in again)
const TOKEN_KEY = "bm_token";
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

// ---- routes live in the URL hash, so refresh and the back button work: #/matches  #/match/<id>  #/predictions
export function parseRoute(hash = globalThis.location?.hash ?? "") {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "match" && parts[1]) return { name: "match", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "predictions") return { name: "predictions" };
  return { name: "matches" };
}
export const hrefFor = (r) => (r.name === "match" ? `#/match/${encodeURIComponent(r.id)}` : r.name === "predictions" ? "#/predictions" : "#/matches");

const emptyMatch = {
  match: null, states: [], stoppages: [], byAfterSeq: {}, matchError: null, matchLoading: false,
  seq: -1, playing: false, active: null, shown: null, cards: {}, picks: {}, toasts: [],
};

export const useStore = create((set, get) => ({
  // ---- account
  token: readToken(), user: null, authStatus: "checking", // "checking" | "anon" | "authed"
  // ---- navigation
  route: parseRoute(),
  // ---- the open match and the replay
  ...emptyMatch,
  ballMs: 700, compress: 6,
  lang: "hinglish", team: "any",

  /** Called once on load: is the stored token still good? */
  bootAuth: async () => {
    if (!get().token) return set({ authStatus: "anon" });
    try {
      const { user } = await api.me();
      set({ user, authStatus: "authed" });
    } catch {
      // a 401 already signed us out; any other failure (server down) leaves the sign-in page with the token kept
      if (get().authStatus === "checking") set({ authStatus: "anon" });
    }
  },
  setSession: ({ token, user }) => { writeToken(token); set({ token, user, authStatus: "authed", ...emptyMatch }); },
  signOut: () => {
    writeToken(null);
    set({ token: null, user: null, authStatus: "anon", ...emptyMatch });
    if (globalThis.location) globalThis.location.hash = "#/matches";
  },

  syncRoute: () => {
    const route = parseRoute();
    set(route.name === "match" ? { route } : { route, playing: false });
  },
  go: (route) => { if (globalThis.location) globalThis.location.hash = hrefFor(route); },

  loadMatch: async (id) => {
    set({ ...emptyMatch, matchLoading: true });
    try {
      const { match, stoppages } = await api.match(id);
      set({
        ...emptyMatch, match, stoppages, states: buildTimeline(match),
        byAfterSeq: Object.fromEntries(stoppages.map((s) => [s.afterSeq, s])),
      });
    } catch (e) {
      set({ ...emptyMatch, matchError: e.message });
    }
  },

  setSeq: (seq) => set({ seq }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  /** Replaying clears this fan's predictions on the server (one prediction per stoppage). */
  restart: ({ autoplay = false } = {}) => {
    set({ seq: -1, playing: autoplay, active: null, shown: null, picks: {}, toasts: [] });
    api.reset().catch(() => {});
  },
  setBallMs: (ballMs) => set({ ballMs }),
  setLang: (lang) => set({ lang }),
  setTeam: (team) => set({ team }),
  startBreak: (stoppage, compress) => {
    const totalMs = Math.max((stoppage.durationSec * 1000) / compress, MIN_BREAK_MS);
    set({ active: { stoppage, endsAt: Date.now() + totalMs, totalMs }, shown: stoppage });
  },
  endBreak: () => set({ active: null }),

  setCard: (key, value) => set((s) => ({ cards: { ...s.cards, [key]: value } })),
  setPick: (stoppageId, pick) => set((s) => ({ picks: { ...s.picks, [stoppageId]: pick } })),
  patchPick: (stoppageId, patch) => set((s) =>
    s.picks[stoppageId] ? { picks: { ...s.picks, [stoppageId]: { ...s.picks[stoppageId], ...patch } } } : {}),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts, { id: ++toastId, ...t }].slice(-3) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// An expired or revoked token anywhere sends the fan back to sign in.
setAuthHooks({
  getToken: () => useStore.getState().token,
  onUnauthorized: () => { if (useStore.getState().authStatus === "authed") useStore.getState().signOut(); },
});
