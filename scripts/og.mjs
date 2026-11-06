// Image de partage 1200×630 en thème sombre, depuis l'accueil servi en local.
//   node scripts/og.mjs http://127.0.0.1:4401/
import { chromium } from "playwright";

// Playwright's Chromium, or the system Edge when no Chromium is installed.
const launch = () => chromium.launch().catch(() => chromium.launch({ channel: "msedge" }));

const url = process.argv[2] || "http://127.0.0.1:4401/";
const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, colorScheme: "dark", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "src/og.png" });
} finally {
  await browser.close();
}
console.log("src/og.png");
