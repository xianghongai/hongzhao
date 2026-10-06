import { cn } from 'cn';
import {
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  Loader2Icon,
  PenLineIcon,
  QrCodeIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { useDeferredValue, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ClearButton } from '@/components/clear-button';
import { CopyButton } from '@/components/copy-button';
import { OptionSelect } from '@/components/option-select';
import { QrPreview } from '@/components/qr-code-view';
import { Note, ToolPage } from '@/components/tool-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type Ecc, encodeQr, fitsBytes } from '@/lib/qr/encode';
import { ImageReadError, imageFiles, readQrCodes } from '@/lib/qr/read-image';
import { encodePlain } from '@/lib/share/envelope';
import { budgetedLength, isLoopback, receiveUrl, siteBase } from '@/lib/share/link';
import { FormatFields } from '@/tools/qr/format-fields';
import { FORMAT_IDS, type FormatId, INITIAL_VALUES, type Values, buildFormats } from '@/tools/qr/formats';

const ECC_LEVELS: readonly Ecc[] = ['L', 'M', 'Q', 'H'];

/** Whether any format holds something other than its starting values. */
function hasInput(values: Record<FormatId, Values>): boolean {
  return FORMAT_IDS.some((id) =>
    Object.entries(values[id]).some(([name, value]) => value !== (INITIAL_VALUES[id][name] ?? ''))
  );
}

/** The text of a QR code read from an image, shown on the right in place of what the form builds. */
interface Decoded {
  text: string;
  /** The image held more than one code; only the first is shown. */
  several: boolean;
}

export default function QrTool() {
  const { t } = useTranslation();
  const formats = useMemo(() => buildFormats(t), [t]);
  const eccOptions = ECC_LEVELS.map((value) => ({ value, label: t(`qr.ecc${value}`) }));
  const [formatId, setFormatId] = useState<FormatId>('text');
  const [values, setValues] = useState<Record<FormatId, Values>>(INITIAL_VALUES);
  const [ecc, setEcc] = useState<Ecc>('M');
  const [relay, setRelay] = useState(false);
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = useId();

  const format = formats.find((item) => item.id === formatId) ?? formats[0]!;
  const built = format.build(values[format.id]);
  const useRelay = format.relay && relay;
  const base = siteBase();

  let content = '';
  let envelope = '';
  if ('text' in built) {
    envelope = useRelay ? encodePlain(built.text) : '';
    content = useRelay ? receiveUrl(envelope, base) : built.text;
  }

  // Typing stays responsive while long content re-encodes.
  const deferredContent = useDeferredValue(decoded?.text ?? content);
  const result = useMemo(() => encodeQr(deferredContent, ecc), [deferredContent, ecc]);
  const reserveShort = decoded === null && useRelay && result.ok && !fitsBytes(budgetedLength(envelope, base), ecc);

  // Touching the form brings its own content back; the form itself is never filled from an image.
  const updateField = (name: string, value: string) => {
    setDecoded(null);
    setValues((current) => ({ ...current, [format.id]: { ...current[format.id], [name]: value } }));
  };

  // Images are decoded on this device and dropped right after; only the text read from one stays, in memory.
  const readImage = async (files: File[]) => {
    const file = files[0];
    if (file === undefined || scanning) {
      return;
    }
    setScanning(true);
    try {
      const texts = await readQrCodes(file);
      if (texts.length === 0) {
        toast.error(t('common.noQrInImage'));
      } else {
        setDecoded({ text: texts[0]!, several: texts.length > 1 });
      }
    } catch (error) {
      toast.error(error instanceof ImageReadError ? t('common.imageUnreadable') : t('common.readFailed'));
    } finally {
      setScanning(false);
    }
  };

  // A screenshot pasted anywhere on the page is read; pasting text still goes to the focused field.
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData?.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      void readImage(files);
    }
  });
  useEffect(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <ToolPage
      icon={QrCodeIcon}
      title={t('tools.qr.title')}
      description={t('qr.description')}
      actions={
        <ClearButton
          disabled={!hasInput(values) && decoded === null}
          // Clears what was typed in every format and what was read from an image; the chosen format and settings stay.
          onClear={() => {
            const previous = values;
            const previousDecoded = decoded;
            setValues(INITIAL_VALUES);
            setDecoded(null);
            return () => {
              setValues(previous);
              setDecoded(previousDecoded);
            };
          }}
        />
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLineIcon className="size-4 text-brand" />
              {t('qr.content')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ToggleGroup
              aria-label={t('qr.format')}
              variant="outline"
              size="sm"
              value={[format.id]}
              onValueChange={(next) => {
                if (next[0] !== undefined) {
                  setDecoded(null);
                  setFormatId(next[0] as FormatId);
                }
              }}
              className="flex w-full flex-wrap"
            >
              {formats.map(({ id, label, icon: Icon }) => (
                <ToggleGroupItem
                  key={id}
                  value={id}
                  className="data-pressed:border-brand/60 data-pressed:bg-brand/10 data-pressed:text-foreground"
                >
                  <Icon data-icon="inline-start" />
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="-mt-3 text-sm text-muted-foreground">{useRelay ? t('qr.relaySummary') : format.summary}</p>

            <FormatFields fields={format.fields} values={values[format.id]} onChange={updateField} />

            <Separator />

            <Field>
              <FieldLabel htmlFor={`${ids}-ecc`}>{t('qr.ecc')}</FieldLabel>
              <OptionSelect id={`${ids}-ecc`} value={ecc} options={eccOptions} onChange={setEcc} />
            </Field>
            {format.relay && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={`${ids}-relay`}>{t('qr.relay')}</FieldLabel>
                  <FieldDescription>{t('qr.relayDescription')}</FieldDescription>
                </FieldContent>
                <Switch
                  id={`${ids}-relay`}
                  checked={relay}
                  onCheckedChange={(checked) => {
                    setDecoded(null);
                    setRelay(checked);
                  }}
                />
              </Field>
            )}

            {useRelay && isLoopback(base) && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>
                  <Trans i18nKey="qr.localhost" components={{ code: <code /> }} />
                </p>
              </Note>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void readImage(imageFiles(event.dataTransfer.files));
            }}
            className={cn('transition-shadow', dragging && 'ring-2 ring-brand')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="size-4 text-brand" />
                {t('qr.qrCode')}
              </CardTitle>
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={scanning}>
                  {scanning ? (
                    <Loader2Icon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <ImageIcon data-icon="inline-start" />
                  )}
                  {t('qr.fromImage')}
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    void readImage(imageFiles(event.target.files ?? []));
                    // Lets the same file be chosen again.
                    event.target.value = '';
                  }}
                />
              </CardAction>
            </CardHeader>
            <CardContent className="grid justify-items-center gap-4">
              <div className="w-full max-w-80">
                {result.ok ? (
                  <QrPreview
                    qr={result.qr}
                    label={decoded === null ? t('qr.qrLabel', { format: format.label }) : t('qr.decodedQrLabel')}
                    filename={decoded === null ? `qr-${format.id}` : 'qr-decoded'}
                  />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <QrCodeIcon className="size-8 opacity-40" />
                    {decoded === null && 'error' in built && built.error !== ''
                      ? built.error
                      : result.reason === 'too-long'
                        ? t('qr.tooLong')
                        : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="size-4 text-brand" />
                {t('qr.encoded')}
                {decoded !== null && <Badge variant="secondary">{t('qr.decodedBadge')}</Badge>}
              </CardTitle>
              {decoded !== null && (
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={() => setDecoded(null)}>
                    <XIcon data-icon="inline-start" />
                    {t('qr.decodedExit')}
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            {result.ok || decoded !== null ? (
              <CardContent className="grid gap-4">
                {decoded?.several && (
                  <Note icon={InfoIcon}>
                    <p>{t('qr.decodedMultiple')}</p>
                  </Note>
                )}
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
                  {decoded?.text ?? deferredContent}
                </pre>
                <CopyButton
                  value={decoded?.text ?? deferredContent}
                  size="sm"
                  className="w-fit"
                  done={t('qr.encodedCopied')}
                />
                {reserveShort && (
                  <Note icon={InfoIcon}>
                    <p>{t('qr.reserveShort')}</p>
                  </Note>
                )}
              </CardContent>
            ) : (
              <CardContent className="grid gap-4" aria-hidden="true">
                <Skeleton className="h-12 w-full animate-none" />
                <Skeleton className="h-7 w-16 animate-none" />
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </ToolPage>
  );
}
