// Outils partagés par les Pages Functions : réponses JSON, cookies, jetons, session.

export const SESSION_COOKIE = "sid";
export const STATE_COOKIE = "oauth_state";
export const SESSION_DAYS = 180;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function error(status, message) {
  return json({ error: message }, status);
}

export function parseCookies(request) {
  const out = {};
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, path = "/" } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; Secure; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomId() {
  return crypto.randomUUID();
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

// Renvoie l'utilisateur de la session, ou null.
export async function currentUser(env, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT u.id, u.username, u.avatar, u.discord_id, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
  ).bind(hash).first();
  if (!row) return null;
  if (row.expires_at < now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
    return null;
  }
  return { id: row.id, username: row.username, avatar: row.avatar, discord_id: row.discord_id, tokenHash: hash };
}

// Les requêtes qui modifient des données doivent venir du site lui-même.
export function sameOrigin(request, env) {
  const origin = request.headers.get("origin");
  const expected = env.APP_ORIGIN || new URL(request.url).origin;
  if (origin) return origin === expected || origin === new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === "same-origin";
}

export async function readJson(request, maxBytes = 8192) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Request too large.");
  try { return JSON.parse(text || "{}"); } catch { throw new Error("Invalid JSON."); }
}
