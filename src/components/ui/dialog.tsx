import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root modal={modal} {...props} />;
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[1600] bg-[var(--backdrop-scrim)] backdrop-blur-[3px]',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
    layer?: 'base' | 'nested';
  }
>(
  (
    {
      className,
      children,
      showClose = true,
      layer = 'base',
      onEscapeKeyDown,
      onInteractOutside,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 bg-[var(--backdrop-scrim)] backdrop-blur-[3px]',
          layer === 'nested' ? 'z-[1700]' : 'z-[1600]',
        )}
      />
      <div
        className={cn(
          'fixed inset-0 flex items-center justify-center p-3 sm:p-5',
          layer === 'nested' ? 'z-[1710]' : 'z-[1610]',
        )}
      >
        <DialogPrimitive.Content
          ref={ref}
          onEscapeKeyDown={onEscapeKeyDown}
          onInteractOutside={onInteractOutside}
          className={cn(
            'relative flex max-h-[90dvh] w-full max-w-[740px] flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-primary)] shadow-[var(--shadow-lg)] focus:outline-none',
            className,
          )}
          {...props}
        >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="关闭窗口"
            className="absolute top-3.5 right-3.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-1 border-b border-[var(--border-soft)] px-5 py-4 pr-12',
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('m-0 font-sans text-base font-extrabold text-[var(--text-strong)]', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('m-0 text-xs text-[var(--text-muted)]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border-soft)] px-5 py-3.5',
        className,
      )}
      {...props}
    />
  );
}
