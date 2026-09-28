import {
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  ImportIcon,
  InboxIcon,
  InfoIcon,
  KeyRoundIcon,
  LockOpenIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  FileKey,
  TriangleAlertIcon,
  RotateCcwKeyIcon,
  UserRoundKeyIcon,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Brand } from '@/components/brand';
import { CopyButton } from '@/components/copy-button';
import { QrPreview } from '@/components/qr-code-view';
import { PrivacyDialog } from '@/components/privacy-dialog';
import { QrScannerButton } from '@/components/qr-scanner';
import { ThemeToggle } from '@/components/theme-toggle';
import { Note } from '@/components/tool-page';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  type KeyPair,
  decrypt,
  decryptWithPrivateKey,
  exportPrivateKey,
  generateKeyPair,
  importPrivateKey,
  isKey,
} from '@/lib/share/envelope';
import { publicKeyLink } from '@/lib/share/link';
import { encodeQr } from '@/lib/qr/encode';
import { ImageReadError, readQrCodes } from '@/lib/qr/read-image';
import { maskKey } from '@/lib/share/mask';
import { formatDateTime } from '@/lib/time';
import { classify } from '@/receive/inbox';
import { takeFragment } from '@/receive/take-fragment';

interface Message {
  id: number;
  text: string;
  encrypted: boolean;
  /** When it was received, or decrypted if it had to wait for a key. */
  at: Date;
}

/** Offers "open" only when the whole content is one web address; opening stays the reader's choice. */
function singleUrl(text: string): string | null {
  const trimmed = text.trim();
  if (/\s/.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function tryDecrypt(data: Uint8Array, key: string): string | null {
  try {
    return decrypt(data, key);
  } catch {
    return null;
  }
}

function imageFiles(files: Iterable<File>): File[] {
  return [...files].filter((file) => file.type.startsWith('image/'));
}

type DecryptMode = 'key' | 'public';

function RandomKeyPanel({
  currentKey,
  waiting,
  onKey,
  onScan,
  onChange,
}: {
  currentKey: string | null;
  waiting: boolean;
  /** Tries a typed key; returns false when it does not open the waiting content. */
  onKey: (key: string) => boolean;
  /** Handles a scanned code, key or content, and says what happened. */
  onScan: (text: string) => string;
  onChange: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  if (currentKey !== null) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-sm" aria-label="当前密钥（部分隐藏）">
          {maskKey(currentKey)}
        </p>
        <Button variant="outline" size="sm" onClick={onChange}>
          <RefreshCwIcon data-icon="inline-start" />
          更换
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isKey(value)) {
          setError('密钥格式不正确');
        } else if (onKey(value.trim())) {
          setValue('');
        } else {
          setError('密钥不匹配，无法解密这条内容');
        }
      }}
    >
      <Field data-invalid={error !== '' || undefined}>
        <FieldLabel htmlFor={id} className="sr-only">
          密钥
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id={id}
            value={value}
            placeholder="粘贴密钥"
            // A link that needs a key has nothing else to do on the page.
            autoFocus={waiting}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={error !== '' || undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setError('');
            }}
            className="min-w-0 flex-1 font-mono"
          />
          <Button type="submit" disabled={value.trim() === ''}>
            <RotateCcwKeyIcon data-icon="inline-start" />
            使用
          </Button>
          {/* Once a key is set this form unmounts, which closes the scanner and stops the camera. */}
          <QrScannerButton
            title="扫描密钥二维码"
            description="对准发送方页面上的密钥二维码。"
            onDetect={(text) => {
              const message = onScan(text);
              toast(message);
              return message;
            }}
          />
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  );
}

/** Shows the private key for the owner's own backup, masked until asked for. */
function ViewPrivateKeyDialog({ privateKey }: { privateKey: () => string }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const text = open ? privateKey() : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setRevealed(false);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <EyeIcon data-icon="inline-start" />
        查看私钥
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>私钥</DialogTitle>
          <DialogDescription>刷新或关闭本页前备份私钥，之后可以用“导入私钥”恢复。</DialogDescription>
        </DialogHeader>
        <Note tone="warning" icon={ShieldAlertIcon}>
          <p>私钥能解密所有发给这把公钥的内容。只用于自己备份，不要发给任何人。</p>
        </Note>
        <p
          className="rounded-lg bg-muted p-3 font-mono text-xs break-all select-all"
          aria-label={revealed ? '私钥' : '私钥（已隐藏）'}
        >
          {revealed ? text : maskKey(text)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRevealed((current) => !current)}>
            {revealed ? <EyeOffIcon data-icon="inline-start" /> : <EyeIcon data-icon="inline-start" />}
            {revealed ? '隐藏' : '显示'}
          </Button>
          <CopyButton value={text} what="私钥" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Restores a key pair from a backed-up private key, showing the public key it leads to before replacing anything. */
function ImportPrivateKeyDialog({
  replacing,
  onImport,
}: {
  replacing: boolean;
  onImport: (privateKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const id = useId();
  let derived: string | null = null;
  try {
    derived = value.trim() === '' ? null : importPrivateKey(value).publicKey;
  } catch {
    derived = null;
  }
  const invalid = value.trim() !== '' && derived === null;

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
        导入私钥
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入私钥</DialogTitle>
          <DialogDescription>粘贴之前备份的私钥，恢复对应的公钥和解密能力。</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (derived !== null) {
              onImport(value.trim());
              setOpen(false);
              setValue('');
            }
          }}
        >
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={id}>私钥</FieldLabel>
            <Input
              id={id}
              value={value}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={invalid || undefined}
              onChange={(event) => setValue(event.target.value)}
              className="font-mono"
            />
            {invalid ? (
              <FieldError>私钥格式不正确</FieldError>
            ) : (
              derived && (
                <p className="text-sm text-muted-foreground">
                  对应公钥 <span className="font-mono text-foreground">{maskKey(derived)}</span>
                </p>
              )
            )}
          </Field>
          {replacing && (
            <Note tone="warning" icon={TriangleAlertIcon}>
              <p>将替换当前的公钥和私钥。</p>
            </Note>
          )}
          <Button type="submit" disabled={derived === null} className="w-fit">
            <ImportIcon data-icon="inline-start" />
            导入
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Receiving by public key: the sender encrypts to this page's public key, and the private key never leaves it
 * unless the owner backs it up. Only a page holding that private key can open such content.
 */
function PublicKeyPanel({
  publicKey,
  privateKey,
  onGenerate,
  onImport,
}: {
  publicKey: string | null;
  privateKey: () => string;
  onGenerate: () => void;
  onImport: (privateKey: string) => void;
}) {
  // The code opens the share tool with this key filled in, so the sender can scan it with a phone camera.
  const qr = publicKey ? encodeQr(publicKeyLink(publicKey), 'M') : null;

  if (publicKey === null) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">让发送方用你的公钥加密，私钥不离开本页，无需传递密钥。</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onGenerate}>
            <UserRoundKeyIcon data-icon="inline-start" />
            生成公钥
          </Button>
          <ImportPrivateKeyDialog replacing={false} onImport={onImport} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        把公钥交给发送方，或让对方扫描二维码直接打开发送页。收到的内容请在本页粘贴或扫码接收。
      </p>
      <p className="rounded-lg bg-muted p-3 font-mono text-xs break-all select-all">{publicKey}</p>
      <CopyButton value={publicKey} what="公钥" className="w-fit" />
      {qr?.ok && <QrPreview qr={qr.qr} label="公钥二维码" filename="public-key" imageClassName="max-w-48" />}
      <div className="flex flex-wrap gap-2">
        <ViewPrivateKeyDialog privateKey={privateKey} />
        <ImportPrivateKeyDialog replacing onImport={onImport} />
      </div>
      <Note tone="warning" icon={TriangleAlertIcon}>
        <p>私钥只在本页内存中。刷新或关闭本页前，请先备份私钥。</p>
      </Note>
    </div>
  );
}

function MessageCard({ message }: { message: Message }) {
  const url = singleUrl(message.text);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {message.encrypted ? (
            <LockOpenIcon className="size-4 text-brand" />
          ) : (
            <InboxIcon className="size-4 text-brand" />
          )}
          {message.encrypted ? '已解密' : '收到的内容'}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <pre className="max-h-[60dvh] overflow-auto rounded-lg bg-muted p-3 font-mono text-sm break-all whitespace-pre-wrap select-all">
          {message.text}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={message.text} variant="default" />
          {url && (
            <a href={url} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: 'outline' })}>
              <ExternalLinkIcon data-icon="inline-start" />
              打开链接
            </a>
          )}
          <time dateTime={message.at.toISOString()} className="ml-auto text-sm text-muted-foreground tabular-nums">
            {formatDateTime(message.at)}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The receive page is a session: a key given once, by typing or scanning, opens everything that arrives after it,
 * whether scanned with the camera, pasted, read from a screenshot or opened as a link in this tab.
 * Nothing outlives the tab.
 */
export function ReceiveApp({ initialEnvelope }: { initialEnvelope: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Only the latest encrypted content waits for a key; each new one replaces the last.
  const [pending, setPending] = useState<Uint8Array | null>(null);
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  // Mirrors of the state, read synchronously: the camera can deliver several codes before React re-renders.
  const session = useRef({
    key: null as string | null,
    // The private half of a public-key pair made on this page; never leaves memory, never becomes text.
    privateKey: null as Uint8Array | null,
    pending: null as Uint8Array | null,
    seen: new Set<string>(),
    nextId: 1,
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [mode, setMode] = useState<DecryptMode>('key');
  // Development StrictMode runs effects twice; the opening link is handled once.
  const openedInitial = useRef(false);
  // Opened from a link, the page shows just that content, or asks for its key; the tools for receiving more stay
  // folded away until asked for. Opened bare, or from something unreadable, it shows everything.
  const [expanded, setExpanded] = useState(
    () => initialEnvelope === '' || classify(initialEnvelope).kind !== 'envelope'
  );

  const addMessage = (text: string, encrypted: boolean) => {
    const message = { id: session.current.nextId++, text, encrypted, at: new Date() };
    setMessages((current) => [message, ...current]);
  };

  const setWaiting = (data: Uint8Array | null) => {
    session.current.pending = data;
    setPending(data);
  };

  /**
   * The one rule for a key, wherever it comes from: it is kept if it opens the content that is waiting,
   * or if nothing is waiting for one yet.
   */
  const offerKey = (next: string): { accepted: boolean; message: string } => {
    const waiting = session.current.pending;
    const opened = waiting === null ? null : tryDecrypt(waiting, next);
    if (waiting !== null && opened === null) {
      return { accepted: false, message: '密钥不匹配，无法解密这条内容' };
    }
    session.current.key = next;
    setKey(next);
    setNotice('');
    if (opened === null) {
      return { accepted: true, message: '已设置密钥' };
    }
    addMessage(opened, true);
    setWaiting(null);
    return { accepted: true, message: '已设置密钥并解密' };
  };

  /** Handles one scanned or pasted text and says what happened. */
  const receive = (text: string): string => {
    const received = classify(text);
    if (received.kind === 'invalid') {
      setNotice(received.message);
      return received.message;
    }
    if (received.kind === 'key') {
      // Keys belong in the key card, but one that ends up here is handled by the same rule.
      return offerKey(received.key).message;
    }
    const { envelope, parsed } = received;
    if (session.current.seen.has(envelope)) {
      return '这条内容已经接收过';
    }
    if (parsed.encrypted && parsed.scheme === 'public') {
      // Sealed to a public key: only the page holding its private key can open it, now or later,
      // so it neither waits nor counts as seen; pasted into the right page it should still work.
      const privateKey = session.current.privateKey;
      const message =
        privateKey === null
          ? '这条内容用公钥加密，只有生成该公钥的页面能解密。请在那个页面里粘贴链接或扫码。'
          : '这条内容不是用本页的公钥加密的。';
      let text: string;
      try {
        if (privateKey === null) {
          throw new Error('no private key');
        }
        text = decryptWithPrivateKey(parsed.data, privateKey);
      } catch {
        setNotice(message);
        return message;
      }
      session.current.seen.add(envelope);
      addMessage(text, true);
      setNotice('');
      return '已接收并解密';
    }
    session.current.seen.add(envelope);
    if (!parsed.encrypted) {
      addMessage(parsed.text, false);
      setNotice('');
      return '已接收';
    }
    const current = session.current.key;
    const opened = current === null ? null : tryDecrypt(parsed.data, current);
    if (opened !== null) {
      addMessage(opened, true);
      setNotice('');
      return '已接收并解密';
    }
    setWaiting(parsed.data);
    if (current === null) {
      return '已接收，设置密钥后解密';
    }
    setNotice('当前密钥无法解密新收到的内容，发送方可能更换了密钥。');
    return '当前密钥无法解密这条内容';
  };

  const importImages = async (files: File[]) => {
    for (const file of files) {
      let texts: string[];
      try {
        texts = await readQrCodes(file);
      } catch (error) {
        toast.error(error instanceof ImageReadError ? error.message : '识别失败');
        continue;
      }
      if (texts.length === 0) {
        toast.error('图片里没有找到二维码');
      }
      for (const text of texts) {
        toast(receive(text));
      }
    }
  };

  // The link that opened this page speaks for itself on screen; links opened later in the same tab get a toast.
  const onFragment = useEffectEvent((envelope: string, announce: boolean) => {
    if (envelope !== '') {
      const message = receive(envelope);
      if (announce) {
        toast(message);
      }
    }
  });
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData?.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      void importImages(files);
    }
  });
  useEffect(() => {
    if (!openedInitial.current) {
      openedInitial.current = true;
      onFragment(initialEnvelope, false);
    }
    const onHashChange = () => onFragment(takeFragment(), true);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('paste', onPaste);
    };
  }, [initialEnvelope]);

  const active = key !== null || messages.length > 0 || pending !== null;

  /** A key typed into the key panel; a mismatch is reported under the field instead of in a toast. */
  const tryKey = (next: string): boolean => {
    const { accepted, message } = offerKey(next);
    if (accepted) {
      toast(message);
    }
    return accepted;
  };

  const applyKeyPair = (pair: KeyPair) => {
    session.current.privateKey = pair.privateKey;
    setPublicKey(pair.publicKey);
  };

  const randomKeyPanel = (
    <RandomKeyPanel
      currentKey={key}
      waiting={pending !== null}
      onKey={(next) => tryKey(next)}
      onScan={receive}
      onChange={() => {
        session.current.key = null;
        setKey(null);
        setNotice('');
      }}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <div className="flex min-h-dvh flex-col">
          <header className="border-b">
            <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-4 px-4">
              <a href="../" aria-label="打开泥上首页" className="rounded-md">
                <Brand />
              </a>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="mx-auto grid w-full max-w-2xl flex-1 content-start gap-4 px-4 py-8">
            {(expanded || pending !== null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRoundIcon className="size-4 text-brand" />
                    解密
                  </CardTitle>
                  {key === null && pending !== null && (
                    <CardDescription>内容已加密，请输入发送方提供的密钥。</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {expanded ? (
                    <Tabs value={mode} onValueChange={(value) => setMode(value as DecryptMode)} className="gap-4">
                      <TabsList className="w-full">
                        <TabsTrigger value="key">
                          <RotateCcwKeyIcon data-icon="inline-start" />
                          随机密钥
                        </TabsTrigger>
                        <TabsTrigger value="public">
                          <UserRoundKeyIcon data-icon="inline-start" />
                          公钥
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="key">{randomKeyPanel}</TabsContent>
                      <TabsContent value="public">
                        <PublicKeyPanel
                          publicKey={publicKey}
                          privateKey={() =>
                            session.current.privateKey ? exportPrivateKey(session.current.privateKey) : ''
                          }
                          onGenerate={() => applyKeyPair(generateKeyPair())}
                          onImport={(text) => {
                            applyKeyPair(importPrivateKey(text));
                            toast('已导入私钥');
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    // Opened from a link that needs a random key: only that, with nothing else to choose.
                    randomKeyPanel
                  )}
                </CardContent>
              </Card>
            )}

            {expanded && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <InboxIcon className="size-4 text-brand" />
                    接收
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    <QrScannerButton
                      title="扫描二维码"
                      description="对准内容二维码，可以连续扫描。"
                      onDetect={receive}
                    />
                    <Button variant="outline" onClick={() => fileInput.current?.click()}>
                      <ImageIcon data-icon="inline-start" />
                      从图片识别
                    </Button>
                    <input
                      ref={fileInput}
                      name="images"
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(event) => {
                        void importImages(imageFiles(event.target.files ?? []));
                        event.target.value = '';
                      }}
                    />
                  </div>
                  <Separator className="my-1" />
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      toast(receive(link));
                      setLink('');
                    }}
                  >
                    <Textarea
                      name="link"
                      aria-label="粘贴链接或内容"
                      value={link}
                      placeholder="或粘贴链接或内容"
                      spellCheck={false}
                      onChange={(event) => setLink(event.target.value)}
                      className="min-h-16 font-mono text-xs break-all"
                    />
                    <Button type="submit" variant="outline" disabled={link.trim() === ''} className="w-fit">
                      <FileKey data-icon="inline-start" />
                      读取
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {notice && (
              <Note tone="warning" icon={TriangleAlertIcon}>
                <p>{notice}</p>
              </Note>
            )}

            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <MessageCard message={message} />
                </motion.div>
              ))}
            </AnimatePresence>

            {!expanded && messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => setExpanded(true)}
              >
                <InboxIcon data-icon="inline-start" />
                接收更多内容
              </Button>
            )}

            {active && (
              <Note icon={InfoIcon}>
                <p>刷新或关闭本页后，内容和密钥都不会保留。</p>
              </Note>
            )}
          </main>

          <footer className="mx-auto w-full max-w-2xl px-4 py-6">
            <PrivacyDialog />
          </footer>
        </div>
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </MotionConfig>
  );
}
