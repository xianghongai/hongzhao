import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { setTheme, useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const label = theme === 'dark' ? t('header.toLight') : t('header.toDark');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        }
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
