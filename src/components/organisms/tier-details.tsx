import { For, Show } from '@jellybrick/react-solid-flow';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/atoms/badge';
import { getDeviceTierReason, getDevicePolicy, type DeviceTier } from '@/core/capability';
import { isDevDeployment } from '@/lib/platform';

import type { TranslationKey } from '@/i18n';

const TIERS: { tier: DeviceTier; name: TranslationKey; key: TranslationKey }[] = [
  { tier: 'High', name: 'tier_high_name', key: 'tier_high_desc' },
  { tier: 'Mid', name: 'tier_mid_name', key: 'tier_mid_desc' },
  { tier: 'Low', name: 'tier_low_name', key: 'tier_low_desc' },
];

export const TierBadge = () => {
  const { t } = useTranslation();
  const { tier } = getDevicePolicy();
  const name = TIERS.find((item) => item.tier === tier)?.name ?? 'tier_mid_name';
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <Badge variant="attention">{t('tier_badge', { level: t(name) })}</Badge>
      <Show when={isDevDeployment()}>
        <Badge>DEV</Badge>
      </Show>
    </span>
  );
};

export const TierReason = () => {
  const { t } = useTranslation();
  return (
    <p className="text-body text-muted-foreground">
      {getDeviceTierReason(getDevicePolicy().specs, t)}
    </p>
  );
};

export const TierDetails = () => {
  const { t } = useTranslation();
  const { tier: current } = getDevicePolicy();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-title">{t('tier_section_reason')}</h3>
        <TierReason />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-title">{t('tier_section_types')}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-body">
          <For each={TIERS}>
            {({ tier, name, key }) => (
              <div key={tier} className="contents">
                <dt
                  className={
                    tier === current ? 'font-semibold text-attention' : 'text-muted-foreground'
                  }
                >
                  {t(name)}
                </dt>
                <dd className={tier === current ? 'text-foreground' : 'text-muted-foreground'}>
                  {t(key)}
                </dd>
              </div>
            )}
          </For>
        </dl>
      </section>
    </div>
  );
};
