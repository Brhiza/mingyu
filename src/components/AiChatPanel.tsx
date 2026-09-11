import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { marked } from '@/lib/marked-init';
import { useAiChat } from '@/hooks/useAiChat';
import type { ChatTurn } from '@/hooks/useAiChat';
import {
  buildAiChatInitialPrompt,
  createAiChatSessionId,
  createAiChatTitle,
  extractPromptQuestion,
  getAiChatCompletionStatus,
  loadAiChatHistory,
  saveAiChatHistory,
  upsertAiChatSession,
} from '@/lib/ai/chat-history';
import type { AiChatPromptMode, AiChatSession } from '@/lib/ai/chat-history';
import type { AiRequestConfig } from '@/lib/ai/settings';
import type { ReadingSubjectSnapshot } from '@/lib/ai/reading-subject';
import type { ReadingMemorySeed } from '@/lib/ai/reading-workflow';
import { registerDismissLayer } from '@/lib/dismiss-layer';
import { WorkspaceButton } from './workspace/WorkspaceUI';

interface AiChatPanelProps {
  /** AI 上下文提示（排盘数据 + 设置摘要，不含用户问题） */
  contextPrompt: string;
  /** 工作流首条提示；完整运限资料由 readingResourceSeed 发送，避免原文重复进入每个阶段。 */
  workflowPrompt?: string;
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
  /** 排盘解读工作台：上方只显示解答，工具与大输入框固定在底部 */
  workspaceMode?: boolean;
  /** 工作台输入框上方的业务工具，如问题灵感和解读年限 */
  composerTools?: ReactNode;
  /** 只在真正切换案例或命盘时清空未发送的输入 */
  inputResetKey?: string;
  /** 当前页面锁定的排盘主体，供自动补算校验使用 */
  readingSubject?: ReadingSubjectSnapshot;
  /** 当前页面锁定的占卜术式，随历史会话保存与恢复 */
  readingMethod?: string;
  /** 当前页面可复用的结构化盘面资源，仅接受与 readingSubject 匹配的种子。 */
  readingResourceSeed?: ReadingMemorySeed;
  /** 当前工作流必须等完整结构化资料就绪后才能发送。 */
  readingResourceRequired?: boolean;
  /** 完整结构化资料生成失败时的可重试提示。 */
  readingResourceError?: string;
  /** 重新生成失败的完整结构化资料。 */
  onRetryReadingResources?: () => void;
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
      <div className="ai-chat-msg-bubble">
        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        {turn.notices?.map((notice) => (
          <p className="ai-chat-workflow-notice" key={notice}>
            {notice}
          </p>
        ))}
      </div>
    </div>
  );
}

function AiChatPanelImpl({
  contextPrompt,
  workflowPrompt,
  resetKey,
  onOpenInspiration,
  externalInput,
  onExternalInputConsumed,
  directSend,
  autoStart,
  autoStartKey,
  historyKey,
  aiConfig,
  workspaceMode = false,
  composerTools,
  inputResetKey,
  readingSubject,
  readingMethod,
  readingResourceSeed,
  readingResourceRequired = false,
  readingResourceError,
  onRetryReadingResources,
}: AiChatPanelProps) {
  const {
    turns,
    streamingContent,
    status,
    error,
    progress,
    notices,
    hasStarted,
    analyze,
    ask,
    restore,
    retry,
    canRetry,
    reset,
    cancel,
  } = useAiChat(aiConfig, readingSubject, readingMethod, readingResourceSeed);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [historySessions, setHistorySessions] = useState<AiChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySaveError, setHistorySaveError] = useState('');
  const isBusy = status === 'loading' || status === 'streaming';
  const isStructuredWorkflow = Boolean(workflowPrompt?.trim());
  const storageKey = useMemo(
    () => getAiChatStorageKey(historyKey || `${resetKey || ''}\n${contextPrompt}`),
    [historyKey, resetKey, contextPrompt],
  );
  const activeSession = useMemo(
    () => historySessions.find((session) => session.id === activeSessionId),
    [historySessions, activeSessionId],
  );
  const isLegacySession = Boolean(activeSession && !activeSession.readingResourceKey);
  const requiresStructuredSeed =
    !isLegacySession && (readingResourceRequired || isStructuredWorkflow);
  const isContextReady =
    contextPrompt.trim().length > 0 &&
    (!requiresStructuredSeed || (isStructuredWorkflow && Boolean(readingResourceSeed)));
  const isReadingResourceBlocked =
    error.includes('历史会话所需的完整盘面资料') || error.includes('历史会话缺少锁定主体资料');
  const directSendIdRef = useRef('');
  const autoStartKeyRef = useRef<string | undefined>(undefined);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historySessionsRef = useRef<AiChatSession[]>([]);
  const activeSessionIdRef = useRef('');
  const inputResetKeyRef = useRef(inputResetKey);
  const readingResourceSeedRef = useRef(readingResourceSeed);

  useEffect(() => {
    readingResourceSeedRef.current = readingResourceSeed;
  }, [readingResourceSeed]);

  const applyHistoryState = useCallback(
    (sessions: AiChatSession[], nextActiveSessionId: string, persist = true) => {
      historySessionsRef.current = sessions;
      activeSessionIdRef.current = nextActiveSessionId;
      setHistorySessions(sessions);
      setActiveSessionId(nextActiveSessionId);
      if (persist) {
        const saved = saveAiChatHistory(storageKey, {
          sessions,
          activeSessionId: nextActiveSessionId,
        });
        setHistorySaveError(saved ? '' : '历史记录暂未保存，请保留当前页面并稍后重试。');
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
      if (readingResourceRequired && !readingResourceSeed) return;
      const now = new Date().toISOString();
      const session: AiChatSession = {
        id: createAiChatSessionId(),
        title: createAiChatTitle(options.titleSource, '自动解析'),
        initialQuestion: options.initialQuestion?.trim() ?? '',
        initialPrompt: options.prompt,
        readingSubject,
        ...(readingResourceSeed?.key ? { readingResourceKey: readingResourceSeed.key } : {}),
        readingMethod,
        completionStatus: 'pending',
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
      analyze(options.prompt, readingResourceSeed);
    },
    [
      analyze,
      applyHistoryState,
      readingMethod,
      readingResourceRequired,
      readingResourceSeed,
      readingSubject,
      reset,
    ],
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
    setHistorySaveError('');
    setIsHistoryOpen(false);

    if (activeSession) {
      restore(
        activeSession.turns,
        buildAiChatInitialPrompt(contextPrompt, activeSession),
        activeSession.readingSubject,
        activeSession.completionStatus,
        activeSession.readingMethod,
        readingResourceSeedRef.current,
        activeSession.readingResourceKey,
      );
      autoStartKeyRef.current = key;
    } else {
      reset();
      autoStartKeyRef.current = undefined;
    }

    if (saved.sessions.length) {
      if (!saveAiChatHistory(storageKey, saved))
        setHistorySaveError('历史记录暂未保存，请保留当前页面并稍后重试。');
    }

    directSendIdRef.current = '';
    if (!workspaceMode) setInputValue('');
  }, [
    storageKey,
    contextPrompt,
    autoStart,
    autoStartKey,
    readingSubject,
    readingMethod,
    restore,
    reset,
    workspaceMode,
  ]);

  useEffect(() => {
    if (inputResetKeyRef.current === inputResetKey) return;
    inputResetKeyRef.current = inputResetKey;
    setInputValue('');
  }, [inputResetKey]);

  // AI 回复完成、出错或取消后，更新当前会话，不覆盖其他历史。
  useEffect(() => {
    if (!hasStarted) return;
    const sessionId = activeSessionIdRef.current;
    const currentSession = historySessionsRef.current.find((session) => session.id === sessionId);
    const completionStatus = getAiChatCompletionStatus(status, turns);
    if (!currentSession || !completionStatus) return;
    if (currentSession.turns === turns && currentSession.completionStatus === completionStatus)
      return;
    const updatedSession: AiChatSession = {
      ...currentSession,
      turns,
      completionStatus,
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
      prompt: (workflowPrompt || contextPrompt) + '\n\n' + text,
      titleSource: text,
      initialQuestion: text,
      promptMode: 'context-question',
    });
  }, [directSend, isContextReady, contextPrompt, startNewSession, workflowPrompt]);

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
      el.style.height = Math.min(el.scrollHeight, workspaceMode ? 180 : 120) + 'px';
    }
  }, [inputValue, workspaceMode]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    const shouldLockPageScroll = window.matchMedia(
      '(max-width: 640px), (max-width: 900px) and (max-height: 520px)',
    ).matches;
    const previousBodyOverflow = document.body.style.overflow;
    if (shouldLockPageScroll) document.body.style.overflow = 'hidden';
    const unregisterDismissLayer = registerDismissLayer(() => setIsHistoryOpen(false));
    return () => {
      unregisterDismissLayer();
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
        prompt: (workflowPrompt || contextPrompt) + '\n\n' + text,
        titleSource: text,
        initialQuestion: text,
        promptMode: 'context-question',
      });
    } else {
      // 追问
      ask(text);
    }
  }, [
    inputValue,
    isBusy,
    isContextReady,
    hasStarted,
    contextPrompt,
    workflowPrompt,
    startNewSession,
    ask,
  ]);

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
    restore(
      session.turns,
      buildAiChatInitialPrompt(contextPrompt, session),
      session.readingSubject,
      session.completionStatus,
      session.readingMethod,
      readingResourceSeed,
      session.readingResourceKey,
    );
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
      restore(
        nextActiveSession.turns,
        buildAiChatInitialPrompt(contextPrompt, nextActiveSession),
        nextActiveSession.readingSubject,
        nextActiveSession.completionStatus,
        nextActiveSession.readingMethod,
        readingResourceSeed,
        nextActiveSession.readingResourceKey,
      );
    } else {
      reset();
    }
    setInputValue('');
  }

  return (
    <section
      className={`workspace-ui-surface panel-ai-chat${workspaceMode ? ' is-workspace-chat' : ''}`}
    >
      <div className="workspace-ui-panel-head">
        <div>
          <h2>{workspaceMode ? '解答' : 'AI 解析'}</h2>
          <p>
            {readingResourceError
              ? '完整盘面资料生成失败，请重试。'
              : error && !canRetry
                ? '完整盘面资料正在恢复，请稍候。'
                : !isContextReady
                  ? '正在生成排盘数据，请稍候…'
                  : status === 'error'
                    ? '本次回复失败，你的问题已保留，可直接重新生成。'
                    : status === 'cancelled'
                      ? '本次回复已停止，已生成内容保留，可重新生成。'
                      : hasStarted
                        ? historySaveError || '可以继续追问，历史对话会自动保存。'
                        : '在下方输入问题开始 AI 解析。'}
          </p>
        </div>
        <div className="ai-chat-head-actions">
          <div className="ai-chat-history-anchor">
            <WorkspaceButton
              size="small"
              onClick={() => setIsHistoryOpen((open) => !open)}
              aria-expanded={isHistoryOpen}
              disabled={isBusy}
            >
              历史{historySessions.length ? ` ${historySessions.length}` : ''}
            </WorkspaceButton>
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
            <WorkspaceButton size="small" onClick={handleNewChat} disabled={isBusy}>
              新对话
            </WorkspaceButton>
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
                {isBusy ? (
                  <span className="ai-analysis-cursor" aria-hidden="true">
                    ▋
                  </span>
                ) : null}
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
                  <span className="ai-chat-thinking-text">{progress || 'AI 正在思考'}</span>
                </div>
              </div>
            ) : null}

            {!hasStarted && !streamingContent && !error && isContextReady ? (
              <div className="ai-chat-empty">
                <div className="ai-chat-empty-inner">
                  <p>在下方输入你想了解的问题，AI 将基于排盘数据给出解读。</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* 底部输入区 */}
          <div className="ai-chat-input-area">
            {historySaveError ? (
              <p role="status" className="ai-chat-workflow-notice">
                {historySaveError}
              </p>
            ) : null}
            {notices.map((notice) => (
              <p key={notice} role="status" className="ai-chat-workflow-notice">
                {notice}
              </p>
            ))}
            {readingResourceError ? (
              <div className="ai-chat-error-notice" role="alert" aria-live="assertive">
                <div className="ai-chat-error-content">
                  <strong>完整资料生成失败</strong>
                  <span>{readingResourceError}</span>
                  <small>已保留成功生成的资料，重试只补生成失败的部分。</small>
                </div>
                {onRetryReadingResources ? (
                  <button
                    type="button"
                    className="ai-chat-retry-btn"
                    onClick={onRetryReadingResources}
                  >
                    重新生成资料
                  </button>
                ) : null}
              </div>
            ) : null}
            {error && !(readingResourceError && isReadingResourceBlocked) ? (
              <div className="ai-chat-error-notice" role="alert" aria-live="assertive">
                <div className="ai-chat-error-content">
                  <strong>{isReadingResourceBlocked ? '完整资料尚未就绪' : 'AI 回复失败'}</strong>
                  <span>{error}</span>
                  <small>
                    {isReadingResourceBlocked
                      ? '资料准备完成后可以继续当前会话。'
                      : '你的问题已保留，不需要重新输入。'}
                  </small>
                </div>
                {canRetry ? (
                  <button type="button" className="ai-chat-retry-btn" onClick={handleRetry}>
                    重新生成
                  </button>
                ) : null}
              </div>
            ) : null}
            {status === 'cancelled' && !error ? (
              <div className="ai-chat-error-notice" role="status" aria-live="polite">
                <div className="ai-chat-error-content">
                  <strong>AI 回复已停止</strong>
                  <span>已生成内容保留在当前对话中。</span>
                </div>
                {canRetry ? (
                  <button type="button" className="ai-chat-retry-btn" onClick={handleRetry}>
                    重新生成
                  </button>
                ) : null}
              </div>
            ) : null}
            {composerTools ? <div className="ai-chat-composer-tools">{composerTools}</div> : null}
            <div className="ai-chat-input-row">
              <div className="ai-chat-input-shell">
                <textarea
                  ref={inputRef}
                  className="ai-chat-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={PLACEHOLDER}
                  rows={workspaceMode ? 4 : 1}
                  disabled={!isContextReady}
                />
                <button
                  className="ai-chat-send-btn"
                  type="button"
                  onClick={isBusy ? cancel : handleSend}
                  disabled={!isBusy && (!inputValue.trim() || !isContextReady)}
                  aria-label={isBusy ? '停止解读' : '发送问题'}
                  title={isBusy ? '停止解读' : '发送'}
                >
                  {isBusy ? (
                    <span aria-hidden="true">■</span>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 19V5" />
                      <path d="m5 12 7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>
              {onOpenInspiration ? (
                <button
                  className="ai-chat-inspire-btn"
                  type="button"
                  onClick={onOpenInspiration}
                  title="问题灵感"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const AiChatPanel = memo(AiChatPanelImpl);
