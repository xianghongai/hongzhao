import { FileTextIcon, InfoIcon, PenLineIcon, QrCodeIcon, TriangleAlertIcon } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ClearButton } from '@/components/clear-button';
import { CopyButton } from '@/components/copy-button';
import { OptionSelect } from '@/components/option-select';
import { QrPreview } from '@/components/qr-code-view';
import { Note, ToolPage } from '@/components/tool-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type Ecc, encodeQr, fitsBytes } from '@/lib/qr/encode';
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

export default function QrTool() {
  const { t } = useTranslation();
  const formats = useMemo(() => buildFormats(t), [t]);
  const eccOptions = ECC_LEVELS.map((value) => ({ value, label: t(`qr.ecc${value}`) }));
  const [formatId, setFormatId] = useState<FormatId>('text');
  const [values, setValues] = useState<Record<FormatId, Values>>(INITIAL_VALUES);
  const [ecc, setEcc] = useState<Ecc>('M');
  const [relay, setRelay] = useState(false);
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
  const deferredContent = useDeferredValue(content);
  const result = useMemo(() => encodeQr(deferredContent, ecc), [deferredContent, ecc]);
  const reserveShort = useRelay && result.ok && !fitsBytes(budgetedLength(envelope, base), ecc);

  const updateField = (name: string, value: string) =>
    setValues((current) => ({ ...current, [format.id]: { ...current[format.id], [name]: value } }));

  return (
    <ToolPage
      icon={QrCodeIcon}
      title={t('tools.qr.title')}
      description={t('qr.description')}
      actions={
        <ClearButton
          disabled={!hasInput(values)}
          // Clears what was typed in every format; the chosen format and settings stay.
          onClear={() => {
            const previous = values;
            setValues(INITIAL_VALUES);
            return () => setValues(previous);
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
              onValueChange={(next) => next[0] !== undefined && setFormatId(next[0] as FormatId)}
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
                <Switch id={`${ids}-relay`} checked={relay} onCheckedChange={setRelay} />
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="size-4 text-brand" />
                {t('qr.qrCode')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid justify-items-center gap-4">
              <div className="w-full max-w-80">
                {result.ok ? (
                  <QrPreview
                    qr={result.qr}
                    label={t('qr.qrLabel', { format: format.label })}
                    filename={`qr-${format.id}`}
                  />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <QrCodeIcon className="size-8 opacity-40" />
                    {'error' in built && built.error !== ''
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
              </CardTitle>
            </CardHeader>
            {result.ok ? (
              <CardContent className="grid gap-4">
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
                  {deferredContent}
                </pre>
                <CopyButton value={deferredContent} size="sm" className="w-fit" done={t('qr.encodedCopied')} />
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
