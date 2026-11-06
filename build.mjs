// Construit public/ (sortie déployée sur Cloudflare Pages) à partir de src/ et data/.
// Le site est en anglais : textes de la route dans data/route-en.json, guide dans data/guide-en.md,
// résumés dans data/guide-brief-en.json (traductions de knowledge/roadmap-xp.md, qui reste en français).
//   node build.mjs
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { mapFigure, loadGlyphs } from "./map.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "public");
const SITE = "https://ddo-roadmap-xp.pages.dev";
const TODAY = "2026-11-05";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const readJson = async (rel, fallback) => (existsSync(join(ROOT, rel)) ? JSON.parse(await readFile(join(ROOT, rel), "utf8")) : fallback);

/* ---------- données de la route ---------- */
const EXPANSIONS = [
  "Menace of the Underdark", "Shadowfell Conspiracy", "Mists of Ravenloft", "Masterminds of Sharn", "Fables of the Feywild",
  "Sinister Secret of Saltmarsh", "Isle of Dread", "Vecna Unleashed", "Magic of Myth Drannor", "The Chill of Ravenloft", "Terror of Demogorgon",
];
function normPack(p) {
  let x = String(p || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (/^The Isle of Dread$/i.test(x)) x = "Isle of Dread";
  if (/^Mists of Ravenloft Pack$/i.test(x)) x = "Mists of Ravenloft";
  if (/^The Necropolis/i.test(x)) x = x.replace(/,? ?Part /i, " Part ");
  return x;
}
function accessOf(pack) {
  if (!pack) return "unknown";
  if (/^Free to Play$/i.test(pack)) return "free";
  if (EXPANSIONS.includes(pack)) return "expansion";
  return "vip";
}
// Retire les remarques de recherche (« la page ne donne pas… ») pour ne garder que l'indication utile.
function cleanPlace(t) {
  if (!t) return "";
  const s = String(t)
    .replace(/\s*\((?:[^()]*?(?:page|précis|coordonn|non vérifi|selon)[^()]*?)\)/gi, "")
    .split(/\s*;\s*/).filter(part => !/(la page|ne précise|non précis|pas précis|non indiqu|n'indique|aucun bâtiment|pas d'emplacement|non vérifi)/i.test(part)).join("; ")
    .replace(/\s+([.,;:])/g, "$1").replace(/[ ;,]+$/, "").trim();
  return s && !/^(—|-)$/.test(s) ? s : "";
}
const plain = t => String(t || "").replace(/[\u00a0\u202f]/g, " ").replace(/\s+([;:!?])/g, "$1").trim();
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

async function buildRoute() {
  const raw = await readJson("data/route-raw.json");
  const en = new Map((await readJson("data/route-en.json", [])).map(x => [x.id, x]));
  const cards = new Map(raw.cards.map(c => [c.quest, c]));
  const mainQuests = new Set(raw.steps.filter(s => s.track === "main").map(s => s.quest));
  const seen = new Set();
  const steps = [];
  for (const s of raw.steps) {
    if (s.track !== "main" && mainQuests.has(s.quest)) continue;   // doublon d'une étape principale
    const key = `${s.track}|${s.quest}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = cards.get(s.quest) || {};
    const pack = normPack(c.pack);
    const access = c.access === "free" ? "free" : accessOf(pack);
    steps.push({
      id: slug(c.title || s.quest), quest: s.quest, title: c.title || "", lvl: s.char_level, track: s.track,
      group: plain(s.group), diff: s.difficulty || "", saga: s.saga || c.saga || "", why: plain(s.why),
      pack, access, giver: c.giver || "", giver_where: plain(cleanPlace(c.giver_where)), entrance: plain(cleanPlace(c.entrance)),
      path: (c.zone_path || []).filter(Boolean).slice(0, 5), rxp: c.rxp_per_skull ? String(c.rxp_per_skull).replace(/[^\d.,]/g, "").replace(",", ".") : "",
      tip: plain(c.tip), url: c.compendium_url || "", map: c.map_url && /ddowiki|ddocompendium/.test(c.map_url) ? c.map_url : "",
    });
  }
  steps.sort((a, b) => a.lvl - b.lvl);
  const ids = new Set();
  for (const s of steps) { let id = s.id || "q"; let n = 2; while (ids.has(id)) id = `${s.id}-${n++}`; s.id = id; ids.add(id); }
  // Textes en anglais (traduction contrôlée) ; la version française ne sort jamais sur le site.
  let missing = 0;
  for (const s of steps) {
    const t = en.get(s.id);
    if (t) for (const k of ["why", "entrance", "giver_where", "tip", "group", "diff"]) s[k] = plain(t[k] ?? "");
    else if (en.size) { missing++; for (const k of ["why", "entrance", "giver_where", "tip"]) s[k] = ""; }
  }
  if (missing) console.warn(`${missing} étapes sans traduction : textes vidés`);
  const expansions = EXPANSIONS.filter(x => steps.some(s => s.pack === x));
  return { version: TODAY, steps, expansions };
}

/* ---------- gabarit ---------- */
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 24c5-1 7-6 12-7s7 3 14-6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" opacity=".55"/><circle cx="6" cy="23" r="2.6" fill="currentColor" opacity=".55"/><circle cx="16" cy="17" r="2.6" fill="currentColor" opacity=".55"/><circle cx="27" cy="11" r="4" fill="#f0b44c"/></svg>`;

function layout({ title, description, path, body, scripts = [], nav = "site", noindex = false, jsonld = null, mainClass = "" }) {
  const url = SITE + path;
  const links = [["/guide/", "Guide"]];
  const navHtml = nav === "app"
    ? `<nav class="nav" id="app-nav" aria-label="App navigation"></nav><div class="who" id="who"></div>`
    : `<nav class="nav" aria-label="Main navigation">${links.map(([h, l]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>${path === "/app/" ? "" : `<a class="btn primary" href="/app/">Open the app</a>`}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0f1116">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta property="og:type" content="website">
<meta property="og:site_name" content="Roadmap XP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/cinzel-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-sans-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-mono-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/vt.js"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<a class="brand" href="/">${LOGO}<span>Roadmap XP</span></a>
${navHtml}
</div></header>
<main id="main" tabindex="-1" class="${mainClass}">
${body}
</main>
<footer class="foot"><div class="wrap">
<nav aria-label="Footer"><a href="/legal/">Legal notice</a><a href="/privacy/">Privacy</a></nav>
<p>Unofficial fan site, not affiliated with Standing Stone Games or Wizards of the Coast. Dungeons &amp; Dragons Online and DDO are trademarks of their owners.</p>
</div></footer>
${nav === "app" ? '<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>\n<p class="sr-only" id="live" role="status" aria-live="polite"></p>\n' : ""}${scripts.map(s => `<script type="module" src="${s}"></script>`).join("\n")}
</body>
</html>
`;
}

const packLabel = s => (s.access === "free" ? "Free to Play" : s.access === "expansion" ? `${s.pack} (expansion)` : s.pack ? `${s.pack} (VIP)` : "VIP pack");

/* ---------- accueil ---------- */
function homePage(route, glyphs) {
  const pick = ["Information is Key", "Haverdasher", "Recovering the Lost Tome", "The Kobold's Den: Clan Gnashtooth", "Explosive Situation", "Irestone Inlet"];
  const demo = pick.map(q => route.steps.find(s => s.quest === q && s.track === "main")).filter(Boolean).map(s => ({
    lvl: s.lvl, title: s.title || s.quest, diff: s.diff, giver: [s.giver, s.giver_where].filter(Boolean).join(", "),
    entrance: s.entrance, access: s.access, packLabel: packLabel(s), why: s.why || "",
  }));
  const q = demo[0];
  const stones = demo.map((d, i) => `<div class="stone ${i === 0 ? "next" : "todo"}" aria-hidden="true" style="--i:${i}"><span class="dot"></span><span class="lv">Lvl ${d.lvl}</span><span class="nm">${esc(d.title)}</span></div>`).join("");
  const nb = route.steps.filter(s => s.track === "main").length;
  const body = `
<div class="wrap">
  <section class="hero" aria-labelledby="h1">
    <h1 id="h1" class="arrive" style="--i:0">Your next DDO quest, one <span class="nowrap">alt-tab</span> away</h1>
    <div class="hero-copy">
      <p class="lede arrive" style="--i:1">Which quest to run next, who to talk to and where the entrance is, for Dungeons &amp; Dragons Online characters that reincarnate. Your progress is saved for each character.</p>
      <div class="row arrive" style="--i:2">
        <a class="btn primary big" href="/app/#/demo">Try it without an account</a>
        <a class="textlink" href="/api/auth/login" rel="nofollow">Sign in with Discord</a>
      </div>
      <p class="note arrive" style="--i:3">With Discord, the site only receives your Discord ID, username and avatar.</p>
    </div>
    <div class="hero-map arrive" style="--i:2">
${mapFigure({ glyphs, level: q.lvl, homePanelOnly: true, id: "home-map", caption: `Levels 1 to 36 as one climb: the harbor at sea level, the Heroic heights, the Underdark for Epic, then the Legendary summit. The torch marks the next quest. <a href="/guide/">The route chapter by chapter</a>.` })}
    </div>
  </section>
  <section class="try" aria-labelledby="try-h">
    <div class="try-intro">
      <h2 id="try-h">Try it</h2>
      <p class="muted">Click Done<span class="kb"> or press D</span>: the card shows the next quest, and the torch moves on the trail and on the map.</p>
    </div>
    <div class="try-demo">
    <div class="hero-trail">
      <div class="demo-head"><b>The Harbor</b><span>levels 2 to 4</span></div>
      <div id="demo-trail"><div class="trail draw" role="img" aria-label="Demo trail" data-active="0" data-n="${demo.length}" data-start="0"><div class="trail-track" style="--n-half:${50 / demo.length}%"><div class="done-line" style="--done-w:0%"></div>${stones}</div><span class="torch" aria-hidden="true" style="left:${50 / demo.length}%"></span></div></div>
    </div>
    <div class="demo hero-card" aria-label="Demo">
      <section class="quest" id="demo-card" aria-labelledby="demo-title">
        <h2 class="title" id="demo-title" data-f="title">${esc(q.title)}</h2>
        <div class="chips"><span class="chip lvl tier-h" data-f="lvl">Level ${q.lvl}</span><span class="chip" data-f="diff">${esc(q.diff)}</span><span class="chip ${q.access}" data-f="pack">${esc(q.packLabel)}</span></div>
        <p class="why" data-f="why">${esc(q.why)}</p>
        <dl class="facts"><dt>Talk to</dt><dd data-f="giver">${esc(q.giver)}</dd><dt>Entrance</dt><dd data-f="entrance">${esc(q.entrance)}</dd></dl>
        <div class="actions"><button class="btn primary big" type="button" id="demo-done">Done <kbd>D</kbd></button></div>
        <p class="sr-only" id="demo-status" role="status" aria-live="polite"></p>
      </section>
      <p class="demo-foot">Set your life number, starting level, VIP and expansions: your own route is filtered to your access.</p>
      <p><a class="btn primary" href="/app/#/demo">Track my own character</a></p>
    </div>
    </div>
  </section>
  <section class="origin" aria-label="Where the route comes from">
    <p>${nb} quests from level 1 to 36, taken from player routes (official forums and player guides) and checked against the DDO Compendium for quest giver, entrance, pack and level. Unverified points are flagged in the guide. <a href="/guide/12/">See the sources</a>.</p>
  </section>
</div>
<script type="application/json" id="demo-data">${JSON.stringify(demo).replace(/</g, "\\u003c")}</script>`;
  return layout({
    title: "Roadmap XP: your next DDO quest, from level 1 to 36",
    description: "Roadmap XP tells you which Dungeons & Dragons Online quest to run next, who to talk to and where the entrance is, and remembers your progress for each character.",
    path: "/", body, scripts: ["/assets/home.js"],
    jsonld: { "@context": "https://schema.org", "@type": "WebApplication", name: "Roadmap XP", url: SITE + "/", applicationCategory: "GameApplication", operatingSystem: "Web browser", inLanguage: "en", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, description: "Leveling route from 1 to 36 for Dungeons & Dragons Online, with progress tracking for each character." },
  });
}

/* ---------- app ---------- */
function appPage(route) {
  // Les six premières quêtes pour un perso VIP sans extension : l'écran de départ les montre sans charger toute la route.
  const first = route.steps.filter(s => s.track !== "option" && s.track !== "f2p" && s.access !== "expansion").slice(0, 6)
    .map(s => ({ lvl: s.lvl, title: s.title || s.quest, giver: s.giver || "" }));
  const body = `<script type="application/json" id="preview-data">${JSON.stringify(first).replace(/</g, "\\u003c")}</script><noscript><p class="banner">The app needs JavaScript. The <a href="/guide/">full guide</a> works without it.</p></noscript><h1 class="sr-only">Roadmap XP app</h1><p class="muted">Loading your route…</p>`;
  return layout({ title: "App · Roadmap XP", description: "Your next DDO quest, who gives it, where the entrance is, and your progress for each character.", path: "/app/", body, scripts: ["/assets/app.js"], nav: "app", mainClass: "wrap narrow app" });
}

/* ---------- guide ---------- */
// Une ligne par chapitre sur la page d'aperçu (tirée des titres, aucun fait nouveau).
const CH_GROUPS = [
  ["Before a new life", [["0", "Your start level and XP target"], ["1", "The 8 rules that save the most XP"], ["2", "XP mechanics: bonuses, elixirs, items"], ["3", "Where each life type joins the route"]]],
  ["The route", [["4", "Levels 1 to 15: quests in order"], ["5", "Levels 15 to 20: quests in order"], ["6", "Epic 20 to 30: quests and the saga bank"], ["7", "Legendary 30 to 36: the quests to run"], ["8", "Reaper XP: skull, pace, points"]]],
  ["After the cap", [["9", "Which class and entry for the next life"], ["10", "A whole life in 6 steps"]]],
  ["Reference", [["11", "What the sources do not settle yet"], ["12", "Every source, with its code and date"]]],
];
const cleanMd = s => s.replace(/\r\n/g, "\n")
  .replace(/\|\s*[—–]\s*\|/g, "| - |").replace(/\|\s*[—–]\s*\|/g, "| - |").replace(/\s[—–]\s/g, ", ").replace(/[—–]/g, "-")
  .replace(/«\s*/g, "“").replace(/\s*»/g, "”").replace(/ ;/g, ";");

async function guidePage() {
  const dir = join(ROOT, "data", "guide-en");
  let intro, chapters;
  if (existsSync(join(dir, "intro.md"))) {
    intro = cleanMd(await readFile(join(dir, "intro.md"), "utf8")).replace(/^# .*\n/, "");
    chapters = [];
    for (let n = 0; existsSync(join(dir, `ch-${n}.md`)); n++) {
      const p = cleanMd(await readFile(join(dir, `ch-${n}.md`), "utf8")).trim();
      const m = p.match(/^## (\d+)\.\s*(.*)/);
      chapters.push({ n: String(n), title: m ? m[2].trim().replace(/\s*→\s*/g, " to ") : `Chapter ${n}`, md: p.replace(/^## .*\n/, "") });
    }
  } else {
    const md = cleanMd(await readFile(join(ROOT, "data", "guide-en.md"), "utf8"));
    const parts = md.split(/\n(?=## )/);
    intro = parts.shift().replace(/^# .*\n/, "");
    chapters = parts.map(p => { const m = p.match(/^## (\d+)\.\s*(.*)/); return { n: m[1], title: m[2].trim(), md: p.replace(/^## .*\n/, "") }; });
  }
  const briefs = await readJson("data/guide-brief-en.json", {});
  const lvRows = html => html.replace(/<td>([\s\S]*?)<\/td>/g, (m, cell) => {
    const parts = cell.split(/(?=\bLv \d+[^:<]{0,12}:)/);
    if (parts.length < 2) return m;
    return `<td>${parts.map(p => { const k = p.match(/^Lv (\d+[^:<]{0,12}):\s*/); return k ? `<span class="lvrow"><b class="mono">Lv ${k[1]}</b> ${p.slice(k[0].length)}</span>` : p; }).join("")}</td>`;
  });
  const decorate = html => lvRows(html)
    .replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, "</table></div>")
    .replace(/\[(R\d{2,3}|AXS?|W-[A-Z]{2}|WR|N7\d|N8\d|F15|SG|SAR|HEL|C-[A-Z]{2,3})\]/g, '<a class="src" href="/guide/12/#$1">$1</a>')
    .replace(/\[(UNVERIFIED[^\]]*)\]/g, '<span class="nv">$1</span>')
    .replace(/\((wiki, not cross-checked[^)]*)\)/g, '<span class="nv">$1</span>')
    .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" rel="noopener"');
  const anchors = html => html.replace(/<td>(R\d{2,3}|AXS?|W-[A-Z]{2}|WR|N7\d|N8\d|F15|SG|SAR|HEL|C-[A-Z]{2,3})<\/td>/g, '<td id="$1">$1</td>');
  const short = c => esc(c.title.replace(/\s*\(.*\)$/, ""));
  const list = cur => `<ol>${chapters.map(c => `<li><a href="/guide/${c.n}/"${cur === c.n ? ' aria-current="page"' : ""}><span class="n">${c.n}</span><span>${short(c)}</span></a></li>`).join("")}</ol>`;
  const brief = c => {
    const b = briefs[c.n];
    return b && b.length ? `<div class="brief"><span class="k">In short</span><ul>${b.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  };
  const gid = label => "g-" + label.toLowerCase().replace(/\W+/g, "-");
  const pages = [];
  const groups = CH_GROUPS.map(([label, rows]) => `<section class="chgroup" aria-labelledby="${gid(label)}"><h2 id="${gid(label)}">${label}</h2><ul class="chlist">${rows.map(([n, line]) => `<li><a href="/guide/${n}/"><span class="n">${n}</span><span><b>${short(chapters[+n])}</b><small>${esc(line)}</small></span></a></li>`).join("")}</ul></section>`).join("\n");
  const paras = intro.trim().split(/\n\s*\n/);
  const introTop = paras.slice(0, 2).join("\n\n"), introMore = paras.slice(2).join("\n\n");
  const index = `<div class="wrap narrow"><article class="doc">
<h1>The level 1 to 36 XP route, explained</h1>
${decorate(marked.parse(introTop))}
${groups}
<h2 class="map-h">The whole route as one climb</h2>
${mapFigure({ glyphs: GLYPHS, level: 1, id: "guide-map", listOpen: false, caption: "Each zone sits on the map at the level where you play it." })}
${introMore ? `<details class="more"><summary>Update date and how to read the markers</summary>${decorate(marked.parse(introMore))}</details>` : ""}
</article></div>`;
  pages.push({ rel: "guide/index.html", path: "/guide/", html: layout({ title: "DDO XP route guide, levels 1 to 36 · Roadmap XP", description: "The DDO leveling guide for characters who reincarnate: XP rules, quests by level, sagas, Reaper XP and the next life, with sources.", path: "/guide/", body: index }) });
  chapters.forEach((c, i) => {
    const prev = chapters[i - 1], next = chapters[i + 1];
    const nav = `<nav class="pager" aria-label="Chapters">${prev ? `<a class="btn" href="/guide/${prev.n}/">← ${prev.n}. ${short(prev)}</a>` : `<a class="btn" href="/guide/">← Overview</a>`}${next ? `<a class="btn" href="/guide/${next.n}/">${next.n}. ${short(next)} →</a>` : ""}</nav>`;
    let html = decorate(marked.parse(c.md)).replace(/<(\/?)h([3-6])/g, (m, s, d) => `<${s}h${d - 1}`);
    if (c.n === "12") html = anchors(html);
    const body = `<div class="wrap"><div class="guide"><aside class="toc" aria-label="Guide chapters">${list(c.n)}</aside>
<article class="doc" style="padding-block:0">
<p class="muted crumb"><a href="/guide/">Guide</a> · chapter ${c.n} of ${chapters.length - 1} · <a href="/app/">Open the app</a></p>
<h1>${esc(c.title)}</h1>
${brief(c)}
${html}
${nav}
<p class="toc-mobile"><a class="textlink" href="/guide/">All chapters</a></p>
</article></div></div>`;
    pages.push({ rel: `guide/${c.n}/index.html`, path: `/guide/${c.n}/`, html: layout({ title: `${short(c)} · DDO XP route guide`, description: (briefs[c.n] && briefs[c.n][0]) || `Chapter ${c.n} of the DDO XP route guide: ${c.title}.`, path: `/guide/${c.n}/`, body }) });
  });
  return pages;
}

/* ---------- pages légales et 404 ---------- */
function legalPage(path, title, description, html) {
  return layout({ title: `${title} · Roadmap XP`, description, path, body: `<div class="wrap narrow"><article class="doc">${html}</article></div>` });
}
const LEGAL = `
<h1>Legal notice</h1>
<h2>Publisher</h2>
<p>Roadmap XP is published by Kmilo, a non-professional publisher. Under article 6, III, 2 of French law no. 2004-575 of June 21, 2004 (LCEN), the publisher has given their identification details to the host. Contact: Kmilo on Discord.</p>
<h2>Host</h2>
<p>Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, United States. Phone: +1 888 993 5273.</p>
<h2>Fan site</h2>
<p>Roadmap XP is a fan project made by a player. Standing Stone Games and Wizards of the Coast have no part in it and do not endorse it. Dungeons &amp; Dragons Online, DDO and the names of quests, places and characters on this site are trademarks and content of their owners. Game maps are not reproduced: each quest links to its ddowiki page. The route map on this site is an original drawing with an invented landscape; only the zone names come from the game.</p>`;
const PRIVACY = `
<h1>Privacy</h1>
<p>Roadmap XP is run by Kmilo, who decides how your data is used (data controller). Contact: Kmilo on Discord. This page says what is kept, why, for how long, and how to delete it.</p>
<h2>Trial mode, without an account</h2>
<p>Your characters and progress stay in your browser's local storage. Nothing is sent to the site. To erase them, delete your characters in the app or clear this site's data in your browser. When you sign in, the app offers to move them to your account.</p>
<h2>With a Discord account</h2>
<ul>
<li><b>Data kept</b>: your Discord ID, username and avatar ID; the characters you create (name, server, life number, starting level, VIP, expansions) and the quests you tick; the dates your account was created and last used.</li>
<li><b>Purpose</b>: to recognize you and keep your progress across devices. No ads, no analytics, no resale.</li>
<li><b>Legal basis</b>: the service you ask for when you sign in (GDPR article 6(1)(b)). Signing in is optional: without an account, you can use trial mode.</li>
<li><b>Retention</b>: as long as your account exists. A sign-in session lasts 180 days at most. After you delete your account, database backups can keep a copy for up to 30 days.</li>
<li><b>Recipients</b>: nobody else gets your data. Cloudflare, Inc. hosts the site and stores the database in Western Europe; it also processes your IP address to deliver and protect the site. Cloudflare is a US company and relies on the EU-U.S. Data Privacy Framework and standard contractual clauses for transfers. Sign-in goes through Discord, which applies its own privacy policy.</li>
<li><b>Cookies</b>: two strictly necessary cookies, which need no consent: <code>sid</code> (your session, 180 days) and <code>oauth_state</code> (protects the Discord sign-in, 10 minutes). No analytics or advertising cookies.</li>
</ul>
<h2>Your rights</h2>
<p>You can access, correct, delete, restrict or object to the use of your data, and take a copy of it. In the app, on the Account page: <b>Export my data</b> and <b>Delete my account</b>, which erases your data from the site's database (not what Discord holds). You can edit your characters in their settings. For any other request, contact Kmilo on Discord. You can also file a complaint with the CNIL, the French data protection authority (cnil.fr).</p>`;
const LOST = `<div class="wrap narrow"><section class="lost">
<div class="trail lost-trail" aria-hidden="true"><div class="trail-track" style="--n-half:12.5%"><div class="stone done"><span class="dot"></span></div><div class="stone done"><span class="dot"></span></div><div class="stone next"><span class="dot"></span></div><div class="stone gone"><span class="dot"></span></div></div></div>
<h1>This trail marker doesn't exist</h1>
<p class="muted">Error 404: the link may be out of date.</p>
<div class="row"><a class="btn primary" href="/app/">Open the app</a><a class="textlink" href="/">Home</a></div>
</section></div>`;

/* ---------- écriture ---------- */
async function write(rel, content) {
  const p = join(OUT, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, content, "utf8");
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(join(ROOT, "src", "assets", "fonts"), join(OUT, "fonts"), { recursive: true });
await mkdir(join(OUT, "assets"), { recursive: true });
for (const f of await readdir(join(ROOT, "src", "assets"))) if (/\.(js|css)$/.test(f)) await cp(join(ROOT, "src", "assets", f), join(OUT, "assets", f));
for (const f of ["_headers", "favicon.svg", "apple-touch-icon.png", "og.png"]) if (existsSync(join(ROOT, "src", f))) await cp(join(ROOT, "src", f), join(OUT, f));

const route = await buildRoute();
const GLYPHS = await loadGlyphs(join(ROOT, "src", "map-glyphs"));
// « why » mélange de vraies raisons (prérequis, saga, repli) et des notes de recherche : on ne montre que les premières.
const WHY_OK = /prerequisite|follows|fallback|saga|in one go|solo|unlock|chain|bonus|favor|free start|level cap|skip|before|after|first/i;
const WHY_NOTE = /not read|not verified|not specified|not listed|check in game|vooduspyce|mixed level|profile|page changed|by calculation|unnamed/i;
for (const s of route.steps) if (!WHY_OK.test(s.why || "") || WHY_NOTE.test(s.why || "")) s.why = "";
await write("route.json", JSON.stringify(route));
await write("index.html", homePage(route, GLYPHS));
await write("app/index.html", appPage(route));
let guidePaths = [];
if (existsSync(join(ROOT, "data", "guide-en", "intro.md")) || existsSync(join(ROOT, "data", "guide-en.md"))) for (const g of await guidePage()) { await write(g.rel, g.html); guidePaths.push(g.path); }
else console.warn("guide non construit : data/guide-en.md manquant");
await write("legal/index.html", legalPage("/legal/", "Legal notice", "Publisher, host and intellectual property of Roadmap XP.", LEGAL));
await write("privacy/index.html", legalPage("/privacy/", "Privacy", "What data Roadmap XP keeps, why, for how long, cookies and your rights.", PRIVACY));
await write("404.html", layout({ title: "Page not found · Roadmap XP", description: "This page doesn't exist.", path: "/404", body: LOST, noindex: true }));
await write("_redirects", "/favicon.ico /apple-touch-icon.png 200\n/roadmap.html /guide/ 301\n/mentions-legales/ /legal/ 301\n/confidentialite/ /privacy/ 301\n/app/* /app/index.html 200\n");
await write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/app/", ...guidePaths, "/legal/", "/privacy/"].map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log(`public/ construit : ${route.steps.length} étapes, ${route.expansions.length} extensions`);
