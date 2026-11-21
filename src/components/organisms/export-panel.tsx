import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/atoms/button';
import { Progress } from '@/components/atoms/progress';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { OptionSelect } from '@/components/molecules/option-select';
import { PanelHeader } from '@/components/molecules/panel-header';
import { RESOLUTIONS, type ResolutionName } from '@/core/constants';
import { resolveVideoEncoderConfig } from '@/core/encoder-config';
import { isMobileDevice } from '@/lib/platform';
import {
  cancelExport,
  EXPORT_SPEEDS,
  estimateSizeMb,
  fpsOptions,
  setExportSpeed,
  startExport,
} from '@/studio/export';
import { rangeSummary } from '@/studio/range';
import { setStudio, useStudio } from '@/studio/store';

import { plainLabel } from './panel-tabs';

import type { TranslationKey } from '@/i18n';
import type { ReactNode } from 'react';

const SPEED_LABEL_KEYS: Record<(typeof EXPORT_SPEEDS)[number], TranslationKey> = {
  0.5: 'speed_05',
  1: 'speed_10',
  1.5: 'speed_15',
  2: 'speed_20',
  4: 'speed_40',
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-body text-muted-foreground">{label}</span>
      {children}
    </div>
  );
};

const ExportStatus = () => {
  const { t } = useTranslation();
  const status = useStudio((state) => state.exportStatus);
  const pct = useStudio((state) => state.exportProgress?.pct ?? 100);
  if (!status) return null;
  const text =
    status.key === 'status_error'
      ? `${t('status_error')}${status.detail ?? ''}`
      : t(status.key, status.params ?? {});
  return (
    <div className="flex flex-col gap-2">
      <Progress value={pct} aria-label={text} />
      <p
        className={
          status.key === 'status_error'
            ? 'text-body text-destructive'
            : 'text-body text-muted-foreground'
        }
      >
        {text}
      </p>
    </div>
  );
};

export const ExportPanel = () => {
  const { t } = useTranslation();
  const resolution = useStudio((state) => state.resolution);
  const speed = useStudio((state) => state.options.exportSpeed ?? 1);
  const fps = useStudio((state) => state.exportFps);
  const estimate = useStudio(estimateSizeMb);
  const [unsupported, setUnsupported] = useState('');
  const format = `${resolution}:${fps}`;
  useEffect(() => {
    if (!window.isSecureContext || typeof VideoEncoder === 'undefined') return;
    let active = true;
    resolveVideoEncoderConfig(resolution, fps)
      .then(({ supported }) => {
        if (active) setUnsupported(supported === false ? format : '');
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, [resolution, fps, format]);
  const summary = useStudio((state) => rangeSummary(state, t));
  const hasClip = useStudio((state) => state.activeClip !== null);
  const exporting = useStudio((state) => state.exportProgress !== null);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PanelHeader title={t('tab_export')} />
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 px-3 pb-6">
          <Field label={plainLabel(t('label_resolution'))}>
            <OptionSelect
              label={plainLabel(t('label_resolution'))}
              value={resolution}
              options={(Object.keys(RESOLUTIONS) as ResolutionName[]).map((value) => ({
                value,
                label: t(`res_${value}`),
              }))}
              onValueChange={(value) => setStudio({ resolution: value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={plainLabel(t('label_speed'))}>
              <OptionSelect
                label={plainLabel(t('label_speed'))}
                value={speed}
                options={EXPORT_SPEEDS.map((value) => ({
                  value,
                  label: t(SPEED_LABEL_KEYS[value]),
                }))}
                onValueChange={setExportSpeed}
              />
            </Field>
            <Field label={plainLabel(t('label_fps'))}>
              <OptionSelect
                label={plainLabel(t('label_fps'))}
                value={fps}
                options={fpsOptions(speed, isMobileDevice(), t)}
                onValueChange={(value) => setStudio({ exportFps: value })}
              />
            </Field>
          </div>
          <dl className="flex flex-col gap-1 px-1 text-body">
            <dt className="text-muted-foreground">{summary}</dt>
            <dd className="text-muted-foreground typo-number">
              {t('est_size_prefix')}
              {estimate.toFixed(1)} MB
            </dd>
          </dl>
          {(!window.isSecureContext ||
            typeof VideoEncoder === 'undefined' ||
            unsupported === format) && (
            <p className="px-1 text-body text-destructive">
              {t(window.isSecureContext ? 'encode_unsupported' : 'http_warning')}
            </p>
          )}
          <Button
            size="lg"
            variant={exporting ? 'secondary' : 'default'}
            disabled={!hasClip}
            onClick={() => {
              if (exporting) cancelExport();
              else startExport().catch(reportError);
            }}
          >
            {exporting ? t('btn_export_cancel') : t('btn_export')}
          </Button>
          <ExportStatus />
        </div>
      </ScrollArea>
    </section>
  );
};
