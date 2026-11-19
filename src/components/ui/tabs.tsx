import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  extraClass?: string;
}

export interface SegmentedTabsProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<TabOption<T>>;
  ariaLabel?: string;
  className?: string;
  itemClassName?: string;
  fullWidthOnMobile?: boolean;
}

/**
 * 统一「分段标签条」原语（对应 `.workspace-ui-tabs > .workspace-ui-tab` 单一视觉规范）。
 */
export function SegmentedTabs<T extends string = string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  itemClassName,
  fullWidthOnMobile = false,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-fit justify-self-start self-start min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-[11px] bg-[var(--state-idle-surface)] p-[3px] [scrollbar-width:none]',
        fullWidthOnMobile && 'max-md:w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(opt.id)}
            className={cn(
              'workspace-ui-tab min-h-[34px] px-3 rounded-[8px] border-0 font-sans text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors duration-150 focus-visible:outline-none',
              fullWidthOnMobile
                ? 'flex-none max-sm:flex-1 max-sm:px-1.5 max-sm:text-[12px] max-sm:text-center'
                : 'flex-none',
              active
                ? 'is-active bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)]'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--state-hover-surface)]',
              opt.extraClass,
              itemClassName,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
