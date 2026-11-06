import { SESSION_COOKIE, cookie, json } from "../../../lib/util.js";

export async function onRequestPost({ env, data }) {
  if (data.user) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(data.user.tokenHash).run();
  }
  return json({ ok: true }, 200, { "set-cookie": cookie(SESSION_COOKIE, "", { maxAge: 0 }) });
}
