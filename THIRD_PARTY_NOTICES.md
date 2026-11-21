# Third-party notices

CT Dashcam Studio Web original project code is offered under GPL-3.0-only only where the owner holds the necessary rights. This does not replace the licenses below or clear uncertain artwork. See LICENSE_AUDIT.md.

## Distributed runtime code: mp4-muxer 5.2.2

The exporter uses mp4-muxer under the MIT license to write MP4 files. Source is available from https://github.com/Vanilagy/mp4-muxer and npm. The full notice is in licenses/mp4-muxer-MIT.txt.

## Distributed runtime code: viewer interface libraries

The React interface bundles the following packages. Versions are locked in pnpm-lock.yaml. Each original notice is preserved in full in licenses/ and on the deployed third-party legal page. Do not relicense these components as original project code.

| Package | Version | License | Notice file |
| --- | --- | --- | --- |
| react | 19.3.1 | MIT | licenses/react-MIT.txt |
| react-dom | 19.3.1 | MIT | licenses/react-dom-MIT.txt |
| scheduler | 0.28.0 | MIT | licenses/scheduler-MIT.txt |
| @base-ui/react | 1.9.0 | MIT | licenses/base-ui-react-MIT.txt |
| @base-ui/utils | 0.5.0 | MIT | licenses/base-ui-utils-MIT.txt |
| @floating-ui/core | 1.8.0 | MIT | licenses/floating-ui-core-MIT.txt |
| @floating-ui/dom | 1.8.0 | MIT | licenses/floating-ui-dom-MIT.txt |
| @floating-ui/react-dom | 2.1.9 | MIT | licenses/floating-ui-react-dom-MIT.txt |
| @floating-ui/utils | 0.2.12 | MIT | licenses/floating-ui-utils-MIT.txt |
| reselect | 5.3.0 | MIT | licenses/reselect-MIT.txt |
| use-sync-external-store | 1.7.0 | MIT | licenses/use-sync-external-store-MIT.txt |
| i18next | 27.1.3 | MIT | licenses/i18next-MIT.txt |
| react-i18next | 18.0.2 | MIT | licenses/react-i18next-MIT.txt |
| html-parse-stringify | 4.0.1 | MIT | licenses/html-parse-stringify-MIT.txt |
| @babel/runtime | 8.1.2 | MIT | licenses/babel-runtime-MIT.txt |
| zustand | 5.1.0 | MIT | licenses/zustand-MIT.txt |
| es-toolkit | 1.53.2 | MIT | licenses/es-toolkit-MIT.txt |
| motion | 14.14.0 | MIT | licenses/motion-MIT.txt |
| framer-motion | 14.14.0 | MIT | licenses/framer-motion-MIT.txt |
| motion-dom | 14.14.0 | MIT | licenses/motion-dom-MIT.txt |
| motion-utils | 14.7.0 | MIT | licenses/motion-utils-MIT.txt |
| @jellybrick/react-solid-flow | 1.2.1 | MIT | licenses/react-solid-flow-MIT.txt |
| the-new-css-reset | 1.11.3 | MIT | licenses/the-new-css-reset-MIT.txt |
| virtua | 0.55.0 | MIT | licenses/virtua-MIT.txt |
| zod | 4.6.7 | MIT | licenses/zod-MIT.txt |
| react-markdown | 10.1.0 | MIT | licenses/runtime-dependencies.txt |
| remark-gfm | 4.0.1 | MIT | licenses/runtime-dependencies.txt |
| react-hotkeys-hook | 5.4.0 | MIT | licenses/runtime-dependencies.txt |
| @use-gesture/react | 10.3.1 | MIT | licenses/runtime-dependencies.txt |
| i18next-browser-languagedetector | 8.3.1 | MIT | licenses/runtime-dependencies.txt |

licenses/runtime-dependencies.txt holds the original license text of every package bundled into the site, including the packages these libraries depend on (for example the unified, remark, micromark, mdast and hast packages behind react-markdown) and the Workbox runtime that the service worker build bundles from @vite-pwa/workbox-swkit. It is generated from `pnpm licenses list --prod`; regenerate it whenever runtime dependencies change.
| sonner | 2.0.8 | MIT | licenses/sonner-MIT.txt |
| lucide-react | 1.73.0 | ISC | licenses/lucide-react-ISC.txt |
| clsx | 2.1.1 | MIT | licenses/clsx-MIT.txt |
| tailwind-merge | 3.7.0 | MIT | licenses/tailwind-merge-MIT.txt |
| class-variance-authority | 0.7.1 | Apache-2.0 | licenses/class-variance-authority-Apache-2.0.txt |
| tw-animate-css | 1.4.0 | MIT | licenses/tw-animate-css-MIT.txt |

## Distributed font: Pretendard 1.3.9

Source: https://github.com/orioncactus/pretendard
Copyright (c) 2021 Kil Hyung-jin, with Reserved Font Name Pretendard. The variable dynamic-subset WOFF2 files are bundled unmodified and are licensed under the SIL Open Font License, Version 1.1, preserved in full in licenses/pretendard-OFL-1.1.txt. The OFL covers the font files only; it does not apply to the rest of this project.

## Python predecessor and ports

Source: https://github.com/mhsong282828221212123123123/CT-dashcam-studio
Headers identify ports of core/constants.py, decoder.py, map_loader.py, renderer.py, exporter.py, scanner.py and ui/main_window.py. The sibling repository LICENSE carries the following MIT notice. Preserving it does not certify that every upstream asset or copied algorithm has been cleared.

MIT License

Copyright (c) 2026 Companion Turret

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Build-generated code and development tools

Vite 8.3.8 is a development/build tool, not an application runtime dependency. It bundles with Rolldown 1.2.19, which may emit small runtime helpers and the modulepreload polyfill into the distributed viewer bundle. Vite's supplied license with its bundled third-party notices is preserved in licenses/vite-NOTICES.txt and Rolldown's MIT notice in licenses/rolldown-MIT.txt. Tailwind CSS, TypeScript, oxlint, oxfmt, Vitest and the React Compiler only run at build or test time. The locked dependency versions are in pnpm-lock.yaml.


## OpenStreetMap

Map data: © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0. Tiles are remotely requested, not bundled map databases. Software licensing does not grant rights in map data or remove tile-provider terms. See https://www.openstreetmap.org/copyright and https://operations.osmfoundation.org/policies/tiles/ . Existing on-video attribution needs owner review; no renderer change is made in this task.

## External services

Google Analytics gtag.js is fetched from Google only after analytics consent on the viewer; it is not bundled or offered under GPL by this project. Google Analytics, Google Forms, GitHub Pages and OSM have separate service/privacy terms. Refer to PRIVACY.md. Standard browser APIs/codecs and system fonts are supplied by the browser/OS, not licensed by this repository.

## Artwork, branding, copied source and test fixtures

Icon PNG/ICO/SVG generations and visual brand references require the provenance review in LICENSE_AUDIT.md. No Valve/Portal or Tesla rights are purportedly granted by this notice. Test timing MP4s were generated with FFmpeg test patterns; they are test-only and not published by the Pages build. The only bundled font is Pretendard, listed above. Source history and AI assistance are not substitutes for third-party copyright review.
