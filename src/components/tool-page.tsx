import type { LucideIcon } from 'lucide-react';

interface ToolPageProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  /** Usage notes shown beside the title, such as a `HelpPopover`. */
  help?: React.ReactNode;
  /** Tool-wide actions, such as clearing, shown at the right of the title. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ToolPage({ icon: Icon, title, description, help, actions, children }: ToolPageProps) {
  return (
    <div className="py-8 sm:py-10">
      <header className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
        <div className="grid gap-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {help}
          </div>
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** A small callout for notes and warnings inside tool pages. */
export function Note({
  tone = 'info',
  icon: Icon,
  children,
}: {
  tone?: 'info' | 'warning';
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === 'warning'
          ? 'flex gap-2.5 rounded-lg bg-brand/10 p-3 text-sm text-foreground'
          : 'flex gap-2.5 rounded-lg bg-muted p-3 text-sm text-muted-foreground'
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
      <div className="grid gap-1 text-pretty">{children}</div>
    </div>
  );
}
