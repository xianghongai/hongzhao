import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';

import { useOtpEntries } from '@/tools/otp/store';

const UPDATE_TOAST = 'pwa-update';

/**
 * Registers the service worker and asks before switching to a new version:
 * the switch reloads the page, which clears everything held in memory.
 */
function PwaPromptInner() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const holdsSecrets = useOtpEntries().length > 0;

  useEffect(() => {
    if (offlineReady) {
      toast.success(t('pwa.offlineReady'));
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady, t]);

  useEffect(() => {
    if (!needRefresh) {
      toast.dismiss(UPDATE_TOAST);
      return;
    }
    toast.info(t('pwa.update'), {
      id: UPDATE_TOAST,
      duration: Infinity,
      description: holdsSecrets ? t('pwa.updateWithSecrets') : t('pwa.updatePlain'),
      action: { label: t('pwa.reload'), onClick: () => void updateServiceWorker(true) },
      cancel: { label: t('pwa.later'), onClick: () => setNeedRefresh(false) },
    });
  }, [needRefresh, holdsSecrets, setNeedRefresh, updateServiceWorker, t]);

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
