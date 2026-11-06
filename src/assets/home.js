// Accueil : démo vivante. Le HTML montre déjà une carte et un sentier ; ce script les anime.
import { trailNode, slideTorch, torchFraction } from "/assets/trail.js";
import { setMapLevel } from "/assets/map.js";

const data = JSON.parse(document.getElementById("demo-data").textContent);
const zone = document.getElementById("demo-trail");
const card = document.getElementById("demo-card");
let idx = 0;
let done = [];

function items() {
  return data.map((q, i) => ({ lvl: q.lvl, name: q.title, state: done.includes(i) ? "done" : i === idx ? "next" : "todo" }));
}

function fillCard() {
  const q = data[idx];
  card.querySelector("[data-f=lvl]").textContent = `Level ${q.lvl}`;
  card.querySelector("[data-f=diff]").textContent = q.diff || "R1";
  card.querySelector("[data-f=title]").textContent = q.title;
  card.querySelector("[data-f=giver]").textContent = q.giver || "see the quest page";
  card.querySelector("[data-f=entrance]").textContent = q.entrance || "see the quest page";
  card.querySelector("[data-f=why]").textContent = q.why || "";
  const pack = card.querySelector("[data-f=pack]");
  pack.textContent = q.packLabel;
  pack.className = `chip ${q.access}`;
}

function draw(first) {
  const prev = zone.firstElementChild;
  const from = torchFraction(prev);
  const node = trailNode(items(), { draw: first, label: "Demo trail" });
  zone.replaceChildren(node);
  if (!first) slideTorch(node, from);
}

function advance() {
  done.push(idx);
  idx += 1;
  const status = document.getElementById("demo-status");
  if (idx >= data.length) {
    idx = 0; done = [];
    status.textContent = "Demo trail complete. Starting over.";
  } else {
    status.textContent = `${data[idx - 1].title} done. Next: ${data[idx].title}.`;
  }
  const swap = () => { fillCard(); draw(false); setMapLevel(document.getElementById("home-map"), data[idx].lvl); };
  if (document.startViewTransition && document.visibilityState === "visible" && !matchMedia("(prefers-reduced-motion: reduce)").matches) { const vt = document.startViewTransition(swap); vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone.catch(() => {}); }
  else swap();
}

// Le sentier de départ est déjà dans le HTML (avec sa torche) : le script ne le remplace qu'au premier clic.
document.getElementById("demo-done").addEventListener("click", advance);
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() !== "d" || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, select, textarea")) return;
  const r = card.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  e.preventDefault(); advance();
});
