import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { Markdown } from '../src/components/atoms/markdown.tsx';
import { CONSENT_KEY, parseConsent, createAnalyticsConsent } from '../src/lib/consent.ts';

const fixture = (saved, { storageError = false, measurementId = 'G-E05V74Q9Q7' } = {}) => {
  const data = new Map(saved ? [[CONSENT_KEY, saved]] : []);
  const handlers = {},
    docHandlers = {},
    scripts = [],
    deleted = [];
  const win = {
    location: {
      origin: 'https://example.test',
      hostname: 'example.test',
      pathname: '/project/dev/',
      search: '?private=never-send',
      hash: '#never-send',
    },
    addEventListener(type, fn) {
      handlers[type] = fn;
    },
  };
  const doc = {
    referrer: 'https://other.test/from?secret=remove#hidden',
    visibilityState: 'visible',
    get cookie() {
      return '_ga=example; _ga_E05V74Q9Q7=example; unrelated=keep';
    },
    set cookie(value) {
      deleted.push(value);
    },
    addEventListener(type, fn) {
      docHandlers[type] = fn;
    },
    createElement(name) {
      return { name, dataset: {} };
    },
    head: {
      appendChild(script) {
        scripts.push(script);
      },
    },
  };
  const storage = {
    getItem(key) {
      if (storageError) throw new Error('blocked');
      return data.get(key) || null;
    },
    setItem(key, value) {
      if (storageError) throw new Error('blocked');
      data.set(key, value);
    },
  };
  const controller = createAnalyticsConsent({
    win,
    doc,
    measurementId,
    storage,
    environment: 'development',
  });
  return {
    win,
    doc,
    data,
    handlers,
    docHandlers,
    scripts,
    deleted,
    controller,
    commands: () => win.dataLayer.map((item) => Array.from(item)),
  };
};

describe('Basic Consent Mode v2 — shared opt-in', () => {
  it.each([
    null,
    '',
    '{}',
    'bad-json',
    '{"v":999,"analytics":"granted"}',
    '{"v":1,"analytics":"yes"}',
  ])('treats invalid/missing consent as no choice: %s', (value) => {
    expect(parseConsent(value)).toBe(null);
    const f = fixture(value);
    expect(f.scripts).toHaveLength(0);
    expect(f.win['ga-disable-G-E05V74Q9Q7']).toBe(true);
    expect(f.commands().some((row) => ['config', 'event', 'js'].includes(row[0]))).toBe(false);
  });
  it('rejection persists a minimal versioned record without a Google request', () => {
    const f = fixture();
    f.controller.setChoice('denied');
    expect(f.data.get(CONSENT_KEY)).toBe('{"v":1,"analytics":"denied"}');
    expect(f.scripts).toHaveLength(0);
    expect(f.commands().filter((row) => row[0] === 'consent')).toHaveLength(1);
    expect(f.deleted.some((value) => value.startsWith('unrelated='))).toBe(false);
  });
  it('queues denied defaults before grant/config and loads the unchanged ID once', () => {
    const f = fixture();
    f.controller.setChoice('granted');
    f.controller.setChoice('granted');
    expect(f.commands()[0]).toEqual([
      'consent',
      'default',
      {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(f.commands().find((row) => row[1] === 'update')[2]).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(f.scripts).toHaveLength(1);
    expect(f.scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-E05V74Q9Q7');
    expect(f.commands().filter((row) => row[0] === 'config')).toHaveLength(1);
    const config = f.commands().find((row) => row[0] === 'config');
    expect(config[1]).toBe('G-E05V74Q9Q7');
    expect(config[2]).toMatchObject({
      page_location: 'https://example.test/project/dev/',
      page_referrer: 'https://other.test/from',
      deployment_environment: 'development',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    expect(config[2]).not.toHaveProperty('send_page_view'); // existing single automatic view
    expect(f.commands().filter((row) => row[0] === 'event')).toHaveLength(0);
  });
  it('restores an affirmative choice, but never restores malformed or denied choices as grants', () => {
    expect(fixture('{"v":1,"analytics":"granted"}').scripts).toHaveLength(1);
    expect(fixture('{"v":1,"analytics":"denied"}').scripts).toHaveLength(0);
  });
  it('disables future calls and deletes only GA cookies on withdrawal, without duplicate views on reaccept', () => {
    const f = fixture();
    f.controller.setChoice('granted');
    f.controller.setChoice('denied');
    expect(f.win['ga-disable-G-E05V74Q9Q7']).toBe(true);
    expect(
      f
        .commands()
        .filter((row) => row[1] === 'update')
        .at(-1)[2].analytics_storage,
    ).toBe('denied');
    const count = f.commands().length;
    f.win.gtag('event', 'should_not_run');
    expect(f.commands()).toHaveLength(count);
    expect(f.deleted.some((value) => value.startsWith('_ga='))).toBe(true);
    expect(f.deleted.some((value) => value.startsWith('_ga_E05V74Q9Q7='))).toBe(true);
    expect(f.deleted.some((value) => value.startsWith('unrelated='))).toBe(false);
    f.controller.setChoice('granted');
    expect(f.scripts).toHaveLength(1);
    expect(f.commands().filter((row) => row[0] === 'config')).toHaveLength(1);
  });
  it('honors cross-tab withdrawal and deleted preferences without re-initializing GA', () => {
    const f = fixture('{"v":1,"analytics":"granted"}');
    f.data.set(CONSENT_KEY, '{"v":1,"analytics":"denied"}');
    f.handlers.storage({ key: CONSENT_KEY });
    expect(f.controller.choice).toBe('denied');
    expect(f.win['ga-disable-G-E05V74Q9Q7']).toBe(true);
    f.data.delete(CONSENT_KEY);
    f.handlers.storage({ key: null });
    expect(f.controller.choice).toBe(null);
    expect(f.scripts).toHaveLength(1);
  });
  it('rechecks persisted state on back/forward restore and visibility', () => {
    const f = fixture('{"v":1,"analytics":"granted"}');
    f.data.set(CONSENT_KEY, '{"v":1,"analytics":"denied"}');
    f.handlers.pageshow();
    expect(f.controller.choice).toBe('denied');
    f.data.set(CONSENT_KEY, '{"v":1,"analytics":"granted"}');
    f.docHandlers.visibilitychange();
    expect(f.controller.choice).toBe('granted');
    expect(f.commands().filter((row) => row[0] === 'config')).toHaveLength(1);
  });
  it('retains an in-memory choice when browser storage fails', () => {
    const f = fixture(null, { storageError: true });
    f.controller.setChoice('denied');
    f.handlers.pageshow();
    expect(f.controller.choice).toBe('denied');
    expect(f.controller.persistent).toBe(false);
    expect(f.scripts).toHaveLength(0);
  });
  it('stores the choice without queueing anything when no measurement ID is given', () => {
    const f = fixture('{"v":1,"analytics":"granted"}', { measurementId: '' });
    f.controller.setChoice('denied');
    f.controller.setChoice('granted');
    expect(f.scripts).toHaveLength(0);
    expect(f.commands()).toHaveLength(0);
    expect(f.data.get(CONSENT_KEY)).toBe('{"v":1,"analytics":"granted"}');
  });
  it('never accepts an unrecognized choice', () => {
    expect(() => fixture().controller.setChoice('maybe')).toThrow();
  });
});

describe('Legal documents and distribution', () => {
  it('loads analytics only through the consent module', () => {
    const viewer = readFileSync('index.html', 'utf8');
    expect(viewer).not.toContain('googletagmanager');
    expect(viewer).not.toMatch(/gtag\(/);
    expect(readFileSync('src/studio/consent.ts', 'utf8')).toContain(
      "measurementId: 'G-E05V74Q9Q7'",
    );
  });
  it('retains the exact official GPLv3 bytes and SPDX metadata', () => {
    expect(createHash('sha256').update(readFileSync('LICENSE')).digest('hex')).toBe(
      '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986',
    );
    expect(JSON.parse(readFileSync('package.json', 'utf8')).license).toBe('GPL-3.0-only');
    expect(readFileSync('THIRD_PARTY_NOTICES.md', 'utf8')).toContain('mp4-muxer 5.2.2');
    expect(readFileSync('licenses/mp4-muxer-MIT.txt')).toEqual(
      readFileSync('node_modules/mp4-muxer/LICENSE'),
    );
  });
  it('renders the Markdown used by the legal documents without raw HTML', () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        source: [
          '# Title',
          'One\ntwo',
          '- a\n- b',
          '| A | B |\n| --- | --- |\n| 1 | 2 |',
          'See [docs](https://example.test/docs).',
          '<script>alert(1)</script>',
        ].join('\n\n'),
      }),
    );
    expect(html).toContain('<h1 class="pt-2 text-foreground text-head2">Title</h1>');
    expect(html).toMatch(/<ul class="[^"]*list-disc[^"]*">\s*<li>a<\/li>\s*<li>b<\/li>\s*<\/ul>/);
    expect(html).toContain('<th class="px-2 py-1.5 font-semibold">A</th>');
    expect(html).toContain('<td class="px-2 py-1.5 align-top">2</td>');
    expect(html).toContain(
      '<a href="https://example.test/docs" target="_blank" rel="noopener noreferrer" class="text-attention hover:underline">docs</a>',
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });
});
