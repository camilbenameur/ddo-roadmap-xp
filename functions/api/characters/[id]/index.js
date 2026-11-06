import { json, error, readJson, now } from "../../../../lib/util.js";
import { parseCharacterInput, rowToCharacter, ownedCharacter } from "../../../../lib/characters.js";

export async function onRequestGet({ env, data, params }) {
  if (!data.user) return error(401, "Sign in first.");
  const row = await ownedCharacter(env, data.user.id, params.id);
  if (!row) return error(404, "Character not found.");
  const { results } = await env.DB.prepare(
    "SELECT step_id, status, updated_at FROM progress WHERE character_id = ? ORDER BY updated_at"
  ).bind(row.id).all();
  return json({ character: rowToCharacter(row), progress: results });
}

export async function onRequestPatch({ env, data, params, request }) {
  if (!data.user) return error(401, "Sign in first.");
  const row = await ownedCharacter(env, data.user.id, params.id);
  if (!row) return error(404, "Character not found.");
  let fields;
  try { fields = parseCharacterInput(await readJson(request), { partial: true }); } catch (e) { return error(400, e.message); }
  const keys = Object.keys(fields);
  if (keys.length) {
    // Les clés viennent de parseCharacterInput : liste fermée, pas d'injection possible.
    const set = keys.map(k => `${k} = ?`).join(", ");
    await env.DB.prepare(`UPDATE characters SET ${set}, updated_at = ? WHERE id = ?`)
      .bind(...keys.map(k => fields[k]), now(), row.id).run();
  }
  const updated = await env.DB.prepare("SELECT * FROM characters WHERE id = ?").bind(row.id).first();
  return json({ character: rowToCharacter(updated) });
}

export async function onRequestDelete({ env, data, params }) {
  if (!data.user) return error(401, "Sign in first.");
  const row = await ownedCharacter(env, data.user.id, params.id);
  if (!row) return error(404, "Character not found.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM progress WHERE character_id = ?").bind(row.id),
    env.DB.prepare("DELETE FROM characters WHERE id = ?").bind(row.id),
  ]);
  return json({ ok: true });
}
