import { For, Show } from '@jellybrick/react-solid-flow';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/atoms/button';
import { ScrollArea } from '@/components/atoms/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown-menu';
import { OptionSelect } from '@/components/molecules/option-select';
import { PanelHeader } from '@/components/molecules/panel-header';
import { ToggleGroup, ToggleGroupItem } from '@/components/molecules/toggle-group';
import { useLayoutMode } from '@/hooks/use-layout-mode';
import { LANGUAGE_NAMES, normalizeLang, setLanguage, SUPPORTED_LANGS } from '@/i18n';
import { FEEDBACK_URL, PC_REPO } from '@/lib/links';
import { openTutorial } from '@/studio/playback';
import { installApp, usePwa } from '@/studio/pwa';
import {
  openDialog,
  setStudioTheme,
  setViewMode,
  STUDIO_THEMES,
  useStudio,
  type ViewMode,
} from '@/studio/store';

import { LegalLinks } from './legal-links';
import { plainLabel } from './panel-tabs';
import { TierBadge, TierReason } from './tier-details';

import type { TranslationKey } from '@/i18n';
import type { ReactNode } from 'react';

const VIEW_MODES: { value: ViewMode; key: TranslationKey }[] = [
  { value: 'auto', key: 'view_auto' },
  { value: 'mobile', key: 'view_mobile' },
  { value: 'desktop', key: 'view_desktop' },
];

const Row = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-3">
      <span className="text-subtitle">{label}</span>
      {children}
    </div>
  );
};

const LinkRow = ({ label, onClick }: { label: string; onClick: () => void }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-md px-3 text-left text-subtitle transition-colors duration-400 ease-fade hover:bg-muted"
    >
      {label}
      <ChevronRight className="size-4 text-faint-foreground" />
    </button>
  );
};

const LanguageMenu = () => {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.language) ?? 'en';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="solid" size="sm" />}>
        {LANGUAGE_NAMES[lang]}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={lang}
          onValueChange={(value) => {
            const next = SUPPORTED_LANGS.find((candidate) => candidate === value);
            if (next) setLanguage(next).catch(reportError);
          }}
        >
          <For each={SUPPORTED_LANGS}>
            {(value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {LANGUAGE_NAMES[value]}
              </DropdownMenuRadioItem>
            )}
          </For>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SettingsPanel = () => {
  const { t } = useTranslation();
  const theme = useStudio((state) => state.theme);
  const viewMode = useStudio((state) => state.viewMode);
  const installed = usePwa((state) => state.installed);
  const desktop = useLayoutMode() === 'desktop';

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PanelHeader title={t('tab_settings')} />
      <ScrollArea className="flex-1">
        <Row label={plainLabel(t('label_lang'))}>
          <LanguageMenu />
        </Row>
        <Row label={t('label_theme')}>
          <OptionSelect
            label={t('label_theme')}
            value={theme}
            options={STUDIO_THEMES.map((value) => ({ value, label: t(`theme_${value}`) }))}
            onValueChange={setStudioTheme}
            className="w-auto min-w-28"
          />
        </Row>
        <Row label={t('settings_view_mode')}>
          <ToggleGroup
            value={[viewMode]}
            onValueChange={(values) => {
              const next = VIEW_MODES.find((item) => item.value === values[0]);
              if (next) setViewMode(next.value);
            }}
          >
            <For each={VIEW_MODES}>
              {({ value, key }) => (
                <ToggleGroupItem key={value} value={value}>
                  {t(key)}
                </ToggleGroupItem>
              )}
            </For>
          </ToggleGroup>
        </Row>
        <button
          type="button"
          onClick={() => openDialog('tier')}
          className="flex flex-col gap-1.5 rounded-md px-3 py-3 text-left transition-colors duration-400 ease-fade hover:bg-muted"
        >
          <span className="flex w-full items-center justify-between gap-4 text-subtitle">
            {t('settings_device')}
            <TierBadge />
          </span>
          <TierReason />
        </button>

        <h3 className="px-3 pt-8 pb-2 text-title text-muted-foreground">{t('settings_help')}</h3>
        <LinkRow label={t('tutorial_open')} onClick={openTutorial} />
        <Show when={desktop}>
          <LinkRow label={plainLabel(t('btn_hotkeys'))} onClick={() => openDialog('hotkeys')} />
        </Show>
        <Show when={!installed}>
          <Show
            when={desktop}
            fallback={<LinkRow label={t('add_home_title')} onClick={() => openDialog('install')} />}
          >
            <LinkRow label={t('btn_pc_install_text')} onClick={installApp} />
          </Show>
        </Show>

        <div className="flex flex-col gap-3 px-3 pt-8 pb-6">
          <p className="flex flex-wrap items-baseline gap-x-2 text-body">
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-attention hover:underline"
            >
              {t('feedback_link')}
            </a>
            <span className="text-faint-foreground">{t('feedback_login_note')}</span>
          </p>
          <a
            href={`${PC_REPO}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-body text-muted-foreground transition-colors duration-400 ease-fade hover:text-foreground"
          >
            {t('windows_version')}
          </a>
          <LegalLinks />
        </div>
      </ScrollArea>
    </section>
  );
};
