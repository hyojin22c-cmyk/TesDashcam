# Privacy and network/data-flow audit

Inspected 2026-11-01. Baseline: dev c746802. See COMPLIANCE_DISCOVERY.md for pre-change architecture and COMPLIANCE_VERIFICATION.md for actual test results. Scope is the Web repository, not the Python application.

## Data and destinations

| Data | Local use/persistence | External transmission found |
| --- | --- | --- |
| Selected MP4 bytes / video frames | Browser File/Blob handles, video decode (HTML video and WebCodecs VideoDecoder), canvas, workers, memory buffers. No application database/cache persistence of source footage. A large exported MP4 may be written to origin-private file storage (`ct-exports/`) on the device; it is removed when the next export starts. With a mosaic option on, frames are additionally read back from a canvas and analysed in-page by ONNX Runtime Web (WebAssembly) with models fetched from this origin (`models/*.onnx`, `ort/`); no frame or detection result is transmitted. | No upload code or server processing endpoint found. |
| Filenames/timestamps | Clip grouping, list labels, download filename in memory. | No application analytics parameters or upload requests use them. External feedback uploads are a separate user action. |
| GPS / telemetry | SEI parser, per-clip timing, overlays/export in memory. | Not sent to GA by application code. Tile x/y/zoom derived from current GPS area are requested from OSM; a sequence may reveal location/movement, even though it is not the raw complete trace. |
| Exported MP4 | Encoded locally, downloaded using URL.createObjectURL and anchor.download. | No exported-video upload endpoint found. |
| Browser/client/session identifiers | GA cookies can exist after acceptance. No own user-profile database or account system. | Google GA receives standard identifiers and network metadata only after acceptance. GitHub/OSM receive ordinary request metadata for their separate services. |
| Usage events | No application-defined custom GA event call found. Existing viewer config produces page_view; Google-managed measurements depend on remote account configuration. | GA only after opt-in. Query/hash stripped from explicitly supplied page_location/referrer. No new application tracking events added. |
| UI settings | localStorage ct_theme, ct_theme_dev, ct_language, ct_view_mode, ct_auto_next, ct_telemetry_order. Legacy ct_layout removed. | No transmission code for these values except language/page title implicit in permitted page usage. |
| Consent preference | Origin-local ct_analytics_consent: version + granted/denied only, no identifier or timestamp; persistent until changed/removed. Storage failure falls back to page memory. | Not sent anywhere before a grant. With GA active, Consent Mode communicates the permitted state to Google. |

## Network surfaces

- GitHub Pages serves first-party HTML, JS/CSS, icons, steering image, SVG, legal texts, manifest, service worker and deployment metadata. Production and dev use different base paths on the same origin. Browser requests necessarily reach the host; no provider retention duration is invented.
- This fork has analytics switched off (`ANALYTICS_ENABLED = false` in `legal/consent.js`). No measurement ID is shipped, no consent notice is shown, and no Google tag, analytics request or analytics cookie is produced. The inherited consent code is inactive.
- `https://tile.openstreetmap.org/{z}/{x}/{y}.png`: existing browser Image requests, zoom 16 by default, current 3×3 area; memory cache plus browser HTTP cache. User-Agent/referrer controlled by browser. Request paths reveal area, source IP/network metadata is visible to provider. No full trace JSON upload, map consent gate, new provider, cache change or renderer change is introduced.
- The original project's Google Forms feedback link has been removed from this fork.
- No remote font/script library CDN besides consent-gated Google tag found. System font names do not trigger application font downloads. No XMLHttpRequest, application WebSocket, application sendBeacon or video upload fetch found in the baseline. New privacy code uses a script element only after consent.

## Browser storage and caches

- No application sessionStorage or IndexedDB usage found. No application-auth/session cookies. Consent uses localStorage, not a new cookie. Analytics cookies belong to GA and can include _ga / _ga_* / _gid / _gat variants depending on Google settings. The cleanup attempts only these names at host/parent domains and ancestor paths; HttpOnly or otherwise inaccessible cookies cannot be cleared by page JavaScript.
- `public/sw.js` precaches the viewer's own built files at install (list injected by the build) into a Cache Storage entry named per deployment scope and build id, and deletes that scope's older entries on activate. Same-origin GET requests inside the scope are answered cache-first for versioned assets and network-first with cache fallback otherwise; `deployment.json`, range requests and all cross-origin requests (including map tiles) pass through untouched. Without a build (dev server) the worker passes everything through. No selected-video persistence, video upload or tile cache policy is added.
- Existing HTTP cache entries, browser cache eviction and provider log/analytics retention are outside a fixed application lifetime. No invented seven-day/user-data deletion promise.
- Shared origin means dev and production can share localStorage/GA cookies. Sharing consent prevents contradictory prompts/choices; analytics paths and a deployment_environment parameter distinguish environments without changing measurement ID. Intro pages are independently generated; no assumption that /dev is a source folder.

## OSM policy findings (documentation only)

The HTTPS endpoint and default browser caching/referrer behavior match the tile-policy technical guidance. There is no explicit offline/bulk download feature. Current-area loading while rendering export can make requests along the segment; actual request volume and retries require operational monitoring. The existing on-video `Map: OpenStreetMap` credit omits contributors/license reference and depends on TIME layout. This is a documented attribution gap, not silently fixed here. See LICENSE_AUDIT.md for exact code evidence. Legal-page credit does not repair the video attribution.

## Evidence limits / operator follow-up

Source review cannot establish every browser/device/provider behavior. GA account enhanced-measurement, retention, cross-domain/Google Signals linking, unwanted event parameters and reporting receipt are not exposed by this repository. Verify the remote property before production release, especially automatic form/file-download measurement. No property settings are changed without access/authorization. The current editor has no application form submission and creates exports as blob URLs, but that does not certify all remote GA configuration.

The operator's non-public identity/address, asset provenance, jurisdiction-specific legal bases, provider contracts, transfer safeguards and request-handling duties require owner review. User footage remains outside the operator's infrastructure except when a user deliberately sends it through an external service. This report is factual technical evidence and a list of limits, not a statement of complete legal compliance.

## Primary references reviewed

- [Google Basic Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Consent Mode v2 implementation](https://developers.google.com/tag-platform/security/guides/consent)
- [Google privacy controls](https://developers.google.com/tag-platform/security/guides/privacy)
- [Enhanced measurement settings](https://support.google.com/analytics/answer/9216061)
- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [OSM copyright and attribution](https://www.openstreetmap.org/copyright)
