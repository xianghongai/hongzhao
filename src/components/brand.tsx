import darkLogoUrl from '@/assets/logo-dark.svg';
import lightLogoUrl from '@/assets/logo-light.svg';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      {/* The amber tile stands out on the dark header; the dark tile reads better on the light one. */}
      <img src={lightLogoUrl} alt="" className="size-7 dark:hidden" />
      <img src={darkLogoUrl} alt="" className="hidden size-7 dark:block" />
      <span className="flex items-baseline gap-2">
        <span className="font-semibold tracking-tight">{SITE_NAME}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">{SITE_TAGLINE}</span>
      </span>
    </span>
  );
}
