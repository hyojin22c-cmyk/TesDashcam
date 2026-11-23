// SPDX-License-Identifier: GPL-3.0-only
const PRIVACY_STRINGS = {"en":{"privacy":"Privacy Policy","licenses":"Open-source Licenses","thirdParty":"Third-party Licenses","preferences":"Privacy & Licenses","settings":"Privacy settings","analytics":"Analytics consent","accept":"Accept Analytics","reject":"Reject Analytics","change":"Change consent","close":"Close","map":"External map requests","body":"Your dashcam footage and telemetry are processed on your device. Optional Google Analytics provides usage statistics. Accepting or rejecting analytics does not affect editing.","mapBody":"Maps request tiles from OpenStreetMap, revealing the requested area and network metadata. Hosting and external links also involve other providers.","granted":"Analytics accepted. You can withdraw consent below.","denied":"Analytics rejected. Editing and maps remain available.","storage":"Your browser could not save this choice. It applies in this page only.","canonical":"Legal documents are provided in English as the canonical version.","back":"Back to viewer"},"ko":{"privacy":"개인정보 처리방침","licenses":"오픈소스 라이선스","thirdParty":"제3자 라이선스","preferences":"개인정보 및 라이선스","settings":"개인정보 설정","analytics":"사용 통계 수집 동의","accept":"통계 수집 동의","reject":"통계 수집 거부","change":"동의 변경","close":"닫기","map":"외부 지도 요청","body":"블랙박스 영상과 텔레메트리는 기기에서 처리합니다. 선택 사항인 Google Analytics로 사용 통계를 수집합니다. 동의하거나 거부해도 편집 기능은 동일합니다.","mapBody":"지도는 OpenStreetMap에 타일을 요청하여 조회 영역과 네트워크 정보가 전달됩니다. 호스팅과 외부 링크도 다른 제공업체와 연결됩니다.","granted":"통계 수집에 동의했습니다. 아래에서 동의를 철회할 수 있습니다.","denied":"통계 수집을 거부했습니다. 편집과 지도는 계속 사용할 수 있습니다.","storage":"브라우저에 선택을 저장하지 못했습니다. 현재 페이지에서만 적용됩니다.","canonical":"법적 문서의 기준이 되는 원문은 영어로 제공됩니다.","back":"뷰어로 돌아가기"},"ja":{"privacy":"プライバシーポリシー","licenses":"オープンソースライセンス","thirdParty":"第三者ライセンス","preferences":"プライバシーとライセンス","settings":"プライバシー設定","analytics":"利用統計への同意","accept":"利用統計に同意","reject":"利用統計を拒否","change":"同意を変更","close":"閉じる","map":"外部地図へのリクエスト","body":"映像とテレメトリーは端末内で処理します。任意の Google Analytics で利用統計を収集します。同意・拒否は編集機能に影響しません。","mapBody":"地図タイルは OpenStreetMap に要求され、表示地域とネットワーク情報が伝わります。ホスティングや外部リンクも他社サービスに接続します。","granted":"利用統計に同意しています。下の操作で撤回できます。","denied":"利用統計を拒否しています。編集と地図は引き続き使えます。","storage":"選択を保存できませんでした。このページでのみ適用されます。","canonical":"法的文書の正式な原文は英語で提供します。","back":"ビューアーに戻る"},"zh-CN":{"privacy":"隐私政策","licenses":"开源许可证","thirdParty":"第三方许可证","preferences":"隐私与许可证","settings":"隐私设置","analytics":"使用统计同意","accept":"同意使用统计","reject":"拒绝使用统计","change":"更改同意","close":"关闭","map":"外部地图请求","body":"行车视频和遥测数据在您的设备上处理。可选的 Google Analytics 用于使用统计。同意或拒绝均不影响编辑功能。","mapBody":"地图向 OpenStreetMap 请求图块，会传递所查看的区域和网络信息。托管和外部链接也涉及其他服务商。","granted":"已同意使用统计。您可以在下方撤回同意。","denied":"已拒绝使用统计。编辑和地图仍可使用。","storage":"浏览器无法保存此选择。仅对当前页面有效。","canonical":"法律文档以英文原文为准。","back":"返回查看器"},"zh-TW":{"privacy":"隱私權政策","licenses":"開放原始碼授權","thirdParty":"第三方授權","preferences":"隱私權與授權","settings":"隱私權設定","analytics":"使用統計同意","accept":"同意使用統計","reject":"拒絕使用統計","change":"變更同意","close":"關閉","map":"外部地圖請求","body":"行車影片與遙測資料在您的裝置上處理。選用的 Google Analytics 用於使用統計。同意或拒絕均不影響編輯功能。","mapBody":"地圖向 OpenStreetMap 請求圖磚，會傳遞查看的區域與網路資訊。託管和外部連結也涉及其他服務商。","granted":"已同意使用統計。您可以在下方撤回同意。","denied":"已拒絕使用統計。編輯與地圖仍可使用。","storage":"瀏覽器無法儲存此選擇。僅對目前頁面有效。","canonical":"法律文件以英文原文為準。","back":"返回檢視器"},"de":{"privacy":"Datenschutzerklärung","licenses":"Open-Source-Lizenzen","thirdParty":"Drittanbieter-Lizenzen","preferences":"Datenschutz & Lizenzen","settings":"Datenschutzeinstellungen","analytics":"Einwilligung in Nutzungsstatistiken","accept":"Analyse erlauben","reject":"Analyse ablehnen","change":"Einwilligung ändern","close":"Schließen","map":"Externe Kartenanfragen","body":"Dashcam-Videos und Telemetrie werden auf deinem Gerät verarbeitet. Das optionale Google Analytics liefert Nutzungsstatistiken. Deine Entscheidung beeinflusst die Bearbeitung nicht.","mapBody":"Kartenkacheln werden von OpenStreetMap angefordert. Dabei werden das angezeigte Gebiet und Netzwerkdaten übermittelt. Hosting und externe Links nutzen ebenfalls andere Anbieter.","granted":"Analyse erlaubt. Du kannst die Einwilligung unten widerrufen.","denied":"Analyse abgelehnt. Bearbeitung und Karten bleiben verfügbar.","storage":"Dein Browser konnte die Auswahl nicht speichern. Sie gilt nur auf dieser Seite.","canonical":"Die maßgebliche Fassung der rechtlichen Dokumente ist auf Englisch.","back":"Zurück zum Viewer"},"fr":{"privacy":"Politique de confidentialité","licenses":"Licences open source","thirdParty":"Licences tierces","preferences":"Confidentialité et licences","settings":"Paramètres de confidentialité","analytics":"Consentement aux statistiques","accept":"Accepter les statistiques","reject":"Refuser les statistiques","change":"Modifier le consentement","close":"Fermer","map":"Requêtes cartographiques externes","body":"Les vidéos et la télémétrie sont traitées sur votre appareil. Google Analytics, facultatif, fournit des statistiques d’utilisation. Votre choix ne modifie pas les fonctions de montage.","mapBody":"Les cartes demandent des tuiles à OpenStreetMap et transmettent la zone consultée et des données réseau. L’hébergement et les liens externes impliquent aussi d’autres prestataires.","granted":"Statistiques acceptées. Vous pouvez retirer votre consentement ci-dessous.","denied":"Statistiques refusées. Le montage et les cartes restent disponibles.","storage":"Le navigateur n’a pas pu enregistrer votre choix. Il ne vaut que pour cette page.","canonical":"Les documents juridiques de référence sont fournis en anglais.","back":"Retour au lecteur"},"es":{"privacy":"Política de privacidad","licenses":"Licencias de código abierto","thirdParty":"Licencias de terceros","preferences":"Privacidad y licencias","settings":"Ajustes de privacidad","analytics":"Consentimiento de estadísticas","accept":"Aceptar estadísticas","reject":"Rechazar estadísticas","change":"Cambiar consentimiento","close":"Cerrar","map":"Solicitudes de mapas externos","body":"Los vídeos y la telemetría se procesan en tu dispositivo. Google Analytics es opcional y proporciona estadísticas de uso. Tu decisión no afecta a las funciones de edición.","mapBody":"Los mapas solicitan teselas a OpenStreetMap y transmiten la zona consultada y datos de red. El alojamiento y los enlaces externos también utilizan otros proveedores.","granted":"Estadísticas aceptadas. Puedes retirar el consentimiento abajo.","denied":"Estadísticas rechazadas. La edición y los mapas siguen disponibles.","storage":"El navegador no pudo guardar tu elección. Solo se aplica en esta página.","canonical":"La versión de referencia de los documentos legales está en inglés.","back":"Volver al visor"}};

export const CONSENT_KEY = 'ct_analytics_consent';
export const CONSENT_VERSION = 1;
// This fork ships without analytics: no measurement ID is used, no consent notice is shown,
// and the Privacy & Licenses links open the legal page instead of a consent panel.
export const ANALYTICS_ENABLED = false;
const deniedSignals = {
  analytics_storage: 'denied', ad_storage: 'denied',
  ad_user_data: 'denied', ad_personalization: 'denied',
};

export function parseConsent(value) {
  try {
    const record = JSON.parse(value);
    return record?.v === CONSENT_VERSION && ['granted', 'denied'].includes(record.analytics)
      ? record.analytics : null;
  } catch { return null; }
}

// Only the viewer supplies a measurement ID. Intro/legal pages manage the same
// preference but do not add tracking to surfaces that previously had none.
export function createAnalyticsConsent({ win, doc, measurementId = '', environment = 'production', storage }) {
  let choice = null;
  let initialized = false;
  let tag = null;
  let persistent = true;
  const listeners = new Set();
  function queue() { win.dataLayer.push(arguments); }
  const read = () => { try { return parseConsent(storage?.getItem(CONSENT_KEY)); } catch { return null; } };
  win.dataLayer = win.dataLayer || [];
  if (measurementId) {
    win[`ga-disable-${measurementId}`] = true;
    // The queue is local: Basic Mode sends nothing, including consent pings,
    // unless an explicit grant subsequently loads the Google tag.
    queue('consent', 'default', { ...deniedSignals });
    queue('set', 'ads_data_redaction', true);
    win.gtag = function (...args) {
      if (choice === 'granted') queue(...args);
    };
  }

  function deleteAnalyticsCookies() {
    // Remove only Google's analytics cookies, never editor preferences or other
    // cookies. Try host-only and parent domains, and all ancestor paths.
    let cookies;
    try { cookies = doc.cookie.split(';').map(part => part.trim().split('=')[0]).filter(name => /^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name)); }
    catch { return; }
    const labels = win.location.hostname.split('.');
    const domains = ['', ...labels.map((_, i) => labels.slice(i).join('.')).filter(d => d.includes('.'))];
    const segments = win.location.pathname.split('/').filter(Boolean);
    const paths = ['/', ...segments.map((_, i) => '/' + segments.slice(0, i + 1).join('/'))];
    for (const name of cookies) for (const domain of domains) for (const path of paths) {
      try { doc.cookie = `${name}=; Max-Age=0; path=${path};${domain ? ` domain=${domain};` : ''} SameSite=Lax`; } catch {}
    }
  }

  function apply(next) {
    const previous = choice;
    choice = next;
    if (measurementId) {
      win[`ga-disable-${measurementId}`] = choice !== 'granted';
      if (choice === 'granted') {
        // Every update keeps all three advertising signals denied.
        if (previous !== 'granted') queue('consent', 'update', { ...deniedSignals, analytics_storage: 'granted' });
        if (!initialized) {
          initialized = true;
          queue('js', new Date());
          // Keep the existing automatic page_view: one config per document.
          // Do not forward URL query strings/hashes to Analytics.
          queue('config', measurementId, {
            allow_google_signals: false, allow_ad_personalization_signals: false,
            page_location: win.location.origin + win.location.pathname,
            page_referrer: safeReferrer(doc.referrer),
            deployment_environment: environment,
          });
          tag = doc.createElement('script');
          tag.async = true;
          tag.dataset.ctAnalytics = 'true';
          tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
          doc.head.appendChild(tag);
        }
      } else {
        // Disable before updating consent, so withdrawal never intentionally
        // transitions to Advanced Mode's cookieless analytics collection.
        if (initialized && previous === 'granted') queue('consent', 'update', { ...deniedSignals });
      }
    }
    if (choice !== 'granted') deleteAnalyticsCookies();
    listeners.forEach(listener => listener({ choice, persistent }));
  }

  function safeReferrer(value) {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; }
  }

  const onStorage = event => {
    if (event.key === CONSENT_KEY || event.key === null) apply(read());
  };
  win.addEventListener('storage', onStorage);
  // Re-check after back/forward cache restoration and when a background tab
  // returns, so a choice changed elsewhere is honored before more page activity.
  win.addEventListener('pageshow', () => { if (persistent) apply(read()); });
  doc.addEventListener('visibilitychange', () => { if (persistent && doc.visibilityState === 'visible') apply(read()); });
  apply(read());
  return {
    get choice() { return choice; },
    get persistent() { return persistent; },
    setChoice(next) {
      if (!['granted', 'denied'].includes(next)) throw new Error('Invalid analytics choice');
      try {
        storage?.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, analytics: next }));
        persistent = Boolean(storage);
      } catch { persistent = false; }
      apply(next);
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

export function initPrivacyUI(win = window, doc = document) {
  if (win.__ctPrivacy) return win.__ctPrivacy;
  const script = doc.querySelector('script[data-ct-privacy]');
  if (!script) return;
  const base = new URL('./', script.src);
  let storage;
  try { storage = win.localStorage; } catch {}
  const controller = createAnalyticsConsent({ win, doc, storage,
    measurementId: ANALYTICS_ENABLED ? script.dataset.measurementId || '' : '',
    environment: script.dataset.environment || (win.location.pathname.includes('/dev/') ? 'development' : 'production') });
  win.__ctPrivacy = controller;
  const lang = () => PRIVACY_STRINGS[doc.documentElement.lang] ? doc.documentElement.lang : 'en';
  const legalURL = file => {
    const url = new URL(file, base);
    url.searchParams.set('lang', lang());
    return url.href;
  };
  const panel = doc.createElement('section');
  panel.className = 'ct-privacy-notice';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'ct-privacy-heading');
  panel.hidden = true;
  panel.innerHTML = `<div class="ct-privacy-heading"><h2 id="ct-privacy-heading"></h2><button type="button" class="ct-privacy-close"></button></div><p data-copy="body"></p><details><summary data-copy="map"></summary><p data-copy="mapBody"></p></details><p class="ct-privacy-status" role="status"></p><div class="ct-privacy-actions"><button type="button" data-choice="granted"></button><button type="button" data-choice="denied"></button></div><nav class="ct-privacy-links"><a data-legal="privacy.html" data-copy="privacy"></a><a data-legal="license.html" data-copy="licenses"></a><a data-legal="third-party.html" data-copy="thirdParty"></a></nav>`;
  let opener = null;
  const close = () => { panel.hidden = true; render(); opener?.focus(); };
  const render = () => {
    const strings = PRIVACY_STRINGS[lang()];
    panel.querySelector('h2').textContent = controller.choice ? strings.settings : strings.analytics;
    panel.querySelector('.ct-privacy-close').textContent = strings.close;
    panel.querySelector('[data-choice="granted"]').textContent = strings.accept;
    panel.querySelector('[data-choice="denied"]').textContent = strings.reject;
    panel.querySelectorAll('[data-copy]').forEach(el => { el.textContent = strings[el.dataset.copy]; });
    panel.querySelector('.ct-privacy-status').textContent = controller.choice ? strings[controller.choice] + (controller.persistent ? '' : ' ' + strings.storage) : '';
    doc.querySelectorAll('[data-privacy-settings]').forEach(el => {
      el.textContent = strings[el.dataset.privacyLabel || 'preferences'] + (el.hasAttribute('data-show-license') ? ' · GPL-3.0-only' : '');
      el.setAttribute('href', legalURL('index.html'));
      if (!ANALYTICS_ENABLED) return;
      el.setAttribute('aria-controls', 'ct-privacy-notice');
      el.setAttribute('aria-expanded', String(!panel.hidden));
      el.setAttribute('title', strings.change);
    });
    doc.querySelectorAll('[data-legal]').forEach(el => {
      el.href = legalURL(el.dataset.legal);
      const key = el.dataset.copy;
      if (key && strings[key]) el.textContent = strings[key] + (key === 'licenses' ? ' · GPL-3.0-only' : '');
    });
    doc.querySelectorAll('[data-privacy-copy]').forEach(el => { el.textContent = strings[el.dataset.privacyCopy] || ''; });
    doc.querySelectorAll('[data-legal-back]').forEach(el => { el.href = new URL(`../?lang=${lang()}`, base).href; });
  };
  const open = trigger => { opener = trigger; panel.hidden = false; render(); panel.querySelector('h2').setAttribute('tabindex', '-1'); panel.querySelector('h2').focus(); };
  panel.id = 'ct-privacy-notice';
  panel.querySelector('.ct-privacy-close').addEventListener('click', close);
  panel.addEventListener('keydown', event => {
    // Editor shortcuts must not fire while operating the privacy controls.
    event.stopPropagation();
    if (event.key === 'Escape') close();
  });
  panel.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    controller.setChoice(button.dataset.choice);
    // A failed write is explained without blocking editing. Successful choices
    // dismiss the notice; settings remain available in the footer.
    if (controller.persistent) close();
  }));
  if (ANALYTICS_ENABLED) doc.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-privacy-settings]');
    if (trigger) { event.preventDefault(); open(trigger); }
  });
  const mount = () => {
    if (ANALYTICS_ENABLED) {
      doc.body.appendChild(panel);
      panel.hidden = controller.choice !== null;
      controller.subscribe(() => { if (!controller.choice) panel.hidden = false; render(); });
    }
    render();
    // Viewer localization changes <html lang>; intro pages already have lang.
    new win.MutationObserver(render).observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  return controller;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') initPrivacyUI();
