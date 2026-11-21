import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { Toaster } from '@/components/molecules/sonner';
import { TooltipProvider } from '@/components/molecules/tooltip';
import { StudioPage } from '@/components/pages/studio-page';
import { watchLayoutMode } from '@/studio/layout-mode';
import { applyStudioTheme } from '@/studio/store';

const root = document.getElementById('app');
if (root) {
  applyStudioTheme();
  watchLayoutMode();
  createRoot(root).render(
    <StrictMode>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <StudioPage />
          </TooltipProvider>
        </MotionConfig>
      </LazyMotion>
      <Toaster position="top-center" />
    </StrictMode>,
  );
}
