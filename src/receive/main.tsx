import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/index.css';
import { setupI18n } from '@/i18n';
import { preventZoom } from '@/lib/prevent-zoom';
import { ReceiveApp } from '@/receive/receive-app';
import { takeFragment } from '@/receive/take-fragment';

preventZoom();

// Read before React renders, so the fragment leaves the address bar as early as possible.
const fragment = takeFragment();

void setupI18n((t) => `${t('receive.pageTitle')} · ${t('brand.name')}`).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ReceiveApp initialEnvelope={fragment} />
    </StrictMode>
  );
});
