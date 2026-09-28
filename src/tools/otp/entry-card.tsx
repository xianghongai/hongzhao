import { cn } from 'cn';
import { PencilIcon, QrCodeIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

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
function entryDetails(entry: OtpEntry): string {
  return [
    entry.issuer,
    entry.algorithm !== DEFAULT_SETTINGS.algorithm && entry.algorithm,
    entry.digits !== DEFAULT_SETTINGS.digits && `${entry.digits} 位`,
    entry.period !== DEFAULT_SETTINGS.period && `${entry.period} 秒`,
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
  const result = useMemo(() => encodeQr(toUri(entry), 'M'), [entry]);

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={<DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="导出二维码" />} />}
        >
          <QrCodeIcon />
        </TooltipTrigger>
        <TooltipContent>导出二维码</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>导出到验证器 App</DialogTitle>
          <DialogDescription>用手机上的 Google 身份验证器、Microsoft Authenticator 等扫描导入。</DialogDescription>
        </DialogHeader>
        {result.ok && <QrPreview qr={result.qr} label="两步验证密钥二维码" filename="otp" />}
        <Note tone="warning" icon={TriangleAlertIcon}>
          <p>这个二维码包含密钥本身，任何扫到它的人都能生成你的验证码。用完请关闭，不要截图留存。</p>
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
  const name = entry.label || `未命名 ${index + 1}`;
  const details = entryDetails(entry);

  const copy = async () => {
    if (await copyText(code)) {
      toast.success(`已复制 ${name} 的验证码`);
    } else {
      toast.error('复制失败，请手动输入');
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
            aria-label="名称"
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
        aria-label={`复制 ${name} 的验证码`}
        className="group grid rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="font-mono text-2xl font-medium tracking-wider tabular-nums">
          {hidden ? groupDigits('•'.repeat(entry.digits)) : groupDigits(code)}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          下一个 {hidden ? '•••' : groupDigits(nextCode)}
        </span>
      </button>

      <div className="flex items-center gap-2">
        <CountdownRing period={entry.period} counter={counter} />
        <span className={cn('w-6 text-sm tabular-nums', remaining <= 5 ? 'text-destructive' : 'text-muted-foreground')}>
          {remaining}s
        </span>
      </div>

      <div className="flex items-center">
        <IconAction label="重命名" onClick={() => setEditing(true)}>
          <PencilIcon />
        </IconAction>
        <ExportDialog entry={entry} />
        <IconAction label="移除" onClick={() => removeEntry(entry.id)}>
          <TrashIcon />
        </IconAction>
      </div>
    </div>
  );
}
