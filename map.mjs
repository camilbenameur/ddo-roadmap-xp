// L'Ascension : la carte illustrée de la route 1 → 36, générée au build en SVG statique.
// Axe x = niveau (par palier), axe y = altitude : le port au niveau de la mer, les sommets héroïques,
// la plongée dans l'Underdark pour l'épique, puis la montée vers le sommet légendaire.
// Paysage inventé : rien n'est repris des cartes du jeu ; seuls les noms de zones viennent de la route.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const W = 1200, H = 440;
const SEA = 364;

// Niveau → x, linéaire par palier (héroïque 1-19, épique 19-30, légendaire 30-36).
export function levelX(l) {
  if (l <= 19) return 60 + (l - 1) * (540 / 18);
  if (l <= 30) return 600 + (l - 19) * (280 / 11);
  return 880 + (l - 30) * (280 / 6);
}

// Zones du parcours principal, dans l'ordre de jeu. lvl = niveau d'ancrage, y = altitude du sentier.
// glyph = symbole dessiné (sinon un simple jalon), label = nom écrit sur la carte.
export const ZONES = [
  { name: "The Harbor", range: "1-2", lvl: 1, y: 366, tier: "h", glyph: "harbor", label: true },
  { name: "Waterworks", range: "3", lvl: 3, y: 356, tier: "h" },
  { name: "Saltmarsh", range: "5", lvl: 5, y: 346, tier: "h" },
  { name: "Three-Barrel Cove", range: "6-7", lvl: 6, y: 330, tier: "h" },
  { name: "Feywild", range: "7-8", lvl: 7, y: 318, tier: "h", glyph: "feywild", label: true },
  { name: "Isle of Dread", range: "9", lvl: 9.4, y: 298, tier: "h", glyph: "isle" },
  { name: "Vault of Night", range: "10-12", lvl: 10, y: 270, tier: "h" },
  { name: "Ravenloft", range: "10-14", lvl: 11.4, y: 258, tier: "h", glyph: "ravenloft", label: true },
  { name: "Sands of Menechtarun", range: "13", lvl: 13, y: 268, tier: "h" },
  { name: "Lordsmarch", range: "14-15", lvl: 14, y: 244, tier: "h" },
  { name: "Myth Drannor", range: "15", lvl: 14.8, y: 228, tier: "h" },
  { name: "Gianthold", range: "15-16", lvl: 15.6, y: 210, tier: "h" },
  { name: "Sharn", range: "17-18", lvl: 17, y: 180, tier: "h", glyph: "sharn", label: true },
  { name: "Vecna Unleashed", range: "18", lvl: 18, y: 162, tier: "h" },
  { name: "Storm Horns", range: "19", lvl: 19, y: 140, tier: "h", glyph: "stormhorns", label: true, ldx: -34 },
  { name: "Thunder Sea", range: "20", lvl: 20, y: 196, tier: "e", glyph: "thundersea", gdx: 34 },
  { name: "Menace of the Underdark", range: "21-24", lvl: 21.6, y: 300, tier: "e", label: true, short: "Underdark", inCave: true },
  { name: "The Druid's Deep", range: "23", lvl: 23, y: 330, tier: "e" },
  { name: "High Road of Shadows", range: "24", lvl: 24, y: 318, tier: "e" },
  { name: "Shadow Over Wheloon", range: "26", lvl: 26, y: 262, tier: "e" },
  { name: "The Mask of Deception", range: "30", lvl: 29.4, y: 226, tier: "e", glyph: "mask" },
  { name: "Mines of Tethyamar", range: "31", lvl: 31, y: 212, tier: "l", glyph: "mines" },
  { name: "Mists of Ravenloft", range: "32", lvl: 32, y: 186, tier: "l" },
  { name: "Isle of Dread", range: "33", lvl: 33, y: 170, tier: "l", again: true },
  { name: "Vecna Unleashed", range: "34", lvl: 33.8, y: 150, tier: "l", again: true },
  { name: "Chill of Ravenloft", range: "34-36", lvl: 34.4, y: 132, tier: "l", glyph: "chill", label: true },
  { name: "Myth Drannor", range: "35", lvl: 35, y: 114, tier: "l", again: true },
  { name: "Terror of Demogorgon", range: "36 (quests at 37)", lvl: 36, y: 92, tier: "l", glyph: "summit", label: true, short: "Demogorgon", ldx: -22 },
];
const TIERS = [
  { id: "h", label: "Heroic 1-19", from: 0, to: 600 },
  { id: "e", label: "Epic 20-29", from: 600, to: 880 },
  { id: "l", label: "Legendary 30-36", from: 880, to: 1200, lx: 975 },
];
// Fenêtres des panneaux téléphone (viewBox) : quatre tranches lisibles à 320 px.
export const PANELS = [
  { id: "h1", label: "Heroic, levels 1 to 9", box: [0, 236, 290, 184], from: 1, to: 9.2 },
  { id: "h2", label: "Heroic, levels 9 to 19", box: [286, 62, 336, 278], from: 9.2, to: 19.5 },
  { id: "e", label: "Epic, levels 20 to 29", box: [624, 150, 262, 222], from: 19.5, to: 30 },
  { id: "l", label: "Legendary, levels 30 to 36", box: [888, 8, 312, 252], from: 30, to: 37 },
];

const r1 = n => Math.round(n * 10) / 10;
const pts = () => ZONES.map(z => ({ x: levelX(z.lvl), y: z.y }));

// Catmull-Rom → Bézier cubique.
function smooth(p) {
  let d = `M${r1(p[0].x)} ${r1(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}
// Altitude du sentier à une abscisse donnée (interpolation lissée entre jalons).
function trailY(x) {
  const p = pts();
  if (x <= p[0].x) return p[0].y;
  for (let i = 0; i < p.length - 1; i++) {
    if (x <= p[i + 1].x) {
      const t = (x - p[i].x) / (p[i + 1].x - p[i].x), s = t * t * (3 - 2 * t);
      return p[i].y + (p[i + 1].y - p[i].y) * s;
    }
  }
  return p[p.length - 1].y;
}
export const levelXY = l => ({ x: r1(levelX(l)), y: r1(trailY(levelX(l))) });

// La caverne de l'Underdark : le sol reste en surface, le sentier passe dessous.
const CAVE = { from: 640, to: 860 };
const wob = (x, a = 1) => a * (3.2 * Math.sin(x / 37) + 2.1 * Math.sin(x / 13.7 + 1.3));
function surfaceY(x) {
  const base = trailY(x) - 16 + wob(x);
  if (x < CAVE.from - 30 || x > CAVE.to + 30) return base;
  // plateau au-dessus de la caverne, raccordé en douceur aux deux bouts
  const plateau = 214 + wob(x, 1.4);
  const k = x < CAVE.from ? (x - (CAVE.from - 30)) / 30 : x > CAVE.to ? 1 - (x - CAVE.to) / 30 : 1;
  return base + (plateau - base) * Math.max(0, Math.min(1, k));
}
function ridgePath(fn, step = 8) {
  let d = `M0 ${H}`;
  for (let x = 0; x <= W; x += step) d += ` L${x} ${r1(fn(x))}`;
  return d + ` L${W} ${H} Z`;
}
function cavePath() {
  const top = [], bottom = [];
  for (let x = CAVE.from; x <= CAVE.to; x += 6) {
    const k = Math.min(1, (x - CAVE.from) / 34, (CAVE.to - x) / 34);
    const roof = surfaceY(x) + 6 + k * (24 + 6 * Math.abs(Math.sin(x / 9)));
    const floorRaw = Math.max(roof + 4, trailY(x) + 14 + 3 * Math.sin(x / 11));
    const floor = roof + (floorRaw - roof) * Math.min(1, (x - CAVE.from) / 18, (CAVE.to - x) / 60);
    top.push(`${x} ${r1(roof)}`); bottom.push(`${x} ${r1(floor)}`);
  }
  return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
}
function snowPath() {
  // calotte de neige sur les crêtes au-dessus de y 150 (sommets héroïques et légendaires)
  let up = [], down = [];
  for (let x = 900; x <= W; x += 5) { const y = surfaceY(x); if (y < 128) { const d = Math.min(14, (128 - y) * 0.6); up.push(`${x} ${r1(y)}`); down.push(`${x} ${r1(y + d + 2.5 * Math.sin(x / 5))}`); } }
  let d = up.length ? `M${up.join(" L")} L${down.reverse().join(" L")} Z` : "";
  up = []; down = [];
  for (let x = 540; x <= 640; x += 4) { const y = surfaceY(x); if (y < 140) { const d = Math.min(10, (140 - y) * 0.7); up.push(`${x} ${r1(y)}`); down.push(`${x} ${r1(y + d + 2 * Math.sin(x / 4))}`); } }
  if (up.length) d += ` M${up.join(" L")} L${down.reverse().join(" L")} Z`;
  return d;
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function loadGlyphs(dir) {
  const out = [];
  for (const z of ZONES) if (z.glyph && !out.includes(z.glyph)) out.push(z.glyph);
  const symbols = [];
  for (const g of out) {
    const f = join(dir, `${g}.svg`);
    if (existsSync(f)) symbols.push((await readFile(f, "utf8")).replace(/<\?xml[^>]*>/, "").trim());
  }
  return symbols.join("\n");
}

// Le dessin complet, défini une fois (id rxm-art) puis réutilisé par les vues ordinateur et téléphone.
export function mapArt(glyphSymbols, level = 1) {
  const trail = smooth(pts());
  const far = ridgePath(x => Math.min(surfaceY(x) - 26, 214 + 42 * Math.sin(x / 140 + 0.6) + 20 * Math.sin(x / 47) + 9 * Math.sin(x / 13)), 8);
  const mid = ridgePath(x => Math.min(surfaceY(x) - 10, 272 + 26 * Math.sin(x / 88 + 2) + 11 * Math.sin(x / 29)), 8);
  const sky = `<circle class="rxm-moon" cx="148" cy="80" r="15"/><circle class="rxm-moon-cut" cx="155" cy="74" r="13"/>` +
    Array.from({ length: 22 }, (_, i) => `<circle class="rxm-star" cx="${r1(30 + ((i * 263) % 1140))}" cy="${r1(40 + ((i * 97) % 150))}" r="${i % 4 === 0 ? 1.4 : 0.9}"/>`).join("");
  const near = ridgePath(surfaceY, 6);
  const contours = [14, 30, 48].map((dy, i) => `<path class="rxm-contour" d="${ridgePath(x => surfaceY(x) + dy + wob(x * 2.1 + i * 40, .6), 10).replace(/ L1200 440 Z$/, "").replace(/^M0 440 L/, "M")}"/>`).join("");
  const sea = `<rect class="rxm-sea" x="0" y="${SEA}" width="${W}" height="${H - SEA}"/>` +
    [0, 1, 2].map(i => `<path class="rxm-wave" d="M${8 + i * 22} ${SEA + 12 + i * 14} q8 -5 16 0 t16 0 t16 0"/>`).join("");
  const specks = Array.from({ length: 16 }, (_, i) => { const x = CAVE.from + 20 + ((i * 53) % (CAVE.to - CAVE.from - 40)); const y = (surfaceY(x) + trailY(x)) / 2 + 10 * Math.sin(i * 2.3); return `<circle class="rxm-speck" cx="${r1(x)}" cy="${r1(y)}" r="${1 + (i % 3) * 0.5}"/>`; }).join("");
  const dividers = TIERS.slice(1).map(t => `<line class="rxm-divider" x1="${t.from}" y1="34" x2="${t.from}" y2="${H}"/>`).join("");
  const tierLabels = TIERS.map(t => `<text class="rxm-tier" x="${t.lx || (t.from + t.to) / 2}" y="24" text-anchor="middle">${t.label}</text>`).join("");
  const nodes = ZONES.map((z, i) => {
    const x = r1(levelX(z.lvl));
    return `<circle class="rxm-node${z.again ? " again" : ""}${z.lvl < level ? " done" : ""}" data-l="${z.lvl}" cx="${x}" cy="${z.y}" r="${z.glyph ? 5 : 4}"/>`;
  }).join("");
  const glyphs = ZONES.filter(z => z.glyph).map(z => {
    const x = levelX(z.lvl) + (z.gdx || 0), s = 48, gx = z.glyph === "harbor" ? x - 40 : x - s / 2;
    const base = z.glyph === "harbor" ? SEA + 3 : Math.min(surfaceY(x), trailY(x) - 6) + 3;
    return `<use href="#g-${z.glyph}" class="rxm-glyph" x="${r1(gx)}" y="${r1(base - 36 * s / 40)}" width="${s}" height="${s}"/>`;
  }).join("");
  const labels = ZONES.filter(z => z.label).map(z => {
    const x = levelX(z.lvl), up = z.inCave ? trailY(x) - 18 : Math.min(surfaceY(x), trailY(x) - 6) + 3 - 36 * 48 / 40 - 6;
    const lx = (z.glyph === "harbor" ? x - 16 : x) + (z.ldx || 0);
    return `<text class="rxm-label" x="${r1(lx)}" y="${r1(up)}" text-anchor="middle">${esc(z.short || z.name)}</text>`;
  }).join("");
  const ticks = [1, 15, 19, 20, 30, 36].map(l => { const p = levelXY(l); const below = 21; return `<text class="rxm-lv" x="${p.x}" y="${r1(p.y + below)}" text-anchor="middle">${l}</text>`; }).join("");
  return `<svg class="rxm-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs>
<linearGradient id="rxm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bottom)"/></linearGradient>
<radialGradient id="rxm-halo"><stop offset="0" stop-color="var(--torch)" stop-opacity=".45"/><stop offset="1" stop-color="var(--torch)" stop-opacity="0"/></radialGradient>
<clipPath id="rxm-walked"><rect class="rxm-walked-rect" x="0" y="0" width="${W}" height="${H}"/></clipPath>
${glyphSymbols}
<g id="rxm-art">
<rect class="rxm-skyrect" width="${W}" height="${H}" fill="url(#rxm-sky)"/>
<rect class="rxm-tierwash" x="880" y="0" width="320" height="${H}"/>
${sky}
${sea}
<path class="rxm-far" d="${far}"/>
<path class="rxm-mid" d="${mid}"/>
<path class="rxm-near" d="${near}"/>
${contours}
<path class="rxm-snow" d="${snowPath()}"/>
<path class="rxm-cave" d="${cavePath()}"/>
${specks}
${dividers}
${tierLabels}
${glyphs}
<path class="rxm-trail" d="${trail}"/>
<path class="rxm-trail-lit" d="${trail}" clip-path="url(#rxm-walked)"/>
${nodes}
${ticks}
${labels}
</g>
</defs></svg>`;
}

// Torche : groupe placé par transform (variables CSS), avec un badge de niveau.
function torch(level) {
  return `<g class="rxm-torch" aria-hidden="true"><circle class="rxm-halo" r="30" fill="url(#rxm-halo)"/><circle class="rxm-ring" r="12"/><line class="rxm-stick" x1="0" y1="2" x2="0" y2="-10"/><path class="rxm-flame" d="M0 -26 C6 -18 7 -13 0 -9 C-7 -13 -6 -18 0 -26 Z"/><path class="rxm-flame-in" d="M0 -20 C3 -16 3 -13 0 -11 C-3 -13 -3 -16 0 -20 Z"/><g class="rxm-badge"><rect x="-17" y="10" width="34" height="18" rx="5"/><text class="rxm-badge-t" x="0" y="23" text-anchor="middle">L${level}</text></g></g>`;
}

const torchStyle = level => { const p = levelXY(level); return `--tx:${p.x}px;--ty:${p.y}px;--wx:${p.x}`; };

// Vue complète : ordinateur (une seule image) + téléphone (panneaux) + liste en texte.
export function mapFigure({ glyphs = "", level = 1, caption = "", listOpen = false, homePanelOnly = false, id = "rxmap" }) {
  const here = ZONES.reduce((a, z) => (z.lvl <= level ? z : a), ZONES[0]);
  const table = {}; for (let l = 1; l <= 36; l++) table[l] = levelXY(l);
  const desc = `Side view of the level 1 to 36 route. It starts at sea level in The Harbor, climbs through the Heroic zones to Storm Horns at level 19, goes down into the Underdark for the Epic levels, then climbs to the summit at level 36. The torch is at level ${level}, ${here.name}.`;
  const desk = `<svg class="rxm-svg rxm-desk" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">Map of the route, levels 1 to 36</title><desc id="${id}-d">${esc(desc)}</desc><use href="#rxm-art"/>${torch(level)}</svg>`;
  const panels = PANELS.filter(p => !homePanelOnly || (level >= p.from && level < p.to) || (homePanelOnly && p.id === "l" && level >= 30));
  const phone = panels.map(p => `<figure class="rxm-panel" data-panel="${p.id}"><figcaption>${p.label}</figcaption><svg class="rxm-svg" viewBox="${p.box.join(" ")}" role="img" aria-label="${esc(p.label)}${level >= p.from && level < p.to ? `. The torch is at level ${level}.` : ""}"><use href="#rxm-art"/>${torch(level)}</svg></figure>`).join("");
  const groups = TIERS.map(t => `<li><b>${t.label}</b><ol>${ZONES.filter(z => z.tier === t.id).map(z => `<li${z === here ? ' aria-current="step"' : ""}><span class="mono">${z.range}</span> ${esc(z.name)}${z.again ? " (again)" : ""}</li>`).join("")}</ol></li>`).join("");
  return `<figure class="rxmap" id="${id}" data-level="${level}" data-xy='${JSON.stringify(table)}' style="${torchStyle(level)}">
${mapArt(glyphs, level)}
<div class="rxm-frame">${desk}</div>
<div class="rxm-phone">${phone}</div>
${caption ? `<figcaption class="rxm-cap">${caption}</figcaption>` : ""}
<details class="more rxm-list"${listOpen ? " open" : ""}><summary>The zones as text</summary><ol class="rxm-tiers">${groups}</ol></details>
</figure>`;
}
