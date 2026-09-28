import { InstallButton } from '@/components/install-button';
import { PrivacyDialog } from '@/components/privacy-dialog';
import { repositoryUrl } from '@/lib/site';

export function SiteFooter() {
  const repo = repositoryUrl();

  return (
    <footer className="page-width flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-muted-foreground">
      <PrivacyDialog />
      <div className="flex items-center gap-4">
        <InstallButton />
        {repo && (
          <a href={repo} rel="noreferrer" className="transition-colors hover:text-foreground">
            源码
          </a>
        )}
      </div>
    </footer>
  );
}
