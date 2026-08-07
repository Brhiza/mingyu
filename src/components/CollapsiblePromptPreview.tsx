import type { ReactNode } from 'react';

interface CollapsiblePromptPreviewProps {
  promptText: string;
  fallback?: ReactNode;
}

export function CollapsiblePromptPreview({
  promptText,
  fallback = null,
}: CollapsiblePromptPreviewProps) {
  return (
    <details className="prompt-preview-details">
      <summary>{promptText ? '查看提示词内容' : '正在整理提示词'}</summary>
      {promptText ? <pre className="result-pre">{promptText}</pre> : fallback}
    </details>
  );
}
