import { ShieldKeyholeIcon, type LucideIcon, QrCodeIcon, GlobeLockIcon } from 'lucide-react';
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

export interface Tool {
  id: string;
  /** The hash route, e.g. `#/qr`. */
  path: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
}

/** Every tool on the shelf. Adding one means adding a folder under `src/tools/` and an entry here. */
export const TOOLS: readonly Tool[] = [
  {
    id: 'qr',
    path: '/qr',
    title: '二维码',
    summary: '文本、链接、Wi-Fi、联系人、日程、两步验证等格式；可选扫码后不直接打开链接。',
    icon: QrCodeIcon,
    component: lazy(() => import('@/tools/qr/qr-tool')),
  },
  {
    id: 'share',
    path: '/share',
    title: '链接传送',
    summary: '把内容编码进链接，在另一台设备打开即可读取；可选 AES-256 加密，密钥由你自行传递。',
    icon: GlobeLockIcon,
    component: lazy(() => import('@/tools/share/share-tool')),
  },
  {
    id: 'otp',
    path: '/otp',
    title: '2FA',
    summary: '输入一个或多个 2FA 密钥，即时生成 TOTP 验证码；不装 App，关闭页面即清空。',
    icon: ShieldKeyholeIcon,
    component: lazy(() => import('@/tools/otp/otp-tool')),
  },
];
