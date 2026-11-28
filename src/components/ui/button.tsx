import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-all duration-150 active:scale-[0.985] cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent-strong)] text-[var(--accent-contrast)] border border-[var(--accent-strong)] hover:bg-[var(--accent-hover)] shadow-xs',
        secondary:
          'bg-[var(--surface-elevated-strong)] text-[var(--text-primary)] border border-[var(--border-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]',
        outline:
          'bg-transparent text-[var(--text-secondary)] border border-[var(--border-soft)] hover:text-[var(--text-strong)] hover:border-[var(--border-contrast)] hover:bg-[var(--surface-base)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)]',
        destructive:
          'bg-transparent text-[var(--danger-text)] border border-[color-mix(in_srgb,var(--danger-text)_28%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger-text)_8%,transparent)]',
        pill:
          'rounded-full bg-[var(--surface-base)] text-[var(--text-secondary)] border border-[var(--border-soft)] hover:border-[var(--border-strong)] hover:text-[var(--text-strong)]',
        pillActive:
          'rounded-full bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)] border border-[var(--accent)] font-bold',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-md',
        sm: 'h-8 px-3 text-xs rounded-lg',
        md: 'h-9 px-4 text-[13px] rounded-lg',
        lg: 'h-11 px-6 text-sm rounded-xl',
        icon: 'h-8 w-8 p-0 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
