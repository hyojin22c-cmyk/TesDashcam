// Runs one real export through each frame/output path in Chrome and saves the results.
//
//   CLIP_DIR=/path/to/TeslaCam/SavedClips/<event> OUT_DIR=/tmp/out node test/chrome_e2e_export_paths.cjs
//
// Optional: CHROME_PATH, APP_URL (default: the local `vite preview` server).
// The clips must be at least two consecutive clips with a front camera file.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = process.env.APP_URL || 'http://localhost:5173/CT-dashcam-studio-WEB/';
const CLIP_DIR = process.env.CLIP_DIR;
const OUT_DIR = process.env.OUT_DIR;

const MODES = [
  { name: 'video-memory', overrides: { directDecode: false, diskOutput: 'never' }, expect: { framePath: 'video', output: 'memory' } },
  { name: 'decoder-memory', overrides: { directDecode: true, diskOutput: 'never' }, expect: { framePath: 'decoder', output: 'memory' } },
  { name: 'decoder-disk', overrides: { directDecode: true, diskOutput: 'always' }, expect: { framePath: 'decoder', output: 'disk' } },
  // Rear distortion correction uploads each rear frame to WebGL; compare both frame sources.
  { name: 'video-rear-corrected', rearCorrection: true, overrides: { directDecode: false, diskOutput: 'never' }, expect: { framePath: 'video', output: 'memory' } },
  { name: 'decoder-rear-corrected', rearCorrection: true, overrides: { directDecode: true, diskOutput: 'never' }, expect: { framePath: 'decoder', output: 'memory' } },
  // A decoder that breaks mid-export must hand over to video element seeking without losing frames.
  { name: 'decoder-fails-midway', breakDecoderAfter: 400, overrides: { directDecode: true, diskOutput: 'never' }, expect: { framePath: 'mixed', output: 'memory' } },
];

async function main() {
  if (!CLIP_DIR || !OUT_DIR) throw new Error('Set CLIP_DIR and OUT_DIR');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(CLIP_DIR).filter((f) => f.endsWith('.mp4')).sort().map((f) => path.join(CLIP_DIR, f));
  if (files.length === 0) throw new Error(`No MP4 files in ${CLIP_DIR}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1280,800'],
  });
  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') console.log(`[browser ${msg.type()}]`, msg.text());
    });
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });

    const input = await page.waitForSelector('#active-file-input', { timeout: 15000 });
    await input.uploadFile(...files);
    await input.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.waitForSelector('.clip-node', { timeout: 15000 });

    // Range: 2.0s of the first clip to 5.0s of the second, so the export crosses a clip boundary
    // and starts away from a key frame.
    const clipNodes = await page.$$('.clip-node');
    await clipNodes[0].evaluate((el) => el.click());
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => { window.app.seekTo(2.0); window.app.setInPoint(); });
    await clipNodes[1].evaluate((el) => el.click());
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => { window.app.seekTo(5.0); window.app.setOutPoint(); });

    await page.evaluate(() => {
      const exporter = window.app.exporter;
      const original = exporter.exportMultiClip.bind(exporter);
      exporter.exportMultiClip = async (config) => {
        const blob = await original({ ...config, ...window.__exportOverrides });
        window.__lastExport = blob;
        return blob;
      };
    });

    for (const mode of MODES) {
      await page.evaluate((mode) => {
        window.app.options.rear_correction = Boolean(mode.rearCorrection);
        if (!window.__originalDecode) window.__originalDecode = VideoDecoder.prototype.decode;
        let calls = 0;
        VideoDecoder.prototype.decode = function (chunk) {
          if (mode.breakDecoderAfter && ++calls > mode.breakDecoderAfter) throw new Error('simulated decoder failure');
          return window.__originalDecode.call(this, chunk);
        };
      }, mode);

      const outcome = await page.evaluate(async (overrides) => {
        window.__exportOverrides = overrides;
        window.__lastExport = null;
        const started = performance.now();
        await window.app.startExport();
        const elapsedMs = Math.round(performance.now() - started);
        const blob = window.__lastExport;
        if (!blob) return { error: 'export produced no file', elapsedMs };
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return { elapsedMs, size: bytes.length, run: window.app.exporter.lastRun, base64: btoa(binary) };
      }, mode.overrides);

      if (outcome.error) throw new Error(`${mode.name}: ${outcome.error}`);
      const file = path.join(OUT_DIR, `${mode.name}.mp4`);
      fs.writeFileSync(file, Buffer.from(outcome.base64, 'base64'));
      const ok = outcome.run.framePath === mode.expect.framePath && outcome.run.output === mode.expect.output;
      results.push({ mode: mode.name, elapsedMs: outcome.elapsedMs, bytes: outcome.size, ...outcome.run, asExpected: ok });
      if (!ok) throw new Error(`${mode.name}: ran as ${JSON.stringify(outcome.run)}`);
    }

    const leftovers = await page.evaluate(async () => {
      // A new export clears stored files from earlier ones; only the last disk export may remain.
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('ct-exports', { create: true });
      const names = [];
      for await (const name of dir.keys()) names.push(name);
      return names.length;
    });
    console.log(JSON.stringify({ results, storedExportFiles: leftovers }, null, 2));

    // iOS: the finished export is offered through the share sheet instead of being downloaded.
    // Chrome stands in for Safari here, so only the dialog logic is covered, not the real sheet.
    const iosPage = await browser.newPage();
    await iosPage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1');
    await iosPage.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true });
    iosPage.on('dialog', (dialog) => dialog.accept());
    await iosPage.evaluateOnNewDocument(() => {
      window.__shared = [];
      navigator.canShare = (data) => Boolean(data && data.files && data.files.length);
      navigator.share = async (data) => { window.__shared.push({ name: data.files[0].name, size: data.files[0].size, type: data.files[0].type }); };
    });
    await iosPage.goto(APP_URL, { waitUntil: 'networkidle0' });
    const iosInput = await iosPage.waitForSelector('#active-file-input', { timeout: 15000 });
    await iosInput.uploadFile(...files);
    await iosInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await iosPage.waitForSelector('.clip-node', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const ios = await iosPage.evaluate(async () => {
      const app = window.app;
      if (!app.activeClip) document.querySelector('.clip-node').click();
      await new Promise((r) => setTimeout(r, 1200));
      app.seekTo(1.0); app.setInPoint();
      app.seekTo(3.0); app.setOutPoint();
      let downloads = 0;
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) downloads++; else originalClick.call(this); };
      await app.startExport();
      const dialogShown = Boolean(document.getElementById('export-result-modal'));
      const downloadsBeforeChoice = downloads;
      document.getElementById('btn-export-result-share')?.click();
      await new Promise((r) => setTimeout(r, 100));
      document.getElementById('btn-export-result-download')?.click();
      const downloadsAfterFileButton = downloads;
      document.getElementById('btn-export-result-close')?.click();
      return {
        run: app.exporter.lastRun, dialogShown, downloadsBeforeChoice, shared: window.__shared,
        downloadsAfterFileButton, dialogClosed: !document.getElementById('export-result-modal'),
        progressModalHidden: document.getElementById('export-progress-modal').style.display === 'none',
      };
    });
    console.log(JSON.stringify({ iosShareDialog: ios }, null, 2));
    if (!ios.dialogShown || ios.downloadsBeforeChoice !== 0 || ios.shared.length !== 1 || ios.downloadsAfterFileButton !== 1 || !ios.dialogClosed) {
      throw new Error('iOS share dialog did not behave as expected');
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
