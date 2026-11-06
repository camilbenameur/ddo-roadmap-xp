// Le Sentier : bornes de quêtes et torche. Partagé par l'accueil et l'app.
// items : [{ lvl, name, state: "done" | "skipped" | "next" | "todo" }]

const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function trailNode(items, { draw = false, label = "Trail of upcoming quests", start = 0 } = {}) {
  const n = Math.max(items.length, 1);
  const active = Math.max(0, items.findIndex(i => i.state === "next"));
  const root = document.createElement("div");
  root.className = "trail" + (draw && !reduce() ? " draw" : "");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", `${label}: ${items.map(i => `${i.name} (${stateLabel(i.state)})`).join(", ")}`);
  const track = document.createElement("div");
  track.className = "trail-track";
  track.style.setProperty("--n-half", `${50 / n}%`);
  const line = document.createElement("div");
  line.className = "done-line";
  line.style.setProperty("--done-w", `${(active / n) * 100}%`);
  track.append(line);
  items.forEach((it, i) => {
    const s = document.createElement("div");
    s.className = `stone ${it.state}`;
    s.style.setProperty("--i", i);
    s.setAttribute("aria-hidden", "true");
    const dot = document.createElement("span"); dot.className = "dot";
    const lv = document.createElement("span"); lv.className = "lv"; lv.textContent = `Lvl ${it.lvl}`;
    const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = it.name;
    s.append(dot, lv, nm);
    track.append(s);
  });
  const torch = document.createElement("span");
  torch.className = "torch";
  torch.setAttribute("aria-hidden", "true");
  torch.style.left = `${((active + 0.5) / n) * 100}%`;
  root.append(track, torch);
  root.dataset.active = String(active);
  root.dataset.n = String(n);
  root.dataset.start = String(start);
  return root;
}

// Fait glisser la torche depuis l'ancienne borne (fraction de largeur) vers la nouvelle.
export function slideTorch(root, fromFraction) {
  if (!root || reduce() || fromFraction === null || fromFraction === undefined) return;
  const torch = root.querySelector(".torch");
  const n = Number(root.dataset.n), active = Number(root.dataset.active);
  const to = (active + 0.5) / n;
  const dx = (fromFraction - to) * root.clientWidth;
  if (!dx || !torch.animate) return;
  torch.getAnimations().forEach(a => { if (a.id === "slide") a.cancel(); });
  if (dx < 0) {
    // En avant : la torche glisse vers la borne suivante.
    torch.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], { id: "slide", duration: 900, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
  } else {
    // En arrière (Undo) : la torche s'éteint, recule éteinte, puis se rallume sur la borne d'avant.
    torch.animate([
      { transform: `translateX(${dx}px)`, opacity: 1 },
      { transform: `translateX(${dx}px)`, opacity: 0.12, offset: 0.3 },
      { transform: "translateX(0)", opacity: 0.12, offset: 0.75 },
      { transform: "translateX(0)", opacity: 1 },
    ], { id: "slide", duration: 900, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
  }
}

export function torchFraction(root) {
  if (!root) return null;
  const n = Number(root.dataset.n), active = Number(root.dataset.active);
  return (active + 0.5) / n;
}

function stateLabel(s) {
  return { done: "done", skipped: "skipped", next: "next", todo: "upcoming" }[s] || "";
}
