// Validation et lecture des persos.

export const MAX_CHARACTERS = 30;
export const MAX_PROGRESS = 3000;
const STEP_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function isStepId(s) {
  return typeof s === "string" && STEP_ID.test(s);
}

function cleanText(v, max) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

// Transforme un corps de requête en champs valides ; ne garde que ce qui est fourni.
export function parseCharacterInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || "name" in body) {
    const name = cleanText(body.name, 40);
    if (!name) throw new Error("Character name is required.");
    out.name = name;
  }
  if ("server" in body) out.server = cleanText(body.server, 30);
  if ("life" in body) {
    const life = Number(body.life);
    if (!Number.isInteger(life) || life < 1 || life > 999) throw new Error("Invalid life number.");
    out.life = life;
  }
  if ("entry" in body) {
    const entry = Number(body.entry);
    if (![1, 15, 20].includes(entry)) throw new Error("Invalid start level (1, 15 or 20).");
    out.entry = entry;
  }
  if ("vip" in body) out.vip = body.vip ? 1 : 0;
  if ("show_options" in body) out.show_options = body.show_options ? 1 : 0;
  if ("expansions" in body) {
    if (!Array.isArray(body.expansions) || body.expansions.length > 60) throw new Error("Invalid expansion list.");
    out.expansions = JSON.stringify([...new Set(body.expansions.map(x => cleanText(x, 60)).filter(Boolean))]);
  }
  return out;
}

export function rowToCharacter(r) {
  let expansions = [];
  try { expansions = JSON.parse(r.expansions || "[]"); } catch { expansions = []; }
  return {
    id: r.id, name: r.name, server: r.server, life: r.life, entry: r.entry,
    vip: !!r.vip, show_options: !!r.show_options, expansions,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

export async function ownedCharacter(env, userId, id) {
  if (typeof id !== "string" || id.length > 64) return null;
  return env.DB.prepare("SELECT * FROM characters WHERE id = ? AND user_id = ?").bind(id, userId).first();
}
