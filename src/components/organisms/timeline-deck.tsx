import { For, Show } from '@jellybrick/react-solid-flow';
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/atoms/button';
import { Switch } from '@/components/atoms/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown-menu';
import { TimelineTrack } from '@/components/molecules/timeline-track';
import { useLayoutMode } from '@/hooks/use-layout-mode';
import { cn } from '@/lib/utils';
import { nextClip, prevClip, seekTo, setPlaybackSpeed, togglePlay } from '@/studio/playback';
import {
  activeRangeOverlay,
  formatTimecode,
  rangeSummary,
  resetRange,
  setInPoint,
  setOutPoint,
} from '@/studio/range';
import { getStudio, setAutoNext, useStudio } from '@/studio/store';

import { plainLabel } from './panel-tabs';

const PREVIEW_SPEEDS = [0.5, 1, 1.2, 1.5, 2, 2.5, 3, 4];

const Scrubber = () => {
  const { t } = useTranslation();
  const currentTimeSec = useStudio((state) => state.currentTimeSec);
  const durationSec = useStudio((state) => state.durationSec);
  const range = useStudio(useShallow(activeRangeOverlay));
  const exporting = useStudio((state) => state.exportProgress !== null);
  return (
    <div className="flex items-center gap-3 text-body typo-number">
      <span className="w-14 shrink-0">{formatTimecode(currentTimeSec)}</span>
      <TimelineTrack
        label={t('tip_play_main')}
        valueText={`${formatTimecode(currentTimeSec)} / ${formatTimecode(durationSec)}`}
        hoverText={(ratio) => formatTimecode(ratio * durationSec)}
        progress={durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0}
        range={range}
        disabled={exporting}
        onSeek={(ratio) => seekTo(ratio * getStudio().durationSec)}
        className="flex-1"
      />
      <span className="w-14 shrink-0 text-right text-muted-foreground">
        {formatTimecode(durationSec)}
      </span>
    </div>
  );
};

const Transport = () => {
  const { t } = useTranslation();
  const playing = useStudio((state) => state.isPlaying);
  const exporting = useStudio((state) => state.exportProgress !== null);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="quiet"
        size="icon"
        aria-label={t('tip_prev_clip')}
        title={t('tip_prev_clip')}
        onClick={() => {
          prevClip().catch(reportError);
        }}
      >
        <SkipBack />
      </Button>
      <Button
        size="icon-round"
        aria-label={t('tip_play_main')}
        title={t('tip_play_main')}
        disabled={exporting}
        onClick={togglePlay}
      >
        <Show when={playing} fallback={<Play className="translate-x-px fill-current" />}>
          <Pause className="fill-current" />
        </Show>
      </Button>
      <Button
        variant="quiet"
        size="icon"
        aria-label={t('tip_next_clip')}
        title={t('tip_next_clip')}
        onClick={() => {
          nextClip().catch(reportError);
        }}
      >
        <SkipForward />
      </Button>
    </div>
  );
};

const RangeControls = () => {
  const { t } = useTranslation();
  const compact = useLayoutMode() !== 'desktop';
  const summary = useStudio((state) => rangeSummary(state, t));
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5',
        compact ? 'order-last basis-full' : 'flex-1',
      )}
    >
      <Button variant="solid" size="sm" title={t('tip_set_in')} onClick={setInPoint}>
        {plainLabel(t('btn_in'))}
      </Button>
      <Button variant="solid" size="sm" title={t('tip_set_out')} onClick={setOutPoint}>
        {plainLabel(t('btn_out'))}
      </Button>
      <Button variant="solid" size="sm" title={t('tip_reset_range')} onClick={resetRange}>
        {plainLabel(t('btn_reset'))}
      </Button>
      <span className="min-w-0 truncate pl-1 text-body text-muted-foreground">{summary}</span>
    </div>
  );
};

const SpeedMenu = () => {
  const { t } = useTranslation();
  const speed = useStudio((state) => state.options.playbackSpeed);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="solid"
            size="sm"
            aria-label={t('lbl_speed')}
            title={t('tip_restore_speed')}
          />
        }
        onDoubleClick={() => setPlaybackSpeed(1)}
      >
        <span className="typo-number">{speed}x</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-28">
        <DropdownMenuRadioGroup
          value={speed}
          onValueChange={(value: number) => setPlaybackSpeed(value)}
        >
          <For each={PREVIEW_SPEEDS}>
            {(value) => (
              <DropdownMenuRadioItem key={value} value={value} className="typo-number">
                {value}x
              </DropdownMenuRadioItem>
            )}
          </For>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AutoNext = () => {
  const { t } = useTranslation();
  const autoNext = useStudio((state) => state.autoNext);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-body text-muted-foreground">
      <Switch checked={autoNext} onCheckedChange={setAutoNext} />
      {t('chk_auto_next')}
    </label>
  );
};

export const TimelineDeck = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Scrubber />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Transport />
        <RangeControls />
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <SpeedMenu />
          <AutoNext />
        </div>
      </div>
    </div>
  );
};
