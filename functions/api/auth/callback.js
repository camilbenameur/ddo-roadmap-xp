import {
  SESSION_COOKIE, STATE_COOKIE, SESSION_DAYS,
  cookie, parseCookies, randomToken, randomId, sha256Hex, now,
} from "../../../lib/util.js";

function back(message) {
  const url = message ? `/app/#/error/${encodeURIComponent(message)}` : "/app/";
  return new Response(null, {
    status: 302,
    headers: { location: url, "set-cookie": cookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth" }) },
  });
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = parseCookies(request)[STATE_COOKIE];
  if (url.searchParams.get("error")) return back("Discord sign-in was cancelled.");
  if (!code || !state || !expected || state !== expected) return back("The sign-in link expired. Try again.");
  if (!env.DISCORD_CLIENT_SECRET) return back("Discord sign-in is not set up yet.");

  const origin = env.APP_ORIGIN || url.origin;
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/auth/callback`,
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) {
    // La réponse d'erreur de Discord ne contient aucun secret : on la journalise pour le diagnostic.
    const detail = (await tokenRes.text().catch(() => "")).slice(0, 300);
    console.log(`discord token exchange failed: ${tokenRes.status} ${detail}`);
    return back(`Discord refused the sign-in (${tokenRes.status}). Try again.`);
  }
  const tok = await tokenRes.json();

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  if (!meRes.ok) return back("Could not read your Discord profile.");
  const me = await meRes.json();
  if (!me || !me.id) return back("Invalid Discord profile.");

  const t = now();
  const username = String(me.global_name || me.username || "Adventurer").slice(0, 64);
  const avatar = me.avatar ? String(me.avatar).slice(0, 64) : null;
  let user = await env.DB.prepare("SELECT id FROM users WHERE discord_id = ?").bind(String(me.id)).first();
  if (user) {
    await env.DB.prepare("UPDATE users SET username = ?, avatar = ?, last_login_at = ? WHERE id = ?")
      .bind(username, avatar, t, user.id).run();
  } else {
    user = { id: randomId() };
    await env.DB.prepare("INSERT INTO users (id, discord_id, username, avatar, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.id, String(me.id), username, avatar, t, t).run();
  }

  const token = randomToken(32);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").bind(user.id, t),
    env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256Hex(token), user.id, t, t + SESSION_DAYS * 86400),
  ]);

  const headers = new Headers({ location: "/app/" });
  headers.append("set-cookie", cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 }));
  headers.append("set-cookie", cookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth" }));
  return new Response(null, { status: 302, headers });
}
