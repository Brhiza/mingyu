import { useCallback, useEffect, useRef, useState } from 'react';
import { streamAiChat, type ChatMessage } from '@/lib/ai/stream-client';
import type { AiRequestConfig } from '@/lib/ai/settings';

export type AiChatStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseAiChat {
  /** 当前对话消息列表（不含正在流式生成的部分） */
  turns: ChatTurn[];
  /** 正在流式生成的助手消息内容 */
  streamingContent: string;
  status: AiChatStatus;
  error: string;
  /** 是否已开始解析（至少有过一次 analyze 调用） */
  hasStarted: boolean;
  /** 用提示词开始首次解析 */
  analyze: (prompt: string) => void;
  /** 发送追问消息 */
  ask: (question: string) => void;
  /** 恢复已保存的对话 */
  restore: (turns: ChatTurn[], initialPrompt?: string) => void;
  /** 重新发送上一次失败的请求 */
  retry: () => void;
  /** 当前是否可以重试 */
  canRetry: boolean;
  /** 重置整个对话 */
  reset: () => void;
  /** 取消当前请求 */
  cancel: () => void;
}

export function useAiChat(aiConfig?: AiRequestConfig): UseAiChat {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [status, setStatus] = useState<AiChatStatus>('idle');
  const [error, setError] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef('');
  const turnsRef = useRef<ChatTurn[]>([]);
  const initialPromptRef = useRef('');
  const lastRequestRef = useRef<ChatMessage[]>([]);

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
    lastRequestRef.current = [];
    setTurns([]);
    setStreamingContent('');
    setStatus('idle');
    setError('');
    setHasStarted(false);
    setCanRetry(false);
  }, []);

  const restore = useCallback((nextTurns: ChatTurn[], initialPrompt = '') => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = '';
    turnsRef.current = nextTurns;
    initialPromptRef.current = initialPrompt;
    lastRequestRef.current = initialPrompt
      ? [{ role: 'user', content: initialPrompt }, ...nextTurns]
      : [...nextTurns];
    setTurns(nextTurns);
    setStreamingContent('');
    setStatus(nextTurns.length ? 'done' : 'idle');
    setError('');
    setHasStarted(nextTurns.length > 0);
    setCanRetry(false);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setCanRetry(false);
  }, []);

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
      setCanRetry(false);

      streamAiChat(messages, {
        signal: controller.signal,
        aiConfig,
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
              { role: 'assistant' as const, content: finalContent },
            ];
            turnsRef.current = nextTurns;
            setTurns(nextTurns);
          }
          setStatus('done');
          setCanRetry(false);
          abortRef.current = null;
        },
        onError: (message) => {
          // 校验回调归属当前活跃请求
          if (abortRef.current !== controller) return;
          setStatus('error');
          setError(message);
          setCanRetry(true);
          streamingRef.current = '';
          setStreamingContent('');
          abortRef.current = null;
        },
      });
    },
    [aiConfig],
  );

  const analyze = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;
      initialPromptRef.current = prompt;
      turnsRef.current = [];
      setTurns([]);
      setHasStarted(true);
      startStream([{ role: 'user', content: prompt }]);
    },
    [startStream],
  );

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      // 从 ref 读取最新的 turns，避免在 state updater 内部产生副作用
      const nextTurns = [...turnsRef.current, { role: 'user' as const, content: trimmed }];
      turnsRef.current = nextTurns;
      setTurns(nextTurns);
      const requestTurns: ChatMessage[] = initialPromptRef.current
        ? [{ role: 'user', content: initialPromptRef.current }, ...nextTurns]
        : nextTurns;
      startStream(requestTurns);
    },
    [startStream],
  );

  const retry = useCallback(() => {
    if (!lastRequestRef.current.length) return;
    startStream([...lastRequestRef.current]);
  }, [startStream]);

  return {
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
    cancel,
  };
}
