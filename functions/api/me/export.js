import { error } from "../../../lib/util.js";

// Export de toutes les données du compte, en JSON (droit d'accès et de portabilité).
export async function onRequestGet({ env, data }) {
  if (!data.user) return error(401, "Sign in first.");
  const uid = data.user.id;
  const user = await env.DB.prepare("SELECT discord_id, username, avatar, created_at, last_login_at FROM users WHERE id = ?").bind(uid).first();
  const { results: characters } = await env.DB.prepare("SELECT id, name, server, life, entry, vip, expansions, show_options, created_at, updated_at FROM characters WHERE user_id = ?").bind(uid).all();
  const { results: progress } = await env.DB.prepare(
    "SELECT p.character_id, p.step_id, p.status, p.updated_at FROM progress p JOIN characters c ON c.id = p.character_id WHERE c.user_id = ?"
  ).bind(uid).all();
  const body = JSON.stringify({ exported_at: new Date().toISOString(), user, characters, progress }, null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="roadmap-xp-data.json"',
      "cache-control": "no-store",
    },
  });
}
