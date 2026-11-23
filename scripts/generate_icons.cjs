// Renders the app icon set from one SVG definition into public/. Usage: node scripts/generate_icons.cjs [outDir]
// Afterwards copy ct-icon-v4-180.png to apple-touch-icon.png and ct-favicon-v4.ico to favicon.ico.
const fs = require('fs'); const path = require('path');
const repo = path.join(__dirname, '..'); const out = process.argv[2] || path.join(repo, 'public');
const puppeteer = require(path.join(repo, 'node_modules/puppeteer-core'));

// 512-unit artwork: a dashcam lens inside viewfinder corners, with a recording dot.
const art = `
  <g fill="none" stroke="#f2f4f7" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M100 170 V128 a28 28 0 0 1 28 -28 H170"/>
    <path d="M342 100 H384 a28 28 0 0 1 28 28 V170"/>
    <path d="M412 342 V384 a28 28 0 0 1 -28 28 H342"/>
    <path d="M170 412 H128 a28 28 0 0 1 -28 -28 V342"/>
  </g>
  <circle cx="256" cy="256" r="112" fill="#0a0c10" stroke="#f2f4f7" stroke-width="24"/>
  <circle cx="256" cy="256" r="66" fill="url(#glass)"/>
  <circle cx="256" cy="256" r="26" fill="#05070b"/>
  <ellipse cx="226" cy="224" rx="20" ry="13" transform="rotate(-38 226 224)" fill="#ffffff" opacity="0.9"/>
  <circle cx="256" cy="100" r="20" fill="#ff3b30"/>`;
const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3039"/><stop offset="1" stop-color="#0c0e12"/></linearGradient>
  <radialGradient id="glass" cx="0.38" cy="0.34" r="0.8"><stop offset="0" stop-color="#6fc3ff"/><stop offset="0.55" stop-color="#1f7ae0"/><stop offset="1" stop-color="#0b2f6b"/></radialGradient>
</defs>`;
const svg = (kind) => {
  const bg = kind === 'rounded' ? '<rect width="512" height="512" rx="116" fill="url(#bg)"/>' : '<rect width="512" height="512" fill="url(#bg)"/>';
  const body = kind === 'maskable' ? `<g transform="translate(256 256) scale(0.78) translate(-256 -256)">${art}</g>` : art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${bg}${body}</svg>`;
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const page = await browser.newPage();
  const png = async (kind, size) => {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(kind)}`);
    return page.screenshot({ omitBackground: true, type: 'png' });
  };
  const write = (name, buf) => fs.writeFileSync(path.join(out, name), buf);
  write('ct-icon-v4.svg', svg('rounded') + '\n');
  write('ct-icon-v4-32.png', await png('rounded', 32));
  write('ct-icon-v4-192.png', await png('rounded', 192));
  write('ct-icon-v4-512.png', await png('rounded', 512));
  write('ct-icon-v4-180.png', await png('square', 180));        // iOS rounds the corners itself
  write('ct-icon-v4-maskable-512.png', await png('maskable', 512));
  // ICO container holding PNG images.
  const sizes = [16, 32, 48, 256]; const images = [];
  for (const s of sizes) images.push(await png('rounded', s));
  const header = Buffer.alloc(6 + 16 * sizes.length); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => { const o = 6 + 16 * i; header[o] = s % 256; header[o + 1] = s % 256; header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6); header.writeUInt32LE(images[i].length, o + 8); header.writeUInt32LE(offset, o + 12); offset += images[i].length; });
  write('ct-favicon-v4.ico', Buffer.concat([header, ...images]));
  // Contact sheet for review: sizes on light and dark backgrounds.
  await page.setViewport({ width: 900, height: 420, deviceScaleFactor: 1 });
  const uri = (k) => 'data:image/svg+xml;base64,' + Buffer.from(svg(k)).toString('base64');
  await page.setContent(`<body style="margin:0;display:flex"><div style="background:#fff;padding:30px;display:flex;gap:24px;align-items:center"><img src="${uri('rounded')}" width="256"><img src="${uri('rounded')}" width="64"><img src="${uri('rounded')}" width="32"><img src="${uri('rounded')}" width="16"></div><div style="background:#111;padding:30px;display:flex;gap:24px;align-items:center"><img src="${uri('maskable')}" width="180" style="border-radius:50%"><img src="${uri('square')}" width="120" style="border-radius:27px"><img src="${uri('rounded')}" width="32"></div></body>`);
  write('sheet.png', await page.screenshot({ type: 'png' }));
  await browser.close();
})();
