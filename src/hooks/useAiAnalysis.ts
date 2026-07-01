import { useCallback, useRef, useState } from 'react';
import { streamAiAnalysis } from '@/lib/ai/stream-client';

export type AiAnalysisStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export interface UseAiAnalysis {
  status: AiAnalysisStatus;
  content: string;
  error: string;
  analyze: (prompt: string) => void;
  reset: () => void;
  cancel: () => void;
}

export function useAiAnalysis(): UseAiAnalysis {
  const [status, setStatus] = useState<AiAnalysisStatus>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setContent('');
    setError('');
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }, []);

  const analyze = useCallback(
    (prompt: string) => {
      if (!prompt.trim()) return;

      // 取消上一次请求
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      setContent('');
      setError('');

      streamAiAnalysis(prompt, {
        signal: controller.signal,
        onChunk: (text) => {
          setStatus('streaming');
          setContent((prev) => prev + text);
        },
        onDone: () => {
          setStatus('done');
          abortRef.current = null;
        },
        onError: (message) => {
          setStatus('error');
          setError(message);
          abortRef.current = null;
        },
      });
    },
    [],
  );

  return { status, content, error, analyze, reset, cancel };
}
