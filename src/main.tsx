import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Toaster } from '@/components/molecules/sonner';
import { TooltipProvider } from '@/components/molecules/tooltip';
import { StudioPage } from '@/components/pages/studio-page';
import { watchLayoutMode } from '@/studio/layout-mode';
import { applyStudioTheme } from '@/studio/store';

const showEditorAfterLaunch = (app: HTMLElement) => {
  const launch = document.getElementById('preview-launch');
  const title = launch?.querySelector('.preview-launch-title');
  if (!launch || !title || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  app.inert = true;
  const observer = new MutationObserver(() => {
    observer.disconnect();
    const reveal = async () => {
      try {
        await Promise.allSettled(title.getAnimations().map((animation) => animation.finished));
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          await launch.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease' })
            .finished;
        }
      } finally {
        launch.remove();
        app.inert = false;
      }
    };
    reveal().catch(reportError);
  });
  observer.observe(app, { childList: true });
};

const root = document.getElementById('app');
if (root) {
  document.documentElement.toggleAttribute('data-iphone', /iPhone/i.test(navigator.userAgent));
  applyStudioTheme();
  watchLayoutMode();
  showEditorAfterLaunch(root);
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
