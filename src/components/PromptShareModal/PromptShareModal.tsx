import React, { useState } from 'react';
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
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
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
        setShareMsg(`已发送至 ${result.targetApp.label}`);
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
          <h2 id="prompt-share-dialog-title">AI 大师提示词 · 分享卡片</h2>
          <p className="prompt-share-subtitle">
            全量事实证据池与古典断诀已结构化封装，支持主流大语言模型
          </p>
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
        {/* 典雅的卡片视觉预览容器 */}
        <div className="prompt-share-card">
          <div className="share-card-header">
            <div className="share-card-brand">
              <span className="share-card-logo">命语</span>
              <span className="share-card-tag">AI 命理大师提示词</span>
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

          <div className="share-card-features">
            <span className="feature-chip">盘面证据全量注入</span>
            <span className="feature-chip">古籍断诀原典佐证</span>
            <span className="feature-chip">多步严密推演逻辑</span>
          </div>

          <div className="share-card-prompt-container">
            <div className="prompt-container-head">
              <span>完整提示词结构（可滚动预览）</span>
              <button type="button" className="prompt-quick-copy" onClick={handleCopy}>
                {copyState === 'copied' ? '已复制' : '复制全文'}
              </button>
            </div>
            <pre className="share-card-prompt-text">{promptText}</pre>
          </div>

          <div className="share-card-footer">
            <span className="footer-tip">
              复制后可发送给 <b>ChatGPT / Claude / DeepSeek / Gemini / 豆包 / Kimi</b>{' '}
              等任意大模型
            </span>
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
          {copyState === 'copied' ? '提示词已复制' : '复制大师提示词'}
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
