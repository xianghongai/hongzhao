import 'i18next';

import type messages from '@/locales/zh-CN.json';

// Keys come from the Simplified Chinese source; `pnpm test` checks that every other language has the same keys.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof messages };
  }
}
