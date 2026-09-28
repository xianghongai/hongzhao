import { CameraIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { readQrCodesFrom } from '@/lib/qr/read-image';

const SCAN_INTERVAL_MS = 250;
/** A code that stays in view is reported once; it counts again only after leaving the view this long. */
const REPEAT_AFTER_MS = 2000;
/** Camera frames are scanned smaller than screenshots, to keep up with the video. */
const FRAME_SIDE = 720;

/** Cameras need a secure context (HTTPS or localhost); a plain-HTTP LAN address has none. */
function cameraAvailable(): boolean {
  return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

type Status = 'starting' | 'scanning' | 'denied' | 'failed';

const STATUS_TEXT: Record<Exclude<Status, 'scanning'>, string> = {
  starting: '正在打开摄像头…',
  denied: '没有摄像头权限。请在浏览器的网站设置中允许使用摄像头后重试。',
  failed: '无法打开摄像头，可能正被其他应用占用。',
};

interface ScannerViewProps {
  /** Handles one scanned text and returns what to tell the user, such as “已接收”. */
  onDetect: (text: string) => string;
}

function ScannerView({ onDetect }: ScannerViewProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [feedback, setFeedback] = useState<{ text: string; count: number } | null>(null);
  const handle = useEffectEvent((text: string) => {
    const message = onDetect(text);
    setFeedback((current) => ({ text: message, count: (current?.count ?? 0) + 1 }));
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lastSeen = new Map<string, number>();

    const scan = async (element: HTMLVideoElement) => {
      if (stopped) {
        return;
      }
      if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const texts = await readQrCodesFrom(element, element.videoWidth, element.videoHeight, FRAME_SIDE);
        const now = Date.now();
        for (const text of texts) {
          const seen = lastSeen.get(text);
          lastSeen.set(text, now);
          if (!stopped && (seen === undefined || now - seen > REPEAT_AFTER_MS)) {
            handle(text);
          }
        }
      }
      timer = setTimeout(() => void scan(element), SCAN_INTERVAL_MS);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (error) {
        if (!stopped) {
          setStatus(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'failed');
        }
        return;
      }
      const element = video.current;
      if (stopped || !element) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      element.srcObject = stream;
      await element.play().catch(() => undefined);
      setStatus('scanning');
      void scan(element);
    };

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
        {status !== 'scanning' && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
            {STATUS_TEXT[status]}
          </p>
        )}
      </div>
      <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">
        {feedback && (
          <span key={feedback.count} className="animate-in fade-in motion-reduce:animate-none">
            {feedback.text}
          </span>
        )}
      </p>
    </div>
  );
}

interface QrScannerButtonProps extends ScannerViewProps {
  title: string;
  description: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
}

/**
 * Opens the camera in a dialog and keeps scanning until it is closed, so several codes can be read in a row.
 * The stream stops as soon as the dialog closes.
 */
export function QrScannerButton({
  title,
  description,
  label = '扫码',
  variant = 'outline',
  onDetect,
}: QrScannerButtonProps) {
  const [open, setOpen] = useState(false);
  const available = cameraAvailable();

  const button = (
    <Button variant={variant} disabled={!available} onClick={() => setOpen(true)}>
      <CameraIcon data-icon="inline-start" />
      {label}
    </Button>
  );

  return (
    <>
      {available ? (
        button
      ) : (
        <Tooltip>
          {/* A disabled button fires no pointer events, so the tooltip hangs on a wrapper. */}
          <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>{button}</TooltipTrigger>
          <TooltipContent>摄像头需要通过 HTTPS 访问本站</TooltipContent>
        </Tooltip>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {open && <ScannerView onDetect={onDetect} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
