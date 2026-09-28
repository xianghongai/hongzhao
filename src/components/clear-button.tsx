import { EraserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

const UNDO_MS = 6000;

interface ClearButtonProps {
  /** Nothing to clear: the button stays visible but inactive. */
  disabled: boolean;
  /** Clears the tool and returns a function that puts everything back. */
  onClear: () => () => void;
}

/**
 * Clears everything a tool holds. Instead of asking first, it offers a short undo:
 * some of it, like 2FA secrets, lives only in memory and could not be recovered otherwise.
 */
export function ClearButton({ disabled, onClear }: ClearButtonProps) {
  const { t } = useTranslation();
  const clear = () => {
    const undo = onClear();
    toast(t('common.cleared'), { duration: UNDO_MS, action: { label: t('common.undo'), onClick: undo } });
  };

  return (
    <Button variant="destructive" size="sm" disabled={disabled} onClick={clear}>
      <EraserIcon data-icon="inline-start" />
      {t('common.clear')}
    </Button>
  );
}
