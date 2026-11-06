// Génère src/apple-touch-icon.png (180×180) à partir de src/favicon.svg.
//   node scripts/icons.mjs
import { chromium } from "playwright";

// Playwright's Chromium, or the system Edge when no Chromium is installed.
const launch = () => chromium.launch().catch(() => chromium.launch({ channel: "msedge" }));
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../src/favicon.svg", import.meta.url), "utf8");
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await page.setContent(`<html><body style="margin:0;background:#0f1116">${svg.replace("<svg ", '<svg width="180" height="180" ')}</body></html>`);
  await page.screenshot({ path: new URL("../src/apple-touch-icon.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
} finally {
  await browser.close();
}
console.log("src/apple-touch-icon.png");
