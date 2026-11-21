# AGENTS.md

CT Dashcam Studio Web is a single-page browser app for playing and editing Tesla dashcam (TeslaCam / Sentry Mode) clips. It syncs 4 to 6 camera MP4 files, overlays telemetry read from H.264 SEI data (speed, steering, pedals, blinkers, Autopilot/FSD/TACC state, and a GPS minimap from OpenStreetMap tiles), and exports a selected range to one MP4. All video processing happens in the browser and nothing is uploaded. The stack uses React 19.3 with the React Compiler (via `@rolldown/plugin-babel` `reactCompilerPreset`), TypeScript 7 (`tsc -b`, `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, typed i18n keys), Vite 8 (Rolldown), Tailwind CSS 4, Vitest, oxlint (type-aware), and oxfmt. The only URL-driven state is `?lang=<code>` and `?legal=<privacy|license|third-party|audit|data-flow>`, which opens the legal documents dialog.

## Commands

- Use Node 26 (`.nvmrc`) and pnpm 12 (`packageManager` in `package.json`).
- Follow the supply-chain policies in `pnpm-workspace.yaml` (`minimumReleaseAge`, `trustPolicy` `no-downgrade`). If an install is refused by these policies, do not bypass them; pick another package or ask.
- Available scripts:
  - `pnpm dev`
  - `pnpm dev:https`
  - `pnpm build` (runs `tsc -b` then `vite build`)
  - `pnpm preview`
  - `pnpm test` (`vitest run`)
  - `pnpm typecheck`
  - `pnpm lint` (`oxlint --deny-warnings --type-aware --type-check`)
  - `pnpm format` (`oxfmt --write .`)
  - `pnpm format:check`
- Media tests that need a real TeslaCam file are skipped unless `CT_TEST_MP4` points to one.

## Project Layout

- `src/core`: framework-free engine:
  - `renderer.ts`: canvas overlay drawing
  - `exporter.ts`: export with browser video elements, WebCodecs and mp4-muxer
  - `sei-decoder.ts` and `sei-worker.ts`: SEI telemetry from the legacy MP4 sample table and wire parser, runs in a Web Worker
  - `clip-scanner.ts`: groups files into clips/folders
  - `map-loader.ts`: OSM tiles with LRU cache
  - `constants.ts`, `capability.ts`, `rear-correction.ts`, `qr-code.ts` (fixed precomputed matrix)
- `src/studio`: app state and actions (`store.ts` with zustand `useStudio`, `playback.ts`, `loading.ts`, `export.ts`, `range.ts`, `layout-mode.ts`, `consent.ts`, `pwa.ts`, `clip-search.ts`, `canvas-gestures.ts`)
- `src/components`: atomic design layers (`atoms`, `molecules`, `organisms`, `templates`, `pages`)
- `src/hooks`
- `src/lib`: consent controller, platform helpers, `cn`, links
- `src/i18n`: i18next setup with a lazy per-language backend, `locales/*.json`, `seo.json`, `i18next.d.ts` for typed keys
- `src/styles`: `index.css` (design tokens), `tutorial.css`
- Repository root: `LICENSE`, legal Markdown files rendered in the legal dialog (`PRIVACY.md`, `PRIVACY_DATA_FLOW.md`, `LICENSE_AUDIT.md`, `THIRD_PARTY_NOTICES.md`), and `licenses/` with notice files

## Architecture Rules

- Respect atomic design import boundaries (enforced by oxlint `no-restricted-imports`):
  - `atoms` and `molecules`: never import higher layers, app state (`@/studio/**`), or translations (`@/i18n/**`, `react-i18next`, `i18next`). Take text and data as props. Base UI primitives are wrapped here, in `atoms` and `molecules`.
  - `organisms`: may read app state and translations. Never import `@base-ui/react` directly (use atom/molecule wrappers) or import `templates` or `pages`.
  - `templates`: lay out slots passed as props. Never import `@base-ui/react` or `pages`, and never import `@/studio` at runtime (type-only imports are fine).
  - `pages`: compose `templates` and `organisms` only. Never import `atoms`, `molecules`, or `@base-ui/react`.
- Preserve Babel pass order in `vite.config.ts`: run `@jellybrick/react-solid-flow/babel` in its own `babel()` pass before the React Compiler pass. If both run in one pass, the compiler hoists `<Match>` elements out of `<Switch>`, the plugin inlines them into plain ternaries, and `<Switch>` renders nothing.

## State Management

- Pass read-only data from parent to child via props.
- Use React context when children write a parent's state in a compound component (examples: `ToggleGroup`'s group id for the sliding indicator, `ClipTreeContext` for folder open state, `ClipSearchContext` for the search query).
- Store app-wide state (layout mode, active panel, dialogs, playback, export progress) in the zustand store (`useStudio`) in `src/studio/store.ts`. Use `getStudio()` and `setStudio()` from non-React code.

## Code Style

- Use arrow functions only (`const f = () => ...`), enforced by oxlint (`func-style` `"expression"` and `prefer-arrow-callback`). Class methods are fine. The only plain `function` is the gtag queue in `src/lib/consent.ts`, because `gtag.js` needs the `arguments` object.
- Omit unnecessary comments; code should explain itself.
- In JSX, use `react-solid-flow` (`For`, `Show`, `Switch`/`Match`, `Dynamic`, `ErrorBoundary`) instead of `.map`, `&&`, and nested ternaries. Exception: direct children of Motion's `AnimatePresence` must use `&&`, because `AnimatePresence` tracks its direct children.
- Use `es-toolkit` for utilities (`clamp`, `sumBy`, `delay`, `memoize`, `compact`, `throttle`, etc.) instead of hand-written helpers. Prefer a well-known library over reinventing one, but ask the maintainer before replacing hand-written code with a new library.
- Validate external data (`localStorage`, URL parameters) with zod (`zod/mini`).
- Never hardcode user-facing text. Route every string through i18n with typed keys (`TranslationKey`). Keep internal values as codes rather than display text (for example, layout `'front-focus' | 'quad' | 'single'`, resolution `'qhd' | 'fhd' | 'hd' | 'compact'`).
- Use `kebab-case` for file names.

## UI and Motion

- Use design tokens from `src/styles/index.css` (dark palette, radius scale, easing curves `ease-fade` and `ease-spring`, typography scale such as `text-head1`, `text-head3`, `text-subtitle`, `text-body`).
- Avoid decorative borders, gradients, and decorative labels.
- Use Motion inside `LazyMotion` strict mode with `m.*` components.
- Use shared motion atoms: `Swap` (content switch), `Reveal` (expand/collapse height), `Fade`, `AutoHeight` (smooth dialog resizing), `ActiveIndicator` (sliding highlight with `layoutId`).
- The clip list is virtualized with `virtua`. Keep list rows cheap and keep per-row zustand selectors returning primitives.

## i18n

- Maintain 8 locales in `src/i18n/locales/*.json`: `ko`, `en`, `ja`, `zh-CN`, `zh-TW`, `de`, `fr`, `es`.
- Keep keys sorted. Tests check that all 8 locales have identical keys and non-empty values.
- Use `{0}`, `{1}` for interpolation.
- Add every new key to all 8 locale files.

## Privacy and Licensing

- Original code is licensed under `GPL-3.0-only`. Keep `LICENSE` byte-identical (a test checks its SHA-256).
- Load Google Analytics only after opt-in via `src/lib/consent.ts` (Basic Consent Mode v2). Do not add any other tracking.
- The service worker (built by `@unplugin-pwa/vite`, Workbox `generateSW`) caches only the app's own files and fonts, never user videos or telemetry. The production worker must not handle the `/dev/` path.
- When runtime dependencies change, update `THIRD_PARTY_NOTICES.md` and regenerate `licenses/runtime-dependencies.txt` from `pnpm licenses list --prod` (keeping every bundled package's full license text).

## Deployment

- `.github/workflows/deploy.yml` builds `main` to the site root and `dev` to `/dev/` on GitHub Pages, with the base path from `VITE_BASE_PATH` (default `/CT-dashcam-studio-WEB/`).
- A failed `dev` build only warns; `main` still deploys.
- The repository's GitHub Pages source must be set to GitHub Actions.

## Checklist Before Finishing

- Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build`.
- Point `CT_TEST_MP4` to a real TeslaCam file when running media tests that require one.
- If user-facing strings changed, verify all 8 `src/i18n/locales/*.json` files have matching, sorted keys and non-empty values.
- If runtime dependencies changed, update `THIRD_PARTY_NOTICES.md` and regenerate `licenses/runtime-dependencies.txt` with `pnpm licenses list --prod`.
- Confirm `LICENSE` is byte-identical.
