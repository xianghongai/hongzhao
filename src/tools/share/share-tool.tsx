import { cn } from 'cn';
import {
  FileTextIcon,
  HistoryIcon,
  ImportIcon,
  InboxIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  PenLineIcon,
  RefreshCwIcon,
  SendIcon,
  TriangleAlertIcon,
  RotateCcwKeyIcon,
  UserRoundKeyIcon,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { useEffect, useId, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ClearButton } from '@/components/clear-button';
import { CopyButton } from '@/components/copy-button';
import { QrScannerButton } from '@/components/qr-scanner';
import { QrPreview } from '@/components/qr-code-view';
import { HelpPopover, type HelpSection } from '@/components/help-popover';
import { Note, ToolPage } from '@/components/tool-page';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Textarea } from '@/components/ui/textarea';
import { DENSE_VERSION, encodeQr, fitsBytes } from '@/lib/qr/encode';
import { encodeEncrypted, encodePlain, encodeSealedFor, generateKey, isKey, isX25519Key } from '@/lib/share/envelope';
import {
  RECEIVE_PATH,
  budgetedLength,
  hashParams,
  isLoopback,
  MAX_LINK_LENGTH,
  publicKeyFrom,
  receiveUrl,
  siteBase,
} from '@/lib/share/link';
import { maskKey } from '@/lib/share/mask';
import { languageQuery } from '@/i18n';

/**
 * A code above this version is hard to scan off a screen, so the share tool offers none rather than a code that
 * may not scan; the link can still be copied.
 */
const QR_MAX_VERSION = DENSE_VERSION;

/** Beyond this, some chat apps and mail clients cut links short. */
const LONG_LINK = 8000;
const MAX_INPUT = 100_000;

/** How content is sealed: not at all, with a shared random key, or to the receiver's public key. */
type Scheme = 'plain' | 'key' | 'public';
type Method = Exclude<Scheme, 'plain'>;

interface Output {
  link: string;
  envelope: string;
  scheme: Scheme;
  /** The random key, for the `key` scheme only. */
  key: string | null;
  /** What was sealed; the input may have been cleared since, and a new key seals this again. */
  text: string;
}

function helpSections(t: TFunction): HelpSection[] {
  return [
    { title: t('share.help.plainTitle'), items: [t('share.help.plain1'), t('share.help.plain2')] },
    {
      title: t('share.help.keyTitle'),
      items: [t('share.help.key1'), t('share.help.key2'), t('share.help.key3'), t('share.help.key4')],
    },
    { title: t('share.help.publicTitle'), items: [t('share.help.public1'), t('share.help.public2')] },
  ];
}

const ALGORITHM: Record<Method, string> = {
  key: 'AES-256-GCM',
  public: 'X25519 · AES-256-GCM',
};

function methodText(t: TFunction, method: Method): { label: string; description: string } {
  return method === 'key'
    ? { label: t('share.keyMethod'), description: t('share.keyDescription') }
    : { label: t('share.publicMethod'), description: t('share.publicDescription') };
}

type Carrier = 'link' | 'content';

/** Stands in, static and compact, for a text block, a button and a QR code until something is generated. */
function ResultSkeleton({ qrWidth }: { qrWidth: 'max-w-40' | 'max-w-32' }) {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-10 w-full animate-none" />
      <Skeleton className="h-8 w-20 animate-none" />
      <Skeleton className={cn('aspect-square w-full animate-none', qrWidth)} />
    </div>
  );
}

function MonoBlock({ children }: { children: string }) {
  return (
    <p className="max-h-40 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-all select-all">{children}</p>
  );
}

/**
 * Takes up a key handed over earlier, so a receiver who still has it can keep reading without entering a new one,
 * even after this page was closed.
 */
function UseKeyDialog({ onUse }: { onUse: (key: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const id = useId();
  const invalid = value.trim() !== '' && !isKey(value);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setValue('');
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ImportIcon data-icon="inline-start" />
        {t('share.enterKey')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('share.useKey')}</DialogTitle>
          <DialogDescription>{t('share.useKeyDescription')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (isKey(value)) {
              onUse(value.trim());
              setOpen(false);
              setValue('');
            }
          }}
        >
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={id}>{t('share.key')}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id={id}
                value={value}
                placeholder={t('share.keyPlaceholder')}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                onChange={(event) => setValue(event.target.value)}
                className="min-w-0 flex-1 font-mono max-md:placeholder:text-xs"
              />
              <QrScannerButton
                title={t('share.scanKey')}
                description={t('share.scanKeyDescription')}
                autoClose
                onDetect={(scanned) => {
                  if (!isKey(scanned)) {
                    return t('share.notKey');
                  }
                  setValue(scanned.trim());
                  return t('share.keyFilled');
                }}
              />
            </div>
            {invalid && <FieldError>{t('share.keyInvalid')}</FieldError>}
          </Field>
          <Button type="submit" disabled={!isKey(value)} className="w-fit">
            <ImportIcon data-icon="inline-start" />
            {t('share.use')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ShareTool() {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  // Opened from a receiver's public-key link or QR code: start out ready to encrypt to that key.
  const [incomingKey] = useState(() => {
    const key = hashParams().get('public_key');
    return key !== null && isX25519Key(key) ? key : null;
  });
  const [encrypt, setEncrypt] = useState(true);
  const [output, setOutput] = useState<Output | null>(null);
  const [tooLong, setTooLong] = useState(false);
  // A fixed key lives only in this component's memory: the receiver enters it once for many messages.
  const [fixedKey, setFixedKey] = useState(false);
  // Empties the input once a link is made, for sending several messages in a row.
  const [clearAfter, setClearAfter] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<Carrier>('link');
  const [method, setMethod] = useState<Method>(incomingKey ? 'public' : 'key');
  const [recipient, setRecipient] = useState(incomingKey ?? '');

  // The parameter has done its job once read; drop it from the address bar.
  useEffect(() => {
    if (hashParams().has('public_key')) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/share`);
    }
  }, []);
  const ids = useId();
  const base = siteBase();

  const seal = (content: string, key: string | null): Output => {
    const envelope = key ? encodeEncrypted(content, key) : encodePlain(content);
    return { link: receiveUrl(envelope, base), envelope, scheme: key ? 'key' : 'plain', key, text: content };
  };

  const recipientValid = isX25519Key(recipient);
  const byPublicKey = encrypt && method === 'public';

  /** Shows a result, or nothing when its link is too long to carry. */
  const show = (next: Output) => {
    const fits = next.link.length <= MAX_LINK_LENGTH;
    setTooLong(!fits);
    setOutput(fits ? next : null);
  };

  const clearOutput = () => {
    setOutput(null);
    setTooLong(false);
  };

  const generate = () => {
    if (byPublicKey) {
      const envelope = encodeSealedFor(text, recipient);
      show({ link: receiveUrl(envelope, base), envelope, scheme: 'public', key: null, text });
    } else {
      let key: string | null = null;
      if (encrypt) {
        key = fixedKey ? (sessionKey ?? generateKey()) : generateKey();
        if (fixedKey) {
          setSessionKey(key);
        }
      }
      show(seal(text, key));
    }
    // Straight to the state: the field's onChange would also clear the result just made.
    if (clearAfter) {
      setText('');
    }
  };

  const toggleFixedKey = (checked: boolean) => {
    setFixedKey(checked);
    // Turning it on keeps the key already handed over, or makes one right away so it can be shared first.
    setSessionKey(checked ? (output?.key ?? generateKey()) : null);
  };

  /** Swaps in another key for what comes next; a result already sealed with a key is sealed again with it. */
  const switchKey = (next: string) => {
    setSessionKey(next);
    if (output?.key) {
      setOutput(seal(output.text, next));
    }
  };

  const replaceKey = () => switchKey(generateKey());

  // A key from earlier is meant for many messages, so it turns the fixed key on.
  const applyKey = (key: string) => {
    setFixedKey(true);
    switchKey(key);
    toast(t('share.keyApplied'));
  };

  const shownKey = encrypt && method === 'key' ? (output?.key ?? (fixedKey ? sessionKey : null)) : null;
  const linkQr = useMemo(() => (output ? encodeQr(output.link, 'L', QR_MAX_VERSION) : null), [output]);
  // The bare envelope makes a smaller code, and a phone camera shows it as text instead of opening a browser.
  const envelopeQr = useMemo(() => (output ? encodeQr(output.envelope, 'L', QR_MAX_VERSION) : null), [output]);
  const keyQr = useMemo(() => (shownKey ? encodeQr(shownKey, 'M') : null), [shownKey]);
  const reserveShort =
    output !== null && linkQr?.ok === true && !fitsBytes(budgetedLength(output.envelope, base), 'L', QR_MAX_VERSION);

  return (
    <ToolPage
      icon={SendIcon}
      title={t('tools.share.title')}
      description={t('share.description')}
      help={<HelpPopover title={t('share.helpTitle')} sections={helpSections(t)} />}
      actions={
        <>
          {/* A new tab keeps what was generated here, which lives only in this page's memory. */}
          <a
            href={`${base}${RECEIVE_PATH}${languageQuery()}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <InboxIcon data-icon="inline-start" />
            {t('share.receive')}
          </a>
          <ClearButton
            disabled={text === '' && output === null && sessionKey === null && recipient === ''}
            onClear={() => {
              const previous = { text, output, sessionKey, recipient };
              setText('');
              clearOutput();
              setSessionKey(null);
              setRecipient('');
              return () => {
                setText(previous.text);
                setOutput(previous.output);
                setSessionKey(previous.sessionKey);
                setRecipient(previous.recipient);
              };
            }}
          />
        </>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLineIcon className="size-4 text-brand" />
              {t('share.content')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field>
              <FieldLabel htmlFor={`${ids}-text`} className="sr-only">
                {t('share.contentLabel')}
              </FieldLabel>
              <Textarea
                id={`${ids}-text`}
                value={text}
                maxLength={MAX_INPUT}
                placeholder={t('share.contentPlaceholder')}
                onChange={(event) => {
                  setText(event.target.value);
                  clearOutput();
                }}
                className="max-h-96 min-h-40 font-mono max-md:placeholder:text-sm"
              />
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${ids}-encrypt`}>{t('share.encrypt')}</FieldLabel>
                <FieldDescription>
                  {encrypt ? methodText(t, method).description : t('share.plainDescription')}
                </FieldDescription>
              </FieldContent>
              <Switch
                id={`${ids}-encrypt`}
                checked={encrypt}
                onCheckedChange={(checked) => {
                  setEncrypt(checked);
                  clearOutput();
                }}
              />
            </Field>

            {encrypt && (
              <ToggleGroup
                aria-label={t('share.method')}
                variant="outline"
                size="sm"
                value={[method]}
                onValueChange={(next) => {
                  if (next[0] !== undefined) {
                    setMethod(next[0] as Method);
                    clearOutput();
                  }
                }}
                className="w-full"
              >
                {(['key', 'public'] as const).map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    className="flex-1 data-pressed:border-brand/60 data-pressed:bg-brand/10 data-pressed:text-foreground"
                  >
                    {value === 'key' ? (
                      <RotateCcwKeyIcon data-icon="inline-start" />
                    ) : (
                      <UserRoundKeyIcon data-icon="inline-start" />
                    )}
                    {methodText(t, value).label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            {byPublicKey && (
              <Field data-invalid={(recipient !== '' && !recipientValid) || undefined}>
                <FieldLabel htmlFor={`${ids}-recipient`}>{t('share.recipient')}</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={`${ids}-recipient`}
                    value={recipient}
                    placeholder={t('share.recipientPlaceholder')}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-invalid={(recipient !== '' && !recipientValid) || undefined}
                    onChange={(event) => {
                      setRecipient(publicKeyFrom(event.target.value));
                      clearOutput();
                    }}
                    className="min-w-0 flex-1 font-mono max-md:placeholder:text-xs"
                  />
                  <QrScannerButton
                    title={t('share.scanPublicKey')}
                    description={t('share.scanPublicKeyDescription')}
                    autoClose
                    onDetect={(scanned) => {
                      // Either the bare key or the receiver's public-key link.
                      const key = publicKeyFrom(scanned);
                      if (!isX25519Key(key)) {
                        return t('share.notPublicKey');
                      }
                      setRecipient(key);
                      clearOutput();
                      return t('share.publicKeyFilled');
                    }}
                  />
                </div>
                {recipient !== '' && !recipientValid ? (
                  <FieldError>{t('share.recipientInvalid')}</FieldError>
                ) : (
                  <FieldDescription>{t('share.recipientHint')}</FieldDescription>
                )}
              </Field>
            )}

            {encrypt && method === 'key' && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={`${ids}-fixed`}>{t('share.fixedKey')}</FieldLabel>
                  <FieldDescription>{t('share.fixedKeyDescription')}</FieldDescription>
                </FieldContent>
                <Switch id={`${ids}-fixed`} checked={fixedKey} onCheckedChange={toggleFixedKey} />
              </Field>
            )}

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${ids}-clear-after`}>{t('share.clearAfter')}</FieldLabel>
                <FieldDescription>{t('share.clearAfterDescription')}</FieldDescription>
              </FieldContent>
              <Switch id={`${ids}-clear-after`} checked={clearAfter} onCheckedChange={setClearAfter} />
            </Field>

            <Button size="lg" onClick={generate} disabled={text === '' || (byPublicKey && !recipientValid)}>
              {encrypt ? <LockIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
              {output ? t('share.regenerate') : t('share.generate')}
            </Button>

            {tooLong && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>{t('share.tooLong', { limit: MAX_LINK_LENGTH.toLocaleString(i18n.language) })}</p>
              </Note>
            )}

            {isLoopback(base) && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>
                  <Trans i18nKey="share.localhost" components={{ code: <code /> }} />
                </p>
              </Note>
            )}

            <Note icon={HistoryIcon}>
              <p>{t('share.history')}</p>
            </Note>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockIcon className="size-4 text-brand" />
              {t('share.encrypted')}
              {encrypt && <Badge variant="secondary">{ALGORITHM[method]}</Badge>}
            </CardTitle>
            {output?.scheme === 'plain' && <CardDescription>{t('share.plainResult')}</CardDescription>}
          </CardHeader>
          <CardContent>
            <Tabs value={carrier} onValueChange={(value) => setCarrier(value as Carrier)} className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger value="link">
                  <LinkIcon data-icon="inline-start" />
                  {t('share.link')}
                </TabsTrigger>
                <TabsTrigger value="content">
                  <FileTextIcon data-icon="inline-start" />
                  {t('share.content')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="grid gap-4">
                {output ? (
                  <>
                    <MonoBlock>{output.link}</MonoBlock>
                    <CopyButton value={output.link} done={t('share.linkCopied')} className="w-fit" />
                    {output.link.length > LONG_LINK && (
                      <Note tone="warning" icon={TriangleAlertIcon}>
                        <p>{t('share.longLink')}</p>
                      </Note>
                    )}
                    {linkQr?.ok ? (
                      <QrPreview
                        qr={linkQr.qr}
                        label={t('share.linkQr')}
                        filename="share-link"
                        imageClassName="max-w-64"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('share.linkNoQr')}</p>
                    )}
                    {reserveShort && <p className="text-xs text-muted-foreground">{t('share.reserveShort')}</p>}
                  </>
                ) : (
                  <ResultSkeleton qrWidth="max-w-40" />
                )}
              </TabsContent>

              <TabsContent value="content" className="grid gap-4">
                {output ? (
                  <>
                    <MonoBlock>{output.envelope}</MonoBlock>
                    <CopyButton value={output.envelope} done={t('share.contentCopied')} className="w-fit" />
                    {envelopeQr?.ok ? (
                      <QrPreview
                        qr={envelopeQr.qr}
                        label={t('share.contentQr')}
                        filename="share-content"
                        imageClassName="max-w-64"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('share.contentNoQr')}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{t('share.contentHint')}</p>
                  </>
                ) : (
                  <ResultSkeleton qrWidth="max-w-40" />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-brand" />
              {t('share.key')}
              {encrypt && method === 'key' && fixedKey && <Badge variant="secondary">{t('share.fixed')}</Badge>}
            </CardTitle>
            {encrypt && method === 'key' && (
              <CardAction>
                <UseKeyDialog onUse={applyKey} />
              </CardAction>
            )}
            {!encrypt ? (
              <CardDescription>{t('share.notEncrypted')}</CardDescription>
            ) : byPublicKey ? (
              <CardDescription>{t('share.publicKeyNote')}</CardDescription>
            ) : (
              shownKey && <CardDescription>{t('share.keyNote')}</CardDescription>
            )}
          </CardHeader>
          {byPublicKey && recipientValid && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('share.recipientMasked')} <span className="font-mono text-foreground">{maskKey(recipient)}</span>
              </p>
            </CardContent>
          )}
          {encrypt && method === 'key' && !shownKey && (
            <CardContent>
              <ResultSkeleton qrWidth="max-w-32" />
            </CardContent>
          )}
          {shownKey && keyQr?.ok && (
            <CardContent className="grid gap-4">
              <MonoBlock>{shownKey}</MonoBlock>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={shownKey} done={t('share.keyCopied')} />
                {fixedKey && (
                  <Button variant="outline" onClick={replaceKey}>
                    <RefreshCwIcon data-icon="inline-start" />
                    {t('share.replaceKey')}
                  </Button>
                )}
              </div>
              <QrPreview qr={keyQr.qr} label={t('share.keyQr')} filename="share-key" imageClassName="max-w-48" />
            </CardContent>
          )}
        </Card>
      </div>
    </ToolPage>
  );
}
