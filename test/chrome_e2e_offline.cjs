// Verifies that the built app opens without a network connection after one online visit.
// Run against `npm run build && npx vite preview`:  node test/chrome_e2e_offline.cjs
const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = process.env.APP_URL || 'http://localhost:5173/TesDashcam/';

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    // First visit: the worker installs and precaches while the page is already loaded.
    const cached = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      for (let i = 0; i < 100 && !registration.active; i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 1500));
      const names = await caches.keys();
      const entries = [];
      for (const name of names) entries.push(...(await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname));
      return { cacheNames: names, entries };
    });

    await page.setOfflineMode(true);
    const failed = [];
    page.on('requestfailed', (request) => failed.push(request.url()));
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 1000));
    const offline = await page.evaluate(() => ({
      appStarted: Boolean(window.app),
      stylesApplied: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)',
      openButton: Boolean(document.getElementById('btn-open-folder')),
      controlled: Boolean(navigator.serviceWorker.controller),
    }));
    const sameOriginFailures = failed.filter((url) => url.startsWith(new URL(APP_URL).origin));
    console.log(JSON.stringify({ cachedEntries: cached.entries.length, cacheNames: cached.cacheNames, offline, sameOriginFailures }, null, 2));
    if (!offline.appStarted || !offline.openButton || !offline.controlled) throw new Error('App did not start offline');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
