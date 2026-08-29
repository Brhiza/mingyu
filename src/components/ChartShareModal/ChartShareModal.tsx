import React, { useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from '@/components/workspace/WorkspaceUI';
import { shareText } from '@/utils/share-text';
import { readPreferredAndroidAiApp } from '@/lib/android-ai-app';

export interface ChartShareModalProps {
  chartTitle: string;
  chartMethodName?: string;
  chartText: string;
  question?: string;
  timeLabel?: string;
  extraMeta?: Array<{ label: string; value: string }>;
  onClose: () => void;
}

export function ChartShareModal({
  chartTitle,
  chartMethodName,
  chartText,
  question,
  timeLabel,
  extraMeta,
  onClose,
}: ChartShareModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareMsg, setShareMsg] = useState<string>('');

  const preferredApp = readPreferredAndroidAiApp();

  async function handleCopy() {
    if (!chartText) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(chartText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = chartText;
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
    if (!chartText) return;
    try {
      const result = await shareText(chartText);
      if (result.type === 'app') {
        setShareMsg(`已发送至 ${result.targetApp.label}`);
      } else if (result.type === 'system') {
        setShareMsg('已调起系统分享');
      } else {
        await navigator.clipboard.writeText(chartText);
        setCopyState('copied');
        setShareMsg('已复制排盘信息，可直接粘贴分享');
      }
      setTimeout(() => setShareMsg(''), 3000);
    } catch {
      setShareMsg('分享遇到问题，请直接复制排盘');
      setTimeout(() => setShareMsg(''), 3000);
    }
  }

  return (
    <WorkspaceDialog
      className="chart-share-dialog"
      labelledBy="chart-share-dialog-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header chart-share-header">
        <div>
          <h2 id="chart-share-dialog-title">排盘分享卡片</h2>
          <p className="chart-share-subtitle">{chartTitle} · 完整排盘与干支盘面信息</p>
        </div>
        <button
          type="button"
          className="chart-share-close-btn"
          onClick={onClose}
          aria-label="关闭分享卡片"
        >
          ✕
        </button>
      </header>

      <div className="workspace-ui-dialog-body chart-share-body">
        <div className="chart-share-card">
          <div className="chart-share-card-head">
            <div className="chart-share-card-brand">
              <span className="chart-share-card-logo">命语</span>
              <span className="chart-share-card-tag">{chartMethodName || chartTitle}</span>
            </div>
            {timeLabel ? <span className="chart-share-card-time">{timeLabel}</span> : null}
          </div>

          {question ? (
            <div className="chart-share-meta-row is-question-row">
              <span className="meta-label">所问之事</span>
              <strong className="meta-value">{question}</strong>
            </div>
          ) : null}

          {extraMeta && extraMeta.length > 0 ? (
            <div className="chart-share-meta-grid">
              {extraMeta.map((item) => (
                <div className="chart-share-meta-item" key={item.label}>
                  <span className="meta-label">{item.label}</span>
                  <span className="meta-value">{item.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="chart-share-content-container">
            <div className="chart-share-content-head">
              <span>排盘明细</span>
              <button type="button" className="chart-quick-copy" onClick={handleCopy}>
                {copyState === 'copied' ? '已复制' : '复制排盘'}
              </button>
            </div>
            <pre className="chart-share-content-text">{chartText}</pre>
          </div>
        </div>

        {shareMsg ? <div className="chart-share-status-toast">{shareMsg}</div> : null}
      </div>

      <footer className="workspace-ui-dialog-footer chart-share-footer">
        <WorkspaceButton
          variant="primary"
          size="medium"
          onClick={handleCopy}
          className="chart-share-primary-btn"
        >
          {copyState === 'copied' ? '排盘已复制' : '复制排盘内容'}
        </WorkspaceButton>
        <WorkspaceButton
          size="medium"
          onClick={handleSystemShare}
          className="chart-share-secondary-btn"
        >
          {preferredApp ? `发送至 ${preferredApp.label}` : '分享排盘'}
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}
