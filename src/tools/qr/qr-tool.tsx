import { FileTextIcon, InfoIcon, PenLineIcon, QrCodeIcon, TriangleAlertIcon } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState } from 'react';

import { ClearButton } from '@/components/clear-button';
import { CopyButton } from '@/components/copy-button';
import { OptionSelect, type Option } from '@/components/option-select';
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
import { FORMATS, type Values } from '@/tools/qr/formats';

const ECC_OPTIONS: ReadonlyArray<Option<Ecc>> = [
  { value: 'L', label: '低 L · 容量最大' },
  { value: 'M', label: '中 M · 推荐' },
  { value: 'Q', label: '较高 Q' },
  { value: 'H', label: '高 H · 最耐污损' },
];

/** Replaces the format's own summary while the relay is on: the phone opens the receive page instead. */
const RELAY_SUMMARY = '扫码后先打开本站接收页显示原文，不会直接打开链接。';

const INITIAL_VALUES = Object.fromEntries(FORMATS.map((format) => [format.id, format.initial]));

/** Whether any format holds something other than its starting values. */
function hasInput(values: Record<string, Values>): boolean {
  return FORMATS.some((format) =>
    Object.entries(values[format.id] ?? {}).some(([name, value]) => value !== (format.initial[name] ?? ''))
  );
}

export default function QrTool() {
  const [formatId, setFormatId] = useState(FORMATS[0]!.id);
  const [values, setValues] = useState<Record<string, Values>>(INITIAL_VALUES);
  const [ecc, setEcc] = useState<Ecc>('M');
  const [relay, setRelay] = useState(false);
  const ids = useId();

  const format = FORMATS.find((item) => item.id === formatId) ?? FORMATS[0]!;
  const built = format.build(values[format.id] ?? format.initial);
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
      title="二维码"
      description="填写内容，实时生成二维码。"
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
              内容
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ToggleGroup
              aria-label="格式"
              variant="outline"
              size="sm"
              value={[format.id]}
              onValueChange={(next) => next[0] !== undefined && setFormatId(String(next[0]))}
              className="flex w-full flex-wrap"
            >
              {FORMATS.map(({ id, label, icon: Icon }) => (
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
            <p className="-mt-3 text-sm text-muted-foreground">{useRelay ? RELAY_SUMMARY : format.summary}</p>

            <FormatFields fields={format.fields} values={values[format.id] ?? format.initial} onChange={updateField} />

            <Separator />

            <Field>
              <FieldLabel htmlFor={`${ids}-ecc`}>纠错等级</FieldLabel>
              <OptionSelect id={`${ids}-ecc`} value={ecc} options={ECC_OPTIONS} onChange={setEcc} />
            </Field>
            {format.relay && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={`${ids}-relay`}>扫码后不直接打开链接</FieldLabel>
                  <FieldDescription>适合订阅地址等只需复制、不该打开的内容。</FieldDescription>
                </FieldContent>
                <Switch id={`${ids}-relay`} checked={relay} onCheckedChange={setRelay} />
              </Field>
            )}

            {useRelay && isLoopback(base) && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>
                  当前通过 localhost 访问，手机无法打开接收页。请改用局域网地址（例如运行 <code>pnpm dev:lan</code>{' '}
                  后显示的地址）或线上站点打开本页。
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
                二维码
              </CardTitle>
            </CardHeader>
            <CardContent className="grid justify-items-center gap-4">
              <div className="w-full max-w-80">
                {result.ok ? (
                  <QrPreview qr={result.qr} label={`${format.label}二维码`} filename={`qr-${format.id}`} />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <QrCodeIcon className="size-8 opacity-40" />
                    {'error' in built && built.error !== ''
                      ? built.error
                      : result.reason === 'too-long'
                        ? '内容超出二维码容量。可以降低纠错等级、精简内容，或改用“链接传送”。'
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
                编码内容
              </CardTitle>
            </CardHeader>
            {result.ok ? (
              <CardContent className="grid gap-4">
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
                  {deferredContent}
                </pre>
                <CopyButton value={deferredContent} size="sm" className="w-fit" what="编码内容" />
                {reserveShort && (
                  <Note icon={InfoIcon}>
                    <p>当前可以使用。若将来站点换用更长的地址，同样的内容可能放不下。</p>
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
