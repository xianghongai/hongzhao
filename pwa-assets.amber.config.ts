import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The alternate amber icon set, kept as design material in public/brand/amber/; generate with `pnpm pwa:icons:amber`.
// The amber ground fills the corners of icons that platforms show as opaque squares.
const background = '#f2b84b';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/brand/amber/favicon.svg'],
});
