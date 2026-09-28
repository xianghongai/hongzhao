import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Suspense } from 'react';
import { Redirect, Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';

/**
 * Hash routing that matches only the path before `?`, so `#/share?public_key=…` still opens `/share`.
 * Parameters stay in the fragment, which never reaches a server; tools read them with `hashParams()`.
 */
const useHashPath = Object.assign(
  (options?: Parameters<typeof useHashLocation>[0]): ReturnType<typeof useHashLocation> => {
    const [location, navigate] = useHashLocation(options);
    return [location.split('?')[0] ?? location, navigate];
  },
  // Links render as `#/path`, as with the plain hash hook.
  { hrefs: (href: string) => `#${href}` }
);

import { PwaPrompt } from '@/components/pwa-prompt';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Home } from '@/tools/home';
import { TOOLS } from '@/tools/registry';

function Routes() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <Suspense fallback={<div className="min-h-96" />}>
          <Switch location={location}>
            <Route path="/" component={Home} />
            {TOOLS.map(({ id, path, component }) => (
              <Route key={id} path={path} component={component} />
            ))}
            <Route>
              <Redirect to="/" replace />
            </Route>
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <Router hook={useHashPath}>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="page-width flex-1">
              <Routes />
            </main>
            <SiteFooter />
          </div>
        </Router>
        <Toaster position="bottom-center" />
        <PwaPrompt />
      </TooltipProvider>
    </MotionConfig>
  );
}
