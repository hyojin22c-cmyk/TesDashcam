import { Show } from '@jellybrick/react-solid-flow';
import { useTranslation } from 'react-i18next';

import { ActiveIndicator } from '@/components/atoms/active-indicator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/molecules/tooltip';
import { cn } from '@/lib/utils';
import { setStudio, useStudio } from '@/studio/store';

import { PANEL_TABS } from './panel-tabs';
import { StudioBrandLink } from './studio-brand-link';

export const NavRail = () => {
  const { t } = useTranslation();
  const active = useStudio((state) => state.panelTab);
  const items = PANEL_TABS.map(({ tab, icon: Icon, labelKey }) => (
    <Tooltip key={tab}>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={t(labelKey)}
            aria-current={active === tab ? 'page' : undefined}
            onClick={() => setStudio({ panelTab: tab })}
            className={cn(
              'relative flex size-11 items-center justify-center rounded-md outline-none transition-colors duration-400 ease-fade focus-visible:ring-2 focus-visible:ring-primary',
              active === tab
                ? 'text-foreground'
                : 'text-faint-foreground hover:text-muted-foreground',
            )}
          />
        }
      >
        <Show when={active === tab}>
          <ActiveIndicator layoutId="nav-rail-active" className="rounded-md" />
        </Show>
        <Icon className="relative size-6" strokeWidth={1.75} />
      </TooltipTrigger>
      <TooltipContent side="right">{t(labelKey)}</TooltipContent>
    </Tooltip>
  ));
  const settings = items.pop();

  return (
    <nav className="m-3 flex w-[60px] shrink-0 flex-col justify-between rounded-lg bg-secondary p-2 shadow-regular">
      <div className="flex flex-col gap-1">
        <StudioBrandLink
          className="mb-3 flex size-11 items-center justify-center"
          logoClassName="size-8"
        />
        {items}
      </div>
      {settings}
    </nav>
  );
};
