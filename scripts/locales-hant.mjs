// Generates the Traditional Chinese locale from the Simplified Chinese source.
// Only the characters are converted (OpenCC cn → tw); the wording stays the same.
// Run `pnpm locales:hant` after editing src/locales/zh-CN.json; `pnpm test` fails while the two are out of step.
import { readFileSync, writeFileSync } from 'node:fs';

import { toTraditional } from './locales-hant-convert.mjs';

const source = new URL('../src/locales/zh-CN.json', import.meta.url);
const target = new URL('../src/locales/zh-Hant.json', import.meta.url);

const messages = JSON.parse(readFileSync(source, 'utf8'));
writeFileSync(target, `${JSON.stringify(toTraditional(messages), null, 2)}\n`);
