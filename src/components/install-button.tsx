import { MonitorDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { install, useCanInstall } from '@/lib/install';

/** Shown only where the browser offers installation; elsewhere the browser's own menu does it. */
export function InstallButton() {
  const canInstall = useCanInstall();
  if (!canInstall) {
    return null;
  }
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void install()}>
      <MonitorDownIcon data-icon="inline-start" />
      安装到本机
    </Button>
  );
}
