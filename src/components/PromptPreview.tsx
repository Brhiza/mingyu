import type { ReactNode } from 'react';

interface PromptPreviewProps {
  promptText: string;
  fallback?: ReactNode;
}

export function PromptPreview({ promptText, fallback = null }: PromptPreviewProps) {
  return (
    <div className="workspace-prompt-preview" aria-live="polite">
      {promptText ? (
        <pre>{promptText}</pre>
      ) : (
        <div className="workspace-prompt-preview-loading">
          {fallback || <span>正在整理提示词…</span>}
        </div>
      )}
    </div>
  );
}
