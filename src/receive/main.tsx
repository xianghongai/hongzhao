import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/index.css';
import { ReceiveApp } from '@/receive/receive-app';
import { takeFragment } from '@/receive/take-fragment';

// Read before React renders, so the fragment leaves the address bar as early as possible.
const fragment = takeFragment();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReceiveApp initialEnvelope={fragment} />
  </StrictMode>
);
