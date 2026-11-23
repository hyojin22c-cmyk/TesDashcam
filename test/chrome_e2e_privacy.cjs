// Exports a clip with the plate and face mosaic enabled and saves it next to an export without.
//   CLIP_DIR=/path/to/SavedClips/<event> OUT_DIR=/tmp/out node test/chrome_e2e_privacy.cjs
// Run against `npm run build && npx vite preview`. Inspect the saved videos by eye: this script
// checks that the pipeline runs and that the mosaic changes pixels, not that detection is right.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = process.env.APP_URL || 'http://localhost:5173/CT-dashcam-studio-WEB/';
const { CLIP_DIR, OUT_DIR } = process.env;

const MODES = [
  { name: 'plain', plate: false, face: false },
  { name: 'mosaic', plate: true, face: true },
];

async function main() {
  if (!CLIP_DIR || !OUT_DIR) throw new Error('Set CLIP_DIR and OUT_DIR');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(CLIP_DIR).filter((f) => f.endsWith('.mp4')).sort().map((f) => path.join(CLIP_DIR, f));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1280,800'],
    protocolTimeout: 900000,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on('console', (msg) => {
      if (['warning', 'error'].includes(msg.type())) console.log(`[browser ${msg.type()}]`, msg.text());
    });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('dialog', async (dialog) => {
      console.log('[dialog]', dialog.message());
      await dialog.accept();
    });
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    const input = await page.waitForSelector('#active-file-input', { timeout: 15000 });
    await input.uploadFile(...files);
    await input.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.waitForSelector('.clip-node', { timeout: 15000 });
    await (await page.$$('.clip-node'))[0].evaluate((el) => el.click());
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => {
      const exporter = window.app.exporter;
      const original = exporter.exportMultiClip.bind(exporter);
      exporter.exportMultiClip = async (config) => {
        window.__boxLog = [];
        if (config.privacy) {
          // Record what was covered on every exported frame.
          const analyze = config.privacy.analyze.bind(config.privacy);
          config.privacy.analyze = async (frames) => {
            const boxes = await analyze(frames);
            window.__boxLog.push(boxes);
            return boxes;
          };
        }
        const blob = await original(config);
        window.__privacyStats = config.privacy ? { ...config.privacy.stats } : null;
        window.__lastExport = blob;
        return blob;
      };
      window.app.seekTo(1.0);
      window.app.setInPoint();
      window.app.seekTo(5.0);
      window.app.setOutPoint();
    });

    const results = [];
    const progress = setInterval(async () => {
      try {
        const pct = await page.$eval('#export-modal-pct', (el) => el.textContent);
        console.log(`[progress] ${pct}`);
      } catch {}
    }, 10000);
    for (const mode of MODES) {
      const outcome = await page.evaluate(async (mode) => {
        for (const [id, on] of [['chk-plate-blur', mode.plate], ['chk-face-blur', mode.face]]) {
          const chk = document.getElementById(id);
          if (chk.checked !== on) {
            chk.checked = on;
            chk.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        // Preview: wait for the background analysis of the paused frame.
        let previewBoxes = null;
        if (mode.plate || mode.face) {
          for (let i = 0; i < 150 && !window.app.options.privacyBoxes; i++) await new Promise((r) => setTimeout(r, 200));
          previewBoxes = window.app.options.privacyBoxes || null;
        }
        window.__lastExport = null;
        const started = performance.now();
        await window.app.startExport();
        const elapsedMs = Math.round(performance.now() - started);
        const blob = window.__lastExport;
        if (!blob) return { error: 'export produced no file', elapsedMs };
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return { elapsedMs, run: window.app.exporter.lastRun, previewBoxes, analysis: window.__privacyStats || null, boxLog: window.__boxLog, base64: btoa(binary) };
      }, mode);
      if (outcome.error) throw new Error(`${mode.name}: ${outcome.error}`);
      fs.writeFileSync(path.join(OUT_DIR, `${mode.name}.mp4`), Buffer.from(outcome.base64, 'base64'));
      const previewBoxesPerCamera = outcome.previewBoxes
        && Object.fromEntries(Object.entries(outcome.previewBoxes).map(([k, v]) => [k, v.length]));
      if (outcome.boxLog && outcome.boxLog.length) fs.writeFileSync(path.join(OUT_DIR, `${mode.name}.boxes.json`), JSON.stringify(outcome.boxLog));
      const analysisMsPerFrame = outcome.analysis && Math.round(outcome.analysis.totalMs / Math.max(1, outcome.analysis.frames));
      results.push({ mode: mode.name, elapsedMs: outcome.elapsedMs, ...outcome.run, analysisMsPerFrame, previewBoxesPerCamera });
    }
    clearInterval(progress);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview.png') });
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
