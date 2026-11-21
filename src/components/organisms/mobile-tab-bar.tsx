import { For, Show } from '@jellybrick/react-solid-flow';
import { useTranslation } from 'react-i18next';

import { ActiveIndicator } from '@/components/atoms/active-indicator';
import { cn } from '@/lib/utils';
import { getStudio, type PanelTab, setStudio, useStudio } from '@/studio/store';

import { PANEL_TABS } from './panel-tabs';

const selectTab = (tab: PanelTab) => {
  const { panelTab, explorerExpanded } = getStudio();
  setStudio({
    panelTab: tab,
    explorerExpanded: tab === 'clips' && panelTab === 'clips' && !explorerExpanded,
  });
};

export const MobileTabBar = () => {
  const { t } = useTranslation();
  const active = useStudio((state) => state.panelTab);
  return (
    <nav className="grid shrink-0 grid-cols-4 gap-1 bg-secondary px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]">
      <For each={PANEL_TABS}>
        {({ tab, icon: Icon, labelKey }) => (
          <button
            key={tab}
            type="button"
            aria-current={active === tab ? 'page' : undefined}
            onClick={() => selectTab(tab)}
            className={cn(
              'relative flex h-12 flex-col items-center justify-center gap-1 rounded-md text-fineprint font-semibold transition-colors duration-400 ease-fade',
              active === tab ? 'text-foreground' : 'text-faint-foreground',
            )}
          >
            <Show when={active === tab}>
              <ActiveIndicator layoutId="mobile-tab-active" className="rounded-md" />
            </Show>
            <Icon className="relative size-5" strokeWidth={1.75} />
            <span className="relative">{t(labelKey)}</span>
          </button>
        )}
      </For>
    </nav>
  );
};
