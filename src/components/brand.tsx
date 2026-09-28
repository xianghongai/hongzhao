import { useTranslation } from 'react-i18next';

import darkLogoUrl from '@/assets/logo-dark.svg';
import lightLogoUrl from '@/assets/logo-light.svg';

export function Brand() {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-2.5">
      {/* The amber tile stands out on the dark header; the dark tile reads better on the light one. */}
      <img src={lightLogoUrl} alt="" className="size-7 dark:hidden" />
      <img src={darkLogoUrl} alt="" className="hidden size-7 dark:block" />
      <span className="flex items-baseline gap-2">
        <span className="font-semibold tracking-tight">{t('brand.name')}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">{t('brand.tagline')}</span>
      </span>
    </span>
  );
}
