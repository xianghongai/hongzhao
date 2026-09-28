import { describe, expect, it } from 'vitest';

import { toTraditional } from '../scripts/locales-hant-convert.mjs';
import en from '@/locales/en.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import zhCN from '@/locales/zh-CN.json';
import zhHant from '@/locales/zh-Hant.json';

type Messages = { [key: string]: string | Messages };

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Flattens to `a.b.c` keys, merging plural forms under their base key. */
function flatten(messages: Messages, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      const base = path.replace(PLURAL_SUFFIX, '');
      out.set(base, [...(out.get(base) ?? []), value]);
    } else {
      for (const [inner, texts] of flatten(value, path)) {
        out.set(inner, [...(out.get(inner) ?? []), ...texts]);
      }
    }
  }
  return out;
}

/** Interpolation variables and markup tags, which a translation must keep. */
function tokens(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)\s*\/?>/g)].map((match) => match[0].replace(/\s/g, '')).sort();
}

const source = flatten(zhCN);
const translations = { 'zh-Hant': zhHant, en, ja, ko } as Record<string, Messages>;

describe.each(Object.entries(translations))('%s', (_, messages) => {
  const flat = flatten(messages);

  it('has exactly the keys of the source', () => {
    expect([...flat.keys()].sort()).toEqual([...source.keys()].sort());
  });

  it('keeps every variable and tag', () => {
    for (const [key, texts] of flat) {
      const expected = tokens(source.get(key)?.[0] ?? '');
      for (const text of texts) {
        expect({ key, tokens: tokens(text) }).toEqual({ key, tokens: expected });
      }
    }
  });

  it('has no empty text', () => {
    for (const [key, texts] of flat) {
      expect({ key, empty: texts.some((text) => text.trim() === '') }).toEqual({ key, empty: false });
    }
  });
});

describe('zh-Hant', () => {
  it('is the character conversion of zh-CN; run `pnpm locales:hant` after editing zh-CN', () => {
    expect(zhHant).toEqual(toTraditional(zhCN));
  });
});
