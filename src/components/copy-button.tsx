import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';

type ButtonProps = React.ComponentProps<typeof Button>;

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  value: string;
  label?: string;
  /** Names what was copied in the confirmation toast. */
  what?: string;
}

export function CopyButton({ value, label = '复制', what = '内容', variant = 'outline', ...props }: CopyButtonProps) {
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
      toast.success(`已复制${what}`);
    } else {
      toast.error('复制失败，请手动选择后复制');
    }
  };

  return (
    <Button variant={variant} onClick={copy} disabled={value === ''} {...props}>
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {label}
    </Button>
  );
}
