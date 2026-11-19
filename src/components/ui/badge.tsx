import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-full font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-muted)] text-[var(--text-secondary)] px-2.5 py-0.5 text-[11px]',
        accent:
          'bg-[var(--state-selected-surface)] text-[var(--state-selected-text)] px-2.5 py-0.5 text-[11px] font-bold',
        good: 'bg-[color-mix(in_srgb,var(--success-text)_11%,var(--surface-base))] text-[var(--success-text)] px-2.5 py-0.5 text-[11px]',
        warn: 'bg-[color-mix(in_srgb,var(--danger-text)_10%,var(--surface-base))] text-[var(--danger-text)] px-2.5 py-0.5 text-[11px]',
        outline:
          'border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-secondary)] px-2.5 py-0.5 text-[11.5px]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
