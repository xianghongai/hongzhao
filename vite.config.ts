import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { codeInspectorPlugin } from 'code-inspector-plugin';

/**
 * The site's privacy promise, enforced by the browser: scripts, styles and fonts load only from the site itself,
 * and `connect-src 'none'` blocks every fetch, XHR, WebSocket and beacon.
 * GitHub Pages cannot set response headers, so the policy ships as a <meta> tag;
 * `frame-ancestors` and reporting are not available that way.
 * Inline styles stay allowed because React style props and the UI libraries set them.
 * The service worker is not bound by this policy: it only fetches the site's own files for offline use.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Adds the policy to built pages only: the dev server needs inline scripts for hot reload. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/**
 * The receive page is not an installable app, and the manifest link the PWA plugin adds
 * would point at `r/manifest.webmanifest`, which does not exist.
 */
function receivePageWithoutManifest(): Plugin {
  return {
    name: 'receive-page-without-manifest',
    apply: 'build',
    // The PWA plugin injects the link in its own post-enforced hook; this one has to run after it.
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: (html, context) =>
        context.path.endsWith('/r/index.html') ? html.replace(/\s*<link rel="manifest"[^>]*>/, '') : html,
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the same build runs under a GitHub Pages subpath, a custom domain or a LAN address.
  base: './',
  plugins: [
    /**
     * https://inspector.fe-dev.cn/guide/start.html
     * 必须位于 React 插件之前，才能在 JSX 转换前注入源码定位信息。
     * 按 Option/Alt + Shift + 鼠标点击 DOM 元素，即可在 IDE 中打开对应的源代码位置。
     */
    codeInspectorPlugin({
      bundler: 'vite',
      // The receive page is a second entry; the plugin only injects into the first one by default.
      injectTo: [
        fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
        fileURLToPath(new URL('./src/receive/main.tsx', import.meta.url)),
      ],
      // hideConsole: true,
    }),

    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    VitePWA({
      // Registered from the main app only (`src/components/pwa-prompt.tsx`), which asks before updating.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: '鸿爪',
        short_name: '鸿爪',
        description: '在浏览器里运行的日常小工具：二维码、链接传送、2FA。不上传、不留存、不追踪。',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1c1a17',
        theme_color: '#1c1a17',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole site, fonts included, so every tool and the receive page work offline.
        globPatterns: ['**/*.{html,js,css,svg,png,ico,woff2,webmanifest}'],
        // Design material in public/brand/ is deployed but never needed by visitors, so it stays out of the cache.
        globIgnores: ['brand/**'],
        // `r/` resolves to its own precached page; nothing should fall back to the main app.
        navigateFallback: null,
        // A language chosen by hand travels as `?lang=`; the page behind it is the same precached file.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^lang$/],
        cleanupOutdatedCaches: true,
        // A first install takes over the open tab at once, so it works offline without a reload.
        // Updates still wait in `waiting` until the prompt is accepted, as there is no skipWaiting.
        clientsClaim: true,
      },
    }),
    receivePageWithoutManifest(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Images and fonts ship as separate files, never as inline data URIs.
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        receive: fileURLToPath(new URL('./r/index.html', import.meta.url)),
      },
    },
  },
});
