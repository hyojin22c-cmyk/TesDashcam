import { Show } from '@jellybrick/react-solid-flow';
import { useDrag } from '@use-gesture/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/atoms/button';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Swap } from '@/components/atoms/swap';
import { PanelHeader } from '@/components/molecules/panel-header';
import { Sheet, SheetContent, SheetTitle } from '@/components/molecules/sheet';
import { useLayoutMode } from '@/hooks/use-layout-mode';
import { setStudio, useStudio } from '@/studio/store';

import { ClipSearchField, ClipSearchProvider, ClipSearchToggle } from './clip-search';
import { ClipTree } from './clip-tree';
import { FilesPicker, FolderPicker } from './folder-picker';

const EmptyClips = () => {
  const { t } = useTranslation();
  const mobile = useLayoutMode() !== 'desktop';
  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 px-3 pt-2 pb-4">
        <p className="text-subtitle text-muted-foreground">{t('empty_state')}</p>
        <FolderPicker />
        <Show when={mobile}>
          <FilesPicker />
        </Show>
      </div>
    </ScrollArea>
  );
};

const expand = () => setStudio({ explorerExpanded: true });
const collapse = () => setStudio({ explorerExpanded: false });

const useSwipe = () =>
  useDrag(
    ({ last, movement: [, dy] }) => {
      if (!last) return;
      if (dy < -25) expand();
      else if (dy > 25) collapse();
    },
    { pointer: { touch: true, keys: false } },
  );

const ClipsSheet = () => {
  const { t } = useTranslation();
  const open = useStudio((state) => state.explorerExpanded && state.folderGroups.length > 0);
  const swipe = useSwipe();
  return (
    <Sheet open={open} onOpenChange={(next) => setStudio({ explorerExpanded: next })}>
      <SheetContent
        side="bottom"
        className="bottom-[calc(54px+max(6px,env(safe-area-inset-bottom)))] h-[85dvh] px-2"
      >
        <div {...swipe()} className="flex flex-col">
          <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-faint-foreground" />
          <div className="flex items-center justify-between">
            <SheetTitle className="px-3 py-2 text-head1">{t('drawer_clips')}</SheetTitle>
            <div className="flex items-center pr-1">
              <ClipSearchToggle />
              <FilesPicker compact />
              <Button
                variant="quiet"
                size="icon"
                aria-label={t('sheet_collapse')}
                onClick={collapse}
              >
                <ChevronDown />
              </Button>
            </div>
          </div>
        </div>
        <ClipSearchField />
        <ClipTree scrollToActive />
      </SheetContent>
    </Sheet>
  );
};

const ClipsPanelBody = () => {
  const { t } = useTranslation();
  const hasClips = useStudio((state) => state.folderGroups.length > 0);
  const portrait = useLayoutMode() === 'portrait';
  const headerSwipe = useSwipe();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div {...(portrait ? headerSwipe() : {})}>
        <PanelHeader title={t('drawer_clips')}>
          <Show when={hasClips}>
            <ClipSearchToggle />
            <FolderPicker compact />
            <FilesPicker compact />
            <Show when={portrait}>
              <Button variant="quiet" size="icon" aria-label={t('drag_expand')} onClick={expand}>
                <ChevronUp />
              </Button>
            </Show>
          </Show>
        </PanelHeader>
      </div>
      <ClipSearchField />
      <Swap id={hasClips ? 'clips' : 'empty'} className="flex min-h-0 flex-1 flex-col">
        <Show when={hasClips} fallback={<EmptyClips />}>
          <ClipTree />
        </Show>
      </Swap>
      <Show when={portrait}>
        <ClipsSheet />
      </Show>
    </section>
  );
};

export const ClipsPanel = () => (
  <ClipSearchProvider>
    <ClipsPanelBody />
  </ClipSearchProvider>
);
