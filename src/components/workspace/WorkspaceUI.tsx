import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { registerDismissLayer } from '@/lib/dismiss-layer';

let dialogScrollLockCount = 0;

function lockDocumentScroll() {
  dialogScrollLockCount += 1;
  document.body.classList.add('has-workspace-dialog');

  return () => {
    dialogScrollLockCount = Math.max(0, dialogScrollLockCount - 1);
    if (dialogScrollLockCount === 0) document.body.classList.remove('has-workspace-dialog');
  };
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type WorkspaceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  block?: boolean;
};

export function WorkspaceButton({
  variant = 'secondary',
  size = 'medium',
  block = false,
  className,
  type = 'button',
  ...props
}: WorkspaceButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={joinClassNames(
        'workspace-ui-button',
        `is-${variant}`,
        `is-${size}`,
        block && 'is-block',
        className,
      )}
    />
  );
}

type WorkspaceDialogProps = {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  backdropClassName?: string;
  labelledBy?: string;
};

export function WorkspaceDialog({
  children,
  onClose,
  className,
  backdropClassName,
  labelledBy,
}: WorkspaceDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const unlockDocumentScroll = lockDocumentScroll();
    const unregisterDismissLayer = onCloseRef.current
      ? registerDismissLayer(() => {
          onCloseRef.current?.();
        })
      : undefined;

    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      unregisterDismissLayer?.();
      unlockDocumentScroll();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div
      className={joinClassNames('workspace-ui-dialog-backdrop', backdropClassName)}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={joinClassNames('workspace-ui-dialog', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type WorkspaceConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function WorkspaceConfirmDialog({
  title,
  message,
  confirmLabel = '确认删除',
  onConfirm,
  onClose,
}: WorkspaceConfirmDialogProps) {
  return (
    <WorkspaceDialog
      className="workspace-confirm-dialog"
      labelledBy="workspace-confirm-dialog-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header">
        <h2 id="workspace-confirm-dialog-title">{title}</h2>
      </header>
      <div className="workspace-ui-dialog-body workspace-confirm-dialog-body">
        <p>{message}</p>
      </div>
      <footer className="workspace-ui-dialog-footer">
        <WorkspaceButton onClick={onClose}>取消</WorkspaceButton>
        <WorkspaceButton variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}

type WorkspaceSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div';
  variant?: 'surface' | 'plain';
};

export function WorkspaceSurface({
  as: Element = 'section',
  variant = 'surface',
  className,
  ...props
}: WorkspaceSurfaceProps) {
  return (
    <Element
      {...props}
      className={joinClassNames(
        'workspace-ui-surface',
        variant === 'plain' && 'is-plain',
        className,
      )}
    />
  );
}

type ResultAssistantHeaderProps = {
  aiEnabled: boolean;
  subtitle: string;
  onBack: () => void;
};

export function ResultAssistantHeader({ aiEnabled, subtitle, onBack }: ResultAssistantHeaderProps) {
  return (
    <div className="workspace-result-assistant-head">
      <WorkspaceButton size="small" onClick={onBack}>
        ← 返回盘面
      </WorkspaceButton>
      <div>
        <h1>{aiEnabled ? 'AI 解读' : '提示词'}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

type ResultAssistantFabProps = {
  aiEnabled: boolean;
  onOpen: () => void;
};

export function ResultAssistantFab({ aiEnabled, onOpen }: ResultAssistantFabProps) {
  const label = aiEnabled ? '打开 AI 解读' : '打开提示词';
  return (
    <button
      type="button"
      className="workspace-result-ai-fab"
      onClick={onOpen}
      aria-label={label}
      title={aiEnabled ? 'AI 解读' : '提示词'}
    >
      <span>AI</span>
    </button>
  );
}

type ResultShareFabProps = {
  disabled?: boolean;
  onShare: () => void;
};

export function ResultShareFab({ disabled = false, onShare }: ResultShareFabProps) {
  return (
    <button
      type="button"
      className="workspace-result-share-fab"
      disabled={disabled}
      onClick={onShare}
      aria-label="分享完整提问内容"
      title="分享"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
      </svg>
    </button>
  );
}

type WorkspacePageProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  action?: ReactNode;
  width?: 'narrow' | 'default' | 'wide';
  children: ReactNode;
};

export function WorkspacePage({
  title,
  action,
  width = 'default',
  className,
  children,
  ...props
}: WorkspacePageProps) {
  return (
    <div {...props} className={joinClassNames('workspace-ui-screen', `is-${width}`, className)}>
      {title || action ? (
        <header className={`workspace-ui-page-header${action ? ' has-action' : ''}`}>
          {title ? <h1>{title}</h1> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </div>
  );
}
