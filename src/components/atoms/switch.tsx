import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '@/lib/utils';

const Switch = ({ className, ...props }: SwitchPrimitive.Root.Props) => {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-accent p-0.5 transition-colors duration-400 ease-fade outline-none focus-visible:ring-2 focus-visible:ring-primary data-checked:bg-switch-checked data-disabled:cursor-not-allowed data-disabled:opacity-45',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="size-5 rounded-full bg-foreground shadow-regular transition-transform duration-400 ease-spring data-checked:translate-x-4 data-checked:bg-switch-checked-thumb"
      />
    </SwitchPrimitive.Root>
  );
};

export { Switch };
