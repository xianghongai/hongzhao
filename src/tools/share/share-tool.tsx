import { cn } from 'cn';
import {
  FileTextIcon,
  HistoryIcon,
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
import { useEffect, useId, useMemo, useState } from 'react';

import { ClearButton } from '@/components/clear-button';
import { CopyButton } from '@/components/copy-button';
import { QrScannerButton } from '@/components/qr-scanner';
import { QrPreview } from '@/components/qr-code-view';
import { HelpPopover, type HelpSection } from '@/components/help-popover';
import { Note, ToolPage } from '@/components/tool-page';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Textarea } from '@/components/ui/textarea';
import { DENSE_VERSION, encodeQr, fitsBytes } from '@/lib/qr/encode';
import { encodeEncrypted, encodePlain, encodeSealedFor, generateKey, isX25519Key } from '@/lib/share/envelope';
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
}

const HELP: HelpSection[] = [
  {
    title: '不加密',
    items: ['适合不敏感的内容，例如把网址传到自己手机。', '拿到链接的人都能看到内容，直接打开链接或扫码即可。'],
  },
  {
    title: '随机密钥',
    items: [
      '由发送方提供密钥：加密时随机生成。',
      '把加密内容和密钥分开发给接收方。',
      '连传多条时开启“固定密钥”，接收方只需输入一次。',
    ],
  },
  {
    title: '接收方公钥',
    items: ['由接收方提供密钥：在接收页生成公钥，交给发送方。', '发送方用公钥加密后发给接收方，无需另外传递密钥。'],
  },
];

const METHOD_TEXT: Record<Method, { label: string; algorithm: string; description: string }> = {
  key: {
    label: '随机密钥',
    algorithm: 'AES-256-GCM',
    description: 'AES-256-GCM 加密，随机 256 位密钥。',
  },
  public: {
    label: '接收方公钥',
    algorithm: 'X25519 · AES-256-GCM',
    description: 'X25519 密钥协商加 AES-256-GCM。只有生成该公钥的接收页能解密。',
  },
};

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

export default function ShareTool() {
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
    return { link: receiveUrl(envelope, base), envelope, scheme: key ? 'key' : 'plain', key };
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
      show({ link: receiveUrl(envelope, base), envelope, scheme: 'public', key: null });
      return;
    }
    let key: string | null = null;
    if (encrypt) {
      key = fixedKey ? (sessionKey ?? generateKey()) : generateKey();
      if (fixedKey) {
        setSessionKey(key);
      }
    }
    show(seal(text, key));
  };

  const toggleFixedKey = (checked: boolean) => {
    setFixedKey(checked);
    // Turning it on keeps the key already handed over, or makes one right away so it can be shared first.
    setSessionKey(checked ? (output?.key ?? generateKey()) : null);
  };

  const replaceKey = () => {
    const next = generateKey();
    setSessionKey(next);
    if (output?.key) {
      setOutput(seal(text, next));
    }
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
      title="链接传送"
      description="把内容编码进链接，在另一台设备打开即可读取。"
      help={<HelpPopover title="如何使用链接传送" sections={HELP} />}
      actions={
        <>
          {/* A new tab keeps what was generated here, which lives only in this page's memory. */}
          <a
            href={`${base}${RECEIVE_PATH}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <InboxIcon data-icon="inline-start" />
            接收
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
              内容
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Field>
              <FieldLabel htmlFor={`${ids}-text`} className="sr-only">
                要传送的内容
              </FieldLabel>
              <Textarea
                id={`${ids}-text`}
                value={text}
                maxLength={MAX_INPUT}
                placeholder="粘贴要传到另一台设备的文字，例如订阅地址、配置片段、临时笔记"
                onChange={(event) => {
                  setText(event.target.value);
                  clearOutput();
                }}
                className="max-h-96 min-h-40 font-mono text-sm"
              />
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${ids}-encrypt`}>加密</FieldLabel>
                <FieldDescription>
                  {encrypt ? METHOD_TEXT[method].description : '内容以明文放进链接。'}
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
                aria-label="加密方式"
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
                    {METHOD_TEXT[value].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            {byPublicKey && (
              <Field data-invalid={(recipient !== '' && !recipientValid) || undefined}>
                <FieldLabel htmlFor={`${ids}-recipient`}>接收方公钥</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={`${ids}-recipient`}
                    value={recipient}
                    placeholder="粘贴接收方的公钥"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-invalid={(recipient !== '' && !recipientValid) || undefined}
                    onChange={(event) => {
                      setRecipient(publicKeyFrom(event.target.value));
                      clearOutput();
                    }}
                    className="min-w-0 flex-1 font-mono"
                  />
                  <QrScannerButton
                    title="扫描公钥二维码"
                    description="对准接收方页面上的公钥二维码。"
                    onDetect={(scanned) => {
                      // Either the bare key or the receiver's public-key link.
                      const key = publicKeyFrom(scanned);
                      if (!isX25519Key(key)) {
                        return '这不是公钥二维码';
                      }
                      setRecipient(key);
                      clearOutput();
                      return '已填入公钥';
                    }}
                  />
                </div>
                {recipient !== '' && !recipientValid ? (
                  <FieldError>公钥格式不正确，请粘贴接收页生成的完整公钥</FieldError>
                ) : (
                  <FieldDescription>由接收方在接收页“解密”的“公钥”中生成。</FieldDescription>
                )}
              </Field>
            )}

            {encrypt && method === 'key' && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={`${ids}-fixed`}>固定密钥</FieldLabel>
                  <FieldDescription>多次生成使用同一把密钥，接收方只需输入一次。</FieldDescription>
                </FieldContent>
                <Switch id={`${ids}-fixed`} checked={fixedKey} onCheckedChange={toggleFixedKey} />
              </Field>
            )}

            <Button size="lg" onClick={generate} disabled={text === '' || (byPublicKey && !recipientValid)}>
              {encrypt ? <LockIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
              {output ? '重新生成' : '生成'}
            </Button>

            {tooLong && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>
                  内容过多，生成的链接会超过 {MAX_LINK_LENGTH.toLocaleString('en-US')}{' '}
                  个字符，浏览器与聊天软件都难以完整承载。请精简内容，或改用文件传输。
                </p>
              </Note>
            )}

            {isLoopback(base) && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>
                  当前通过 localhost 访问，生成的链接在其他设备上打不开。请改用局域网地址（例如运行{' '}
                  <code>pnpm dev:lan</code> 后显示的地址）或线上站点。
                </p>
              </Note>
            )}

            <Note icon={HistoryIcon}>
              <p>打开过的链接会留在浏览器历史记录里，敏感内容请加密。</p>
            </Note>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockIcon className="size-4 text-brand" />
              加密
              {encrypt && <Badge variant="secondary">{METHOD_TEXT[method].algorithm}</Badge>}
            </CardTitle>
            {output?.scheme === 'plain' && <CardDescription>未加密，任何拿到链接的人都能读取内容。</CardDescription>}
          </CardHeader>
          <CardContent>
            <Tabs value={carrier} onValueChange={(value) => setCarrier(value as Carrier)} className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger value="link">
                  <LinkIcon data-icon="inline-start" />
                  链接
                </TabsTrigger>
                <TabsTrigger value="content">
                  <FileTextIcon data-icon="inline-start" />
                  内容
                </TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="grid gap-4">
                {output ? (
                  <>
                    <MonoBlock>{output.link}</MonoBlock>
                    <CopyButton value={output.link} what="链接" className="w-fit" />
                    {output.link.length > LONG_LINK && (
                      <Note tone="warning" icon={TriangleAlertIcon}>
                        <p>
                          链接较长，部分聊天软件或邮件客户端可能截断。对方打开后如果提示内容不完整，请改用文件传输。
                        </p>
                      </Note>
                    )}
                    {linkQr?.ok ? (
                      <QrPreview qr={linkQr.qr} label="链接二维码" filename="share-link" imageClassName="max-w-64" />
                    ) : (
                      <p className="text-sm text-muted-foreground">内容较多，不提供二维码，请复制链接发送。</p>
                    )}
                    {reserveShort && (
                      <p className="text-xs text-muted-foreground">
                        二维码当前可用。若将来站点换用更长的地址，同样的内容可能放不下。
                      </p>
                    )}
                  </>
                ) : (
                  <ResultSkeleton qrWidth="max-w-40" />
                )}
              </TabsContent>

              <TabsContent value="content" className="grid gap-4">
                {output ? (
                  <>
                    <MonoBlock>{output.envelope}</MonoBlock>
                    <CopyButton value={output.envelope} what="内容" className="w-fit" />
                    {envelopeQr?.ok ? (
                      <QrPreview
                        qr={envelopeQr.qr}
                        label="内容二维码"
                        filename="share-content"
                        imageClassName="max-w-64"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">内容较多，不提供二维码，请复制后发送。</p>
                    )}
                    <p className="text-xs text-muted-foreground">不含网址，用接收页的“扫码”读取，可以连续扫描多条。</p>
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
              密钥
              {encrypt && method === 'key' && fixedKey && <Badge variant="secondary">固定</Badge>}
            </CardTitle>
            {!encrypt ? (
              <CardDescription>未开启加密。</CardDescription>
            ) : byPublicKey ? (
              <CardDescription>无需传递密钥：复制加密内容或链接到生成该公钥的接收页打开。</CardDescription>
            ) : (
              shownKey && <CardDescription>离开页面后无法找回，建议与链接分开传递。</CardDescription>
            )}
          </CardHeader>
          {byPublicKey && recipientValid && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                接收方公钥 <span className="font-mono text-foreground">{maskKey(recipient)}</span>
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
                <CopyButton value={shownKey} what="密钥" />
                {fixedKey && (
                  <Button variant="outline" onClick={replaceKey}>
                    <RefreshCwIcon data-icon="inline-start" />
                    更换密钥
                  </Button>
                )}
              </div>
              <QrPreview qr={keyQr.qr} label="密钥二维码" filename="share-key" imageClassName="max-w-48" />
            </CardContent>
          )}
        </Card>
      </div>
    </ToolPage>
  );
}
