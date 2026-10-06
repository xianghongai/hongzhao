import { cn } from 'cn';
import {
  ChevronDownIcon,
  ClockIcon,
  EyeOffIcon,
  ImageIcon,
  InfoIcon,
  KeyRoundIcon,
  ListPlusIcon,
  Loader2Icon,
  PlusIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { TFunction } from 'i18next';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { OptionSelect } from '@/components/option-select';
import { ClearButton } from '@/components/clear-button';
import { Note, ToolPage } from '@/components/tool-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNow } from '@/hooks/use-now';
import { formatUtcOffset, timeZoneName } from '@/lib/time';
import {
  ALGORITHMS,
  type Algorithm,
  DEFAULT_SETTINGS,
  type OtpEntry,
  parseEntry,
  isProblem,
  parseScanned,
} from '@/lib/otp/entries';
import { otpProblemText } from '@/i18n/messages';
import { ImageReadError, imageFiles, readQrCodes } from '@/lib/qr/read-image';
import { EntryCard } from '@/tools/otp/entry-card';
import { SecretRows, type SecretRow, emptyRow, isBlank } from '@/tools/otp/secret-rows';
import { addEntries, clearEntries, restoreEntries, useOtpEntries } from '@/tools/otp/store';

const ALGORITHM_OPTIONS = ALGORITHMS.map((value) => ({ value, label: value }));
const DIGITS = ['6', '7', '8'];
const PERIODS = ['30', '60'];

/** An image that could not be imported, and why. */
interface Problem {
  source: string;
  message: string;
}

/** Screenshots pasted from the clipboard all arrive as `image.png`. */
function imageName(t: TFunction, file: File, pasted: boolean): string {
  return pasted ? t('otp.pastedImage') : t('otp.image', { name: file.name });
}

async function scanImages(
  t: TFunction,
  files: File[],
  pasted: boolean
): Promise<{ entries: OtpEntry[]; problems: Problem[] }> {
  const entries: OtpEntry[] = [];
  const problems: Problem[] = [];
  for (const file of files) {
    const source = imageName(t, file, pasted);
    let texts: string[];
    try {
      texts = await readQrCodes(file);
    } catch (error) {
      problems.push({
        source,
        message: error instanceof ImageReadError ? t('common.imageUnreadable') : t('common.readFailed'),
      });
      continue;
    }
    if (texts.length === 0) {
      problems.push({ source, message: t('otp.noQrFound') });
    }
    for (const text of texts) {
      const parsed = parseScanned(text);
      if (isProblem(parsed)) {
        problems.push({ source, message: otpProblemText(t, parsed) });
      } else {
        entries.push(parsed);
      }
    }
  }
  return { entries, problems };
}

function reportAdded(t: TFunction, entries: OtpEntry[]): void {
  const { added, duplicates } = addEntries(entries);
  if (added > 0) {
    toast.success(t('otp.added', { count: added }));
  }
  if (duplicates > 0) {
    toast.info(t('otp.duplicates', { count: duplicates }));
  }
}

interface AddCardProps {
  rows: SecretRow[];
  setRows: React.Dispatch<React.SetStateAction<SecretRow[]>>;
}

/** The input rows live in the page, so clearing the tool also clears what was typed but not added. */
function AddCard({ rows, setRows }: AddCardProps) {
  const { t } = useTranslation();
  const [focusId, setFocusId] = useState<number | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [algorithm, setAlgorithm] = useState<Algorithm>(DEFAULT_SETTINGS.algorithm);
  const [digits, setDigits] = useState(String(DEFAULT_SETTINGS.digits));
  const [period, setPeriod] = useState(String(DEFAULT_SETTINGS.period));
  const ids = useId();

  const filled = rows.filter((row) => !isBlank(row));

  const add = () => {
    const settings = { algorithm, digits: Number(digits), period: Number(period) };
    const entries: OtpEntry[] = [];
    const failed: SecretRow[] = [];
    for (const row of filled) {
      const parsed = parseEntry(row, settings);
      if (isProblem(parsed)) {
        failed.push({ ...row, error: otpProblemText(t, parsed) });
      } else {
        entries.push(parsed);
      }
    }
    reportAdded(t, entries);
    // Rows that failed stay, each with its reason, so they can be fixed; the rest are cleared.
    setRows(failed.length > 0 ? failed : [emptyRow()]);
    setProblems([]);
  };

  const addRow = () => {
    const row = emptyRow();
    setFocusId(row.id);
    setRows((current) => [...current, row]);
  };

  // Images are decoded on this device and dropped right after; nothing about them is kept.
  const importImages = async (files: File[], pasted = false) => {
    if (files.length === 0 || scanning) {
      return;
    }
    setScanning(true);
    try {
      const result = await scanImages(t, files, pasted);
      reportAdded(t, result.entries);
      setProblems(result.problems);
    } finally {
      setScanning(false);
    }
  };

  // A screenshot pasted anywhere on the page is imported; pasting text still goes to the focused field.
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData?.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      void importImages(files, true);
    }
  });
  useEffect(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
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
        void importImages(imageFiles(event.dataTransfer.files));
      }}
      className={cn('transition-shadow', dragging && 'ring-2 ring-brand')}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListPlusIcon className="size-4 text-brand" />
          {t('otp.addTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SecretRows rows={rows} onChange={setRows} onSubmit={add} focusId={focusId} onAddRow={addRow} />
        <p className="text-xs text-muted-foreground">{t('otp.pasteHint')}</p>

        {problems.length > 0 && (
          <ul className="grid gap-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {problems.map((problem, index) => (
              <li key={index}>{t('otp.problem', { source: problem.source, message: problem.message })}</li>
            ))}
          </ul>
        )}

        <Collapsible className="grid gap-3">
          <CollapsibleTrigger className="group flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" />
            {t('otp.advanced')}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={`${ids}-algorithm`}>{t('otp.algorithm')}</FieldLabel>
                <OptionSelect
                  id={`${ids}-algorithm`}
                  value={algorithm}
                  options={ALGORITHM_OPTIONS}
                  onChange={setAlgorithm}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${ids}-digits`}>{t('otp.digits')}</FieldLabel>
                <OptionSelect
                  id={`${ids}-digits`}
                  value={digits}
                  options={DIGITS.map((value) => ({ value, label: t('common.digits', { count: Number(value) }) }))}
                  onChange={setDigits}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${ids}-period`}>{t('otp.period')}</FieldLabel>
                <OptionSelect
                  id={`${ids}-period`}
                  value={period}
                  options={PERIODS.map((value) => ({ value, label: t('common.seconds', { count: Number(value) }) }))}
                  onChange={setPeriod}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('otp.advancedHint')}</p>
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={add} disabled={filled.length === 0}>
            <PlusIcon data-icon="inline-start" />
            {t('otp.add')}
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={scanning}>
            {scanning ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <ImageIcon data-icon="inline-start" />
            )}
            {t('otp.importScreenshot')}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void importImages(imageFiles(event.target.files ?? []));
            // Lets the same file be chosen again after fixing something.
            event.target.value = '';
          }}
        />
        <p className="text-xs text-muted-foreground">{t('otp.dropHint')}</p>
      </CardContent>
    </Card>
  );
}

export default function OtpTool() {
  const { t, i18n } = useTranslation();
  const entries = useOtpEntries();
  const [rows, setRows] = useState<SecretRow[]>(() => [emptyRow()]);
  // Remounting the add card resets its own state too: image import errors and advanced settings.
  const [addCardKey, setAddCardKey] = useState(0);

  const clear = () => {
    const previousEntries = clearEntries();
    const previousRows = rows;
    setRows([emptyRow()]);
    setAddCardKey((key) => key + 1);
    return () => {
      restoreEntries(previousEntries);
      setRows(previousRows);
    };
  };
  // Always ticking, so the clock shown is live even before any entry is added.
  const now = useNow();
  const zone = timeZoneName();
  const [hidden, setHidden] = useState(false);
  const ids = useId();

  return (
    <ToolPage
      icon={KeyRoundIcon}
      title={t('tools.otp.title')}
      description={t('otp.description')}
      actions={<ClearButton disabled={entries.length === 0 && rows.every(isBlank)} onClear={clear} />}
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <AddCard key={addCardKey} rows={rows} setRows={setRows} />
          <Note icon={InfoIcon}>
            <p>{t('otp.tempUse')}</p>
          </Note>
        </div>

        <section aria-label={t('otp.codes')} className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
              <ClockIcon className="size-4" />
              {t('otp.localTime', { time: new Date(now).toLocaleTimeString(i18n.language, { hour12: false }) })}
              <span className="text-xs">
                {t('otp.timeZone', {
                  zone: [formatUtcOffset(new Date(now).getTimezoneOffset()), zone].filter(Boolean).join(' · '),
                })}
              </span>
            </p>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id={`${ids}-hide`} checked={hidden} onCheckedChange={setHidden} />
                <Label htmlFor={`${ids}-hide`} className="text-sm text-muted-foreground">
                  <EyeOffIcon className="size-4" />
                  {t('otp.hideCodes')}
                </Label>
              </div>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <KeyRoundIcon className="size-8 opacity-40" />
              {t('otp.empty')}
            </div>
          ) : (
            <ul className="grid gap-3">
              <AnimatePresence initial={false}>
                {entries.map((entry, index) => (
                  <motion.li
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <EntryCard entry={entry} now={now} index={index} hidden={hidden} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          <p className="text-xs text-muted-foreground">{t('otp.utcNote')}</p>
        </section>
      </div>
    </ToolPage>
  );
}
