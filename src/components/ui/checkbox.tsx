import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, id, ...props }, ref) => {
    const fallbackId = React.useId();
    const resolvedId = id ?? fallbackId;

    return (
      <label
        htmlFor={resolvedId}
        className={cn(
          'inline-flex w-fit cursor-pointer select-none items-center gap-2 text-xs text-[var(--text-secondary)]',
          props.disabled && 'cursor-not-allowed opacity-55',
          className,
        )}
      >
        <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={resolvedId}
            type="checkbox"
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex size-4 items-center justify-center rounded-[5px] border transition-colors duration-150',
              'border-[var(--border-contrast)] bg-[var(--surface-elevated-strong)] text-white',
              'peer-checked:border-[var(--accent-strong)] peer-checked:bg-[var(--accent-strong)]',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent-surface)]',
            )}
          >
            {checked ? <Check className="size-3 stroke-[2.75]" /> : null}
          </span>
        </span>
        {label ? <span>{label}</span> : null}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
