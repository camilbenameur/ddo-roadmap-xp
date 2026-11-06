// Lighthouse sur des URL, avec un Chromium lancé par Playwright (plus fiable que chrome-launcher sous Windows).
//   node scripts/lh.mjs <url> [<url>...]   -> .shots/lh-<slug>-<mobile|desktop>.json
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const urls = process.argv.slice(2);
const port = 9334;
const args = [`--remote-debugging-port=${port}`];
// Playwright's Chromium first, then the system Chrome, then the system Edge.
let browser;
for (const opts of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
  try { browser = await chromium.launch({ ...opts, args }); break; } catch {}
}
if (!browser) throw new Error("No Chromium found: run npx playwright install chromium");
await mkdir(".shots", { recursive: true });
try {
  for (const url of urls) {
    for (const mode of ["mobile", "desktop"]) {
      const res = await lighthouse(url, { port, output: "json", logLevel: "error" }, mode === "desktop" ? desktopConfig : undefined);
      const slug = new URL(url).pathname.replace(/\//g, "_").replace(/^_|_$/g, "") || "home";
      await writeFile(`.shots/lh-${slug}-${mode}.json`, res.report);
      const r = res.lhr, a = r.audits;
      const mw = a["mainthread-work-breakdown"]?.details?.items || [];
      console.log(slug, mode, Object.entries(r.categories).map(([k, v]) => `${k.slice(0, 4)}=${Math.round(v.score * 100)}`).join(" "),
        "LCP", Math.round(a["largest-contentful-paint"].numericValue), "TBT", Math.round(a["total-blocking-time"].numericValue),
        "CLS", a["cumulative-layout-shift"].numericValue.toFixed(3), "style", Math.round((mw.find(i => i.group === "styleLayout") || {}).duration || 0));
    }
  }
} finally {
  await browser.close();
}
