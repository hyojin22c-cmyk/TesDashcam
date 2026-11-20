import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

const Slider = ({
  className,
  'aria-label': label,
  ...props
}: SliderPrimitive.Root.Props<number>) => {
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn('w-full', className)} {...props}>
      <SliderPrimitive.Control className="relative flex h-5 w-full touch-none items-center select-none data-disabled:opacity-45">
        <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-accent">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          <SliderPrimitive.Thumb
            aria-label={label}
            className="size-4 rounded-full bg-foreground shadow-regular outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
};

export { Slider };
