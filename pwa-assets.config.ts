import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The icon set in use. The dark ground fills the corners of icons that platforms show as opaque squares.
// Design material, such as the alternate amber set, lives in public/brand/.
const background = '#1c1a17';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/favicon.svg'],
});
