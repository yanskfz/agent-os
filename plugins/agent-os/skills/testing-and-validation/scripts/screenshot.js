// Takes screenshots of every slide at desktop (1440) and phone (390) width,
// and prints one short line per width: slide count, page overflow, broken images, console errors.
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

  for (const [width, height, name] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
    const tab = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    tab.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    tab.on("pageerror", (e) => errors.push(String(e)));
    tab.on("requestfailed", (r) => { if (r.url().startsWith(base)) errors.push("failed: " + r.url()); });
    await tab.emulateMedia({ reducedMotion: "reduce" });
    await tab.goto(base, { waitUntil: "networkidle" });

    // A carousel has a #next button; a plain mockup page gets one full-page screenshot.
    const slides = (await tab.$("#next")) ? await tab.$$eval(".slide", (s) => s.length) : 1;
    let overflow = 0, broken = 0;
    for (let i = 1; i <= slides; i++) {
      await tab.waitForTimeout(120);
      await tab.screenshot({ path: path.join(outDir, `${name}-${String(i).padStart(2, "0")}.png`), fullPage: slides === 1 });
      const r = await tab.evaluate(() => ({
        overflow: Math.max(document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth),
        broken: [...document.images].filter((im) => im.complete && im.naturalWidth === 0).length
      }));
      overflow = Math.max(overflow, r.overflow);
      broken = Math.max(broken, r.broken);
      if (slides > 1) await tab.click("#next");
    }
    // Page overflow only matters for the one-screen carousel; a mockup page may scroll.
    if (slides === 1) overflow = 0;
    const ok = overflow <= 0 && broken === 0 && errors.length === 0;
    if (!ok) failed = true;
    console.log(`${ok ? "OK  " : "FAIL"} ${name} ${width}px: ${slides} shot(s), page overflow ${overflow}px, broken images ${broken}, errors ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.log("     " + e.slice(0, 160)));
    await tab.close();
  }

  await browser.close();
  server.close();
  console.log("saved to " + path.relative(root, outDir) + "/");
  process.exit(failed ? 1 : 0);
})();
