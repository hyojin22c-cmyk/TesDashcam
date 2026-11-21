import { useTranslation } from 'react-i18next';

import { BrandLogo } from '@/components/atoms/brand-logo';
import { cn } from '@/lib/utils';

const previewSuffix = 'preview/pr-1/';
const base = import.meta.env.BASE_URL;
const originalStudio = base.endsWith(`/${previewSuffix}`)
  ? base.slice(0, -previewSuffix.length)
  : null;

export const StudioBrandLink = ({
  className,
  logoClassName,
}: {
  className?: string;
  logoClassName: string;
}) => {
  const { t } = useTranslation();
  const logo = <BrandLogo className={logoClassName} />;
  if (!originalStudio) return <span className={className}>{logo}</span>;

  return (
    <a
      href={originalStudio}
      aria-label={t('switch_to_original')}
      title={t('switch_to_original')}
      className={cn(
        'shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      {logo}
    </a>
  );
};
