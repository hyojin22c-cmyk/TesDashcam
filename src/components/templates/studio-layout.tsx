import { Match, Switch } from '@jellybrick/react-solid-flow';
import { m } from 'motion/react';

import { Swap } from '@/components/atoms/swap';

import type { LayoutMode } from '@/studio/store';
import type { ReactNode } from 'react';

const transition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] } as const;

const Region = ({
  id,
  resize = false,
  className,
  children,
}: {
  id: string;
  resize?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <m.div
    layoutId={id}
    layout={resize ? true : 'position'}
    transition={transition}
    className={className}
  >
    {children}
  </m.div>
);

interface StudioLayoutProps {
  mode: LayoutMode;
  rail: ReactNode;
  header: ReactNode;
  viewport: ReactNode;
  deck: ReactNode;
  panelId: string;
  panel: ReactNode;
  tabBar: ReactNode;
  drawer: ReactNode;
}

export const StudioLayout = ({
  mode,
  rail,
  header,
  viewport,
  deck,
  panelId,
  panel,
  tabBar,
  drawer,
}: StudioLayoutProps) => {
  const swappedPanel = (
    <Swap id={panelId} className="flex min-h-0 flex-1 flex-col">
      {panel}
    </Swap>
  );
  return (
    <Switch>
      <Match when={mode === 'landscape'}>
        <div className="fixed inset-0 bg-black">
          <Region id="studio-viewport" resize className="absolute inset-0 flex">
            {viewport}
          </Region>
          <Region
            id="studio-header"
            className="absolute inset-x-0 top-0 z-30 bg-glass px-[max(16px,env(safe-area-inset-left))] py-2 backdrop-blur-large"
          >
            {header}
          </Region>
          <Region
            id="studio-deck"
            className="absolute inset-x-0 bottom-0 z-20 bg-glass px-[max(16px,env(safe-area-inset-left))] pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-large"
          >
            {deck}
          </Region>
          {drawer}
        </div>
      </Match>
      <Match when={mode === 'portrait'}>
        <div
          data-layout="portrait"
          className="group/studio flex h-dvh flex-col overflow-y-auto overscroll-y-contain"
        >
          <Region
            id="studio-header"
            className="shrink-0 px-4 pt-[var(--preview-header-top,max(6px,env(safe-area-inset-top)))] pb-1.5"
          >
            {header}
          </Region>
          <Region
            id="studio-viewport"
            resize
            className="flex aspect-video max-h-[28dvh] min-h-[22dvh] w-full"
          >
            {viewport}
          </Region>
          <Region id="studio-deck" className="shrink-0 bg-glass-subtle px-4 py-2">
            {deck}
          </Region>
          <Region
            id="studio-panel"
            className="flex min-h-[38dvh] flex-1 flex-col overflow-hidden px-1 pt-2"
          >
            {swappedPanel}
          </Region>
          <div className="sticky bottom-0 z-20 shrink-0">{tabBar}</div>
        </div>
      </Match>
      <Match when={mode === 'desktop'}>
        <div className="h-dvh overflow-x-auto">
          <div className="flex h-full min-w-[1100px]">
            {rail}
            <Region id="studio-panel" className="flex w-[340px] shrink-0 flex-col py-3 pr-3">
              {swappedPanel}
            </Region>
            <main className="flex min-w-0 flex-1 flex-col bg-glass-subtle">
              <Region id="studio-header" className="px-8 pt-7 pb-5">
                {header}
              </Region>
              <Region id="studio-viewport" resize className="flex min-h-0 flex-1 px-8">
                {viewport}
              </Region>
              <Region id="studio-deck" className="px-8 pt-4 pb-6">
                {deck}
              </Region>
            </main>
          </div>
        </div>
      </Match>
    </Switch>
  );
};
