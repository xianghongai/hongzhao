/** Interface languages, in the order the language menu lists them. Simplified Chinese is the source language. */
export const LANGUAGES = ['zh-CN', 'zh-Hant', 'en', 'ja', 'ko'] as const;

export type Language = (typeof LANGUAGES)[number];

export const SOURCE_LANGUAGE: Language = 'zh-CN';

/** Used when none of the browser's languages is supported. */
export const DEFAULT_LANGUAGE: Language = 'en';

/** Each language named in itself, as a language menu should show it. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  'zh-CN': '简体中文',
  'zh-Hant': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};

/** The URL query parameter that carries a language chosen by hand. */
export const LANGUAGE_PARAM = 'lang';

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Maps a BCP 47 tag to a supported language. Chinese goes to Traditional for Taiwan, Hong Kong, Macau
 * or an explicit `Hant` script, and to Simplified otherwise; other languages match on their primary subtag.
 */
export function matchLanguage(tag: string): Language | null {
  const lower = tag.trim().toLowerCase();
  const primary = lower.split('-')[0];
  if (primary === 'zh') {
    return /^zh-(hant|tw|hk|mo)(-|$)/.test(lower) ? 'zh-Hant' : 'zh-CN';
  }
  return primary === 'en' || primary === 'ja' || primary === 'ko' ? primary : null;
}

/**
 * The language to show: one chosen by hand (the URL parameter) wins, then the browser's preferences in order,
 * then the default.
 */
export function resolveLanguage(chosen: string | null, preferred: readonly string[]): Language {
  if (chosen !== null && isLanguage(chosen)) {
    return chosen;
  }
  for (const tag of preferred) {
    const match = matchLanguage(tag);
    if (match !== null) {
      return match;
    }
  }
  return DEFAULT_LANGUAGE;
}
