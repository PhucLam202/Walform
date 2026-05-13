'use client';

import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { cn } from '@/lib/utils';

function RadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: Radio.Root.Props) {
  return (
    <Radio.Root
      data-slot="radio-group-item"
      className={cn(
        'relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input',
        'outline-none transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-checked:border-primary',
        className,
      )}
      {...props}
    >
      <Radio.Indicator
        className="flex items-center justify-center"
        render={(props) => (
          <span
            {...props}
            className={cn(
              'block size-2 rounded-full bg-primary opacity-0 transition-opacity',
              'data-checked:opacity-100',
            )}
          />
        )}
      />
    </Radio.Root>
  );
}

export { RadioGroup, RadioGroupItem };
