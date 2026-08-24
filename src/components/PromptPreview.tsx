import type { ReactNode } from 'react';
import { WorkspaceButton } from '@/components/workspace/WorkspaceUI';

interface PromptPreviewProps {
  promptText: string;
  fallback?: ReactNode;
  expandedByDefault?: boolean;
}

export function PromptPreview({
  promptText,
  fallback = null,
  expandedByDefault = false,
}: PromptPreviewProps) {
  return (
    <details className="workspace-prompt-preview" open={expandedByDefault}>
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
  showShare?: boolean;
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

function PromptActionButtons(props: {
  promptText: string;
  copyState: string;
  shareState: string;
  onCopy: () => void;
  onShare: () => void;
  showShare?: boolean;
}) {
  return (
    <div
      className={`workspace-prompt-delivery-actions${props.showShare === false ? ' is-single' : ''}`}
    >
      <WorkspaceButton
        className="workspace-prompt-delivery-button"
        variant="primary"
        size="large"
        disabled={!props.promptText}
        onClick={props.onCopy}
      >
        <CopyIcon />
        <span>{props.copyState}</span>
      </WorkspaceButton>
      {props.showShare === false ? null : (
        <WorkspaceButton
          className="workspace-prompt-delivery-button"
          size="large"
          disabled={!props.promptText}
          onClick={props.onShare}
        >
          <ShareIcon />
          <span>{props.shareState}</span>
        </WorkspaceButton>
      )}
    </div>
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
  showShare = true,
  expandedByDefault = false,
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
            <p>
              {showShare
                ? '选好问题后，复制并粘贴到常用 AI 对话中发送，也可以直接分享。'
                : '复制后粘贴到常用 AI 对话中发送。'}
            </p>
          </div>
        </div>

        <PromptActionButtons
          promptText={promptText}
          copyState={copyState}
          shareState={shareState}
          onCopy={onCopy}
          onShare={onShare}
          showShare={showShare}
        />
      </div>

      <PromptPreview
        promptText={promptText}
        fallback={fallback}
        expandedByDefault={expandedByDefault}
      />
    </section>
  );
}

interface PromptWorkbenchPanelProps extends PromptDeliveryPanelProps {
  children: ReactNode;
}

export function PromptWorkbenchPanel({
  promptText,
  fallback,
  copyState,
  shareState,
  onCopy,
  onShare,
  children,
}: PromptWorkbenchPanelProps) {
  return (
    <section className="workspace-ui-surface workspace-prompt-workbench">
      <div className="workspace-prompt-workbench-preview">
        <header className="workspace-prompt-workbench-head">
          <h2>提示词</h2>
          <small>内容会随问题和解读范围自动更新</small>
        </header>

        <div className="workspace-prompt-workbench-body" aria-live="polite">
          {promptText ? (
            <pre>{promptText}</pre>
          ) : (
            <div className="workspace-prompt-preview-loading">
              {fallback || <span>正在整理提问内容…</span>}
            </div>
          )}
        </div>

        <PromptActionButtons
          promptText={promptText}
          copyState={copyState}
          shareState={shareState}
          onCopy={onCopy}
          onShare={onShare}
        />
      </div>

      <div className="workspace-prompt-workbench-composer">{children}</div>
    </section>
  );
}
