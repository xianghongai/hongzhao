import { CircleHelpIcon } from 'lucide-react';

import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';

export interface HelpSection {
  title: string;
  items: React.ReactNode[];
}

/** A help icon that shows short usage notes on hover, or on tap where there is no hover. */
export function HelpPopover({ title, sections }: { title: string; sections: HelpSection[] }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label={title}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-brand"
      >
        <CircleHelpIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-4 sm:w-md">
        <PopoverTitle className="text-base">{title}</PopoverTitle>
        {sections.map((section) => (
          <section key={section.title} className="grid gap-1.5">
            <h3 className="font-medium text-brand">{section.title}</h3>
            <ul className="grid list-disc gap-1 pl-4 text-muted-foreground marker:text-muted-foreground/60">
              {section.items.map((item, index) => (
                <li key={index} className="text-pretty">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </PopoverContent>
    </Popover>
  );
}
