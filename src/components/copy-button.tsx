import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';

type ButtonProps = React.ComponentProps<typeof Button>;

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  label?: string;
  /** The confirmation toast, naming what was copied, such as “Link copied”. */
  done?: string;
}

export function CopyButton({ value, label, done, variant = 'outline', ...props }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      toast.success(done ?? t('common.copied'));
    } else {
      toast.error(t('common.copyFailed'));
    }
  };

  return (
    <Button variant={variant} onClick={copy} disabled={value === ''} {...props}>
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {label ?? t('common.copy')}
    </Button>
  );
}
