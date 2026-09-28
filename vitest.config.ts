import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts, which carries the build-only plugins.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { include: ['test/**/*.test.ts'] },
});
