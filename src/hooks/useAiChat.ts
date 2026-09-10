import { useCallback, useEffect, useRef, useState } from 'react';
import { streamAiChat, type ChatMessage } from '@/lib/ai/stream-client';
import type { AiRequestConfig } from '@/lib/ai/settings';
import { runReadingWorkflow, type ReadingMemory } from '@/lib/ai/reading-workflow';
import { executeReadingAction } from '@/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '@/lib/ai/reading-subject';

export type AiChatStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'cancelled' | 'error';
export type AiChatCompletionStatus = 'pending' | 'complete' | 'partial' | 'cancelled' | 'error';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  notices?: string[];
  incomplete?: boolean;
}

export interface UseAiChat {
  /** 当前对话消息列表（不含正在流式生成的部分） */
  turns: ChatTurn[];
  /** 正在流式生成的助手消息内容 */
  streamingContent: string;
  status: AiChatStatus;
  error: string;
  progress: string;
  notices: string[];
  /** 是否已开始解析（至少有过一次 analyze 调用） */
  hasStarted: boolean;
  /** 用提示词开始首次解析 */
  analyze: (prompt: string) => void;
  /** 发送追问消息 */
  ask: (question: string) => void;
  /** 恢复已保存的对话 */
  restore: (
    turns: ChatTurn[],
    initialPrompt?: string,
    readingSubject?: ReadingSubjectSnapshot,
    completionStatus?: AiChatCompletionStatus,
  ) => void;
  /** 重新发送上一次失败的请求 */
  retry: () => void;
  /** 当前是否可以重试 */
  canRetry: boolean;
  /** 重置整个对话 */
  reset: () => void;
  /** 取消当前请求 */
  cancel: () => void;
}

export interface RestoredAiChatState {
  status: AiChatStatus;
  error: string;
  hasStarted: boolean;
  canRetry: boolean;
}

export function useAiChat(
  aiConfig?: AiRequestConfig,
  readingSubject?: ReadingSubjectSnapshot,
): UseAiChat {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [status, setStatus] = useState<AiChatStatus>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const noticesRef = useRef<string[]>([]);
  const readingMemoryRef = useRef<ReadingMemory>({ resources: [] });
  const [hasStarted, setHasStarted] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef('');
  const turnsRef = useRef<ChatTurn[]>([]);
  const initialPromptRef = useRef('');
  const lastRequestRef = useRef<ChatMessage[]>([]);
  const readingSubjectRef = useRef<ReadingSubjectSnapshot | undefined>(readingSubject);
  const readingSubjectLockedRef = useRef(false);

  useEffect(() => {
    if (!readingSubjectLockedRef.current) readingSubjectRef.current = readingSubject;
  }, [readingSubject]);

  // 保持 turnsRef 与 turns 同步，供 ask 回调读取最新值
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // 组件卸载时中止未完成的请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = '';
    turnsRef.current = [];
    initialPromptRef.current = '';
    readingMemoryRef.current = { resources: [] };
    readingSubjectLockedRef.current = false;
    readingSubjectRef.current = readingSubject;
    setProgress('');
    setNotices([]);
    lastRequestRef.current = [];
    setTurns([]);
    setStreamingContent('');
    setStatus('idle');
    setError('');
    setHasStarted(false);
    setCanRetry(false);
  }, [readingSubject]);

  const restore = useCallback(
    (
      nextTurns: ChatTurn[],
      initialPrompt = '',
      restoredSubject?: ReadingSubjectSnapshot,
      completionStatus?: AiChatCompletionStatus,
    ) => {
      abortRef.current?.abort();
      abortRef.current = null;
      streamingRef.current = '';
      turnsRef.current = nextTurns;
      initialPromptRef.current = initialPrompt;
      readingMemoryRef.current = { resources: [] };
      readingSubjectLockedRef.current = true;
      readingSubjectRef.current = restoredSubject;
      setProgress('');
      setNotices([]);
      lastRequestRef.current = buildAiChatRequest(initialPrompt, nextTurns);
      setTurns(nextTurns);
      setStreamingContent('');
      const restoredState = resolveRestoredAiChatState(nextTurns, initialPrompt, completionStatus);
      setStatus(restoredState.status);
      setError(restoredState.error);
      setHasStarted(restoredState.hasStarted);
      setCanRetry(restoredState.canRetry);
    },
    [],
  );

  const appendIncompleteTurn = useCallback((notice: string) => {
    const partial = streamingRef.current;
    streamingRef.current = '';
    setStreamingContent('');
    if (!partial) return false;

    const nextTurns: ChatTurn[] = [
      ...turnsRef.current,
      {
        role: 'assistant',
        content: partial,
        incomplete: true,
        notices: [...new Set([...noticesRef.current, notice])],
      },
    ];
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    return true;
  }, []);

  const cancel = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    controller.abort();
    abortRef.current = null;
    appendIncompleteTurn('本次回答未完整生成，可重新生成。');
    setStatus('cancelled');
    setError('');
    setCanRetry(lastRequestRef.current.length > 0);
    setProgress('已停止解读');
    setNotices((items) => [...new Set([...items, '已停止解读，已生成内容保留在当前对话中。'])]);
  }, [appendIncompleteTurn]);

  const startStream = useCallback(
    (messages: ChatMessage[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      lastRequestRef.current = [...messages];

      setStatus('loading');
      streamingRef.current = '';
      setStreamingContent('');
      setError('');
      setProgress('');
      setNotices([]);
      noticesRef.current = [];
      setCanRetry(false);

      void runReadingWorkflow(
        messages,
        {
          signal: controller.signal,
          aiConfig,
          memory: readingMemoryRef.current,
          subject: readingSubjectRef.current,
          onProgress: (value) => {
            if (abortRef.current === controller) setProgress(value.text);
          },
          onNotice: (notice) => {
            if (abortRef.current === controller) {
              noticesRef.current = [...new Set([...noticesRef.current, notice])];
              setNotices(noticesRef.current);
            }
          },
          onChunk: (text) => {
            // 校验回调归属当前活跃请求
            if (abortRef.current !== controller) return;
            setStatus('streaming');
            streamingRef.current += text;
            setStreamingContent(streamingRef.current);
          },
          onDone: () => {
            // 校验回调归属当前活跃请求
            if (abortRef.current !== controller) return;
            const finalContent = streamingRef.current;
            streamingRef.current = '';
            setStreamingContent('');
            if (finalContent) {
              const nextTurns = [
                ...turnsRef.current,
                {
                  role: 'assistant' as const,
                  content: finalContent,
                  ...(noticesRef.current.length ? { notices: [...noticesRef.current] } : {}),
                },
              ];
              turnsRef.current = nextTurns;
              setTurns(nextTurns);
            }
            setStatus('done');
            setNotices([]);
            setCanRetry(false);
            abortRef.current = null;
          },
          onError: (message) => {
            // 校验回调归属当前活跃请求
            if (abortRef.current !== controller) return;
            appendIncompleteTurn('本次回答未完整生成，可重新生成。');
            setStatus('error');
            setError(message);
            setCanRetry(true);
            setNotices([]);
            abortRef.current = null;
          },
        },
        { stream: streamAiChat, execute: executeReadingAction },
      );
    },
    [aiConfig, appendIncompleteTurn],
  );

  const analyze = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;
      readingSubjectLockedRef.current = false;
      readingSubjectRef.current = readingSubject;
      initialPromptRef.current = prompt;
      readingMemoryRef.current = { resources: [] };
      turnsRef.current = [];
      setTurns([]);
      setHasStarted(true);
      startStream([{ role: 'user', content: prompt }]);
    },
    [readingSubject, startStream],
  );

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      // 从 ref 读取最新的 turns，避免在 state updater 内部产生副作用
      const nextTurns = [...turnsRef.current, { role: 'user' as const, content: trimmed }];
      turnsRef.current = nextTurns;
      setTurns(nextTurns);
      startStream(buildAiChatRequest(initialPromptRef.current, nextTurns));
    },
    [startStream],
  );

  const retry = useCallback(() => {
    if (!lastRequestRef.current.length) return;
    const nextTurns = removeIncompleteChatTurns(turnsRef.current);
    if (nextTurns.length !== turnsRef.current.length) {
      turnsRef.current = nextTurns;
      setTurns(nextTurns);
    }
    startStream([...lastRequestRef.current]);
  }, [startStream]);

  return {
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
  };
}

type LatestChatTurnState = 'none' | 'user' | 'partial' | 'complete';

function getLatestChatTurnState(turns: ChatTurn[]): LatestChatTurnState {
  const latestTurn = turns[turns.length - 1];
  if (!latestTurn) return 'none';
  if (latestTurn.role === 'user') return 'user';
  return latestTurn.incomplete ? 'partial' : 'complete';
}

function resolveLatestCompletionStatus(
  turns: ChatTurn[],
  completionStatus?: AiChatCompletionStatus,
): AiChatCompletionStatus | undefined {
  const latestState = getLatestChatTurnState(turns);
  if (latestState === 'user') {
    return completionStatus === 'cancelled' || completionStatus === 'error'
      ? completionStatus
      : 'pending';
  }
  if (latestState === 'partial') {
    return completionStatus === 'cancelled' ||
      completionStatus === 'error' ||
      completionStatus === 'pending'
      ? completionStatus
      : 'partial';
  }
  if (latestState === 'complete') {
    return completionStatus === 'pending' ||
      completionStatus === 'cancelled' ||
      completionStatus === 'error'
      ? completionStatus
      : 'complete';
  }
  return completionStatus;
}

export function removeIncompleteChatTurns(turns: ChatTurn[]) {
  return turns.filter((turn) => !turn.incomplete);
}

export function buildAiChatRequest(initialPrompt: string, turns: ChatTurn[]): ChatMessage[] {
  const completeTurns = removeIncompleteChatTurns(turns).map(({ role, content }) => ({
    role,
    content,
  }));
  return initialPrompt
    ? [{ role: 'user', content: initialPrompt }, ...completeTurns]
    : completeTurns;
}

export function resolveRestoredAiChatState(
  turns: ChatTurn[],
  initialPrompt: string,
  completionStatus?: AiChatCompletionStatus,
): RestoredAiChatState {
  const restoredStatus = resolveLatestCompletionStatus(turns, completionStatus);
  const hasRequest = buildAiChatRequest(initialPrompt, turns).length > 0;
  const isUnfinished =
    restoredStatus === 'partial' || restoredStatus === 'error' || restoredStatus === 'pending';
  const hasStarted = turns.length > 0 || Boolean(initialPrompt.trim()) || Boolean(restoredStatus);

  return {
    status: isUnfinished
      ? 'error'
      : restoredStatus === 'cancelled'
        ? 'cancelled'
        : restoredStatus === 'complete'
          ? 'done'
          : 'idle',
    error:
      restoredStatus === 'partial'
        ? '上次回答未完整生成，可重新生成。'
        : isUnfinished
          ? '上次回答未完成，可重新生成。'
          : '',
    hasStarted,
    canRetry: hasRequest && (isUnfinished || restoredStatus === 'cancelled'),
  };
}
