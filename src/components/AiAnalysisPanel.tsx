import { memo, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';
import type { AiAnalysisStatus } from '@/hooks/useAiAnalysis';

// 配置 marked：启用 GFM 和换行转换
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface AiAnalysisPanelProps {
  /** 完整的提示词文本 */
  prompt: string;
  /** 用于在提示词变化时重置 AI 状态的 key */
  resetKey?: string;
}

function statusButtonLabel(status: AiAnalysisStatus): string {
  switch (status) {
    case 'loading':
      return '正在连接…';
    case 'streaming':
      return '解析中…';
    case 'done':
      return '重新解析';
    case 'error':
      return '重试';
    default:
      return 'AI 解读';
  }
}

function AiAnalysisPanelImpl({ prompt, resetKey }: AiAnalysisPanelProps) {
  const { status, content, error, analyze, reset } = useAiAnalysis();

  // 当 resetKey 变化时重置 AI 状态
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const isBusy = status === 'loading' || status === 'streaming';
  const hasContent = content.length > 0;
  const showPanel = status !== 'idle';

  const renderedHtml = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content]);

  function handleClick() {
    if (isBusy) return;
    if (status === 'done' || status === 'error') {
      reset();
    }
    analyze(prompt);
  }

  if (!prompt.trim()) return null;

  return (
    <section className="panel panel-ai-analysis">
      <div className="panel-head">
        <div>
          <h2>AI 解读</h2>
          <p>基于上方提示词，由 DeepSeek 直接给出解读结果。</p>
        </div>
        <div className="action-row compact-actions">
          <button
            className={`copy-button ${isBusy ? 'is-disabled' : ''}`}
            type="button"
            onClick={handleClick}
            disabled={isBusy}
          >
            {isBusy ? (
              <span className="ai-analysis-spinner-wrap">
                <span className="ai-analysis-spinner" />
                {statusButtonLabel(status)}
              </span>
            ) : (
              statusButtonLabel(status)
            )}
          </button>
        </div>
      </div>

      {showPanel ? (
        <div className="ai-analysis-body">
          {error ? (
            <div className="ai-analysis-error">
              <p>解析失败：{error}</p>
            </div>
          ) : null}

          {status === 'loading' && !hasContent ? (
            <div className="ai-analysis-placeholder">
              <span className="skeleton-block ai-analysis-skeleton-line" />
              <span className="skeleton-block ai-analysis-skeleton-line ai-analysis-skeleton-line-long" />
              <span className="skeleton-block ai-analysis-skeleton-line" />
              <span className="skeleton-block ai-analysis-skeleton-line ai-analysis-skeleton-line-short" />
              <span className="skeleton-block ai-analysis-skeleton-line" />
            </div>
          ) : null}

          {hasContent ? (
            <div
              className="ai-analysis-content markdown-body"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : null}

          {status === 'streaming' ? (
            <span className="ai-analysis-cursor" aria-hidden="true">
              ▋
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const AiAnalysisPanel = memo(AiAnalysisPanelImpl);
