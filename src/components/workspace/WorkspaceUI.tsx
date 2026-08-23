import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

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
  return (
    <div
      className={joinClassNames('workspace-ui-dialog-backdrop', backdropClassName)}
      onClick={onClose}
    >
      <div
        className={joinClassNames('workspace-ui-dialog', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type WorkspaceSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div';
};

export function WorkspaceSurface({
  as: Element = 'section',
  className,
  ...props
}: WorkspaceSurfaceProps) {
  return <Element {...props} className={joinClassNames('workspace-ui-surface', className)} />;
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
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3Z" />
        <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      </svg>
      <span>AI</span>
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
        <header className="workspace-ui-page-header">
          {title ? <h1>{title}</h1> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </div>
  );
}
