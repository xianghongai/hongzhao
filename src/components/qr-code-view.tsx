import { cn } from 'cn';
import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canCopyImages, copyPng, downloadPng, downloadSvg } from '@/lib/download';
import { DENSE_VERSION, QUIET_ZONE, type QrMatrix, modulesToPath } from '@/lib/qr/encode';

interface QrCodeViewProps {
  qr: QrMatrix;
  /** Accessible description of what the code contains. */
  label: string;
  className?: string;
}

/** Always dark modules on white: inverted or low-contrast codes fail on many scanners. */
export function QrCodeView({ qr, label, className }: QrCodeViewProps) {
  const path = useMemo(() => modulesToPath(qr.modules), [qr]);
  const full = qr.size + QUIET_ZONE * 2;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${full} ${full}`}
      shapeRendering="crispEdges"
      className={cn('aspect-square w-full rounded-lg bg-white', className)}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}

function CopyImageButton({ qr }: { qr: QrMatrix }) {
  const [copied, setCopied] = useState(false);
  const available = canCopyImages();

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (await copyPng(qr)) {
      setCopied(true);
      toast.success('已复制二维码图片');
    } else {
      toast.error('复制失败，请改用下载');
    }
  };

  const button = (
    <Button variant="outline" size="sm" disabled={!available} onClick={() => void copy()}>
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      复制图片
    </Button>
  );

  if (available) {
    return button;
  }
  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the tooltip hangs on a wrapper. */}
      <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>{button}</TooltipTrigger>
      <TooltipContent>复制图片需要通过 HTTPS 访问本站</TooltipContent>
    </Tooltip>
  );
}

export function QrDownloadButtons({ qr, filename }: { qr: QrMatrix; filename: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <CopyImageButton qr={qr} />
      <Button variant="outline" size="sm" onClick={() => downloadPng(qr, filename)}>
        <DownloadIcon data-icon="inline-start" />
        PNG
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadSvg(qr, filename)}>
        <DownloadIcon data-icon="inline-start" />
        SVG
      </Button>
    </div>
  );
}

interface QrPreviewProps {
  qr: QrMatrix;
  label: string;
  filename: string;
  /** Limits the code's width only, so the buttons below always get the full row. */
  imageClassName?: string;
}

/** The code, a density warning when scanning may struggle, and download buttons. */
export function QrPreview({ qr, label, filename, imageClassName }: QrPreviewProps) {
  return (
    <div className="grid gap-3">
      <div className={cn('w-full', imageClassName)}>
        <QrCodeView qr={qr} label={label} />
      </div>
      {qr.version > DENSE_VERSION && (
        <p className="text-xs text-brand">码点较密，屏幕扫码可能吃力；可以精简内容或降低纠错等级。</p>
      )}
      <QrDownloadButtons qr={qr} filename={filename} />
    </div>
  );
}
