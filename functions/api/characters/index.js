import { json, error, readJson, randomId, now } from "../../../lib/util.js";
import { parseCharacterInput, rowToCharacter, MAX_CHARACTERS } from "../../../lib/characters.js";

export async function onRequestGet({ env, data }) {
  if (!data.user) return error(401, "Sign in first.");
  const { results } = await env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM progress p WHERE p.character_id = c.id AND p.status = 'done') AS done_count
     FROM characters c WHERE c.user_id = ? ORDER BY c.updated_at DESC`
  ).bind(data.user.id).all();
  return json({ characters: results.map(r => ({ ...rowToCharacter(r), done_count: r.done_count })) });
}

export async function onRequestPost({ env, data, request }) {
  if (!data.user) return error(401, "Sign in first.");
  let fields;
  try { fields = parseCharacterInput(await readJson(request)); } catch (e) { return error(400, e.message); }
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM characters WHERE user_id = ?").bind(data.user.id).first();
  if (count.n >= MAX_CHARACTERS) return error(400, `You reached the limit of ${MAX_CHARACTERS} characters.`);
  const t = now();
  const c = {
    id: randomId(), name: fields.name, server: fields.server ?? "", life: fields.life ?? 5,
    entry: fields.entry ?? 1, vip: fields.vip ?? 1, expansions: fields.expansions ?? "[]",
    show_options: fields.show_options ?? 0,
  };
  await env.DB.prepare(
    `INSERT INTO characters (id, user_id, name, server, life, entry, vip, expansions, show_options, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(c.id, data.user.id, c.name, c.server, c.life, c.entry, c.vip, c.expansions, c.show_options, t, t).run();
  const row = await env.DB.prepare("SELECT * FROM characters WHERE id = ?").bind(c.id).first();
  return json({ character: rowToCharacter(row) }, 201);
}
