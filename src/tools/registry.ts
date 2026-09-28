import { ShieldKeyholeIcon, type LucideIcon, QrCodeIcon, GlobeLockIcon } from 'lucide-react';
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

export interface Tool {
  /** Also names its title and summary in the locale files: `tools.<id>.title`, `tools.<id>.summary`. */
  id: 'qr' | 'share' | 'otp';
  /** The hash route, e.g. `#/qr`. */
  path: string;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
}

/** Every tool on the shelf. Adding one means adding a folder under `src/tools/` and an entry here. */
export const TOOLS: readonly Tool[] = [
  {
    id: 'qr',
    path: '/qr',
    icon: QrCodeIcon,
    component: lazy(() => import('@/tools/qr/qr-tool')),
  },
  {
    id: 'share',
    path: '/share',
    icon: GlobeLockIcon,
    component: lazy(() => import('@/tools/share/share-tool')),
  },
  {
    id: 'otp',
    path: '/otp',
    icon: ShieldKeyholeIcon,
    component: lazy(() => import('@/tools/otp/otp-tool')),
  },
];
