import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import {
  executeAstrolabeBirthRangeWorker,
  type AstrolabeBirthRange,
} from '@/lib/astrolabe-birth-range';

export type AstrolabeBirthRangeProgress = {
  completed: number;
  total: number;
};

export type UseAstrolabeBirthRangeResult = {
  range: AstrolabeBirthRange | null;
  loading: boolean;
  error: string | null;
  progress: AstrolabeBirthRangeProgress;
  cancel: () => void;
  retry: () => void;
};

type CachedRange = {
  range: AstrolabeBirthRange;
  progress: AstrolabeBirthRangeProgress;
};

type RequestState = {
  key: string | null;
  range: AstrolabeBirthRange | null;
  loading: boolean;
  error: string | null;
  progress: AstrolabeBirthRangeProgress;
};

type ActiveRequest = {
  controller: AbortController;
  key: string;
  sequence: number;
};

type RequestSnapshot = {
  input: AstrolabeBirthInput;
  source: BaziReverseSource;
};

const EMPTY_PROGRESS: AstrolabeBirthRangeProgress = { completed: 0, total: 0 };
const CANCELLED_MESSAGE = '已取消西占星盘出生区间计算，请点击“重试”重新计算。';

function getRequestKey(input: AstrolabeBirthInput | null, source: BaziReverseSource | null) {
  if (!input || !source) return null;
  return JSON.stringify({ input, source }) ?? null;
}

function parseRequestKey(key: string): RequestSnapshot | null {
  try {
    const value: unknown = JSON.parse(key);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const snapshot = value as Record<string, unknown>;
    if (
      !snapshot.input ||
      typeof snapshot.input !== 'object' ||
      Array.isArray(snapshot.input) ||
      !snapshot.source ||
      typeof snapshot.source !== 'object' ||
      Array.isArray(snapshot.source)
    ) {
      return null;
    }
    return {
      input: snapshot.input as AstrolabeBirthInput,
      source: snapshot.source as BaziReverseSource,
    };
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
    return CANCELLED_MESSAGE;
  }
  if (error instanceof Error && error.message) return error.message;
  return '西占星盘出生区间计算失败，请稍后重试。';
}

function isCurrentRequest(active: ActiveRequest | null, key: string, sequence: number): boolean {
  return active?.key === key && active.sequence === sequence;
}

/** 只保留一个已完成区间结果，避免两小时结果同时占用大量内存。 */
function putCache(cache: Map<string, CachedRange>, key: string, value: CachedRange) {
  cache.clear();
  cache.set(key, value);
}

/**
 * 计算并管理西占本命出生区间。
 *
 * 请求键变化会终止旧 Worker；结果只在对应请求仍然有效时写回。
 * 只缓存一个成功结果；显式取消会记住当前请求键，切换显示状态后也不会自动重试，
 * 必须由调用方显式调用 retry。
 */
export function useAstrolabeBirthRange(
  input: AstrolabeBirthInput | null,
  source: BaziReverseSource | null,
  enabled: boolean,
): UseAstrolabeBirthRangeResult {
  const requestKey = useMemo(() => {
    if (!enabled) return null;
    return getRequestKey(input, source);
  }, [enabled, input, source]);
  const cacheRef = useRef(new Map<string, CachedRange>());
  const cancelledKeysRef = useRef(new Set<string>());
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const sequenceRef = useRef(0);
  const forcedRetryKeyRef = useRef<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState<RequestState>({
    key: null,
    range: null,
    loading: false,
    error: null,
    progress: EMPTY_PROGRESS,
  });

  useEffect(() => {
    sequenceRef.current += 1;
    const sequence = sequenceRef.current;
    const key = requestKey;
    const previousRequest = activeRequestRef.current;
    activeRequestRef.current = null;
    previousRequest?.controller.abort();

    if (!key) {
      setState({
        key,
        range: null,
        loading: false,
        error: null,
        progress: EMPTY_PROGRESS,
      });
      return;
    }
    const snapshot = parseRequestKey(key);
    if (!snapshot) {
      setState({
        key,
        range: null,
        loading: false,
        error: '西占星盘出生区间请求快照无效，请重新计算。',
        progress: EMPTY_PROGRESS,
      });
      return;
    }
    const { input: currentInput, source: currentSource } = snapshot;

    const forceRetry = forcedRetryKeyRef.current === key;
    if (forceRetry) forcedRetryKeyRef.current = null;

    if (cancelledKeysRef.current.has(key) && !forceRetry) {
      setState({
        key,
        range: null,
        loading: false,
        error: CANCELLED_MESSAGE,
        progress: EMPTY_PROGRESS,
      });
      return;
    }
    if (forceRetry) cancelledKeysRef.current.delete(key);

    const cached = forceRetry ? undefined : cacheRef.current.get(key);
    if (cached) {
      setState({
        key,
        range: cached.range,
        loading: false,
        error: null,
        progress: cached.progress,
      });
      return;
    }

    const controller = new AbortController();
    const activeRequest: ActiveRequest = { controller, key, sequence };
    activeRequestRef.current = activeRequest;
    let active = true;
    let latestProgress = EMPTY_PROGRESS;

    setState({
      key,
      range: null,
      loading: true,
      error: null,
      progress: EMPTY_PROGRESS,
    });

    const finishIfCurrent = (nextState: RequestState) => {
      if (!active || !isCurrentRequest(activeRequestRef.current, key, sequence)) return;
      activeRequestRef.current = null;
      setState(nextState);
    };

    void executeAstrolabeBirthRangeWorker(
      currentInput,
      currentSource,
      controller.signal,
      (completed, total) => {
        latestProgress = { completed, total };
        if (!active || !isCurrentRequest(activeRequestRef.current, key, sequence)) return;
        setState((current) =>
          current.key === key ? { ...current, loading: true, progress: latestProgress } : current,
        );
      },
    )
      .then((range) => {
        const progress =
          latestProgress.total > 0
            ? latestProgress
            : { completed: range.sampleCount, total: range.sampleCount };
        if (!active || !isCurrentRequest(activeRequestRef.current, key, sequence)) return;
        putCache(cacheRef.current, key, { range, progress });
        activeRequestRef.current = null;
        setState({ key, range, loading: false, error: null, progress });
      })
      .catch((error: unknown) => {
        finishIfCurrent({
          key,
          range: null,
          loading: false,
          error: getErrorMessage(error),
          progress: latestProgress,
        });
      });

    return () => {
      active = false;
      if (isCurrentRequest(activeRequestRef.current, key, sequence)) {
        activeRequestRef.current = null;
        controller.abort();
      }
    };
  }, [requestKey, retryVersion]);

  const cancel = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest) return;
    cancelledKeysRef.current.add(activeRequest.key);
    activeRequest.controller.abort();
    activeRequestRef.current = null;
    setState((current) =>
      current.key === activeRequest.key
        ? { ...current, range: null, loading: false, error: CANCELLED_MESSAGE }
        : current,
    );
  }, []);

  const retry = useCallback(() => {
    if (!requestKey) return;
    forcedRetryKeyRef.current = requestKey;
    setState((current) =>
      current.key === requestKey
        ? { ...current, range: null, loading: false, error: null, progress: EMPTY_PROGRESS }
        : current,
    );
    setRetryVersion((version) => version + 1);
  }, [requestKey]);

  const isCurrentState = state.key === requestKey;
  return {
    range: isCurrentState ? state.range : null,
    loading: isCurrentState ? state.loading : false,
    error: isCurrentState ? state.error : null,
    progress: isCurrentState ? state.progress : EMPTY_PROGRESS,
    cancel,
    retry,
  };
}
