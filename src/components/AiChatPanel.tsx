import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from '@/lib/marked-init';
import { useAiChat } from '@/hooks/useAiChat';
import type { ChatTurn } from '@/hooks/useAiChat';
import {
  buildAiChatInitialPrompt,
  createAiChatSessionId,
  createAiChatTitle,
  extractPromptQuestion,
  loadAiChatHistory,
  saveAiChatHistory,
  upsertAiChatSession,
} from '@/lib/ai/chat-history';
import type { AiChatPromptMode, AiChatSession } from '@/lib/ai/chat-history';
import type { AiRequestConfig } from '@/lib/ai/settings';

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
const AUTO_SCROLL_BOTTOM_THRESHOLD = 48;

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

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
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
  const {
    turns,
    streamingContent,
    status,
    error,
    hasStarted,
    analyze,
    ask,
    restore,
    retry,
    canRetry,
    reset,
  } = useAiChat(aiConfig);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [historySessions, setHistorySessions] = useState<AiChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const isBusy = status === 'loading' || status === 'streaming';
  const isContextReady = contextPrompt.trim().length > 0;
  const storageKey = useMemo(
    () => getAiChatStorageKey(historyKey || `${resetKey || ''}\n${contextPrompt}`),
    [historyKey, resetKey, contextPrompt],
  );
  const activeSession = useMemo(
    () => historySessions.find((session) => session.id === activeSessionId),
    [historySessions, activeSessionId],
  );
  const directSendIdRef = useRef('');
  const autoStartKeyRef = useRef<string | undefined>(undefined);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historySessionsRef = useRef<AiChatSession[]>([]);
  const activeSessionIdRef = useRef('');

  const applyHistoryState = useCallback(
    (sessions: AiChatSession[], nextActiveSessionId: string, persist = true) => {
      historySessionsRef.current = sessions;
      activeSessionIdRef.current = nextActiveSessionId;
      setHistorySessions(sessions);
      setActiveSessionId(nextActiveSessionId);
      if (persist) {
        saveAiChatHistory(storageKey, {
          sessions,
          activeSessionId: nextActiveSessionId,
        });
      }
    },
    [storageKey],
  );

  const startNewSession = useCallback(
    (options: {
      prompt: string;
      titleSource: string;
      initialQuestion?: string;
      promptMode: AiChatPromptMode;
    }) => {
      const now = new Date().toISOString();
      const session: AiChatSession = {
        id: createAiChatSessionId(),
        title: createAiChatTitle(options.titleSource, '自动解析'),
        initialQuestion: options.initialQuestion?.trim() ?? '',
        promptMode: options.promptMode,
        turns: [],
        createdAt: now,
        updatedAt: now,
      };
      const nextSessions = upsertAiChatSession(historySessionsRef.current, session);
      applyHistoryState(nextSessions, session.id);
      shouldAutoScrollRef.current = true;
      setIsHistoryOpen(false);
      reset();
      setInputValue('');
      analyze(options.prompt);
    },
    [analyze, applyHistoryState, reset],
  );

  // 当上下文变化时，恢复上次使用的会话，并自动兼容旧版单条历史。
  useEffect(() => {
    const saved = loadAiChatHistory(storageKey);
    const key = autoStartKey ?? autoStart;
    const activeSession = saved.sessions.find((session) => session.id === saved.activeSessionId);
    shouldAutoScrollRef.current = true;
    historySessionsRef.current = saved.sessions;
    activeSessionIdRef.current = activeSession?.id ?? '';
    setHistorySessions(saved.sessions);
    setActiveSessionId(activeSession?.id ?? '');
    setIsHistoryOpen(false);

    if (activeSession) {
      restore(activeSession.turns, buildAiChatInitialPrompt(contextPrompt, activeSession));
      autoStartKeyRef.current = key;
    } else {
      reset();
      autoStartKeyRef.current = undefined;
    }

    if (saved.sessions.length) {
      saveAiChatHistory(storageKey, saved);
    }

    directSendIdRef.current = '';
    setInputValue('');
  }, [storageKey, contextPrompt, autoStart, autoStartKey, restore, reset]);

  // AI 回复完成或出错后，更新当前会话，不覆盖其他历史。
  useEffect(() => {
    if (!hasStarted || (status !== 'done' && status !== 'error')) return;
    const sessionId = activeSessionIdRef.current;
    const currentSession = historySessionsRef.current.find((session) => session.id === sessionId);
    if (!currentSession || currentSession.turns === turns) return;
    const updatedSession: AiChatSession = {
      ...currentSession,
      turns,
      updatedAt: new Date().toISOString(),
    };
    applyHistoryState(
      upsertAiChatSession(historySessionsRef.current, updatedSession),
      updatedSession.id,
    );
  }, [applyHistoryState, hasStarted, turns, status]);

  // 接收外部设置的输入文本（如从灵感选取，填入后用户手动发送）
  useEffect(() => {
    if (externalInput) {
      setInputValue(externalInput);
      inputRef.current?.focus();
      onExternalInputConsumed?.();
    }
  }, [externalInput, onExternalInputConsumed]);

  // 接收直接发送指令（快捷按钮 → 新建会话并立即发送）
  useEffect(() => {
    if (!directSend || !directSend.text.trim() || directSend.id === directSendIdRef.current) return;
    directSendIdRef.current = directSend.id;
    const text = directSend.text.trim();
    if (!text || !isContextReady) return;
    startNewSession({
      prompt: contextPrompt + '\n\n' + text,
      titleSource: text,
      initialQuestion: text,
      promptMode: 'context-question',
    });
  }, [directSend, isContextReady, contextPrompt, startNewSession]);

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
      const question = extractPromptQuestion(autoStart);
      startNewSession({
        prompt: autoStart.trim(),
        titleSource: question,
        initialQuestion: question,
        promptMode: 'context',
      });
    }, 0);
    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
  }, [autoStart, autoStartKey, startNewSession]);

  // 仅在用户仍停留在底部时跟随流式内容；上滑阅读后暂停自动滚动。
  useEffect(() => {
    const el = scrollRef.current;
    if (el && shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, streamingContent, status]);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
  }, []);

  // 自动调整输入框高度
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    const shouldLockPageScroll = window.matchMedia(
      '(max-width: 640px), (max-width: 900px) and (max-height: 520px)',
    ).matches;
    const previousBodyOverflow = document.body.style.overflow;
    if (shouldLockPageScroll) document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHistoryOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (shouldLockPageScroll) document.body.style.overflow = previousBodyOverflow;
    };
  }, [isHistoryOpen]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isBusy || !isContextReady) return;

    shouldAutoScrollRef.current = true;
    setInputValue('');

    if (!hasStarted) {
      startNewSession({
        prompt: contextPrompt + '\n\n' + text,
        titleSource: text,
        initialQuestion: text,
        promptMode: 'context-question',
      });
    } else {
      // 追问
      ask(text);
    }
  }, [inputValue, isBusy, isContextReady, hasStarted, contextPrompt, startNewSession, ask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleRetry = useCallback(() => {
    if (!canRetry || isBusy) return;
    shouldAutoScrollRef.current = true;
    retry();
  }, [canRetry, isBusy, retry]);

  function handleNewChat() {
    if (isBusy) return;
    shouldAutoScrollRef.current = true;
    applyHistoryState(historySessionsRef.current, '');
    reset();
    setInputValue('');
    setIsHistoryOpen(false);
    inputRef.current?.focus();
  }

  function handleSelectSession(session: AiChatSession) {
    if (isBusy || session.id === activeSessionIdRef.current) {
      setIsHistoryOpen(false);
      return;
    }
    shouldAutoScrollRef.current = true;
    applyHistoryState(historySessionsRef.current, session.id);
    restore(session.turns, buildAiChatInitialPrompt(contextPrompt, session));
    setInputValue('');
    setIsHistoryOpen(false);
  }

  function handleDeleteSession(event: React.MouseEvent, sessionId: string) {
    event.stopPropagation();
    if (isBusy) return;
    const nextSessions = historySessionsRef.current.filter((session) => session.id !== sessionId);
    if (sessionId !== activeSessionIdRef.current) {
      applyHistoryState(nextSessions, activeSessionIdRef.current);
      return;
    }

    const nextActiveSession = nextSessions[0];
    applyHistoryState(nextSessions, nextActiveSession?.id ?? '');
    shouldAutoScrollRef.current = true;
    if (nextActiveSession) {
      restore(nextActiveSession.turns, buildAiChatInitialPrompt(contextPrompt, nextActiveSession));
    } else {
      reset();
    }
    setInputValue('');
  }

  return (
    <section className="panel panel-ai-chat">
      <div className="panel-head">
        <div>
          <h2>AI 解析</h2>
          <p>
            {!isContextReady
              ? '正在生成排盘数据，请稍候…'
              : status === 'error'
                ? '本次回复失败，你的问题已保留，可直接重新生成。'
                : hasStarted
                  ? '可以继续追问，历史对话会自动保存。'
                  : '在下方输入问题开始 AI 解析。'}
          </p>
        </div>
        <div className="action-row compact-actions ai-chat-head-actions">
          <div className="ai-chat-history-anchor">
            <button
              className="copy-button secondary-button"
              type="button"
              onClick={() => setIsHistoryOpen((open) => !open)}
              aria-expanded={isHistoryOpen}
              disabled={isBusy}
            >
              历史{historySessions.length ? ` ${historySessions.length}` : ''}
            </button>
            {isHistoryOpen ? (
              <div className="ai-chat-history-shell">
                <button
                  className="ai-chat-history-backdrop"
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  aria-label="关闭历史对话"
                />
                <aside
                  className="ai-chat-history-panel"
                  role="dialog"
                  aria-labelledby="ai-chat-history-title"
                >
                  <div className="ai-chat-history-head">
                    <div>
                      <strong id="ai-chat-history-title">历史对话</strong>
                      <span>最多保留 20 条</span>
                    </div>
                    <button
                      className="ai-chat-history-close"
                      type="button"
                      onClick={() => setIsHistoryOpen(false)}
                      aria-label="关闭历史对话"
                      title="关闭"
                    >
                      ×
                    </button>
                  </div>
                  {historySessions.length ? (
                    <div className="ai-chat-history-list">
                      {historySessions.map((session) => (
                        <div
                          className={`ai-chat-history-item${session.id === activeSessionId ? ' is-active' : ''}`}
                          key={session.id}
                        >
                          <button
                            className="ai-chat-history-main"
                            type="button"
                            onClick={() => handleSelectSession(session)}
                          >
                            <strong>{session.title}</strong>
                            <span>
                              {formatHistoryTime(session.updatedAt)}
                              {session.turns.length
                                ? ` · ${session.turns.length} 条消息`
                                : ' · 待完成'}
                            </span>
                          </button>
                          <button
                            className="ai-chat-history-delete"
                            type="button"
                            onClick={(event) => handleDeleteSession(event, session.id)}
                            aria-label={`删除对话：${session.title}`}
                            title="删除对话"
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ai-chat-history-empty">
                      暂无历史对话，完成一次解析后会自动保存。
                    </div>
                  )}
                </aside>
              </div>
            ) : null}
          </div>
          {hasStarted || activeSessionId ? (
            <button
              className="copy-button secondary-button"
              type="button"
              onClick={handleNewChat}
              disabled={isBusy}
            >
              新对话
            </button>
          ) : null}
        </div>
      </div>

      <div className="ai-chat-body">
        {/* 消息区域 */}
        <div className="ai-chat-container">
          <div className="ai-chat-messages" ref={scrollRef} onScroll={handleMessagesScroll}>
            {activeSession?.initialQuestion ? (
              <ChatMessageItem turn={{ role: 'user', content: activeSession.initialQuestion }} />
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
            {error ? (
              <div className="ai-chat-error-notice" role="alert" aria-live="assertive">
                <div className="ai-chat-error-content">
                  <strong>AI 回复失败</strong>
                  <span>{error}</span>
                  <small>你的问题已保留，不需要重新输入。</small>
                </div>
                {canRetry ? (
                  <button type="button" className="ai-chat-retry-btn" onClick={handleRetry}>
                    重新生成
                  </button>
                ) : null}
              </div>
            ) : null}
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
      </div>
    </section>
  );
}

export const AiChatPanel = memo(AiChatPanelImpl);
