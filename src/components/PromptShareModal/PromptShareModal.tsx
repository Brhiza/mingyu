import { useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from '@/components/workspace/WorkspaceUI';
import { shareText } from '@/utils/share-text';
import { readPreferredAndroidAiApp } from '@/lib/android-ai-app';

export interface PromptShareModalProps {
  promptText: string;
  question?: string;
  methodName?: string;
  timeLabel?: string;
  onClose: () => void;
}

function formatDisplayTime(time?: string) {
  if (!time) return undefined;
  if (time.includes('T')) {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return time;
}

export function PromptShareModal({
  promptText,
  question,
  methodName,
  timeLabel,
  onClose,
}: PromptShareModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareMsg, setShareMsg] = useState<string>('');

  const preferredApp = readPreferredAndroidAiApp();
  const formattedTime = formatDisplayTime(timeLabel);

  async function handleCopy() {
    if (!promptText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = promptText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand('copy')) throw new Error('复制失败');
        } finally {
          textarea.remove();
        }
      }
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  }

  async function handleSystemShare() {
    if (!promptText) return;
    try {
      const result = await shareText(promptText);
      if (result.type === 'app') {
        setShareMsg(`已发送至 ${result.label}`);
      } else if (result.type === 'system') {
        setShareMsg('已调起系统分享');
      } else {
        await navigator.clipboard.writeText(promptText);
        setCopyState('copied');
        setShareMsg('已复制提示词，可直接粘贴分享');
      }
      setTimeout(() => setShareMsg(''), 3000);
    } catch {
      setShareMsg('分享遇到问题，请直接复制提示词');
      setTimeout(() => setShareMsg(''), 3000);
    }
  }

  return (
    <WorkspaceDialog
      className="prompt-share-dialog"
      labelledBy="prompt-share-dialog-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header prompt-share-header">
        <div>
          <h2 id="prompt-share-dialog-title">AI 解读提示词</h2>
          <p className="prompt-share-subtitle">查看、复制或分享本次占问的完整内容</p>
        </div>
        <button
          type="button"
          className="prompt-share-close-btn"
          onClick={onClose}
          aria-label="关闭分享卡片"
        >
          ✕
        </button>
      </header>

      <div className="workspace-ui-dialog-body prompt-share-body">
        <div className="prompt-share-card">
          <div className="share-card-header">
            <div className="share-card-brand">
              <span className="share-card-logo">命语</span>
              <span className="share-card-tag">完整解读提示词</span>
            </div>
            {methodName ? <span className="share-card-method">{methodName}</span> : null}
          </div>

          <div className="share-card-meta">
            {question ? (
              <div className="share-card-meta-row">
                <span className="meta-label">所问之事</span>
                <strong className="meta-value is-question">{question}</strong>
              </div>
            ) : null}
            {formattedTime ? (
              <div className="share-card-meta-row">
                <span className="meta-label">起课时间</span>
                <span className="meta-value">{formattedTime}</span>
              </div>
            ) : null}
          </div>

          <div className="share-card-prompt-container">
            <div className="prompt-container-head">
              <span>完整内容</span>
              <button type="button" className="prompt-quick-copy" onClick={handleCopy}>
                {copyState === 'copied'
                  ? '已复制'
                  : copyState === 'failed'
                    ? '复制失败，请重试'
                    : '复制全文'}
              </button>
            </div>
            <pre className="share-card-prompt-text">{promptText}</pre>
          </div>

          <div className="share-card-footer">
            <span className="footer-tip">复制后可粘贴到常用 AI 对话中继续解读</span>
          </div>
        </div>

        {shareMsg ? <div className="prompt-share-status-toast">{shareMsg}</div> : null}
      </div>

      <footer className="workspace-ui-dialog-footer prompt-share-footer">
        <WorkspaceButton
          variant="primary"
          size="medium"
          onClick={handleCopy}
          className="prompt-share-primary-btn"
        >
          {copyState === 'copied'
            ? '提示词已复制'
            : copyState === 'failed'
              ? '复制失败，请重试'
              : '复制提示词'}
        </WorkspaceButton>
        {typeof navigator !== 'undefined' &&
        /android|iphone|ipad|ipod/i.test(navigator.userAgent || '') ? (
          <WorkspaceButton
            size="medium"
            onClick={handleSystemShare}
            className="prompt-share-secondary-btn"
          >
            {preferredApp ? `发送至 ${preferredApp.label}` : '系统分享'}
          </WorkspaceButton>
        ) : null}
      </footer>
    </WorkspaceDialog>
  );
}
