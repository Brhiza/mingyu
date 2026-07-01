import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from '@/lib/marked-init';
import { useAiChat } from '@/hooks/useAiChat';
import type { ChatTurn } from '@/hooks/useAiChat';
import type { AiRequestConfig } from '@/lib/ai/settings';
import { safeStorage } from '@/lib/safe-storage';

interface AiChatPanelProps {
  /** AI 上下文提示（排盘数据 + 设置摘要，不含用户问题） */
  contextPrompt: string;
  /** 用于在 contextPrompt 变化时重置对话的 key */
  resetKey?: string;
  /** 问题灵感弹窗 */
  onOpenInspiration?: () => void;
  /** 外部设置输入框文本（如从灵感选取，填入后用户手动发送） */
  externalInput?: string;
  /** 外部输入已被使用的回调 */
  onExternalInputConsumed?: () => void;
  /** 直接发送文本（点击快捷按钮时立即发送，不经过输入框） */
  directSend?: { text: string; id: string };
  /** 自动发送的完整文本（占卜页：session.prompt 已含问题），首次或变化时自动发送 */
  autoStart?: string;
  /** autoStart 变化触发的 key（通常等于 autoStart） */
  autoStartKey?: string;
  /** AI 对话历史缓存 key；不传时根据 resetKey/contextPrompt 自动生成 */
  historyKey?: string;
  aiConfig?: AiRequestConfig;
}

const PLACEHOLDER = '输入你想询问的问题…';
const AI_CHAT_HISTORY_STORAGE_PREFIX = 'mingyu:ai-chat-history:v1:';

type SavedAiChatHistory = {
  turns: ChatTurn[];
  updatedAt: string;
};

function renderMarkdown(content: string): string {
  if (!content) return '';
  try {
    return marked.parse(content) as string;
  } catch {
    return content;
  }
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getAiChatStorageKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return `${AI_CHAT_HISTORY_STORAGE_PREFIX}${hashText(trimmed)}:${trimmed.length}`;
}

function normalizeSavedTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ChatTurn =>
      item &&
      typeof item === 'object' &&
      ((item as ChatTurn).role === 'user' || (item as ChatTurn).role === 'assistant') &&
      typeof (item as ChatTurn).content === 'string' &&
      (item as ChatTurn).content.length > 0,
  );
}

function readAiChatHistory(storageKey: string): SavedAiChatHistory | null {
  if (!storageKey) return null;
  const saved = safeStorage.getJSON<Partial<SavedAiChatHistory> | null>(storageKey, null);
  const turns = normalizeSavedTurns(saved?.turns);
  if (!turns.length) return null;
  return {
    turns,
    updatedAt: typeof saved?.updatedAt === 'string' ? saved.updatedAt : '',
  };
}

function writeAiChatHistory(storageKey: string, turns: ChatTurn[]) {
  if (!storageKey || !turns.length) return;
  safeStorage.setJSON<SavedAiChatHistory>(storageKey, {
    turns,
    updatedAt: new Date().toISOString(),
  });
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
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function AiChatPanelImpl({
  contextPrompt,
  resetKey,
  onOpenInspiration,
  externalInput,
  onExternalInputConsumed,
  directSend,
  autoStart,
  autoStartKey,
  historyKey,
  aiConfig,
}: AiChatPanelProps) {
  const { turns, streamingContent, status, error, hasStarted, analyze, ask, restore, reset } =
    useAiChat(aiConfig);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const isBusy = status === 'loading' || status === 'streaming';
  const isContextReady = contextPrompt.trim().length > 0;
  const storageKey = useMemo(
    () => getAiChatStorageKey(historyKey || `${resetKey || ''}\n${contextPrompt}`),
    [historyKey, resetKey, contextPrompt],
  );
  const directSendIdRef = useRef('');
  const autoStartKeyRef = useRef<string | undefined>(undefined);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当上下文变化时，优先恢复已保存的 AI 对话；没有历史才重置。
  useEffect(() => {
    const saved = readAiChatHistory(storageKey);
    const key = autoStartKey ?? autoStart;

    if (saved) {
      restore(saved.turns);
      autoStartKeyRef.current = key;
    } else {
      reset();
      autoStartKeyRef.current = undefined;
    }

    directSendIdRef.current = '';
    setInputValue('');
  }, [storageKey, autoStart, autoStartKey, restore, reset]);

  // AI 回复完成后保存历史；加载中不覆盖已有完整记录。
  useEffect(() => {
    if (!hasStarted || !turns.length || status === 'loading' || status === 'streaming') return;
    writeAiChatHistory(storageKey, turns);
  }, [hasStarted, turns, status, storageKey]);

  // 接收外部设置的输入文本（如从灵感选取，填入后用户手动发送）
  useEffect(() => {
    if (externalInput) {
      setInputValue(externalInput);
      inputRef.current?.focus();
      onExternalInputConsumed?.();
    }
  }, [externalInput, onExternalInputConsumed]);

  // 接收直接发送指令（快捷按钮 → 立即重置并发送，不经过输入框）
  useEffect(() => {
    if (!directSend || !directSend.text.trim() || directSend.id === directSendIdRef.current) return;
    directSendIdRef.current = directSend.id;
    const text = directSend.text.trim();
    if (!text || !isContextReady) return;
    // reset 会 abort 当前请求并清空对话
    safeStorage.remove(storageKey);
    reset();
    setInputValue('');
    // React 18 批处理：即使 reset 和 analyze 在同一帧调用，最终状态正确
    analyze(contextPrompt + '\n\n' + text);
  }, [directSend, isContextReady, contextPrompt, storageKey, analyze, reset]);

  // 自动发送首轮（占卜页：session.prompt 已含完整问题，无需用户输入）
  useEffect(() => {
    const key = autoStartKey ?? autoStart;
    if (!autoStart || !autoStart.trim() || key === autoStartKeyRef.current) return;

    // 延迟到下一 tick，让 resetKey effect 的状态更新先落地，
    // 同时避免 StrictMode 第一次挂载清理时误记为已发送。
    if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
    autoStartTimerRef.current = setTimeout(() => {
      autoStartTimerRef.current = null;
      if (key === autoStartKeyRef.current) return;
      autoStartKeyRef.current = key;
      reset();
      setInputValue('');
      analyze(autoStart.trim());
    }, 0);
    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
  }, [autoStart, autoStartKey, analyze, reset]);

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, streamingContent, status]);

  // 自动调整输入框高度
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isBusy || !isContextReady) return;

    setInputValue('');

    if (!hasStarted) {
      // 首次发送：context + 用户问题
      const fullPrompt = contextPrompt + '\n\n' + text;
      analyze(fullPrompt);
    } else {
      // 追问
      ask(text);
    }
  }, [inputValue, isBusy, isContextReady, hasStarted, contextPrompt, analyze, ask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  function handleReset() {
    safeStorage.remove(storageKey);
    reset();
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  return (
    <section className="panel panel-ai-chat">
      <div className="panel-head">
        <div>
          <h2>AI 解析</h2>
          <p>
            {!isContextReady
              ? '正在生成排盘数据，请稍候…'
              : hasStarted
                ? '可以继续追问，或点击重置开始新对话。'
                : '在下方输入问题开始 AI 解析。'}
          </p>
        </div>
        {hasStarted ? (
          <div className="action-row compact-actions">
            <button
              className="copy-button secondary-button"
              type="button"
              onClick={handleReset}
              disabled={isBusy}
            >
              重置
            </button>
          </div>
        ) : null}
      </div>

      {/* 消息区域 */}
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
              <div className="ai-chat-thinking" role="status" aria-live="polite">
                <span className="ai-chat-thinking-dot" />
                <span className="ai-chat-thinking-dot" />
                <span className="ai-chat-thinking-dot" />
                <span className="ai-chat-thinking-text">AI 正在思考</span>
              </div>
            </div>
          ) : null}

          {!hasStarted && !streamingContent && !error && isContextReady ? (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-inner">
                <div className="ai-chat-empty-icon">💬</div>
                <p>在下方输入你想了解的问题，AI 将基于排盘数据给出解读。</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* 底部输入区 */}
        <div className="ai-chat-input-area">
          <div className="ai-chat-input-row">
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDER}
              rows={1}
              disabled={!isContextReady}
            />
            {onOpenInspiration ? (
              <button
                className="ai-chat-inspire-btn"
                type="button"
                onClick={onOpenInspiration}
                title="问题灵感"
              >
                ✨
              </button>
            ) : null}
            <button
              className="ai-chat-send-btn"
              type="button"
              onClick={handleSend}
              disabled={isBusy || !inputValue.trim() || !isContextReady}
            >
              {isBusy ? (
                <span className="ai-analysis-spinner-wrap">
                  <span className="ai-analysis-spinner" />
                </span>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export const AiChatPanel = memo(AiChatPanelImpl);
