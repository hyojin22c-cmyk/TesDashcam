import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex h-[18px] w-fit shrink-0 items-center justify-center gap-1 rounded-sm px-1.5 text-fineprint font-semibold whitespace-nowrap typo-number',
  {
    variants: {
      variant: {
        default: 'bg-accent text-muted-foreground',
        attention: 'bg-attention text-attention-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Badge = ({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) => {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: 'badge', variant },
  });
};

export { Badge };
