import * as OpenCC from 'opencc-js';

const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });

/** Converts every string in a nested message object; keys stay as they are. */
export function toTraditional(value) {
  if (typeof value === 'string') {
    return convert(value);
  }
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, toTraditional(inner)]));
}
