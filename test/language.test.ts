import { describe, expect, it } from 'vitest';

import { matchLanguage, resolveLanguage } from '@/lib/language';

describe('matchLanguage', () => {
  it('splits Chinese by script and region', () => {
    expect(matchLanguage('zh')).toBe('zh-CN');
    expect(matchLanguage('zh-CN')).toBe('zh-CN');
    expect(matchLanguage('zh-SG')).toBe('zh-CN');
    expect(matchLanguage('zh-Hans-HK')).toBe('zh-CN');
    expect(matchLanguage('zh-TW')).toBe('zh-Hant');
    expect(matchLanguage('zh-hk')).toBe('zh-Hant');
    expect(matchLanguage('zh-MO')).toBe('zh-Hant');
    expect(matchLanguage('zh-Hant')).toBe('zh-Hant');
  });

  it('matches other languages on the primary subtag', () => {
    expect(matchLanguage('en-GB')).toBe('en');
    expect(matchLanguage('ja-JP')).toBe('ja');
    expect(matchLanguage('ko')).toBe('ko');
    expect(matchLanguage('fr-FR')).toBeNull();
  });
});

describe('resolveLanguage', () => {
  it('prefers a language chosen by hand', () => {
    expect(resolveLanguage('ja', ['zh-CN'])).toBe('ja');
    expect(resolveLanguage('zh-Hant', ['en'])).toBe('zh-Hant');
  });

  it('ignores an unknown choice and follows the browser in order', () => {
    expect(resolveLanguage('xx', ['fr', 'ko', 'en'])).toBe('ko');
    expect(resolveLanguage(null, ['zh-TW', 'en'])).toBe('zh-Hant');
  });

  it('falls back to English', () => {
    expect(resolveLanguage(null, ['fr', 'de'])).toBe('en');
    expect(resolveLanguage(null, [])).toBe('en');
  });
});
