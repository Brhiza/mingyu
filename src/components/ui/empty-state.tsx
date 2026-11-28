import * as React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-8 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--surface-base)] text-[var(--text-muted)]">
          {icon}
        </div>
      ) : null}
      <p className="m-0 text-xs font-semibold text-[var(--text-muted)]">{title}</p>
      {action ? <div className="flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
