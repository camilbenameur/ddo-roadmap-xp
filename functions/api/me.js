import { json, error, SESSION_COOKIE, cookie } from "../../lib/util.js";

export async function onRequestGet({ data }) {
  if (!data.user) return json({ user: null });
  const { id, username, avatar, discord_id } = data.user;
  const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${discord_id}/${avatar}.png?size=64` : null;
  return json({ user: { id, username, avatarUrl } });
}

// Suppression du compte : utilisateur, sessions, persos, progression.
export async function onRequestDelete({ env, data }) {
  if (!data.user) return error(401, "Sign in first.");
  const uid = data.user.id;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM progress WHERE character_id IN (SELECT id FROM characters WHERE user_id = ?)").bind(uid),
    env.DB.prepare("DELETE FROM characters WHERE user_id = ?").bind(uid),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(uid),
  ]);
  return json({ ok: true }, 200, { "set-cookie": cookie(SESSION_COOKIE, "", { maxAge: 0 }) });
}
