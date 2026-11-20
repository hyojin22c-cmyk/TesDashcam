import { For } from '@jellybrick/react-solid-flow';
import { Menu, X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/atoms/button';
import { Swap } from '@/components/atoms/swap';
import { Sheet, SheetContent, SheetTitle } from '@/components/molecules/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { type PanelTab, setStudio, useStudio } from '@/studio/store';

import { PANEL_TABS } from './panel-tabs';

import type { ReactNode } from 'react';

export const LandscapeDrawer = ({ panels }: { panels: Record<PanelTab, ReactNode> }) => {
  const { t } = useTranslation();
  const open = useStudio((state) => state.drawerOpen);
  const tab = useStudio((state) => state.panelTab);
  const touchStartX = useRef<number | null>(null);
  const setOpen = (drawerOpen: boolean) => setStudio({ drawerOpen });

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        aria-label={t('btn_drawer_menu')}
        className="fixed top-14 left-3 z-40 shadow-regular"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[360px] max-w-[86vw] gap-3 p-3"
          onTouchStart={(event) => {
            touchStartX.current = (event.target as Element).closest('[data-slot="slider"]')
              ? null
              : (event.touches[0]?.clientX ?? null);
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX;
            if (startX !== null && endX !== undefined && endX - startX < -40) setOpen(false);
          }}
        >
          <Tabs
            value={tab}
            onValueChange={(value: PanelTab) => setStudio({ panelTab: value })}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <SheetTitle className="sr-only">
                {t(PANEL_TABS.find((item) => item.tab === tab)?.labelKey ?? 'drawer_clips')}
              </SheetTitle>
              <TabsList className="flex-1">
                <For each={PANEL_TABS}>
                  {({ tab: value, labelKey }) => (
                    <TabsTrigger key={value} value={value}>
                      {t(labelKey)}
                    </TabsTrigger>
                  )}
                </For>
              </TabsList>
              <Button
                variant="quiet"
                size="icon-sm"
                aria-label={t('btn_close')}
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <TabsContent value={tab} className="flex min-h-0 flex-1 flex-col">
              <Swap id={tab} className="flex min-h-0 flex-1 flex-col">
                {panels[tab]}
              </Swap>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
};
