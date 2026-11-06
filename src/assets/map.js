// Carte L'Ascension : déplace la torche au niveau donné (la carte elle-même est du SVG statique).
export function setMapLevel(fig, level) {
  if (!fig) return;
  let table = null;
  try { table = JSON.parse(fig.dataset.xy); } catch { return; }
  const l = Math.max(1, Math.min(36, Math.round(level)));
  const p = table[l];
  if (!p) return;
  fig.style.setProperty("--tx", `${p.x}px`);
  fig.style.setProperty("--ty", `${p.y}px`);
  fig.style.setProperty("--wx", String(p.x));
  fig.dataset.level = String(l);
  fig.querySelectorAll(".rxm-badge-t").forEach(t => { t.textContent = `L${l}`; });
  fig.querySelectorAll(".rxm-node").forEach(n => n.classList.toggle("done", Number(n.dataset.l) < l));
}
