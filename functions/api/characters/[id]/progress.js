import { json, error, readJson, now } from "../../../../lib/util.js";
import { ownedCharacter, isStepId, MAX_PROGRESS } from "../../../../lib/characters.js";

// PUT { step_id, status: "done" | "skipped" | null }  ->  null efface l'étape.
// PUT { reset: true }  ->  nouvelle vie : efface toute la progression du perso.
export async function onRequestPut({ env, data, params, request }) {
  if (!data.user) return error(401, "Sign in first.");
  const row = await ownedCharacter(env, data.user.id, params.id);
  if (!row) return error(404, "Character not found.");
  let body;
  try { body = await readJson(request, 64 * 1024); } catch (e) { return error(400, e.message); }
  const t = now();

  // Import en lot (reprise de la progression d'essai) : { items: [{ step_id, status }] }, 500 au plus.
  if (Array.isArray(body.items)) {
    if (body.items.length > 500) return error(400, "500 steps at most per request.");
    const items = body.items.filter(i => i && isStepId(i.step_id) && (i.status === "done" || i.status === "skipped"));
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM progress WHERE character_id = ?").bind(row.id).first();
    if (n.n + items.length > MAX_PROGRESS) return error(400, "Too many saved steps for this character.");
    if (items.length) {
      await env.DB.batch(items.map(i => env.DB.prepare(
        `INSERT INTO progress (character_id, step_id, status, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(character_id, step_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
      ).bind(row.id, i.step_id, i.status, t)));
    }
    await env.DB.prepare("UPDATE characters SET updated_at = ? WHERE id = ?").bind(t, row.id).run();
    return json({ ok: true, imported: items.length });
  }

  if (body.reset === true) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM progress WHERE character_id = ?").bind(row.id),
      env.DB.prepare("UPDATE characters SET updated_at = ? WHERE id = ?").bind(t, row.id),
    ]);
    return json({ ok: true });
  }

  if (!isStepId(body.step_id)) return error(400, "Invalid step.");
  if (body.status === null) {
    await env.DB.prepare("DELETE FROM progress WHERE character_id = ? AND step_id = ?").bind(row.id, body.step_id).run();
  } else if (body.status === "done" || body.status === "skipped") {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM progress WHERE character_id = ?").bind(row.id).first();
    if (n.n >= MAX_PROGRESS) return error(400, "Too many saved steps for this character.");
    await env.DB.prepare(
      `INSERT INTO progress (character_id, step_id, status, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(character_id, step_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
    ).bind(row.id, body.step_id, body.status, t).run();
  } else {
    return error(400, "Invalid status.");
  }
  await env.DB.prepare("UPDATE characters SET updated_at = ? WHERE id = ?").bind(t, row.id).run();
  return json({ ok: true });
}
