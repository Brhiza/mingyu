import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './badge';
import { SegmentedTabs, type TabOption } from './tabs';

export interface PageHeaderProps<T extends string = string> {
  title: string;
  badgeText?: string;
  subtitle?: string;
  activeTab?: T;
  tabs?: ReadonlyArray<TabOption<T>>;
  tabsAriaLabel?: string;
  onTabChange?: (tab: T) => void;
  tabsClassName?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * 全站唯一标准化 React 页头组件：「左标题 · 右选项 / 操作区」。
 */
export function PageHeader<T extends string = string>({
  title,
  badgeText,
  subtitle,
  activeTab,
  tabs,
  tabsAriaLabel,
  onTabChange,
  tabsClassName,
  rightSlot,
  className,
}: PageHeaderProps<T>) {
  const hasTabs = Boolean(tabs && tabs.length > 0 && activeTab !== undefined && onTabChange);

  return (
    <header
      className={cn(
        'ws-page-header workspace-ui-page-header flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 sm:gap-y-3 border-0 bg-transparent p-0 mb-3.5',
        className,
      )}
    >
      <div className="ws-page-header-title-block order-1 grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="ws-page-title m-0 whitespace-nowrap font-sans text-[20px] sm:text-[clamp(21px,2vw,25px)] font-extrabold leading-tight tracking-[-0.02em] text-[var(--text-strong)]">
            {title}
          </h1>
          {badgeText ? (
            <Badge variant="outline" className="shrink-0 font-mono text-[11.5px]">
              {badgeText}
            </Badge>
          ) : null}
        </div>
        {subtitle ? (
          <p className="m-0 font-sans text-[13px] leading-normal text-[var(--text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {rightSlot ? (
        <div className="ws-page-header-actions order-2 flex shrink-0 items-center justify-end gap-2 sm:order-3">
          {rightSlot}
        </div>
      ) : null}

      {hasTabs && tabs && activeTab !== undefined && onTabChange ? (
        <div className="ws-page-header-tabs-wrap order-3 w-full max-w-full sm:order-2 sm:w-auto sm:flex sm:items-center sm:justify-end">
          <SegmentedTabs
            value={activeTab}
            onValueChange={onTabChange}
            options={tabs}
            ariaLabel={tabsAriaLabel}
            fullWidthOnMobile
            className={cn('ws-page-tabs', tabsClassName)}
          />
        </div>
      ) : null}
    </header>
  );
}

export interface SubPillBarProps<T extends string = string> {
  value: T;
  items: ReadonlyArray<TabOption<T>>;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SubPillBar<T extends string = string>({
  value,
  items,
  onValueChange,
  ariaLabel,
  className,
}: SubPillBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'ws-sub-pills -mt-1 mb-3 flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mb-3.5 md:flex-wrap md:overflow-visible md:pb-0',
        className,
      )}
    >
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              'workspace-tier2-method-pill h-8 px-3.5 rounded-full border font-sans text-[12.5px] whitespace-nowrap cursor-pointer transition-colors duration-150',
              active
                ? 'is-active border-[var(--accent-strong)] bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)] font-extrabold'
                : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-secondary)] font-semibold hover:border-[var(--border-contrast)] hover:text-[var(--text-strong)]',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
