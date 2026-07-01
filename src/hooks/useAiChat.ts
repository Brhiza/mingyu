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
  restore: (turns: ChatTurn[]) => void;
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
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef('');
  const turnsRef = useRef<ChatTurn[]>([]);

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
    setTurns([]);
    setStreamingContent('');
    setStatus('idle');
    setError('');
    setHasStarted(false);
  }, []);

  const restore = useCallback((nextTurns: ChatTurn[]) => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = '';
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    setStreamingContent('');
    setStatus(nextTurns.length ? 'done' : 'idle');
    setError('');
    setHasStarted(nextTurns.length > 0);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }, []);

  const startStream = useCallback(
    (messages: ChatMessage[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      streamingRef.current = '';
      setStreamingContent('');
      setError('');

      streamAiChat(messages, {
        signal: controller.signal,
        aiConfig,
        onChunk: (text) => {
          setStatus('streaming');
          streamingRef.current += text;
          setStreamingContent(streamingRef.current);
        },
        onDone: () => {
          const finalContent = streamingRef.current;
          streamingRef.current = '';
          setStreamingContent('');
          if (finalContent) {
            setTurns((prev) => [...prev, { role: 'assistant', content: finalContent }]);
          }
          setStatus('done');
          abortRef.current = null;
        },
        onError: (message) => {
          setStatus('error');
          setError(message);
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
      startStream(nextTurns);
    },
    [startStream],
  );

  return {
    turns,
    streamingContent,
    status,
    error,
    hasStarted,
    analyze,
    ask,
    restore,
    reset,
    cancel,
  };
}
