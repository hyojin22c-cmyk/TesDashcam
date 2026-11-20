# License and provenance audit

Date: 2026-11-01. Scope: CT Dashcam Studio **Web** and its Pages artifacts. This is a source/metadata audit, not a legal opinion or a certification of complete clearance. Python distributions are not relicensed by this task.

## Original project code

The owner requested GPL-3.0-only. `LICENSE` is the unmodified official GPLv3 text obtained from https://www.gnu.org/licenses/gpl-3.0.txt (35,149 bytes; SHA-256 `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`). The SPDX choice is **GPL-3.0-only**, not GPL-3.0-or-later. The license text itself includes general instructions/examples; those do not change this project's explicit version choice. Copyright in original code remains with its respective holders. Owner authorization covers only rights the owner actually holds.

README, package metadata and deployed legal navigation state this scope. Existing port headers are preserved. No core modules are edited merely to add headers. Dependencies, copied material and artwork retain their own licenses or unresolved status; a new root LICENSE cannot cure missing rights. Source provenance is not established merely because code was generated or edited using AI.

## Dependency findings

All 123 package entries in package-lock.json were inventoried, including transitive and optional platform entries: 109 MIT, 6 Apache-2.0, 6 ISC and 2 BSD-3-Clause declarations; none lacks a declared license. The full per-package name, version, path, dependency class, optional status and locally available repository metadata are in LICENSE_DEPENDENCIES.json. This is a declaration inventory, not a line-by-line origin review of every dependency. Optional packages absent on this Windows installation were checked via lock metadata only. Recheck on dependency updates.

Separate root license/notice files were hashed for 70 installed packages. Six installed development/tool packages lack such a root notice file in this installation: @esbuild/win32-x64, @puppeteer/browsers, @rollup/rollup-win32-x64-gnu, @rollup/rollup-win32-x64-msvc, puppeteer-core, stackback. Their license declarations are recorded, but full upstream/package notice coverage remains a distribution-review item if those tool binaries/packages are redistributed. They are not copied into Pages. The other 47 locked optional/platform packages are not installed here and have metadata-only evidence. This does not affect the separately inspected runtime Mediabunny license.

- **Distributed runtime:** Mediabunny 1.66.2, MPL-2.0, replaces mp4-muxer for video export. The installed package license was read and copied unchanged into licenses/mediabunny-MPL-2.0.txt. Its files carry the MPL Exhibit A notice and no "Incompatible With Secondary Licenses" notice, so MPL section 3.3 permits distribution together with GPL-3.0-only code. The files are bundled unmodified; their source is available from the upstream repository and npm package named in THIRD_PARTY_NOTICES.md.
- **Distributed runtime, Apache-2.0 / BSD-3-Clause:** @bufbuild/protobuf 2.17.0 decodes the Tesla SEI protobuf fields. Apache-2.0 is compatible with GPLv3 (not with GPLv2) and BSD-3-Clause is GPL-compatible; their notices are kept in licenses/runtime-dependencies.txt. Tesla's own `dashcam.proto` is not copied (its repository has no license); only field numbers are used in code.
- **Service worker:** `sw.js` and `workbox-*.js` are generated at build time by @unplugin-pwa/vite and bundle Workbox runtime code from @vite-pwa/workbox-swkit (MIT, Google LLC and Anthony Fu), listed in licenses/runtime-dependencies.txt.
- **Transitive, non-dev in npm metadata but type-only:** @types/dom-webcodecs 0.1.13 and @types/dom-mediacapture-transform 0.1.12, MIT. They do not add browser runtime code. Full notices retained for source/dependency distribution.
- **Build outputs:** Vite's modulepreload helper is distributed in the viewer; preserve its supplied MIT and bundled notices. esbuild output helpers may also be emitted; its MIT notice is retained conservatively. Tool packages as a whole are not shipped by copying node_modules to Pages.
- **Development-only:** TypeScript, Vite, Rollup, esbuild, Vitest, puppeteer-core, basic-ssl, Node type declarations and their tools/transitives. These support build, tests or local development. Their permissive declarations show no apparent GPLv3 combination obstacle in this snapshot; that is not a statement that all their code is part of the GPL application.
- Apache-2.0, MIT/Expat, ISC and modified BSD declarations are consistent with GPLv3 compatibility according to the FSF license list; retain their conditions when redistributing them. No replacement library was introduced to simplify licensing.
- Google gtag.js and OSM tiles are remotely provided services/resources, not npm/GPL code. Access is subject to their own terms; GPL does not relicense them.

References: https://www.gnu.org/licenses/license-list.en.html and https://apache.org/licenses/GPL-compatibility.html .

## Copied source / predecessor

Module headers identify ports from the owner's Python predecessor: constants, SEI decoder, clip scanning, map loader, renderer, motion scanner and exporter. The Python predecessor snapshot used for these ports was MIT, copyright (c) 2026 Companion Turret; that full historical notice is preserved. The current Desktop project has since migrated its original code to GPL-3.0-only. MIT permits inclusion under a GPL-covered combined work with its notice retained; it does not change the historical MIT grant for upstream code. Upstream commit-level author/asset provenance and any earlier copied algorithms remain to be reviewed. No evidence establishes that every port is exclusively original to the owner. QR_MATRIX is a fixed generated data table, but generator/version/source history is incomplete; preserve and review, do not assert that absence of a notice proves original authorship.

## Fonts and assets

LICENSE_ASSETS.json lists every tracked distributable PNG/ICO/SVG asset and SHA-256. The Pretendard 1.3.9 variable WOFF2 subsets are bundled under the SIL Open Font License 1.1 (see THIRD_PARTY_NOTICES.md and licenses/pretendard-OFL-1.1.txt). There are no external font imports. System font references do not distribute the referenced font files.

The following are **unresolved before claiming full public-release clearance**:

1. Current `ct-*-v3` icons were supplied by the owner. A supplied file is not documentary proof of ownership/licensing. Their Portal turret/companion-cube inspiration raises potential Valve character/art/trademark questions. No permission record, original editable artwork or asset-specific grant is present. Older v2 and legacy icons remain in public/ and are copied to Pages too; they also need provenance review. Do not silently remove or redraw them in this scoped task.
2. `public/models/steering_hud.png` was restored byte-for-byte from the existing project. Its creator and redistribution license remain unverified.
3. The former `intro/scene.svg` illustration has been removed together with the introduction pages.
4. Core Python ports and QR table: confirm upstream commit lineage and any external copied code/required notices. No automated similarity search can prove absence of infringement.
5. Test fixtures: test/fixtures/README.md records generated FFmpeg test patterns, not user footage. They are outside public/ and not shipped by Pages. FFmpeg executable itself is not distributed by this web build. Any source archive that adds tool binaries would need a new audit.

## OpenStreetMap attribution / tile-policy review

Evidence: `src/core/map-loader.ts` uses the required HTTPS tile endpoint, ordinary Image requests with browser User-Agent/referrer behavior, current-area 3×3 loading, in-memory cache and browser caching. No cache-bypass headers, bulk offline pack or explicit prefetch job found. Provider headers and real traffic volume must still be checked; no claim is made about unlimited tile capacity. Export can request tiles as the rendered location advances, so large exports and repeated failed-tile retries are a load consideration, not proof of a bulk-download violation from source alone.

**Identified attribution gap:** `src/core/renderer.ts` draws `Map: OpenStreetMap` in small, partly transparent text inside the optional TIME column. It does not show “contributors”, an ODbL/copyright link/URL, or guarantee attribution when TIME is disabled. OSM's copyright page requires contributor credit and making the data license clear. This is evidence of an existing compliance gap, especially in exported video where legal-page links cannot replace on-video credit. The legal pages add accurate credit/reference, but **do not cure this rendering issue**. No tile endpoint, timing, caching, map gate, renderer or export behavior was modified. A future owner-approved attribution-only renderer change would be needed; report first as requested.

Policy evidence inspected 2026-11-01: https://operations.osmfoundation.org/policies/tiles/ and https://www.openstreetmap.org/copyright .

## Distribution and remaining release review

Browser bundles are object-code distribution. Keep matching source (including generated-page scripts, CSS, lockfile and build instructions), GPL and third-party notices available with each published revision. Legal pages link to the exact deployed commit's source when deployment.json is available. The repository is public; the Pages build does not distribute node_modules or require private footage for build. Source-archive copies should preserve licenses/ as well as root documents. Browser codecs/OS fonts are external platform components; no patent clearance is asserted.

Before claiming international release readiness: resolve asset and upstream provenance, fix the OSM attribution gap in a separately authorized scope, confirm GA account enhanced-measurement/retention settings and operator identity/contact/legal requirements in relevant jurisdictions. This dev change does not publish a production release and does not claim that GPL adoption alone resolves privacy or trademark obligations.
