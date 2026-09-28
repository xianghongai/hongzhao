import { cn } from 'cn';
import { Link, useLocation } from 'wouter';

import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { TOOLS } from '@/tools/registry';

export function SiteHeader() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="page-width flex h-14 items-center gap-4">
        <Link href="/" aria-label="回到首页" className="rounded-md">
          <Brand />
        </Link>
        <nav aria-label="工具" className="ml-auto flex items-center gap-1">
          {TOOLS.map(({ id, path, title, icon: Icon }) => {
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
                <span className="hidden md:inline">{title}</span>
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
