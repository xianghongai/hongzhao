import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/index.css';
import { App } from '@/app';
import { setupI18n } from '@/i18n';

// The interface language loads first, so the page never flashes in another one.
void setupI18n((t) => `${t('brand.name')} · ${t('brand.tagline')}`).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
