import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectInitialLang,
  i18n,
  LOCALIZED_SEO,
  normalizeLang,
  setLanguage,
  type SupportedLang,
} from '../src/i18n';
import { TRANSLATIONS } from './locales';

const environment = (languages: string[] = [], saved: string | null = null, search = '') => {
  const storage = { getItem: vi.fn(() => saved), setItem: vi.fn() };
  vi.stubGlobal('window', { location: { search } });
  vi.stubGlobal('navigator', { languages, language: languages[0] || '', userAgent: '' });
  vi.stubGlobal('localStorage', storage);
  return storage;
};

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});

describe('initial language and persistence', () => {
  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['ko-KR', 'ko'],
    ['ja-JP', 'ja'],
    ['de-DE', 'de'],
    ['de-AT', 'de'],
    ['fr-CA', 'fr'],
    ['es-MX', 'es'],
    ['zh-CN', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans-TW', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant-US', 'zh-TW'],
  ])('matches first-visit preference %s to %s', (locale, expected) => {
    const storage = environment([locale]);
    expect(detectInitialLang()).toBe(expected);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('skips unsupported preferences in order', () => {
    environment(['it-IT', 'fr-FR', 'en-US']);
    expect(detectInitialLang()).toBe('fr');
  });

  it('uses English for unsupported or unavailable browser languages', () => {
    environment(['it-IT', 'pt-BR']);
    expect(detectInitialLang()).toBe('en');
    vi.stubGlobal('navigator', undefined);
    expect(detectInitialLang()).toBe('en');
  });

  it('prioritizes URL, then stored choice, then browser preference', () => {
    environment(['de-DE'], 'ja', '?lang=fr-CA');
    expect(detectInitialLang()).toBe('fr');
    environment(['de-DE'], 'ja', '?lang=unsupported');
    expect(detectInitialLang()).toBe('ja');
    environment(['de-DE'], 'invalid');
    expect(detectInitialLang()).toBe('de');
    environment(['de-DE'], 'cimode', '?lang=cimode');
    expect(detectInitialLang()).toBe('de');
  });

  it('saves an explicit language link over the previous preference at startup', async () => {
    const storage = environment(['ko'], 'ko', '?lang=en');
    vi.resetModules();
    const { currentLang } = await import('../src/i18n');
    expect(currentLang()).toBe('en');
    expect(storage.setItem).toHaveBeenCalledWith('ct_language', 'en');
  });

  it('normalizes regional codes without accepting unrelated prefixes', () => {
    expect(normalizeLang(' FR_ca ')).toBe('fr');
    for (const invalid of ['english', 'deceptive', 'hant', 'constructor', '__proto__']) {
      expect(normalizeLang(invalid)).toBeNull();
    }
  });

  it('survives inaccessible storage when switching languages', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage blocked');
      },
      setItem: () => {
        throw new Error('Storage blocked');
      },
    });
    expect(detectInitialLang()).toBeTruthy();
    await setLanguage('es');
    expect(i18n.t('btn_open_folder')).toBe(TRANSLATIONS.es.btn_open_folder);
  });

  it('persists explicit choices for the next visit', async () => {
    const storage = environment(['en-US']);
    await setLanguage('de');
    expect(storage.setItem).toHaveBeenCalledWith('ct_language', 'de');
  });
});

describe('translation review and fallback', () => {
  it.each(Object.keys(TRANSLATIONS) as SupportedLang[])(
    '%s covers all keys and preserves interpolation variables',
    (lang) => {
      expect(Object.keys(TRANSLATIONS[lang]).sort()).toEqual(Object.keys(TRANSLATIONS.en).sort());
      for (const [key, english] of Object.entries(TRANSLATIONS.en)) {
        const translated = TRANSLATIONS[lang][key] ?? '';
        expect(translated.trim(), `${lang}.${key}`).not.toBe('');
        expect(translated.match(/\{[^{}]+\}/g)?.sort() || [], `${lang}.${key}`).toEqual(
          english.match(/\{[^{}]+\}/g)?.sort() || [],
        );
        if (lang !== 'ko') expect(translated, `${lang}.${key}`).not.toMatch(/[가-힣]/);
      }
      expect(LOCALIZED_SEO[lang].desc).toBeTruthy();
      if (lang !== 'ko') expect(LOCALIZED_SEO[lang].ogDesc).not.toMatch(/[가-힣]/);
    },
  );

  it('interpolates positional and named parameters', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('progress_found_videos', { 0: 3, 1: 1 })).toBe('3 videos found (1 folders)');
    expect(i18n.t('progress_grouping_status', { 0: 25, 1: 100, 2: 25, 3: 4 })).not.toMatch(
      /\{\d+\}/,
    );
    expect(i18n.t('tier_reason_low', { concurrency: 2, memory: 2 })).not.toMatch(/\{\w+\}/);
  });

  it('falls back to English for missing or empty messages', async () => {
    await i18n.changeLanguage('de');
    const bundle = i18n.getResourceBundle('de', 'translation') as Record<string, string>;
    const original = bundle.progress_found_videos;
    try {
      bundle.progress_found_videos = '';
      expect(i18n.t('progress_found_videos', { 0: 3, 1: 1 })).toBe('3 videos found (1 folders)');
      expect(i18n.t('unknown_key')).toBe('unknown_key');
    } finally {
      bundle.progress_found_videos = original ?? '';
    }
  });

  it('can switch all eight languages', async () => {
    for (const lang of Object.keys(TRANSLATIONS) as SupportedLang[]) {
      await i18n.changeLanguage(lang);
      expect(i18n.t('label_resolution')).toBe(TRANSLATIONS[lang].label_resolution);
    }
  });
});
