import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, relative, sep } from 'node:path';
import introLocales from './intro/content.json';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Files the app needs to start and run without a network connection. Intro and legal pages,
// superseded icons, crawler files and the large privacy models/runtime are cached on first use.
const PRECACHE_PATTERN = /^(index\.html|manifest\.webmanifest|assets\/.+|models\/.+\.png|legal\/(consent\.js|privacy\.css|palettes\.css)|ct-icon-v4-[^/]+|ct-favicon-v4\.ico|apple-touch-icon\.png|favicon\.ico)$/;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Writes the list of built files and a content-derived build id into dist/sw.js. */
function precacheServiceWorker(outDir = 'dist') {
  return {
    name: 'precache-service-worker',
    apply: 'build' as const,
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const hash = createHash('sha256');
      const urls: string[] = [];
      for (const file of listFiles(outDir).sort()) {
        const url = relative(outDir, file).split(sep).join('/');
        if (!PRECACHE_PATTERN.test(url)) continue;
        hash.update(url).update(readFileSync(file));
        urls.push(url);
      }
      const source = readFileSync(swPath, 'utf8');
      if (!source.includes('__CT_BUILD_ID__') || !source.includes('/*__CT_PRECACHE__*/[]')) {
        throw new Error('public/sw.js is missing its precache placeholders');
      }
      writeFileSync(swPath, source
        .replace('__CT_BUILD_ID__', hash.digest('hex').slice(0, 16))
        .replace('/*__CT_PRECACHE__*/[]', JSON.stringify(urls)));
    },
  };
}

export default defineConfig(({ mode }) => {
  const isHttps = process.env.HTTPS === 'true' || mode === 'https';
  const basePath = process.env.VITE_BASE_PATH || '/TesDashcam/';
  const introRoutes = new Set([`${basePath}intro/`, ...Object.values(introLocales).map(locale => `${basePath}intro/${locale.slug}/`)]);
  const introDirectoryIndex = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (introRoutes.has(url.pathname)) req.url = `${url.pathname}index.html${url.search}`;
    else if (introRoutes.has(`${url.pathname}/`)) {
      res.writeHead(302, { Location: `${url.pathname}/${url.search}` });
      res.end();
      return;
    }
    next();
  };
  return {
    base: basePath,
    plugins: [{
      name: 'intro-directory-index',
      configureServer(server) { server.middlewares.use(introDirectoryIndex); },
      configurePreviewServer(server) { server.middlewares.use(introDirectoryIndex); },
    }, precacheServiceWorker(), ...(isHttps ? [basicSsl()] : [])],
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: isHttps ? {} : undefined,
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
    },
  };
});
