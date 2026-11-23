# CT Dashcam Studio Web — Privacy Policy

Last updated: 2026-11-01. Canonical policy language: English.

Deployment scope: this revised source is used for production and development following the owner-approved main promotion on 2026-11-01. Older cached deployments may not yet include the revised consent controls; reload to obtain the current site.

## Operator and contact

CT Dashcam Studio Web is an independent project originally created under the GitHub account `mhsong282828221212123123123` (Companion Turret). This copy is a fork maintained under the GitHub account `hyojin22c-cmyk`. It is not affiliated with Tesla, Inc. The repository does not identify a company, postal address or private contact email; none is invented here.

Contact the maintainer through [GitHub Issues](https://github.com/hyojin22c-cmyk/CT-dashcam-studio-WEB/issues). GitHub Issues are public: do not post private footage, identifiers or precise locations there.

## Video, filenames, frames, telemetry and exports

The inspected application reads files you choose using browser file APIs. MP4 parsing, video decoding/playback, SEI telemetry parsing, motion analysis, compositing and MP4 encoding/muxing run on your device. Filenames and file timestamps are used to group/order clips and name downloads. Frames, GPS coordinates and other telemetry are used for previews, overlays and exports. Exported files are downloaded through a local Blob URL. We found no application endpoint that uploads selected videos, frames, filenames, complete GPS traces, vehicle identifiers or exported files.

These files and processing buffers are held in browser memory/local file handles for the session. The application does not write source footage or telemetry into localStorage, IndexedDB or an application server. One exception concerns the video you export: when an export is large, and in browsers that support it, the finished MP4 is written to the browser's origin-private file storage on your device instead of being held in memory. That file never leaves the device, is deleted when the next export starts, and can be removed at any time with the browser's site-data controls. Files you download or share remain wherever you save them, under your control. Browser and operating-system internals, extensions and device backups are outside this policy's technical guarantees. Maps are an important exception to wholly local processing of location-related information, explained below.

The optional, experimental licence-plate and face mosaic also runs entirely on your device. Switching it on downloads two detection models and a WebAssembly runtime from this site; video frames are analysed in the browser and are not sent anywhere. Detection is automatic and imperfect: it can miss plates or faces and can cover other things, so review an exported video before sharing it.

## No analytics in this fork

This fork does not use Google Analytics. The consent code inherited from the original project is still in the source but is switched off (`ANALYTICS_ENABLED = false` in `legal/consent.js`): the viewer carries no measurement ID, no consent notice is shown, no Google tag is requested and no analytics cookies are set. The original project's feedback form link has also been removed.

## Browser storage and retention

This fork never writes the consent preference described next; the description is kept for the inherited code. The shared, origin-local consent preference is `ct_analytics_consent`, a minimal JSON record containing a schema version and granted/denied choice, with no user ID or timestamp. It is shared by production, dev, viewer and introduction routes on the same GitHub Pages origin. It has no application expiry; it remains until you change it, clear browser/site data, or the browser removes it. Storage failures do not prevent editing; a choice then applies in memory only and a later page may ask again. A different origin, browser or profile has separate preferences.

Existing localStorage settings include `ct_theme`, `ct_theme_dev`, `ct_language`, `ct_view_mode`, `ct_auto_next`, and `ct_telemetry_order`. Legacy `ct_layout` is removed by existing code. These preferences have no application expiry. They store UI settings, not video content or telemetry. No application sessionStorage or IndexedDB use was found. With analytics accepted, Google can create `_ga` and measurement-specific `_ga_*` cookies and other standard GA cookies; their expiry is controlled by Google tag/account settings and browser policy, not a retention promise made here.

The viewer registers a service worker for its deployment path. The worker stores the viewer's own application files (page, scripts, styles, icons, steering image) in the browser's Cache Storage so the viewer can open without a network connection; caches of earlier builds are deleted when a new build activates. It does not cache map tiles or other cross-origin requests and never stores selected videos. The browser's normal HTTP cache may retain site assets and map tiles according to response headers and browser policy. Site-data controls can remove cookies, preferences, caches and service-worker registrations. Removal may cause a new consent prompt.

## OpenStreetMap requests

The existing minimap requests raster tiles from `https://tile.openstreetmap.org/{z}/{x}/{y}.png` as needed for the current rendered area in preview or export. These requests disclose the requested map tile area and normal network metadata (including IP address, browser headers and usually the site's origin referrer) to the tile provider. A series of tile requests can reveal information about viewed locations or movement; it is not a direct upload of the raw GPS trace or complete telemetry file.

The application keeps an in-memory tile cache and uses browser HTTP caching. Map requests are independent of analytics consent. Rejecting analytics does not stop map requests or introduce a map consent gate. Existing overlay settings determine whether the map is rendered. OSM services are governed by their own policies; the operator does not control their logs or retention. Map data is credited to OpenStreetMap contributors and is licensed under ODbL. An audit found limitations in the existing on-video attribution; see LICENSE_AUDIT.md. This task documents those limitations without changing the renderer or map behavior.

## Hosting and external services

GitHub Pages serves the application, scripts, icons, introductions and legal documents. GitHub and its infrastructure receive normal web request information; hosting is not the application's video processing server. Network requests to Google Analytics are conditional on acceptance. Map requests and user-initiated GitHub, Google Forms or other external links have separate purposes and do not depend on analytics acceptance. No external font CDN or consent-management service is used by this change.

The operator has not verified provider/account-specific retention, international transfer arrangements, legal identity requirements in every jurisdiction, or all third-party provenance. This policy describes inspected source behavior, not a guarantee of complete legal compliance. Third parties maintain their own privacy practices and may update them. Any legal basis, rights-handling procedure or operator details required for a particular jurisdiction must be verified before a public release there.

## Third-party references

- [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
- [OpenStreetMap Foundation Privacy Policy](https://osmfoundation.org/wiki/Privacy_Policy)
- [OpenStreetMap copyright and licensing](https://www.openstreetmap.org/copyright)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)

Policy changes will update the date above. A material change to analytics purposes should also trigger a new consent schema version and renewed choice.
