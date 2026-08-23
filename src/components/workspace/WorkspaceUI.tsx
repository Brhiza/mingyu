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
