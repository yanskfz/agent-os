// Takes screenshots of every slide at the nine viewports required by the company profile design guard
// (docs/COMPANY-PROFILE-DESIGN-GUARD.md) and prints one short line per viewport: slide count, page overflow,
// broken images, interactive targets smaller than 24x24 px, clipped header/footer elements, console errors.
//
// Usage (from the project root):  node <this file> [page] [outDir]
//   page    default: index.html   (e.g. mockups/v1.html)
//   outDir  default: screenshots   (gitignored; mockup shots go in mockups/<name>/)
//
// Needs Playwright, which is preinstalled in Claude Code cloud sessions.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// Keep in sync with the "Verify at these viewports" list in docs/COMPANY-PROFILE-DESIGN-GUARD.md.
const VIEWPORTS = [[320, 800], [360, 800], [390, 844], [414, 896], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]];

const root = process.cwd();
const page = process.argv[2] || "index.html";
const outDir = path.resolve(root, process.argv[3] || "screenshots");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, url === "/" ? page : url);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = "http://localhost:" + server.address().port + "/";
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  let failed = false;

  for (const [width, height] of VIEWPORTS) {
    const name = `${width}x${height}`;
    const tab = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    const external = new Set(); // third-party hosts that failed to load (fonts, CDNs); network, not code, so not counted
    tab.on("console", (m) => {
      if (m.type() !== "error") return;
      const url = (m.location() && m.location().url) || "";
      if (url && !url.startsWith(base) && /^https?:/.test(url)) external.add(new URL(url).host);
      else errors.push(m.text());
    });
    tab.on("pageerror", (e) => errors.push(String(e)));
    tab.on("requestfailed", (r) => { if (r.url().startsWith(base)) errors.push("failed: " + r.url()); });
    await tab.emulateMedia({ reducedMotion: "reduce" });
    await tab.goto(base, { waitUntil: "networkidle" });

    // A carousel has a #next button; a plain mockup page gets one full-page screenshot.
    const slides = (await tab.$("#next")) ? await tab.$$eval(".slide", (s) => s.length) : 1;
    let overflow = 0, broken = 0;
    const small = new Set(), clipped = new Set();
    for (let i = 1; i <= slides; i++) {
      await tab.waitForTimeout(120);
      await tab.screenshot({ path: path.join(outDir, `${name}-${String(i).padStart(2, "0")}.png`), fullPage: slides === 1 });
      const r = await tab.evaluate(() => {
        const label = (el, r) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} ${Math.round(r.width)}x${Math.round(r.height)}`;
        const onScreen = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
        // Interactive targets currently on screen that are smaller than 24x24 CSS px (guard minimum).
        const small = [...document.querySelectorAll("a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [role=button]")]
          .map((el) => [el, el.getBoundingClientRect()])
          .filter(([el, r]) => onScreen(r) && getComputedStyle(el).visibility !== "hidden" && (r.width < 24 || r.height < 24))
          .map(([el, r]) => label(el, r));
        // Header/footer content pushed past the viewport edge (clipped even when the page itself cannot scroll).
        const clipped = [...document.querySelectorAll("header *, footer *")]
          .map((el) => [el, el.getBoundingClientRect()])
          .filter(([, r]) => r.width > 0 && (r.right > innerWidth + 1 || r.left < -1))
          .map(([el, r]) => label(el, r));
        return {
          overflow: Math.max(document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth),
          broken: [...document.images].filter((im) => im.complete && im.naturalWidth === 0).length,
          small, clipped
        };
      });
      overflow = Math.max(overflow, r.overflow);
      broken = Math.max(broken, r.broken);
      r.small.forEach((s) => small.add(s));
      r.clipped.forEach((s) => clipped.add(s));
      if (slides > 1) await tab.click("#next");
    }
    // Page overflow only matters for the one-screen carousel; a mockup page may scroll.
    if (slides === 1) overflow = 0;
    const ok = overflow <= 0 && broken === 0 && small.size === 0 && clipped.size === 0 && errors.length === 0;
    if (!ok) failed = true;
    console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${slides} shot(s), page overflow ${overflow}px, broken images ${broken}, small targets ${small.size}, clipped ${clipped.size}, errors ${errors.length}`);
    [...small].slice(0, 3).forEach((s) => console.log("     small target: " + s));
    [...clipped].slice(0, 3).forEach((s) => console.log("     clipped: " + s));
    errors.slice(0, 5).forEach((e) => console.log("     " + e.slice(0, 160)));
    if (external.size) console.log("     note: external request(s) failed, not counted: " + [...external].join(", "));
    await tab.close();
  }

  await browser.close();
  server.close();
  console.log("saved to " + path.relative(root, outDir) + "/");
  process.exit(failed ? 1 : 0);
})();
