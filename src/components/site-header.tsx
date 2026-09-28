import { cn } from 'cn';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { TOOLS } from '@/tools/registry';

export function SiteHeader() {
  const { t } = useTranslation();
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="page-width flex h-14 items-center gap-4">
        <Link href="/" aria-label={t('header.home')} className="rounded-md">
          <Brand />
        </Link>
        <nav aria-label={t('header.tools')} className="ml-auto flex items-center gap-1">
          {TOOLS.map(({ id, path, icon: Icon }) => {
            const active = location === path;
            return (
              <Link
                key={id}
                href={path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  active && 'bg-muted text-foreground'
                )}
              >
                <Icon className={cn('size-4', active && 'text-brand')} />
                <span className="hidden md:inline">{t(`tools.${id}.title`)}</span>
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
