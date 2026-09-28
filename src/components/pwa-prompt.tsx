import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { useOtpEntries } from '@/tools/otp/store';

const UPDATE_TOAST = 'pwa-update';

/**
 * Registers the service worker and asks before switching to a new version:
 * the switch reloads the page, which clears everything held in memory.
 */
function PwaPromptInner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const holdsSecrets = useOtpEntries().length > 0;

  useEffect(() => {
    if (offlineReady) {
      toast.success('已可离线使用');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) {
      toast.dismiss(UPDATE_TOAST);
      return;
    }
    toast.info('有新版本', {
      id: UPDATE_TOAST,
      duration: Infinity,
      description: holdsSecrets
        ? '刷新后生效。刷新会清空已添加的两步验证密钥，可以用完再刷新。'
        : '刷新后生效，页面上已输入的内容会被清空。',
      action: { label: '刷新', onClick: () => void updateServiceWorker(true) },
      cancel: { label: '稍后', onClick: () => setNeedRefresh(false) },
    });
  }, [needRefresh, holdsSecrets, setNeedRefresh, updateServiceWorker]);

  return null;
}

/**
 * Service workers need a secure context (HTTPS or localhost), so a plain-HTTP LAN address simply runs without one.
 * The dev server has no service worker either.
 */
export function PwaPrompt() {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) {
    return null;
  }
  return <PwaPromptInner />;
}
