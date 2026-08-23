import type { ReactNode } from 'react';
import { WorkspaceButton } from '@/components/workspace/WorkspaceUI';

interface PromptPreviewProps {
  promptText: string;
  fallback?: ReactNode;
}

export function PromptPreview({ promptText, fallback = null }: PromptPreviewProps) {
  return (
    <details className="workspace-prompt-preview">
      <summary className="workspace-prompt-preview-summary">
        <span>{promptText ? '查看完整提问内容' : '正在整理提问内容'}</span>
        <small>通常无需查看</small>
      </summary>
      <div className="workspace-prompt-preview-body" aria-live="polite">
        {promptText ? (
          <pre>{promptText}</pre>
        ) : (
          <div className="workspace-prompt-preview-loading">
            {fallback || <span>正在整理提问内容…</span>}
          </div>
        )}
      </div>
    </details>
  );
}

interface PromptDeliveryPanelProps extends PromptPreviewProps {
  copyState: string;
  shareState: string;
  onCopy: () => void;
  onShare: () => void;
  question?: string;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </svg>
  );
}

export function PromptDeliveryPanel({
  promptText,
  fallback,
  copyState,
  shareState,
  onCopy,
  onShare,
  question,
}: PromptDeliveryPanelProps) {
  return (
    <section className="workspace-ui-surface workspace-prompt-delivery">
      {question ? (
        <div className="workspace-prompt-current-question">
          <span>本次问题</span>
          <strong>{question}</strong>
        </div>
      ) : null}

      <div className="workspace-prompt-delivery-main">
        <div className="workspace-prompt-delivery-copy">
          <span className="workspace-prompt-delivery-mark" aria-hidden="true">
            问
          </span>
          <div>
            <h2>发送给 AI 解读</h2>
            <p>选好问题后，复制并粘贴到常用 AI 对话中发送，也可以直接分享。</p>
          </div>
        </div>

        <div className="workspace-prompt-delivery-actions">
          <WorkspaceButton
            className="workspace-prompt-delivery-button"
            variant="primary"
            size="large"
            disabled={!promptText}
            onClick={onCopy}
          >
            <CopyIcon />
            <span>{copyState}</span>
          </WorkspaceButton>
          <WorkspaceButton
            className="workspace-prompt-delivery-button"
            size="large"
            disabled={!promptText}
            onClick={onShare}
          >
            <ShareIcon />
            <span>{shareState}</span>
          </WorkspaceButton>
        </div>
      </div>

      <PromptPreview promptText={promptText} fallback={fallback} />
    </section>
  );
}
