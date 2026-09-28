import { PlusIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type NamedSecret, splitLine, splitLines } from '@/lib/otp/entries';

export interface SecretRow extends NamedSecret {
  id: number;
  /** Why this row could not be added, shown under it until it is edited. */
  error?: string;
}

let nextRowId = 1;

export function emptyRow(values: NamedSecret = { name: '', secret: '' }): SecretRow {
  return { id: nextRowId++, ...values };
}

export function isBlank(row: NamedSecret): boolean {
  return row.name.trim() === '' && row.secret.trim() === '';
}

interface SecretRowsProps {
  rows: SecretRow[];
  onChange: (rows: SecretRow[]) => void;
  onSubmit: () => void;
  /** The row whose name field takes focus when it appears. */
  focusId: number | null;
  onAddRow: () => void;
}

export function SecretRows({ rows, onChange, onSubmit, focusId, onAddRow }: SecretRowsProps) {
  const { t } = useTranslation();
  const update = (id: number, patch: Partial<NamedSecret>) =>
    onChange(rows.map((row) => (row.id === id ? { id, name: row.name, secret: row.secret, ...patch } : row)));

  const remove = (id: number) => {
    const rest = rows.filter((row) => row.id !== id);
    onChange(rest.length > 0 ? rest : [emptyRow()]);
  };

  /**
   * Pasting several lines fans them out into rows, which keeps bulk entry possible;
   * a single `name, secret` line fills both fields of the row.
   */
  const paste = (row: SecretRow, event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    const pasted = splitLines(text);
    const single = pasted.length === 1 ? splitLine(text) : null;
    if (pasted.length > 1) {
      event.preventDefault();
      const [first, ...more] = pasted;
      const index = rows.findIndex((item) => item.id === row.id);
      const replaced = { id: row.id, name: first!.name || row.name, secret: first!.secret };
      onChange([
        ...rows.slice(0, index),
        replaced,
        ...more.map((values) => emptyRow(values)),
        ...rows.slice(index + 1),
      ]);
    } else if (single && single.name !== '' && row.name.trim() === '') {
      event.preventDefault();
      update(row.id, single);
    }
  };

  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex gap-2 text-sm font-medium" aria-hidden="true">
        <span className="w-28 shrink-0 sm:w-36">{t('otp.nameColumn')}</span>
        <span className="flex-1">{t('otp.secretColumn')}</span>
        <span className="w-7" />
      </div>

      {rows.map((row, index) => (
        <div key={row.id} className="grid gap-1">
          <div className="flex gap-2">
            <Input
              aria-label={t('otp.rowName', { row: index + 1 })}
              value={row.name}
              placeholder={t('otp.namePlaceholder')}
              autoFocus={row.id === focusId}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => update(row.id, { name: event.target.value })}
              onKeyDown={submitOnEnter}
              className="w-28 shrink-0 text-sm sm:w-36"
            />
            <Input
              aria-label={t('otp.rowSecret', { row: index + 1 })}
              aria-invalid={row.error ? true : undefined}
              value={row.secret}
              placeholder={t('otp.secretPlaceholder')}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(event) => update(row.id, { secret: event.target.value })}
              onPaste={(event) => paste(row, event)}
              onKeyDown={submitOnEnter}
              className="min-w-0 flex-1 font-mono text-xs"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('otp.removeRow', { row: index + 1 })}
              disabled={rows.length === 1 && isBlank(row)}
              onClick={() => remove(row.id)}
            >
              <XIcon />
            </Button>
          </div>
          {row.error && <p className="text-xs text-destructive">{row.error}</p>}
        </div>
      ))}

      <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={onAddRow}>
        <PlusIcon data-icon="inline-start" />
        {t('otp.addRow')}
      </Button>
    </div>
  );
}
