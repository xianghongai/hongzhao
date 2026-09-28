import i18next, { type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  LANGUAGES,
  LANGUAGE_PARAM,
  type Language,
  SOURCE_LANGUAGE,
  isLanguage,
  matchLanguage,
  resolveLanguage,
} from '@/lib/language';

/** Shapes differ slightly between languages (English adds plural forms); `pnpm test` checks the keys. */
type Messages = Record<string, unknown>;

/**
 * Each language is its own hashed chunk, loaded only when it is shown. They are imported rather than fetched from
 * `public/`: a fetch would need `connect-src`, which the CSP sets to 'none'; a chunk falls under `script-src 'self'`.
 */
const LOADERS: Record<Language, () => Promise<{ default: Messages }>> = {
  'zh-CN': () => import('@/locales/zh-CN.json'),
  'zh-Hant': () => import('@/locales/zh-Hant.json'),
  en: () => import('@/locales/en.json'),
  ja: () => import('@/locales/ja.json'),
  ko: () => import('@/locales/ko.json'),
};

function browserLanguages(): readonly string[] {
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

async function ensureLoaded(language: Language): Promise<void> {
  if (!i18next.hasResourceBundle(language, 'translation')) {
    const { default: messages } = await LOADERS[language]();
    i18next.addResourceBundle(language, 'translation', messages);
  }
}

/** Each page names itself: the main app by the brand, the receive page by what it does. */
let pageTitle: ((t: TFunction) => string) | null = null;

function applyToDocument(language: Language): void {
  document.documentElement.lang = language;
  if (pageTitle !== null) {
    document.title = pageTitle(i18next.t);
  }
}

/**
 * Starts i18n before the first render. A language chosen by hand travels in the `lang` query parameter,
 * since nothing is stored; otherwise the browser's languages decide.
 */
export async function setupI18n(title?: (t: TFunction) => string): Promise<void> {
  pageTitle = title ?? null;
  const chosen = new URL(window.location.href).searchParams.get(LANGUAGE_PARAM);
  const language = resolveLanguage(chosen, browserLanguages());
  const { default: messages } = await LOADERS[language]();
  await i18next.use(initReactI18next).init({
    lng: language,
    // Only the language on screen is loaded, so there is nothing to fall back to; `pnpm test` checks that no key is missing.
    fallbackLng: false,
    supportedLngs: [...LANGUAGES],
    load: 'currentOnly',
    resources: { [language]: { translation: messages } },
    // Other languages are added when switched to.
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
  });
  applyToDocument(language);
}

/**
 * Switches the interface language and records the choice in the address bar, so a reload or a bookmark keeps it.
 * Choosing what the browser would pick anyway drops the parameter.
 */
export async function switchLanguage(language: Language): Promise<void> {
  await ensureLoaded(language);
  // The address changes first: the re-render that follows reads it for links such as `languageQuery()`.
  const url = new URL(window.location.href);
  if (resolveLanguage(null, browserLanguages()) === language) {
    url.searchParams.delete(LANGUAGE_PARAM);
  } else {
    url.searchParams.set(LANGUAGE_PARAM, language);
  }
  history.replaceState(history.state, '', url);
  await i18next.changeLanguage(language);
  applyToDocument(language);
}

/** The language on screen, for `Intl` formatting and the language menu. */
export function currentLanguage(): Language {
  const language = i18next.language;
  return isLanguage(language) ? language : (matchLanguage(language) ?? SOURCE_LANGUAGE);
}

/** The `lang` parameter of this page, to carry onto links that stay within the site. */
export function languageQuery(): string {
  const chosen = new URL(window.location.href).searchParams.get(LANGUAGE_PARAM);
  return chosen !== null && isLanguage(chosen) ? `?${LANGUAGE_PARAM}=${chosen}` : '';
}
