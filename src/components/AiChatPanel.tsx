import { memo, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import { useAiChat } from '@/hooks/useAiChat';
import type { AiChatStatus } from '@/hooks/useAiChat';
import type { ChatTurn } from '@/hooks/useAiChat';

// 配置 marked：启用 GFM 和换行转换
marked.setOptions({
  breaks: true,
  gfm: true,
});

interface AiChatPanelProps {
  /** 完整的提示词文本（不展示给用户，仅发送给 AI） */
  prompt: string;
  /** 用于在提示词变化时重置对话的 key */
  resetKey?: string;
}

function analyzeButtonLabel(status: AiChatStatus): string {
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
      return '开始解析';
  }
}

function renderMarkdown(content: string): string {
  if (!content) return '';
  try {
    return marked.parse(content) as string;
  } catch {
    return content;
  }
}

function ChatMessageItem({ turn }: { turn: ChatTurn }) {
  const html = useMemo(() => renderMarkdown(turn.content), [turn.content]);

  if (turn.role === 'user') {
    return (
      <div className="ai-chat-msg ai-chat-msg-user">
        <div className="ai-chat-msg-bubble">{turn.content}</div>
      </div>
    );
  }

  return (
    <div className="ai-chat-msg ai-chat-msg-assistant">
      <div className="ai-chat-msg-avatar">AI</div>
      <div
        className="ai-chat-msg-bubble markdown-body"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function AiChatPanelImpl({ prompt, resetKey }: AiChatPanelProps) {
  const { turns, streamingContent, status, error, hasStarted, analyze, reset } = useAiChat();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 当 resetKey 变化时重置对话
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, streamingContent, status]);

  const isBusy = status === 'loading' || status === 'streaming';
  const isPromptReady = prompt.trim().length > 0;

  function handleAnalyze() {
    if (isBusy || !isPromptReady) return;
    // reset 会清空 turns 和 hasStarted，analyze 会重新设置 hasStarted=true 并开始流式
    // React 18 批处理保证最终状态正确
    if (status === 'done' || status === 'error') {
      reset();
    }
    analyze(prompt);
  }

  return (
    <section className="panel panel-ai-chat">
      <div className="panel-head">
        <div>
          <h2>AI 解析</h2>
          <p>
            {hasStarted
              ? '如需询问其他问题，请在左侧重新选择/输入问题后再次解析。'
              : isPromptReady
                ? '选择好左侧来源、年限和问题后，点击下方按钮开始 AI 解析。'
                : '正在生成排盘数据，请稍候…'}
          </p>
        </div>
        <div className="action-row compact-actions">
          <button
            className={`copy-button ${isBusy || !isPromptReady ? 'is-disabled' : ''}`}
            type="button"
            onClick={handleAnalyze}
            disabled={isBusy || !isPromptReady}
          >
            {isBusy ? (
              <span className="ai-analysis-spinner-wrap">
                <span className="ai-analysis-spinner" />
                {analyzeButtonLabel(status)}
              </span>
            ) : (
              analyzeButtonLabel(status)
            )}
          </button>
        </div>
      </div>

      {hasStarted ? (
        <div className="ai-chat-container">
          <div className="ai-chat-messages" ref={scrollRef}>
            {error && !streamingContent ? (
              <div className="ai-analysis-error">
                <p>解析失败：{error}</p>
              </div>
            ) : null}

            {turns.map((turn, index) => (
              <ChatMessageItem key={index} turn={turn} />
            ))}

            {/* 流式生成中的助手消息 */}
            {streamingContent ? (
              <div className="ai-chat-msg ai-chat-msg-assistant">
                <div className="ai-chat-msg-avatar">AI</div>
                <div
                  className="ai-chat-msg-bubble markdown-body"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
                />
                <span className="ai-analysis-cursor" aria-hidden="true">
                  ▋
                </span>
              </div>
            ) : null}

            {/* loading 状态骨架屏 */}
            {status === 'loading' && !streamingContent ? (
              <div className="ai-chat-msg ai-chat-msg-assistant">
                <div className="ai-chat-msg-avatar">AI</div>
                <div className="ai-analysis-placeholder">
                  <span className="skeleton-block ai-analysis-skeleton-line" />
                  <span className="skeleton-block ai-analysis-skeleton-line ai-analysis-skeleton-line-long" />
                  <span className="skeleton-block ai-analysis-skeleton-line" />
                  <span className="skeleton-block ai-analysis-skeleton-line ai-analysis-skeleton-line-short" />
                  <span className="skeleton-block ai-analysis-skeleton-line" />
                </div>
              </div>
            ) : null}
          </div>

          {status === 'done' ? (
            <div className="ai-chat-hint">
              如需询问其他问题，请在左侧重新选择/输入问题后再次解析。
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ai-chat-empty">
          {isPromptReady ? (
            <p>点击「开始解析」按钮，AI 将根据你选择的排盘数据和问题给出解读。</p>
          ) : (
            <div className="ai-analysis-placeholder">
              <span className="skeleton-block ai-analysis-skeleton-line" />
              <span className="skeleton-block ai-analysis-skeleton-line ai-analysis-skeleton-line-long" />
              <span className="skeleton-block ai-analysis-skeleton-line" />
              <span className="skeleton-block ai-analysis-skeleton-line ai-analysis-skeleton-line-short" />
              <span className="skeleton-block ai-analysis-skeleton-line" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export const AiChatPanel = memo(AiChatPanelImpl);
