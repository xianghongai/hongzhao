import { LanguagesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { currentLanguage, switchLanguage } from '@/i18n';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '@/lib/language';

const ITEMS = LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }));

/** Lists every language in its own name, so it can be found whatever the page is showing. */
export function LanguageMenu() {
  // The hook re-renders this menu when the language changes.
  const { t } = useTranslation();
  const language = currentLanguage();

  return (
    <Select<Language>
      items={ITEMS}
      value={language}
      onValueChange={(next) => next !== null && void switchLanguage(next)}
    >
      <SelectTrigger
        aria-label={t('footer.language')}
        className="h-8 gap-1.5 border-none bg-transparent px-2 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted"
      >
        <LanguagesIcon className="size-4" />
        <span className="text-sm">{LANGUAGE_NAMES[language]}</span>
      </SelectTrigger>
      <SelectContent side="top" align="end" alignItemWithTrigger={false}>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value} lang={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
