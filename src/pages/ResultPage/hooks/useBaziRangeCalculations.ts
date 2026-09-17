import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BirthProfile } from 'mingyu-core/profile';
import { attachWorkerSafety } from '@/hooks/useWorkerRequest';
import {
  buildFrontendBirthProfile,
  hasFrontendBirthRangeInput,
} from '@/lib/full-chart-engine/birth-profile';
import type { QueryInputState } from '@/lib/query-state';
import {
  type BaziRangeCalculationRequest,
  type BaziRangePage,
  type BaziRangeWorkerResponse,
} from '@/lib/full-chart-engine/bazi-range';

interface PreparedRangeRequest extends BaziRangeCalculationRequest {
  total: number;
}

interface RangePreparation {
  requested: boolean;
  key: string | null;
  request: PreparedRangeRequest | null;
  total: number;
  error: string | null;
}

interface ActiveRequest {
  controller: AbortController;
  key: string;
  sequence: number;
}

interface RangeState {
  inputKey: string | null;
  page: BaziRangePage | null;
  index: number;
  total: number;
  nextIndex: number | null;
  loading: boolean;
  error: string | null;
  paused: boolean;
}

export interface UseBaziRangeCalculationsResult {
  requested: boolean;
  loading: boolean;
  error: string | null;
  page: BaziRangePage | null;
  index: number;
  total: number;
  nextIndex: number | null;
  previous: () => void;
  next: () => void;
  goTo: (index: number) => void;
  cancel: () => void;
  resume: () => void;
  retry: () => void;
  paused: boolean;
}

const CANCELLED_MESSAGE = '已暂停八字出生范围计算，请点击“继续”恢复当前条目。';
const INVALID_INDEX_MESSAGE = '八字出生范围索引超出当前范围。';

let workerRequestCounter = 0;

function createAbortError(): DOMException {
  return new DOMException('已停止八字出生范围计算。', 'AbortError');
}

function createWorkerRequestId(): string {
  workerRequestCounter += 1;
  return 'bazi-birth-range-' + workerRequestCounter;
}

/** 在浏览器主线程启动一个只计算单条 page 的模块 Worker。 */
function executeBaziRangeWorker(
  request: BaziRangeCalculationRequest,
  signal?: AbortSignal,
): Promise<BaziRangePage> {
  if (signal?.aborted) return Promise.reject(createAbortError());

  let worker: Worker;
  try {
    worker = new Worker(new URL('../../../workers/bazi-birth-range.worker.ts', import.meta.url), {
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
      reject(error instanceof Error ? error : new Error('八字出生范围计算失败。'));
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
    worker.onmessage = (event: MessageEvent<BaziRangeWorkerResponse>) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.id !== id) return;
      if (data.type === 'result') {
        settled = true;
        cleanup();
        resolve(data.result);
      } else if (data.type === 'error') {
        finishError(new Error(data.error || '八字出生范围计算失败。'));
      } else {
        finishError(new Error('八字出生范围结果协议无效。'));
      }
    };
    try {
      worker.postMessage({ ...request, id });
    } catch (error) {
      finishError(error);
    }
  });
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
    return CANCELLED_MESSAGE;
  }
  if (error instanceof Error && error.message) return error.message;
  return '八字出生范围计算失败，请稍后重试。';
}

function getRangeSampleCount(profile: BirthProfile): number {
  const range = profile.birthTimeRange;
  if (!range) return 1;
  const total = (range.endTimestamp - range.startTimestamp) / 1_000;
  if (!Number.isSafeInteger(total) || total < 1 || total > 7_200) {
    throw new RangeError('八字出生时间范围必须包含 1 到 7200 个整秒样本。');
  }
  return total;
}

function buildInputKey(
  input: QueryInputState,
  primary: BirthProfile,
  partner?: BirthProfile,
): string {
  return JSON.stringify({ input, primary, partner });
}

function buildPreparedSide(
  input: QueryInputState,
  subject: 'primary' | 'partner',
  sourceText: string,
): { profile: BirthProfile; samples: number } {
  let profile: BirthProfile;
  try {
    profile = buildFrontendBirthProfile(input, subject);
  } catch (error) {
    const label = subject === 'primary' ? '本人' : '对方';
    const detail = error instanceof Error ? error.message : '无法建立统一出生档案。';
    throw new Error(label + '出生范围来源或档案无效：' + detail, { cause: error });
  }
  if (sourceText && !profile.birthTimeRange) {
    const label = subject === 'primary' ? '本人' : '对方';
    throw new Error(label + '出生范围来源损坏，未能恢复完整的机器时间区间。');
  }
  return { profile, samples: getRangeSampleCount(profile) };
}

function prepareRangeRequest(input: QueryInputState, enabled: boolean): RangePreparation {
  const primarySourceText = input.birthReverseSource.trim();
  const compatibility = input.analysisMode === 'compatibility';
  const partnerSourceText = compatibility ? input.partnerBirthReverseSource.trim() : '';
  const hasAnySource = hasFrontendBirthRangeInput(input);
  if (!enabled || !hasAnySource) {
    return { requested: false, key: null, request: null, total: 0, error: null };
  }
  try {
    const primarySide = buildPreparedSide(input, 'primary', primarySourceText);
    const partnerSide = compatibility
      ? buildPreparedSide(input, 'partner', partnerSourceText)
      : undefined;
    const total = primarySide.samples * (partnerSide?.samples ?? 1);
    const primary = primarySide.profile;
    const partner = partnerSide?.profile;
    const key = buildInputKey(input, primary, partner);
    const request: PreparedRangeRequest = {
      inputKey: key,
      index: 0,
      primary: { profile: primary },
      ...(partner ? { partner: { profile: partner } } : {}),
      total,
    };
    return { requested: true, key, request, total, error: null };
  } catch (error) {
    return {
      requested: true,
      key: null,
      request: null,
      total: 0,
      error: getErrorMessage(error),
    };
  }
}

function isCurrentRequest(active: ActiveRequest | null, key: string, sequence: number): boolean {
  return active?.key === key && active.sequence === sequence;
}

/**
 * 管理八字出生范围的逐条 Worker 读取。
 *
 * 范围请求只启动当前 index 的一个 Worker；翻页、跳转、重试和继续都会
 * 终止旧 Worker，返回结果必须同时匹配 sequence 与 inputKey 才能写回。
 */
export function useBaziRangeCalculations(
  input: QueryInputState,
  enabled: boolean,
): UseBaziRangeCalculationsResult {
  const inputFingerprint = JSON.stringify(input);
  const preparation = useMemo(
    () => prepareRangeRequest(JSON.parse(inputFingerprint) as QueryInputState, enabled),
    [inputFingerprint, enabled],
  );
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const sequenceRef = useRef(0);
  const [state, setState] = useState<RangeState>({
    inputKey: null,
    page: null,
    index: 0,
    total: 0,
    nextIndex: null,
    loading: false,
    error: null,
    paused: false,
  });

  const launch = useCallback((request: PreparedRangeRequest, targetIndex: number) => {
    const previous = activeRequestRef.current;
    activeRequestRef.current = null;
    previous?.controller.abort();

    const controller = new AbortController();
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const active: ActiveRequest = { controller, key: request.inputKey, sequence };
    activeRequestRef.current = active;
    setState({
      inputKey: request.inputKey,
      page: null,
      index: targetIndex,
      total: request.total,
      nextIndex: null,
      loading: true,
      error: null,
      paused: false,
    });

    void executeBaziRangeWorker({ ...request, index: targetIndex }, controller.signal)
      .then((page) => {
        if (
          !isCurrentRequest(activeRequestRef.current, request.inputKey, sequence) ||
          page.inputKey !== request.inputKey ||
          page.index !== targetIndex
        ) {
          return;
        }
        activeRequestRef.current = null;
        setState({
          inputKey: request.inputKey,
          page,
          index: page.index,
          total: page.total,
          nextIndex: page.nextIndex,
          loading: false,
          error: null,
          paused: false,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest(activeRequestRef.current, request.inputKey, sequence)) return;
        activeRequestRef.current = null;
        setState((current) => ({
          ...current,
          inputKey: request.inputKey,
          page: null,
          index: targetIndex,
          total: request.total,
          nextIndex: null,
          loading: false,
          error: getErrorMessage(error),
          paused: false,
        }));
      });
  }, []);

  useEffect(() => {
    const previous = activeRequestRef.current;
    activeRequestRef.current = null;
    previous?.controller.abort();
    sequenceRef.current += 1;

    if (!preparation.request) {
      setState({
        inputKey: preparation.key,
        page: null,
        index: 0,
        total: preparation.total,
        nextIndex: null,
        loading: false,
        error: preparation.error,
        paused: false,
      });
      return;
    }

    launch(preparation.request, 0);
    return () => {
      const active = activeRequestRef.current;
      if (active && active.key === preparation.request?.inputKey) {
        activeRequestRef.current = null;
        active.controller.abort();
      }
      sequenceRef.current += 1;
    };
  }, [launch, preparation]);

  const goTo = useCallback(
    (targetIndex: number) => {
      const request = preparation.request;
      if (!request) return;
      if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex >= request.total) {
        setState((current) =>
          current.inputKey === request.inputKey
            ? { ...current, error: INVALID_INDEX_MESSAGE }
            : current,
        );
        return;
      }
      launch(request, targetIndex);
    },
    [launch, preparation.request],
  );

  const previous = useCallback(() => {
    if (state.index <= 0) return;
    goTo(state.index - 1);
  }, [goTo, state.index]);

  const next = useCallback(() => {
    if (state.nextIndex === null) return;
    goTo(state.nextIndex);
  }, [goTo, state.nextIndex]);

  const cancel = useCallback(() => {
    const active = activeRequestRef.current;
    if (active) {
      activeRequestRef.current = null;
      active.controller.abort();
    }
    const key = preparation.request?.inputKey;
    if (!key) return;
    setState((current) =>
      current.inputKey === key
        ? { ...current, loading: false, error: null, paused: true }
        : current,
    );
  }, [preparation.request?.inputKey]);

  const resume = useCallback(() => {
    const request = preparation.request;
    if (!request || !state.paused) return;
    goTo(state.index);
  }, [goTo, preparation.request, state.index, state.paused]);

  const retry = useCallback(() => {
    const request = preparation.request;
    if (!request) return;
    goTo(state.index);
  }, [goTo, preparation.request, state.index]);

  const current = state.inputKey === preparation.key;
  return {
    requested: preparation.requested,
    loading: current ? state.loading : false,
    error: preparation.error ?? (current ? state.error : null),
    page: current ? state.page : null,
    index: current ? state.index : 0,
    total: preparation.total,
    nextIndex: current ? state.nextIndex : null,
    previous,
    next,
    goTo,
    cancel,
    resume,
    retry,
    paused: current ? state.paused : false,
  };
}
