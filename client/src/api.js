// The session token lives here so every request can send it; the store registers the hooks below.
let hooks = { getToken: () => null, onUnauthorized: () => {} };
export const setAuthHooks = (h) => { hooks = { ...hooks, ...h }; };

/** Zod errors arrive as "field: message"; show only the message. */
const friendly = (data, status) => {
  if (data.details?.length) return data.details.map((d) => String(d).replace(/^[\w.]+:\s*/, "")).join(" ");
  return data.error || `Server replied ${status}`;
};

async function call(method, url, body, { timeoutMs = 10000, auth = true } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = auth ? hooks.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method, signal: ctrl.signal, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "The server took too long to answer" : "Could not reach the server");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) hooks.onUnauthorized();
  if (!res.ok) throw new Error(friendly(data, res.status));
  return data;
}

export const api = {
  register: (b) => call("POST", "/api/auth/register", b, { auth: false }),
  login: (b) => call("POST", "/api/auth/login", b, { auth: false }),
  me: () => call("GET", "/api/auth/me"),
  matches: () => call("GET", "/api/matches"),
  match: (id) => call("GET", `/api/matches/${encodeURIComponent(id)}`),
  getBreak: (b) => call("POST", "/api/break", b, { timeoutMs: 50000 }), // the AI may retry once; the template shows meanwhile
  predict: (b) => call("POST", "/api/predictions", b),
  resolve: (b) => call("POST", "/api/predictions/resolve", b),
  history: () => call("GET", "/api/history"),
  reset: () => call("POST", "/api/reset", {}),
};