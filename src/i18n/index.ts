import i18next, { type ResourceLanguage } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import seo from './seo.json';

import type en from './locales/en.json';

export const SUPPORTED_LANGS = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'de', 'fr', 'es'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export type TranslationKey = keyof typeof en;

export const LANGUAGE_NAMES: Record<SupportedLang, string> = {
  'ko': '한국어',
  'en': 'English',
  'ja': '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
};

export const LOCALIZED_SEO: Record<
  SupportedLang,
  { title: string; desc: string; ogTitle: string; ogDesc: string }
> = seo;

const STORAGE_KEY = 'ct_language';

export const normalizeLang = (input: string): SupportedLang | null => {
  const [base = '', ...subtags] = input.trim().toLowerCase().replace(/_/g, '-').split('-');
  if (base === 'zh') {
    if (subtags.includes('hant')) return 'zh-TW';
    if (subtags.includes('hans')) return 'zh-CN';
    return subtags.some((part) => ['tw', 'hk', 'mo'].includes(part)) ? 'zh-TW' : 'zh-CN';
  }
  return SUPPORTED_LANGS.find((lang) => lang === base) ?? null;
};

const applyDocumentLanguage = (lang: SupportedLang) => {
  if (typeof document === 'undefined') return;
  const meta = LOCALIZED_SEO[lang];
  document.documentElement.lang = lang;
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', meta.ogTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', meta.ogDesc);
};

export const currentLang = () => normalizeLang(i18n.language) ?? 'en';

const localeBackend = {
  type: 'backend' as const,
  callbackApi: false,
  init() {},
  read: async (language: string) => {
    const locale = (await import(`./locales/${language}.json`)) as { default: ResourceLanguage };
    return locale.default;
  },
};

const languageDetector = new LanguageDetector().addDetector({
  name: STORAGE_KEY,
  lookup: () => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  },
});

export const i18n = i18next.createInstance();

await i18n
  .use(localeBackend)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    detection: {
      order: ['querystring', STORAGE_KEY, 'navigator'],
      lookupQuerystring: 'lang',
      caches: [],
      convertDetectedLanguage: (lng) => normalizeLang(lng) ?? '',
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGS],
    load: 'currentOnly',
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  });

export const detectInitialLang = (): SupportedLang =>
  normalizeLang(i18n.services.languageUtils.getBestMatchFromCodes(languageDetector.detect())) ??
  'en';

applyDocumentLanguage(currentLang());
i18n.on('languageChanged', () => applyDocumentLanguage(currentLang()));

export const setLanguage = async (lang: SupportedLang) => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  await i18n.changeLanguage(lang);
  if (typeof window !== 'undefined' && window.location.href) {
    const url = new URL(window.location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', lang);
      window.history.replaceState(window.history.state, '', url);
    }
  }
};
