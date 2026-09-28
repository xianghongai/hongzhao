import { CloudOffIcon, EraserIcon, EyeOffIcon, ShieldCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PROMISES = [
  { icon: CloudOffIcon, title: 'privacy.noUploadTitle', body: 'privacy.noUploadBody' },
  { icon: EraserIcon, title: 'privacy.noStorageTitle', body: 'privacy.noStorageBody' },
  { icon: EyeOffIcon, title: 'privacy.noTrackingTitle', body: 'privacy.noTrackingBody' },
] as const;

export function PrivacyDialog() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <ShieldCheckIcon data-icon="inline-start" className="text-brand" />
        {t('privacy.trigger')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('privacy.title')}</DialogTitle>
          <DialogDescription>{t('privacy.description')}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-4">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="grid gap-1">
                <p className="font-medium">{t(title)}</p>
                <p className="text-sm text-muted-foreground">{t(body)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('privacy.verify')}</p>
      </DialogContent>
    </Dialog>
  );
}
