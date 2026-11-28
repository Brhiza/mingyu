import * as React from 'react';
import { cn } from '../../lib/utils';

export const Slider = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, min = 0, max = 100, value, defaultValue, style, ...props }, ref) => {
  const numMin = Number(min);
  const numMax = Number(max);
  const numVal = value !== undefined ? Number(value) : Number(defaultValue ?? numMin);
  const span = numMax - numMin;
  const pct =
    span > 0 && Number.isFinite(numVal)
      ? Math.max(0, Math.min(100, ((numVal - numMin) / span) * 100))
      : 0;

  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      value={value}
      defaultValue={defaultValue}
      style={{ '--slider-pct': `${pct}%`, ...style } as React.CSSProperties}
      className={cn('ui-slider', className)}
      {...props}
    />
  );
});
Slider.displayName = 'Slider';
