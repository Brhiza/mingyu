import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type {
  AstrolabeDynamicRangeRequest,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { executeAstrolabeDynamicRangeWorker } from '@/lib/astrolabe-dynamic-range';
import {
  createAstrolabeDynamicRangeStore,
  type AstrolabeDynamicBranchIndex,
  type AstrolabeDynamicRangeStore,
} from '@/lib/astrolabe-dynamic-range-store';

type RangeState = {
  key: string;
  loading: boolean;
  paused: boolean;
  error: string | null;
  summary: AstrolabeDynamicRangeSummary | null;
  branches: AstrolabeDynamicBranchIndex[];
  progress: { completed: number; total: number };
};

const emptyState = (key: string): RangeState => ({
  key,
  loading: false,
  paused: false,
  error: null,
  summary: null,
  branches: [],
  progress: { completed: 0, total: 0 },
});

/** 用户启动后逐段计算并保存，React 状态只保留分段索引。 */
export function useAstrolabeDynamicRange(
  input: AstrolabeBirthInput | null,
  source: BaziReverseSource | null,
  request: AstrolabeDynamicRangeRequest | null,
  enabled: boolean,
) {
  const key = enabled && input && source && request ? JSON.stringify([input, source, request]) : '';
  const [run, setRun] = useState({ key: '', sequence: 0 });
  const consumedSequence = useRef(0);
  const [state, setState] = useState<RangeState>(() => emptyState(''));
  const activeRef = useRef<{
    key: string;
    controller: AbortController;
    store: AstrolabeDynamicRangeStore | null;
    resume: (() => void) | null;
    completeAll: boolean;
  } | null>(null);

  useEffect(() => {
    if (!key || run.key !== key || consumedSequence.current === run.sequence) {
      setState(emptyState(key));
      return;
    }
    consumedSequence.current = run.sequence;
    const [currentInput, currentSource, currentRequest] = JSON.parse(key) as [
      AstrolabeBirthInput,
      BaziReverseSource,
      AstrolabeDynamicRangeRequest,
    ];
    const active = {
      key,
      controller: new AbortController(),
      store: null as AstrolabeDynamicRangeStore | null,
      resume: null as (() => void) | null,
      completeAll: false,
    };
    activeRef.current = active;
    let mounted = true;
    setState({ ...emptyState(key), loading: true });
    const branches: AstrolabeDynamicBranchIndex[] = [];
    let batchEnd = (currentSource.startTimestamp ?? 0) + 60_000;
    void (async () => {
      try {
        const store = await createAstrolabeDynamicRangeStore();
        if (!mounted) {
          await store.dispose();
          return;
        }
        active.store = store;
        const summary = await executeAstrolabeDynamicRangeWorker(
          currentInput,
          currentSource,
          currentRequest,
          async (branch) => {
            const entry = await store.put(branches.length, branch);
            if (!mounted || active.controller.signal.aborted) return;
            branches.push(entry);
            setState((current) => ({ ...current, branches: [...branches] }));
            if (
              !active.completeAll &&
              entry.endTimestamp >= batchEnd &&
              entry.endTimestamp < (currentSource.endTimestamp ?? 0)
            ) {
              setState((current) => ({ ...current, paused: true }));
              await new Promise<void>((resolve) => {
                active.resume = () => resolve();
                active.controller.signal.addEventListener('abort', active.resume, { once: true });
              });
              if (active.resume)
                active.controller.signal.removeEventListener('abort', active.resume);
              active.resume = null;
              batchEnd = entry.endTimestamp + 60_000;
              if (mounted) setState((current) => ({ ...current, paused: false }));
            }
          },
          {
            signal: active.controller.signal,
            onProgress(completed, total) {
              if (mounted) setState((current) => ({ ...current, progress: { completed, total } }));
            },
          },
        );
        if (mounted)
          setState((current) => ({ ...current, loading: false, paused: false, summary }));
      } catch (error) {
        if (mounted)
          setState((current) => ({
            ...current,
            loading: false,
            paused: false,
            error: error instanceof Error ? error.message : '动态区间计算失败。',
          }));
      }
    })();
    return () => {
      mounted = false;
      active.controller.abort();
      if (activeRef.current === active) activeRef.current = null;
      void active.store
        ?.dispose()
        .catch((error) => console.error('清除动态区间临时资料失败。', error));
    };
  }, [key, run]);

  const start = useCallback(() => {
    if (key) setRun((current) => ({ key, sequence: current.sequence + 1 }));
  }, [key]);
  const cancel = useCallback(() => activeRef.current?.controller.abort(), []);
  const continueCalculation = useCallback(
    (completeAll = false) => {
      const active = activeRef.current;
      if (!active || active.key !== key) return;
      active.completeAll = completeAll;
      active.resume?.();
    },
    [key],
  );
  const readBranch = useCallback(
    async (index: number) => {
      const active = activeRef.current;
      if (!active || active.key !== key || !active.store)
        throw new Error('动态区间分段尚未准备好。');
      return active.store.read(index);
    },
    [key],
  );
  const visible = useMemo(() => (state.key === key ? state : emptyState(key)), [state, key]);
  return { ...visible, start, cancel, continueCalculation, readBranch };
}
