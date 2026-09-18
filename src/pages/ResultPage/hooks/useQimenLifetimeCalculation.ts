import { useEffect, useState } from 'react';
import type { QimenLifetimeData, QimenLifetimeInput } from 'mingyu-core/types';
import { executeQimenLifetimeWorker } from '@/lib/ai/qimen-lifetime-worker';

/** 每次输入变化终止旧计算，避免旧候选秒结果覆盖当前页。 */
export function useQimenLifetimeCalculation(input: QimenLifetimeInput | null, revision: number) {
  const key = JSON.stringify([input, revision]);
  const [state, setState] = useState<{
    key: string;
    data: QimenLifetimeData | null;
    error: string;
  }>({ key: '', data: null, error: '' });
  useEffect(() => {
    if (!input) return;
    const controller = new AbortController();
    void executeQimenLifetimeWorker(input, undefined, controller.signal).then(
      ({ result }) => {
        if (!controller.signal.aborted) setState({ key, data: result, error: '' });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            data: null,
            error: error instanceof Error ? error.message : '奇门终身局排盘失败。',
          });
      },
    );
    return () => controller.abort();
  }, [input, key]);
  return state.key === key ? state : { key, data: null, error: '' };
}
