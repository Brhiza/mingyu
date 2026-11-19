import * as React from 'react';

interface WorkspaceErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class WorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode },
  WorkspaceErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): WorkspaceErrorBoundaryState {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : '页面渲染时遇到意外问题。';
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown): void {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[Mingyu ErrorBoundary]', error);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  private handleGoHome = (): void => {
    try {
      window.history.pushState(null, '', '/');
    } catch {
      // ignore history errors
    }
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--surface-base, #f7f4ee)',
          color: 'var(--text-strong, #2c241b)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            borderRadius: '16px',
            border: '1px solid var(--border-soft, rgba(120, 96, 70, 0.18))',
            background: 'var(--surface-elevated-strong, #fffdf9)',
            padding: '28px 24px',
            boxShadow: '0 10px 30px rgba(32, 24, 16, 0.08)',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>
            当前页面遇到了一点小问题
          </h2>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'var(--text-secondary, #6b5d4d)',
            }}
          >
            您的本地个人档案、历史记录和设置均已安全保存在浏览器中，不会丢失。您可以点击下方按钮恢复页面。
          </p>
          <div
            style={{
              marginBottom: '18px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--surface-soft, #f3ede2)',
              fontSize: '12px',
              color: 'var(--text-secondary, #6b5d4d)',
              wordBreak: 'break-word',
            }}
          >
            错误摘要：{this.state.message}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent, #8b4a2b)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              重新加载当前视图
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-soft, rgba(120, 96, 70, 0.24))',
                background: 'transparent',
                color: 'inherit',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              返回首页
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-soft, rgba(120, 96, 70, 0.24))',
                background: 'transparent',
                color: 'inherit',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              刷新整个页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
