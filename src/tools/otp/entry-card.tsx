import { cn } from 'cn';
import { PencilIcon, QrCodeIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { QrPreview } from '@/components/qr-code-view';
import { Note } from '@/components/tool-page';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyText } from '@/lib/clipboard';
import { DEFAULT_SETTINGS, type OtpEntry, elapsedInPeriod, generateCode, toUri } from '@/lib/otp/entries';
import { encodeQr } from '@/lib/qr/encode';
import { type StoredEntry, removeEntry, renameEntry } from '@/tools/otp/store';

/** The issuer plus any parameter that differs from the common SHA1, 6 digits, 30 seconds. */
function entryDetails(t: TFunction, entry: OtpEntry): string {
  return [
    entry.issuer,
    entry.algorithm !== DEFAULT_SETTINGS.algorithm && entry.algorithm,
    entry.digits !== DEFAULT_SETTINGS.digits && t('common.digits', { count: entry.digits }),
    entry.period !== DEFAULT_SETTINGS.period && t('common.seconds', { count: entry.period }),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 123456 → 123 456, 12345678 → 1234 5678. */
function groupDigits(code: string): string {
  const half = Math.floor(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

/**
 * The arc drains with a CSS animation. Its negative delay syncs it to the clock and is fixed at mount:
 * changing the delay of a running animation would make it jump. A new key per period remounts it.
 * The delay reads the clock itself: the `now` passed down can be stale on the first render after adding entries.
 */
function CountdownArc({ period }: { period: number }) {
  const [delay] = useState(() => Date.now() % (period * 1000));

  return (
    <circle
      cx="18"
      cy="18"
      r="15"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      pathLength={100}
      strokeDasharray={100}
      className="animate-countdown stroke-brand motion-reduce:animate-none"
      style={
        {
          '--countdown-duration': `${period}s`,
          '--countdown-delay': `-${delay / 1000}s`,
        } as React.CSSProperties
      }
    />
  );
}

function CountdownRing({ period, counter }: { period: number; counter: number }) {
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-muted" />
      <CountdownArc key={counter} period={period} />
    </svg>
  );
}

function IconAction({ label, children, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ExportDialog({ entry }: { entry: StoredEntry }) {
  const { t } = useTranslation();
  const result = useMemo(() => encodeQr(toUri(entry), 'M'), [entry]);

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('otp.export')} />} />}
        >
          <QrCodeIcon />
        </TooltipTrigger>
        <TooltipContent>{t('otp.export')}</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('otp.exportTitle')}</DialogTitle>
          <DialogDescription>{t('otp.exportDescription')}</DialogDescription>
        </DialogHeader>
        {result.ok && <QrPreview qr={result.qr} label={t('otp.exportQr')} filename="otp" />}
        <Note tone="warning" icon={TriangleAlertIcon}>
          <p>{t('otp.exportWarning')}</p>
        </Note>
      </DialogContent>
    </Dialog>
  );
}

interface EntryCardProps {
  entry: StoredEntry;
  now: number;
  index: number;
  hidden: boolean;
}

export function EntryCard({ entry, now, index, hidden }: EntryCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const periodMs = entry.period * 1000;
  const counter = Math.floor(now / periodMs);
  // Codes only change at period boundaries, so they are computed once per period, not every second.
  const [code, nextCode] = useMemo(
    () => [generateCode(entry, counter * periodMs), generateCode(entry, (counter + 1) * periodMs)],
    [entry, counter, periodMs]
  );
  const elapsed = elapsedInPeriod(entry, now);
  const remaining = Math.ceil((periodMs - elapsed) / 1000);
  const name = entry.label || t('otp.unnamed', { index: index + 1 });
  const details = entryDetails(t, entry);

  const copy = async () => {
    if (await copyText(code)) {
      toast.success(t('otp.codeCopied', { name }));
    } else {
      toast.error(t('otp.codeCopyFailed'));
    }
  };

  const commitRename = (value: string) => {
    renameEntry(entry.id, value.trim());
    setEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
        {editing ? (
          <Input
            autoFocus
            defaultValue={entry.label}
            aria-label={t('otp.nameLabel')}
            className="h-7"
            onBlur={(event) => commitRename(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitRename(event.currentTarget.value);
              } else if (event.key === 'Escape') {
                setEditing(false);
              }
            }}
          />
        ) : (
          <p className="truncate font-medium">{name}</p>
        )}
        {details && <p className="truncate text-xs text-muted-foreground">{details}</p>}
      </div>

      <button
        type="button"
        onClick={copy}
        aria-label={t('otp.copyCode', { name })}
        className="group grid rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="font-mono text-2xl font-medium tracking-wider tabular-nums">
          {hidden ? groupDigits('•'.repeat(entry.digits)) : groupDigits(code)}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {t('otp.next', { code: hidden ? '•••' : groupDigits(nextCode) })}
        </span>
      </button>

      <div className="flex items-center gap-2">
        <CountdownRing period={entry.period} counter={counter} />
        <span className={cn('w-6 text-sm tabular-nums', remaining <= 5 ? 'text-destructive' : 'text-muted-foreground')}>
          {remaining}s
        </span>
      </div>

      <div className="flex items-center">
        <IconAction label={t('otp.rename')} onClick={() => setEditing(true)}>
          <PencilIcon />
        </IconAction>
        <ExportDialog entry={entry} />
        <IconAction label={t('otp.remove')} onClick={() => removeEntry(entry.id)}>
          <TrashIcon />
        </IconAction>
      </div>
    </div>
  );
}
