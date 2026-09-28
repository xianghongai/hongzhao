# AGENTS.md

纯静态站点，部署到 GitHub Pages。所有工具在浏览器内运行，不依赖任何后端。

## 不可违反的约束

- **不联网**：运行时不发出网络请求。`vite.config.ts` 在构建产物中注入 CSP（`connect-src 'none'`），不得放宽；新增依赖不得在运行时加载远程资源（例如从 CDN 拉取 WASM 或字体）。
- **不存储**：不使用 Cookie、localStorage、sessionStorage 或 IndexedDB。需要跨工具保留的状态放在模块内存中，参考 `src/tools/otp/store.ts`。
- **离线缓存只放站点文件**：Service Worker 由 `vite-plugin-pwa` 生成，只预缓存构建产物。不得添加运行时缓存、后台同步或任何缓存用户内容的逻辑；只在主应用注册（`src/components/pwa-prompt.tsx`），更新必须经用户确认，因为刷新会清空内存中的密钥。
- **不加载 WASM**：WASM 需要额外获取二进制文件并在 CSP 中加入 `'wasm-unsafe-eval'`。二维码识别因此使用原生 `BarcodeDetector` 加纯 JS 的 `jsQR`，参考 `src/lib/qr/read-image.ts`。
- **不引用 CDN**：依赖一律从 npm 安装并随站点打包。图片以独立文件提供，`build.assetsInlineLimit` 保持为 `0`。
- **兼容非安全上下文**：站点需要在 HTTP 局域网地址下可用。不使用 `crypto.subtle`、`crypto.randomUUID`、`navigator.clipboard`（除非有回退）等仅限安全上下文的 API；加密与哈希使用 `@noble/*`，随机数使用 `crypto.getRandomValues`。摄像头（`getUserMedia`）无法回退，非安全上下文下必须降级为禁用状态，参考 `src/components/qr-scanner.tsx`。
- **公开契约**：接收路径 `r/`、`src/lib/share/envelope.ts` 中的信封格式和 `#/share?public_key=` 参数会随链接与二维码发出。参数名（`alg`、`data`、`public_key`）、`alg` 各取值的含义与 HKDF 领域字符串不可更改，新的加密方式只能新增 `alg` 取值。不给密钥或密文加私有前缀，不使用版本号；参数名用 snake_case，算法名用 JOSE 注册名。

## 目录职责

- `src/lib/`：纯函数，不依赖 React 和 DOM（`clipboard.ts`、`download.ts`、`theme.ts`、`qr/read-image.ts` 除外），全部由 `test/` 下的单元测试覆盖。
- `src/tools/`：每个工具一个目录，在 `src/tools/registry.ts` 注册后自动出现在导航和首页。
- `src/receive/`：接收页 `r/index.html` 的入口。接收页不注册 Service Worker，也不带 manifest，由 `vite.config.ts` 中的插件移除。
- `public/`：站点图标。PNG 图标由 `pnpm pwa:icons` 从 `public/favicon.svg` 生成，改动图标后重新运行。标题栏标志按主题分为 `src/assets/logo-light.svg` 与 `src/assets/logo-dark.svg`。
- `public/brand/`：提供给社区的设计物料，随站点部署但不进入离线缓存（`vite.config.ts` 中的 `globIgnores`），站点本身不使用。
- `src/components/ui/`：shadcn/ui（Base UI）生成的组件，通过 `shadcn` CLI 添加，不做格式化和 lint。

## 技术约定

- Tailwind CSS v4，设计令牌在 `src/index.css` 中用 `@theme` 声明，不使用 `tailwind.config.js`。品牌色为 `brand`，默认深色主题。
- class 合并使用 `import { cn } from 'cn'`，不使用 clsx 与 tailwind-merge。
- 动效：微交互用 CSS 过渡；进场、列表与页面切换用 `motion/react`。应用根部使用 `MotionConfig reducedMotion="user"`，CSS 动画配合 `motion-reduce:` 关闭。
- 界面文案使用简体中文。

## 验证

提交前运行：

```sh
pnpm format:check && pnpm lint && pnpm check-types && pnpm test && pnpm build
```

涉及界面的改动需在浏览器中实际验证，并确认构建产物加载后没有新的网络请求。
