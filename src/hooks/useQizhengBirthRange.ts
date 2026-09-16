import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QizhengInput } from 'mingyu-core/qizheng';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { executeQizhengBirthRangeWorker } from '@/lib/qizheng-birth-range';
import type { QizhengDateRange } from '@/lib/qizheng-birth-range';

export type QizhengBirthRangeProgress = {
  completed: number;
  total: number;
};

export type UseQizhengBirthRangeResult = {
  range: QizhengDateRange | null;
  loading: boolean;
  error: string | null;
  progress: QizhengBirthRangeProgress;
  cancel: () => void;
  retry: () => void;
};

type CachedRange = {
  range: QizhengDateRange;
  progress: QizhengBirthRangeProgress;
};

type RequestState = {
  key: string | null;
  range: QizhengDateRange | null;
  loading: boolean;
  error: string | null;
  progress: QizhengBirthRangeProgress;
};

type ActiveRequest = {
  controller: AbortController;
  key: string;
  sequence: number;
};

type RequestSnapshot = {
  input: QizhengInput;
  source: BaziReverseSource;
};

const EMPTY_PROGRESS: QizhengBirthRangeProgress = { completed: 0, total: 0 };
const CANCELLED_MESSAGE = '已取消七政四余出生区间计算，请点击“重试”重新计算。';

function getRequestKey(input: QizhengInput | null, source: BaziReverseSource | null) {
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
      input: snapshot.input as QizhengInput,
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
  return '七政四余出生区间计算失败，请稍后重试。';
}

function isCurrentRequest(active: ActiveRequest | null, key: string, sequence: number): boolean {
  return active?.key === key && active.sequence === sequence;
}

function putCache(cache: Map<string, CachedRange>, key: string, value: CachedRange) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > 2) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

/**
 * 计算并管理七政四余本命或流曜出生区间。
 *
 * 请求键变化会终止旧 Worker；结果只在对应请求仍然有效时写回，避免旧盘闪现。
 * 仅保留最近两个成功结果，取消不会自动重试，必须由调用方显式调用 retry。
 */
export function useQizhengBirthRange(
  input: QizhengInput | null,
  source: BaziReverseSource | null,
  enabled: boolean,
): UseQizhengBirthRangeResult {
  const requestKey = useMemo(() => {
    if (!enabled) return null;
    return getRequestKey(input, source);
  }, [enabled, input, source]);
  const cacheRef = useRef(new Map<string, CachedRange>());
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
        error: '七政四余出生区间请求快照无效，请重新计算。',
        progress: EMPTY_PROGRESS,
      });
      return;
    }
    const { input: currentInput, source: currentSource } = snapshot;

    const forceRetry = forcedRetryKeyRef.current === key;
    if (forceRetry) forcedRetryKeyRef.current = null;

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

    void executeQizhengBirthRangeWorker(
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
        const message = getErrorMessage(error);
        finishIfCurrent({
          key,
          range: null,
          loading: false,
          error: message,
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
