// Roadmap XP : l'app. Sans framework ; rendu par le DOM, jamais de innerHTML avec des données.
import { trailNode, slideTorch, torchFraction } from "/assets/trail.js";

const view = document.getElementById("main");
let PREVIEW = [];
try { PREVIEW = JSON.parse(document.getElementById("preview-data")?.textContent || "[]"); } catch { PREVIEW = []; }
const state = { user: null, mode: null, route: null, chars: [], char: null, progress: new Map(), order: [] };
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- outils ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const svgTick = () => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M3 8.5 6.5 12 13 4.5"); s.append(p); return s;
};

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

let painted = false;
function paint(nodes, { focus = false } = {}) {
  const first = !painted; painted = true;
  const swap = () => { view.replaceChildren(...nodes); if (focus && !first) view.focus({ preventScroll: true }); };
  // Pas de transition sur un onglet masqué : le navigateur n'y rend aucune image et l'écran resterait figé.
  if (document.startViewTransition && !reduceMotion() && focus && document.visibilityState === "visible" && view.childElementCount && !view.querySelector(".muted:only-child")) { const vt = document.startViewTransition(swap); vt.ready.catch(() => {}); vt.finished.catch(() => {}); return vt.updateCallbackDone.catch(() => {}); }
  swap();
  return Promise.resolve();
}

function ls(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) || "null");
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
  return null;
}

/* ---------- stockage : compte (API) ou démo (navigateur) ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "content-type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
  return data;
}

const remote = {
  async list() { return (await api("/api/characters")).characters; },
  async create(body) { return (await api("/api/characters", { method: "POST", body })).character; },
  async get(id) { return api(`/api/characters/${encodeURIComponent(id)}`); },
  async patch(id, body) { return (await api(`/api/characters/${id}`, { method: "PATCH", body })).character; },
  async remove(id) { await api(`/api/characters/${id}`, { method: "DELETE" }); },
  async set(id, step_id, status) { await api(`/api/characters/${id}/progress`, { method: "PUT", body: { step_id, status } }); },
  async bulk(id, items) { await api(`/api/characters/${id}/progress`, { method: "PUT", body: { items } }); },
  async reset(id) { await api(`/api/characters/${id}/progress`, { method: "PUT", body: { reset: true } }); },
};

const DEMO = "rx-demo";
function demoDb() { return ls(DEMO) || { chars: [], progress: {} }; }
function demoSave(db) { ls(DEMO, db); }
const local = {
  async list() {
    const db = demoDb();
    return db.chars.map(c => ({ ...c, done_count: Object.values(db.progress[c.id] || {}).filter(p => p.status === "done").length }));
  },
  async create(body) {
    const db = demoDb();
    const t = Math.floor(Date.now() / 1000);
    const c = { id: `demo-${crypto.randomUUID()}`, name: body.name, server: body.server || "", life: body.life || 5, entry: body.entry || 1,
      vip: body.vip !== false, expansions: body.expansions || [], show_options: !!body.show_options, created_at: t, updated_at: t };
    db.chars.unshift(c); db.progress[c.id] = {}; demoSave(db); return c;
  },
  async get(id) {
    const db = demoDb();
    const c = db.chars.find(x => x.id === id);
    if (!c) throw new Error("Character not found.");
    const progress = Object.entries(db.progress[id] || {}).map(([step_id, p]) => ({ step_id, status: p.status, updated_at: p.at })).sort((a, b) => a.updated_at - b.updated_at);
    return { character: c, progress };
  },
  async patch(id, body) {
    const db = demoDb(); const c = db.chars.find(x => x.id === id);
    Object.assign(c, body, { updated_at: Math.floor(Date.now() / 1000) }); demoSave(db); return c;
  },
  async remove(id) { const db = demoDb(); db.chars = db.chars.filter(x => x.id !== id); delete db.progress[id]; demoSave(db); },
  async set(id, step_id, status) {
    const db = demoDb(); db.progress[id] = db.progress[id] || {};
    if (status) db.progress[id][step_id] = { status, at: Date.now() }; else delete db.progress[id][step_id];
    demoSave(db);
  },
  async reset(id) { const db = demoDb(); db.progress[id] = {}; demoSave(db); },
};
const store = () => (state.mode === "account" ? remote : local);

/* ---------- route ---------- */
const BANDS = [
  { id: "h1", label: "Heroic 1-9", from: 1, to: 9, cls: "h" },
  { id: "h2", label: "Heroic 10-19", from: 10, to: 19, cls: "h" },
  { id: "e", label: "Epic 20-29", from: 20, to: 29, cls: "e" },
  { id: "l", label: "Legendary 30-36", from: 30, to: 99, cls: "l" },
];
const bandOf = lvl => BANDS.find(b => lvl >= b.from && lvl <= b.to) || BANDS[0];
const TRACK = { f2p: "free alternative", option: "optional" };

function visibleSteps(c) {
  if (!state.route) return [];
  return state.route.steps.filter(s => {
    if (s.lvl < c.entry) return false;
    if (s.track === "option" && !c.show_options) return false;
    if (s.track === "f2p" && c.vip) return false;
    if (s.access === "vip" && !c.vip) return false;
    if (s.access === "expansion" && !(c.expansions || []).includes(s.pack)) return false;
    return true;
  });
}
const xpTarget = life => (life >= 8 ? "3.8M" : life >= 5 ? "2.85M" : "1.9M");
const qname = s => s.title || s.quest;

async function loadRoute() {
  if (state.route) return;
  const res = await fetch("/route.json");
  if (!res.ok) throw new Error("Route not found.");
  state.route = await res.json();
}
async function loadChar(id) {
  const data = await store().get(id);
  state.char = data.character;
  state.progress = new Map(data.progress.map(p => [p.step_id, p.status]));
  state.order = data.progress.map(p => p.step_id);
}

async function setStatus(stepId, status) {
  const c = state.char;
  const before = state.progress.get(stepId) || null;
  const t = view.querySelector(".trail");
  const prevAbs = t ? Number(t.dataset.start) + Number(t.dataset.active) : null;
  const viaButton = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".quest .actions"));
  const viaTick = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".tick"));
  const tickId = viaTick ? document.activeElement.id : null;
  const y = scrollY;
  if (status) { state.progress.set(stepId, status); state.order = state.order.filter(x => x !== stepId).concat(stepId); }
  else { state.progress.delete(stepId); state.order = state.order.filter(x => x !== stepId); }
  rerender(prevAbs);
  announce(stepId, status);
  if (viaButton) view.querySelector(".quest .btn.primary")?.focus({ preventScroll: true });
  if (viaTick) { (document.getElementById(tickId) || view.querySelector("li.current input, .quest .btn.primary"))?.focus({ preventScroll: true }); scrollTo(0, y); }
  try { await store().set(c.id, stepId, status); }
  catch (e) {
    if (before) state.progress.set(stepId, before); else state.progress.delete(stepId);
    toast(`Not saved: ${e.message}`); rerender();
  }
}
function announce(stepId, status) {
  const live = document.getElementById("live");
  if (!live || !state.route) return;
  const s = state.route.steps.find(x => x.id === stepId);
  const next = visibleSteps(state.char).find(x => !state.progress.has(x.id));
  const what = status === "done" ? "done" : status === "skipped" ? "skipped" : "back on the route";
  live.textContent = `${s ? qname(s) : "Quest"} ${what}.${next ? ` Next: ${qname(next)}.` : ""}`;
}
function undo() { const last = state.order[state.order.length - 1]; if (last) setStatus(last, null); }

/* ---------- en-tête ---------- */
function header(c) {
  const nav = document.getElementById("app-nav");
  const here = location.hash || "#/";
  const links = [];
  if (state.mode) links.push(["#/", "Characters"]);
  if (c) links.push([`#/p/${c.id}`, c.name, "char"], [`#/p/${c.id}/route`, "Route"], [`#/p/${c.id}/settings`, "Settings"]);
  if (state.mode === "account") links.push(["#/account", "Account"]);
  links.push(["/guide/", "Guide"]);
  nav.closest(".wrap").classList.toggle("has-sub", links.length > 2);
  nav.replaceChildren(...links.map(([href, label, cls]) => h("a", { href, class: cls || null, "aria-current": here === href ? "page" : null }, label)));
  const who = document.getElementById("who");
  who.replaceChildren();
  if (state.mode === "account" && state.user) {
    if (state.user.avatarUrl) who.append(h("img", { src: state.user.avatarUrl, alt: "", width: "28", height: "28" }));
  } else if (state.mode === "demo") {
    who.append(h("a", { class: "btn discord", href: "/api/auth/login", rel: "nofollow" }, "Keep my progress"));
  }
}

/* ---------- écrans ---------- */
function viewChoice(msg) {
  header(null);
  paint([h("div", { class: "stack" },
    h("h1", {}, "Choose how to start"),
    msg ? h("p", { class: "banner", role: "alert" }, msg) : null,
    h("div", { class: "choice" },
      h("section", { class: "panel" },
        h("h2", {}, "Try it here"),
        h("p", { class: "muted" }, "Your progress stays in this browser. Sign in later to keep it on your account."),
        h("div", {}, h("button", { class: "btn primary big", type: "button", onclick: startDemo }, "Try it without an account"))),
      h("section", { class: "panel" },
        h("h2", {}, "Keep it everywhere"),
        h("p", { class: "muted" }, "Your progress follows you on every device. With Discord, the site only receives your Discord ID, username and avatar."),
        h("div", {}, h("a", { class: "btn discord big", href: "/api/auth/login", rel: "nofollow" }, "Sign in with Discord")))),
    previewNode(),
  )], { focus: true });
}

// Aperçu : les premières bornes du sentier, pour montrer ce qui attend avant de choisir.
function previewNode() {
  if (!PREVIEW.length) return null;
  const first = PREVIEW[0];
  const node = trailNode(PREVIEW.map((s, i) => ({ lvl: s.lvl, name: s.title, state: i === 0 ? "next" : "todo" })), { draw: !reduceMotion(), label: "First quests of the route" });
  return h("section", { class: "preview", "aria-labelledby": "preview-h" },
    h("h2", { id: "preview-h" }, "Where your trail starts"),
    node,
    h("p", { class: "muted" }, "First quest: ", h("b", {}, first.title), first.giver ? `, from ${first.giver}.` : ".", " Each quest shows who to talk to, where the entrance is and its pack."));
}

function startDemo() {
  ls("rx-mode", "demo"); state.mode = "demo";
  location.hash = "#/new";
}

async function viewChars() {
  header(null);
  const list = await store().list();
  const demo = state.mode === "account" ? await local.list() : [];
  const cards = list.map(c => {
    const steps = visibleSteps(c);
    const pct = steps.length ? Math.min(100, Math.round((c.done_count / steps.length) * 100)) : 0;
    return h("a", { class: "charcard arrive", href: `#/p/${c.id}` },
      h("span", { class: "nm" }, c.name),
      h("span", { class: "pct" }, `${pct}%`),
      h("span", { class: "meta" }, [c.server, `life ${c.life}`, `starts at level ${c.entry}`].filter(Boolean).join(" · ")));
  });
  paint([h("div", { class: "stack" },
    h("div", { class: "row", style: "justify-content:space-between" },
      h("h1", {}, "Your characters"),
      h("a", { class: "btn primary", href: "#/new" }, "New character")),
    demo.length ? h("div", { class: "banner" },
      h("span", {}, `You have ${demo.length} trial character${demo.length > 1 ? "s" : ""} in this browser.`),
      h("button", { class: "btn primary", type: "button", onclick: importDemo }, "Add them to my account")) : null,
    state.mode === "demo" ? h("p", { class: "banner" }, h("span", {}, "Trial mode: your progress stays in this browser."), h("a", { class: "btn discord", href: "/api/auth/login", rel: "nofollow" }, "Keep my progress")) : null,
    cards.length ? h("div", { class: "chars" }, cards) : h("p", { class: "panel muted" }, "No characters yet. Create your first one: a name and a life number are enough."),
  )], { focus: true });
}

async function importDemo(e) {
  const btn = e.currentTarget; btn.disabled = true;
  try {
    const db = demoDb();
    for (const c of db.chars) {
      const created = await remote.create({ name: c.name, server: c.server, life: c.life, entry: c.entry, vip: c.vip, expansions: c.expansions, show_options: c.show_options });
      const items = Object.entries(db.progress[c.id] || {}).sort((a, b) => a[1].at - b[1].at).map(([step_id, p]) => ({ step_id, status: p.status }));
      for (let i = 0; i < items.length; i += 500) await remote.bulk(created.id, items.slice(i, i + 500));
    }
    ls(DEMO, null); toast("Trial progress added to your account."); route();
  } catch (err) { toast(`Import stopped: ${err.message}`); btn.disabled = false; }
}

function charForm(c, onSubmit, submitLabel) {
  const exps = (state.route && state.route.expansions) || [];
  const err = h("p", { class: "err", id: "f-name-err", role: "status" });
  const form = h("form", { class: "grid", novalidate: true, onsubmit: async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const nameInput = form.querySelector("#f-name");
    if (!name) { nameInput.setAttribute("aria-invalid", "true"); err.textContent = "Give your character a name."; nameInput.focus(); return; }
    nameInput.removeAttribute("aria-invalid"); err.textContent = "";
    const body = { name, server: fd.get("server"), life: Number(fd.get("life")), entry: Number(fd.get("entry")),
      vip: fd.get("vip") === "on", show_options: fd.get("show_options") === "on", expansions: fd.getAll("exp") };
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try { await onSubmit(body); } catch (x) { toast(x.message); } finally { btn.disabled = false; }
  } },
    h("div", { class: "two" },
      h("div", { class: "field" }, h("label", { for: "f-name" }, "Character name"),
        h("input", { id: "f-name", name: "name", type: "text", autocomplete: "off", maxlength: "40", value: c.name ?? "My character", "aria-describedby": "f-name-err" }), err),
      h("div", { class: "field" }, h("label", { for: "f-server" }, "Server"),
        h("input", { id: "f-server", name: "server", type: "text", autocomplete: "off", maxlength: "30", value: c.server || "", placeholder: "Thrane, Cannith…" }))),
    h("div", { class: "two" },
      h("div", { class: "field" }, h("label", { for: "f-life" }, "Life number"),
        h("input", { id: "f-life", name: "life", type: "number", inputmode: "numeric", min: "1", max: "999", value: String(c.life || 5), "aria-describedby": "f-life-hint" }),
        h("span", { class: "hint", id: "f-life-hint" }, "Sets the XP needed for level 20: 1.9M up to life 4, 2.85M for lives 5 to 7, 3.8M after that.")),
      h("div", { class: "field" }, h("label", { for: "f-entry" }, "This life starts at"),
        h("select", { id: "f-entry", name: "entry" },
          [[1, "level 1 (Heroic or Racial TR)"], [20, "level 20 (Epic Reincarnation)"], [15, "level 15 (iconic)"]]
            .map(([v, l]) => h("option", { value: String(v), selected: (c.entry || 1) === v }, l))))),
    h("label", { class: "check", for: "f-vip" }, h("input", { id: "f-vip", name: "vip", type: "checkbox", checked: c.vip !== false }), "VIP (all adventure packs, not expansions)"),
    h("details", { class: "more", open: !!c.id }, h("summary", {}, "Expansions and optional quests"),
    exps.length ? h("fieldset", {}, h("legend", {}, "Expansions you own"),
      h("div", { class: "exp" }, exps.map((x, i) => h("label", { class: "check", for: `f-exp-${i}` },
        h("input", { id: `f-exp-${i}`, name: "exp", type: "checkbox", value: x, checked: (c.expansions || []).includes(x) }), x)))) : null,
    h("label", { class: "check", for: "f-opt" }, h("input", { id: "f-opt", name: "show_options", type: "checkbox", checked: !!c.show_options }), "Also show optional quests")),
    h("div", { class: "row" }, h("button", { class: "btn primary big", type: "submit" }, submitLabel)));
  return form;
}

function viewNew() {
  header(null);
  paint([h("div", { class: "stack" },
    h("h1", {}, "New character"),
    h("div", { class: "panel" }, charForm({}, async body => {
      const c = await store().create(body);
      location.hash = `#/p/${c.id}`;
    }, "Create and see my first quest")))], { focus: true });
}

function bandsBar(steps) {
  return h("div", { class: "bands", role: "group", "aria-label": "Progress by tier" }, BANDS.map(b => {
    const inBand = steps.filter(s => bandOf(s.lvl).id === b.id);
    const handled = inBand.filter(s => state.progress.get(s.id) === "done").length;
    const p = inBand.length ? handled / inBand.length : 0;
    return h("div", { class: `band ${b.cls}` },
      h("div", { class: "bar", role: "progressbar", "aria-label": b.label, "aria-valuemin": "0", "aria-valuemax": String(inBand.length), "aria-valuenow": String(handled) },
        h("div", { class: "fill", style: `--p:${p}` })),
      h("div", { class: "lab" }, h("span", {}, b.label), h("span", { class: "mono" }, `${Math.round(p * 100)}%`)));
  }));
}

function accessChip(s) {
  if (!s.access) return null;
  const label = s.access === "free" ? "Free to Play" : s.access === "expansion" ? `${s.pack} (expansion)` : s.access === "vip" ? (s.pack ? `${s.pack} (VIP)` : "VIP pack") : "Access unknown";
  return h("span", { class: `chip ${s.access}` }, label);
}
const tierCls = lvl => `tier-${bandOf(lvl).cls}`;
const wiki = s => `https://ddowiki.com/page/${encodeURIComponent(qname(s).replace(/ /g, "_"))}`;

function questCard(s) {
  const facts = [];
  if (s.giver || s.giver_where) facts.push(["Talk to", [s.giver ? h("b", {}, s.giver) : null, s.giver && s.giver_where ? ", " : null, s.giver_where || null]]);
  if (s.entrance) facts.push(["Entrance", s.entrance]);
  if (s.path && s.path.length) facts.push(["Path", h("span", { class: "path" }, s.path.map(p => h("span", {}, p)))]);
  if (s.rxp) facts.push(["Reaper XP", h("span", { class: "mono" }, `${s.rxp} per skull`)]);
  return h("section", { class: "quest arrive", "aria-labelledby": "q-title" },
    h("h2", { class: "title", id: "q-title" }, qname(s)),
    h("div", { class: "chips" },
      h("span", { class: `chip lvl ${tierCls(s.lvl)}` }, `Level ${s.lvl}`),
      s.diff ? h("span", { class: "chip" }, s.diff) : null,
      accessChip(s),
      TRACK[s.track] ? h("span", { class: "chip" }, TRACK[s.track]) : null),
    s.why ? h("p", { class: "why" }, s.why) : null,
    facts.length ? h("dl", { class: "facts" }, facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]))
      : h("p", { class: "muted", style: "margin:1rem 0" }, "No details yet: the ddowiki page shows the quest giver and the entrance."),
    h("div", { class: "actions" },
      h("button", { class: "btn primary big", type: "button", onclick: () => setStatus(s.id, "done") }, "Done ", h("kbd", {}, "D")),
      h("button", { class: "btn", type: "button", onclick: () => setStatus(s.id, "skipped") }, "Skip ", h("kbd", {}, "S")),
      state.order.length ? h("button", { class: "btn ghost", type: "button", onclick: undo }, "Undo ", h("kbd", {}, "U")) : null),
    (s.saga || s.tip) ? h("details", { class: "qdetails" }, h("summary", {}, "Details"),
      s.saga ? h("p", {}, `Counts for the saga ${s.saga}.`) : null,
      s.tip ? h("p", { class: "tip" }, s.tip) : null) : null,
    h("div", { class: "links" },
      h("a", { href: s.map || wiki(s), target: "_blank", rel: "noopener" }, "Map and entrance (ddowiki)"),
      s.url ? h("a", { href: s.url, target: "_blank", rel: "noopener" }, "Compendium page") : null));
}

function dashNodes() {
  const c = state.char;
  const steps = visibleSteps(c);
  const nextIdx = steps.findIndex(s => !state.progress.has(s.id));
  const next = nextIdx >= 0 ? steps[nextIdx] : null;
  const doneCount = steps.filter(s => state.progress.get(s.id) === "done").length;
  const skipCount = steps.filter(s => state.progress.get(s.id) === "skipped").length;
  // Sentier : 2 bornes passées, la torche, 4 à venir.
  let trail = null;
  if (next) {
    const start = Math.max(0, nextIdx - 2);
    const win = steps.slice(start, start + 7).map(s => ({ lvl: s.lvl, name: qname(s), state: s.id === next.id ? "next" : (state.progress.get(s.id) || "todo") }));
    trail = trailNode(win, { start });
  }
  const upcoming = next ? steps.slice(nextIdx + 1).filter(s => !state.progress.has(s.id)).slice(0, 5) : [];
  return [h("div", { class: "stack" },
    h("div", {},
      h("h1", { class: "char-name" }, c.name),
      h("div", { class: "meta" },
        c.server ? h("span", {}, c.server) : null,
        h("span", {}, "life ", h("span", { class: "mono" }, String(c.life))),
        h("span", {}, "Level 20 XP: ", h("span", { class: "mono" }, xpTarget(c.life))),
        h("span", {}, h("span", { class: "mono" }, `${doneCount}/${steps.length}`), " quests done"),
        skipCount ? h("span", {}, h("span", { class: "mono" }, String(skipCount)), " skipped") : null)),
    trail,
    next ? questCard(next) : h("section", { class: "quest" },
      h("h2", { class: "title" }, "Every quest of this life is done"),
      h("div", { class: "chips" }, h("span", { class: "chip next" }, "Route complete")),
      h("p", { class: "muted" }, "Before you reincarnate, run your legendary quests on Reaper: per ddowiki, the first run gives three times the Reaper XP. Then use New life in Settings.")),
    upcoming.length ? h("section", {}, h("h2", {}, "Up next"), h("ul", { class: "list" }, upcoming.map(s => stepRow(s)))) : null,
    bandsBar(steps),
    h("p", { class: "keys" }, "Keyboard: ", h("kbd", {}, "D"), " done, ", h("kbd", {}, "S"), " skip, ", h("kbd", {}, "U"), " undo, ", h("kbd", {}, "R"), " full route and back."),
  )];
}

function rerender(prevAbs) {
  const hash = location.hash;
  if (/\/route$/.test(hash)) { view.replaceChildren(...routeNodes()); return; }
  const nodes = dashNodes();
  nodes.forEach(n => n.querySelectorAll(".arrive").forEach(e => e.classList.remove("arrive")));
  view.replaceChildren(...nodes);
  const t = view.querySelector(".trail");
  if (t && prevAbs !== null && prevAbs !== undefined) slideTorch(t, (prevAbs - Number(t.dataset.start) + 0.5) / Number(t.dataset.n));
}

function stepRow(s, current) {
  const st = state.progress.get(s.id);
  const id = `cb-${s.id}`;
  return h("li", { class: [st || "", current ? "current" : ""].join(" ").trim() },
    h("span", { class: "tick" },
      h("input", { type: "checkbox", id, checked: st === "done", "aria-label": `Done: ${qname(s)}`, onchange: e => setStatus(s.id, e.target.checked ? "done" : null) }),
      svgTick()),
    h("span", { class: "lv" }, `Lvl ${s.lvl}`),
    h("span", { class: "nm" }, h("b", {}, qname(s)),
      h("small", {}, [s.giver ? `Talk to ${s.giver}${s.giver_where ? `, ${s.giver_where}` : ""}` : null, s.group].filter(Boolean).join(" · ") || " ")),
    h("span", { class: "acc" }, accessChip(s)));
}

function routeNodes() {
  const c = state.char;
  const steps = visibleSteps(c);
  const hideDone = ls("rx-hide-done") === true;
  const nextId = (steps.find(s => !state.progress.has(s.id)) || {}).id;
  const groups = [];
  for (const s of steps) {
    if (hideDone && state.progress.has(s.id)) continue;
    const b = bandOf(s.lvl);
    if (!groups.length || groups[groups.length - 1].band !== b.id) groups.push({ band: b.id, label: b.label, items: [] });
    groups[groups.length - 1].items.push(s);
  }
  return [h("div", { class: "stack" },
    h("div", { class: "row", style: "justify-content:space-between" },
      h("h1", {}, "Full route"),
      h("label", { class: "check", for: "hide-done" },
        h("input", { id: "hide-done", type: "checkbox", checked: hideDone, onchange: e => { ls("rx-hide-done", e.target.checked); rerender(); } }),
        "Hide completed quests")),
    bandsBar(steps),
    groups.length ? groups.map(g => h("section", {}, h("h2", { class: "group-h" }, g.label), h("ul", { class: "list" }, g.items.map(s => stepRow(s, s.id === nextId)))))
      : h("p", { class: "panel muted" }, "Nothing to show with these settings."))];
}

function twoStep(label, confirmLabel, action, cls = "") {
  let armed = false, timer;
  const btn = h("button", { class: `btn ${cls}`, type: "button", onclick: async () => {
    if (!armed) { armed = true; btn.textContent = confirmLabel; timer = setTimeout(() => { armed = false; btn.textContent = label; }, 5000); return; }
    clearTimeout(timer); btn.disabled = true;
    try { await action(); } catch (e) { toast(e.message); btn.disabled = false; }
  } }, label);
  return btn;
}

function viewSettings() {
  const c = state.char;
  header(c);
  paint([h("div", { class: "stack" },
    h("h1", {}, "Settings"),
    h("div", { class: "panel" }, charForm(c, async body => {
      state.char = await store().patch(c.id, body); toast("Saved."); location.hash = `#/p/${c.id}`;
    }, "Save")),
    h("section", { class: "panel stack" },
      h("h2", {}, "End of life"),
      h("p", { class: "muted" }, "After you reincarnate, New life clears every checked quest and moves to the next life."),
      h("div", { class: "row" },
        twoStep("New life", "Confirm: clear everything", async () => {
          await store().reset(c.id); await store().patch(c.id, { life: c.life + 1 });
          await loadChar(c.id); toast(`Life ${state.char.life} started.`); location.hash = `#/p/${c.id}`;
        }))),
    h("section", { class: "panel stack" },
      h("h2", {}, "Delete character"),
      h("p", { class: "muted" }, "Removes this character and its progress. This cannot be undone."),
      h("div", {}, twoStep("Delete this character", "Confirm delete", async () => {
        await store().remove(c.id); state.char = null; toast("Character deleted."); location.hash = "#/";
      }, "danger"))))], { focus: true });
}

function viewAccount() {
  header(null);
  paint([h("div", { class: "stack" },
    h("h1", {}, "Your account"),
    h("section", { class: "panel stack" },
      h("p", {}, "Signed in with Discord as ", h("b", {}, state.user.username), "."),
      h("div", { class: "row" },
        h("a", { class: "btn", href: "/api/me/export", download: "roadmap-xp-data.json" }, "Export my data"),
        h("button", { class: "btn ghost", type: "button", onclick: logout }, "Sign out"))),
    h("section", { class: "panel stack" },
      h("h2", {}, "Delete account"),
      h("p", { class: "muted" }, "Deletes your account, your characters and your progress. This is immediate and permanent."),
      h("div", {}, twoStep("Delete my account", "Confirm: delete everything", async () => {
        await api("/api/me", { method: "DELETE" }); state.user = null; state.mode = null; ls("rx-mode", null);
        toast("Account deleted."); location.hash = "#/";
      }, "danger"))),
    h("p", { class: "muted" }, "Details: ", h("a", { href: "/privacy/" }, "privacy"), "."))], { focus: true });
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch { /* rien */ }
  state.user = null; state.mode = ls("rx-mode") === "demo" ? "demo" : null; location.hash = "#/"; route();
}

/* ---------- routeur ---------- */
let routing = 0;
async function route() {
  const my = ++routing;
  const hash = location.hash || "#/";
  try {
    const err = hash.match(/^#\/error\/(.*)$/);
    if (err) return viewChoice(decodeURIComponent(err[1]));
    if (hash === "#/demo") { startDemo(); return; }
    if (!state.mode) return viewChoice();
    await loadRoute();
    if (hash === "#/new") return viewNew();
    if (hash === "#/account" && state.mode === "account") return viewAccount();
    const m = hash.match(/^#\/p\/([\w-]{1,80})(?:\/(route|settings))?$/);
    if (m) {
      if (!state.char || state.char.id !== m[1]) {
        try { await loadChar(m[1]); } catch (e) { ls("rx-last", null); toast(e.message); location.hash = "#/"; return; }
      }
      if (my !== routing) return;
      ls("rx-last", m[1]);
      header(state.char);
      if (m[2] === "route") { paint(routeNodes(), { focus: true }); requestAnimationFrame(() => view.querySelector("li.current")?.scrollIntoView({ block: "center" })); return; }
      if (m[2] === "settings") return viewSettings();
      const nodes = dashNodes();
      paint(nodes, { focus: true });
      const t = view.querySelector(".trail"); if (t) t.classList.add(reduceMotion() ? "x" : "draw");
      return;
    }
    if (my !== routing) return;
    return viewChars();
  } catch (e) {
    paint([h("p", { class: "banner", role: "alert" }, `Could not load: ${e.message}`), h("p", {}, h("a", { href: "#/" }, "Back to characters"))]);
  }
}

document.addEventListener("keydown", e => {
  if (e.target.closest("input, select, textarea, button, a") && e.key !== "Escape") { if (e.target.closest("input, select, textarea")) return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const c = state.char;
  if (c && e.key.toLowerCase() === "r" && location.hash === `#/p/${c.id}/route`) { e.preventDefault(); location.hash = `#/p/${c.id}`; return; }
  if (!c || !/^#\/p\/[\w-]+$/.test(location.hash)) return;
  const next = visibleSteps(c).find(s => !state.progress.has(s.id));
  const k = e.key.toLowerCase();
  if (k === "d" && next) setStatus(next.id, "done");
  else if (k === "s" && next) setStatus(next.id, "skipped");
  else if (k === "u") undo();
  else if (k === "r") location.hash = `#/p/${c.id}/route`;
  else return;
  e.preventDefault();
});
window.addEventListener("hashchange", route);

(async function start() {
  try { state.user = (await api("/api/me")).user; } catch { state.user = null; }
  state.mode = state.user ? "account" : (ls("rx-mode") === "demo" ? "demo" : null);
  const last = ls("rx-last");
  let opened = null; try { opened = sessionStorage.getItem("rx-opened"); } catch { /* rien */ }
  if (state.mode && last && (!location.hash || location.hash === "#/") && opened !== "1") history.replaceState(null, "", `#/p/${last}`);
  try { sessionStorage.setItem("rx-opened", "1"); } catch { /* rien */ }
  route();
})();
