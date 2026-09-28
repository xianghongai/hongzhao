import { InstallButton } from '@/components/install-button';
import { LanguageMenu } from '@/components/language-menu';
import { PrivacyDialog } from '@/components/privacy-dialog';

export function SiteFooter() {
  return (
    <footer className="page-width flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-muted-foreground">
      <PrivacyDialog />
      <div className="flex items-center gap-4">
        <InstallButton />
        <LanguageMenu />
      </div>
    </footer>
  );
}
