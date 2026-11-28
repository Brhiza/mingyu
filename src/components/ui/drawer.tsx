import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Drawer = DialogPrimitive.Root;
export const DrawerClose = DialogPrimitive.Close;

function isSelectMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-ui-select-menu="true"]'));
}

export const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onInteractOutside, onPointerDownOutside, onFocusOutside, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="ws-fade-in fixed inset-0 z-[1490] bg-[rgba(24,18,12,0.28)] backdrop-blur-[1px]" />
    <DialogPrimitive.Content
      ref={ref}
      onPointerDownOutside={(e) => {
        if (isSelectMenuTarget(e.target)) {
          e.preventDefault();
          return;
        }
        onPointerDownOutside?.(e);
      }}
      onFocusOutside={(e) => {
        if (isSelectMenuTarget(e.target)) {
          e.preventDefault();
          return;
        }
        onFocusOutside?.(e);
      }}
      onInteractOutside={(e) => {
        if (isSelectMenuTarget(e.target)) {
          e.preventDefault();
          return;
        }
        onInteractOutside?.(e);
      }}
      className={cn(
        'ws-drawer-in fixed top-3 right-3 bottom-3 z-[1500] flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-primary)] shadow-[var(--shadow-lg)] focus:outline-none max-sm:top-2 max-sm:right-2 max-sm:bottom-2 max-sm:left-2 max-sm:w-auto',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = 'DrawerContent';

export function DockedSidePanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        'ws-drawer-in fixed top-[74px] right-4 z-[1200] flex max-h-[calc(100dvh-90px)] w-[320px] flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-primary)] shadow-[0_2px_12px_rgba(32,24,16,0.04)]',
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function DrawerHeader({
  className,
  children,
  actions,
  onClose,
  isDocked = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  actions?: React.ReactNode;
  onClose?: () => void;
  isDocked?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-start justify-between gap-2.5 border-b border-[var(--border-soft)] px-4 py-3.5',
        className,
      )}
      {...props}
    >
      <div className="grid min-w-0 gap-0.5">{children}</div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {isDocked ? (
          <button
            type="button"
            aria-label="收起右侧面板"
            onClick={onClose}
            className="workspace-right-drawer-close inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <DialogPrimitive.Close
            aria-label="收起抽屉"
            className="workspace-right-drawer-close inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)]"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </div>
    </div>
  );
}

export function PanelTitle({
  className,
  isDocked = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & { isDocked?: boolean }) {
  const cls = cn('m-0 font-sans text-base font-extrabold text-[var(--text-strong)]', className);
  return isDocked ? (
    <h2 className={cls} {...props} />
  ) : (
    <DialogPrimitive.Title className={cls} {...props} />
  );
}

export function PanelDescription({
  className,
  isDocked = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & { isDocked?: boolean }) {
  const cls = cn('m-0 text-xs text-[var(--text-muted)]', className);
  return isDocked ? (
    <p className={cls} {...props} />
  ) : (
    <DialogPrimitive.Description className={cls} {...props} />
  );
}

export const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('m-0 font-sans text-base font-extrabold text-[var(--text-strong)]', className)}
    {...props}
  />
));
DrawerTitle.displayName = 'DrawerTitle';

export const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('m-0 text-xs text-[var(--text-muted)]', className)}
    {...props}
  />
));
DrawerDescription.displayName = 'DrawerDescription';
