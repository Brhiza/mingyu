import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attachWorkerSafety } from '@/hooks/useWorkerRequest';
import type { BaziRangePage } from '@/lib/full-chart-engine/bazi-range';
import {
  assertMingluPageBundle,
  buildMingluPersonFromBirthProfile,
  type MingluRangeCalculationRequest,
  type MingluRangePageFacts,
} from '@/lib/full-chart-engine/minglu-range';
import { buildMingluArticle, type MingluArticle } from 'mingyu-core/minglu';
import type { ZiweiRuntime } from 'mingyu-core/ziwei';

export interface UseMingluRangeArticleOptions {
  enabled: boolean;
  page: BaziRangePage | null;
  /** 当前页对应的紫微运行时；由 useZiweiCalculations 的 range page 结果提供。 */
  ziweiRuntime?: ZiweiRuntime | null;
  /** 命录是否需要星盘章节；为 false 时不启动无用星盘计算。 */
  astrolabeRequested: boolean;
}

export interface UseMingluRangeArticleResult {
  requested: boolean;
  article: MingluArticle | null;
  loading: boolean;
  error: string | null;
  inputKey: string | null;
  pageIndex: number | null;
  cancel: () => void;
  retry: () => void;
  paused: boolean;
}

type WorkerResponse =
  | { id: string; type: 'result'; result: MingluRangePageFacts }
  | { id: string; type: 'error'; error?: string };

interface PreparedRequest {
  requested: boolean;
  key: string | null;
  request: MingluRangeCalculationRequest | null;
  error: string | null;
}

interface ActiveRequest {
  controller: AbortController;
  key: string;
  sequence: number;
}

interface State {
  key: string | null;
  facts: MingluRangePageFacts | null;
  loading: boolean;
  error: string | null;
  paused: boolean;
}

let workerRequestCounter = 0;

function createAbortError(): DOMException {
  return new DOMException('已停止当前命录出生样本计算。', 'AbortError');
}

function createWorkerRequestId(): string {
  workerRequestCounter += 1;
  return `minglu-range-${workerRequestCounter}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '命录当前出生样本计算失败，请稍后重试。';
}

function executeMingluRangeWorker(
  request: MingluRangeCalculationRequest,
  signal?: AbortSignal,
): Promise<MingluRangePageFacts> {
  if (signal?.aborted) return Promise.reject(createAbortError());

  let worker: Worker;
  try {
    worker = new Worker(new URL('../../../workers/minglu-range.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch (error) {
    return Promise.reject(error);
  }

  const id = createWorkerRequestId();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      disarmSafety();
      try {
        worker.terminate();
      } catch {
        // Worker 已结束时无需重复终止。
      }
    };
    const finishError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('命录当前出生样本计算失败。'));
    };
    const handleAbort = () => finishError(createAbortError());
    const disarmSafety = attachWorkerSafety(worker, {
      onError: (message) => finishError(new Error(message)),
    });

    if (signal?.aborted) {
      finishError(createAbortError());
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (settled || !data || data.id !== id) return;
      if (data.type === 'result') {
        settled = true;
        cleanup();
        resolve(data.result);
      } else if (data.type === 'error') {
        finishError(new Error(data.error || '命录当前出生样本计算失败。'));
      } else {
        finishError(new Error('命录当前出生样本结果协议无效。'));
      }
    };
    try {
      worker.postMessage({ id, type: 'calculate', calculationRequest: request });
    } catch (error) {
      finishError(error);
    }
  });
}

function prepareRequest(
  enabled: boolean,
  page: BaziRangePage | null,
  astrolabeRequested: boolean,
  pageFingerprint: string,
): PreparedRequest {
  if (!enabled || !page) {
    return { requested: false, key: null, request: null, error: null };
  }

  try {
    const side = page.primary;
    assertMingluPageBundle(side.bundle);
    const profile = side.bundle.profile;
    const baziResult = side.bundle.bazi ?? side.result;
    const request: MingluRangeCalculationRequest = {
      inputKey: page.inputKey,
      pageIndex: page.index,
      ...(side.timestamp === undefined ? {} : { timestamp: side.timestamp }),
      primary: {
        profile,
        baziResult,
        astrolabeData: side.bundle.astrolabe,
      },
      astrolabeRequested,
    };
    return {
      requested: true,
      key: pageFingerprint,
      request,
      error: null,
    };
  } catch (error) {
    return {
      requested: true,
      key: pageFingerprint,
      request: null,
      error: getErrorMessage(error),
    };
  }
}

function isCurrentRequest(active: ActiveRequest | null, key: string, sequence: number): boolean {
  return active?.key === key && active.sequence === sequence;
}

/**
 * 为当前八字范围页懒加载同页命录。
 *
 * 八字直接取 side bundle，Worker 只补齐当前秒缺失的星盘事实；旧页响应必须
 * 同时通过 inputKey、页索引和 sequence 校验后才能写回。
 */
export function useMingluRangeArticle(
  options: UseMingluRangeArticleOptions,
): UseMingluRangeArticleResult {
  const pageFingerprint = useMemo(
    () =>
      options.page
        ? JSON.stringify({
            inputKey: options.page.inputKey,
            index: options.page.index,
            profile: options.page.primary.profile,
            astrolabeRequested: options.astrolabeRequested,
          })
        : '',
    [options.page, options.astrolabeRequested],
  );
  const preparation = useMemo(
    () =>
      prepareRequest(options.enabled, options.page, options.astrolabeRequested, pageFingerprint),
    [options.enabled, options.page, options.astrolabeRequested, pageFingerprint],
  );
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const sequenceRef = useRef(0);
  const [state, setState] = useState<State>({
    key: null,
    facts: null,
    loading: false,
    error: null,
    paused: false,
  });

  const launch = useCallback((request: MingluRangeCalculationRequest, key: string) => {
    const previous = activeRequestRef.current;
    activeRequestRef.current = null;
    previous?.controller.abort();

    const controller = new AbortController();
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const active: ActiveRequest = { controller, key, sequence };
    activeRequestRef.current = active;
    setState({ key, facts: null, loading: true, error: null, paused: false });

    void executeMingluRangeWorker(request, controller.signal)
      .then((facts) => {
        if (
          !isCurrentRequest(activeRequestRef.current, key, sequence) ||
          facts.inputKey !== request.inputKey ||
          facts.pageIndex !== request.pageIndex
        ) {
          return;
        }
        activeRequestRef.current = null;
        setState({ key, facts, loading: false, error: null, paused: false });
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest(activeRequestRef.current, key, sequence)) return;
        activeRequestRef.current = null;
        setState({
          key,
          facts: null,
          loading: false,
          error: getErrorMessage(error),
          paused: false,
        });
      });
  }, []);

  useEffect(() => {
    const previous = activeRequestRef.current;
    activeRequestRef.current = null;
    previous?.controller.abort();
    sequenceRef.current += 1;

    if (!preparation.request) {
      setState({
        key: preparation.key,
        facts: null,
        loading: false,
        error: preparation.error,
        paused: false,
      });
      return;
    }

    launch(preparation.request, preparation.key!);
    return () => {
      const active = activeRequestRef.current;
      if (active?.key === preparation.key) {
        activeRequestRef.current = null;
        active.controller.abort();
      }
      sequenceRef.current += 1;
    };
  }, [launch, preparation]);

  const cancel = useCallback(() => {
    const active = activeRequestRef.current;
    if (!active) return;
    activeRequestRef.current = null;
    active.controller.abort();
    setState((current) =>
      current.key === active.key
        ? { ...current, loading: false, error: null, paused: true }
        : current,
    );
  }, []);

  const retry = useCallback(() => {
    if (!preparation.request || !preparation.key) return;
    launch(preparation.request, preparation.key);
  }, [launch, preparation.key, preparation.request]);

  const current = state.key === preparation.key;
  const articleState = useMemo(() => {
    if (!current || state.loading || !state.facts || state.error) {
      return { article: null, error: null };
    }
    try {
      const person = buildMingluPersonFromBirthProfile(state.facts.profile, state.facts.baziResult);
      return {
        article: buildMingluArticle({
          person,
          baziResult: state.facts.baziResult,
          ziweiRuntime: options.ziweiRuntime ?? null,
          astrolabeData: state.facts.astrolabeData,
        }),
        error: null,
      };
    } catch (error) {
      return { article: null, error: getErrorMessage(error) };
    }
  }, [current, options.ziweiRuntime, state.error, state.facts, state.loading]);

  return {
    requested: preparation.requested,
    article: articleState.article,
    loading: current ? state.loading : false,
    error: preparation.error ?? (current ? state.error : null) ?? articleState.error,
    inputKey: current ? (preparation.request?.inputKey ?? null) : null,
    pageIndex: current ? (preparation.request?.pageIndex ?? null) : null,
    cancel,
    retry,
    paused: current ? state.paused : false,
  };
}
