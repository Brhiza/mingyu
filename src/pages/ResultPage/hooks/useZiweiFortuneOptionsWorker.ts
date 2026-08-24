import { useEffect, useRef, useState } from 'react';
import type { ChartInput } from '@/types/chart';
import { createSecureId } from '@/lib/secure-id';
import { createBoundedMemoryCache } from '@/lib/bounded-memory-cache';
import type { ZiweiDayOption, ZiweiMonthOption, ZiweiYearOption } from '../ResultPage.types';

interface SelectedDecadal {
  startAge: number;
  endAge: number;
  dateStr: string;
}

interface ZiweiFortuneOptionsData {
  yearOptions: ZiweiYearOption[];
  monthOptions: ZiweiMonthOption[];
  dayOptions: ZiweiDayOption[];
  effectiveYearDateStr?: string;
  effectiveMonthDateStr?: string;
}

const fortuneOptionsCache = createBoundedMemoryCache<ZiweiFortuneOptionsData>(24);

export interface ZiweiFortuneOptions {
  yearOptions: ZiweiYearOption[];
  monthOptions: ZiweiMonthOption[];
  dayOptions: ZiweiDayOption[];
  isLoading: boolean;
  effectiveYearDateStr?: string;
  effectiveMonthDateStr?: string;
}

export function useZiweiFortuneOptionsWorker(
  chartInput: ChartInput,
  birthSolarDate: string,
  hourIndex: number,
  selectedDecadal: SelectedDecadal | null,
  draftYearDateStr: string,
  draftMonthDateStr: string,
  draftDecadalIndex: number,
): ZiweiFortuneOptions {
  const requestKey = JSON.stringify({
    chartInput,
    birthSolarDate,
    hourIndex,
    selectedDecadal,
    draftYearDateStr,
    draftMonthDateStr,
    draftDecadalIndex,
  });
  const initialCached = fortuneOptionsCache.get(requestKey);
  const [yearOptions, setYearOptions] = useState<ZiweiYearOption[]>(
    () => initialCached?.yearOptions ?? [],
  );
  const [monthOptions, setMonthOptions] = useState<ZiweiMonthOption[]>(
    () => initialCached?.monthOptions ?? [],
  );
  const [dayOptions, setDayOptions] = useState<ZiweiDayOption[]>(
    () => initialCached?.dayOptions ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [effectiveYearDateStr, setEffectiveYearDateStr] = useState<string | undefined>(
    initialCached?.effectiveYearDateStr,
  );
  const [effectiveMonthDateStr, setEffectiveMonthDateStr] = useState<string | undefined>(
    initialCached?.effectiveMonthDateStr,
  );
  const workerRef = useRef<Worker | null>(null);

  // 组件卸载时清理 worker
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const cached = fortuneOptionsCache.get(requestKey);
    if (cached) {
      setYearOptions(cached.yearOptions);
      setMonthOptions(cached.monthOptions);
      setDayOptions(cached.dayOptions);
      setEffectiveYearDateStr(cached.effectiveYearDateStr);
      setEffectiveMonthDateStr(cached.effectiveMonthDateStr);
      setIsLoading(false);
      return;
    }

    // 惰性创建：如果 workerRef 为空（初始或脚本加载失败后）则重新创建
    if (!workerRef.current) {
      const worker = new Worker(
        new URL('../../../workers/ziwei-fortune-options.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      const handleFailure = () => {
        setYearOptions([]);
        setMonthOptions([]);
        setDayOptions([]);
        setEffectiveYearDateStr(undefined);
        setEffectiveMonthDateStr(undefined);
        setIsLoading(false);
        // worker 脚本加载/执行失败时 terminate 并清空引用，下次依赖变化时将重建
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = handleFailure;
      worker.onmessageerror = handleFailure;
    }

    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    const requestId = `${draftDecadalIndex}-${draftYearDateStr}-${draftMonthDateStr}-${createSecureId()}`;
    setIsLoading(true);

    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
      setYearOptions([]);
      setMonthOptions([]);
      setDayOptions([]);
      setEffectiveYearDateStr(undefined);
      setEffectiveMonthDateStr(undefined);
      setIsLoading(false);
    }, 30000);

    workerRef.current.onmessage = (
      event: MessageEvent<{
        id: string;
        ok: boolean;
        yearOptions?: ZiweiYearOption[];
        monthOptions?: ZiweiMonthOption[];
        dayOptions?: ZiweiDayOption[];
        effectiveYearDateStr?: string;
        effectiveMonthDateStr?: string;
      }>,
    ) => {
      if (event.data.id !== requestId || settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);

      if (event.data.ok) {
        const next: ZiweiFortuneOptionsData = {
          yearOptions: event.data.yearOptions ?? [],
          monthOptions: event.data.monthOptions ?? [],
          dayOptions: event.data.dayOptions ?? [],
          effectiveYearDateStr: event.data.effectiveYearDateStr,
          effectiveMonthDateStr: event.data.effectiveMonthDateStr,
        };
        fortuneOptionsCache.set(requestKey, next);
        setYearOptions(next.yearOptions);
        setMonthOptions(next.monthOptions);
        setDayOptions(next.dayOptions);
        setEffectiveYearDateStr(next.effectiveYearDateStr);
        setEffectiveMonthDateStr(next.effectiveMonthDateStr);
      } else {
        setYearOptions([]);
        setMonthOptions([]);
        setDayOptions([]);
        setEffectiveYearDateStr(undefined);
        setEffectiveMonthDateStr(undefined);
      }

      setIsLoading(false);
    };

    workerRef.current.postMessage({
      id: requestId,
      input: chartInput,
      birthSolarDate,
      hourIndex,
      selectedDecadal,
      selectedYearDateStr: draftYearDateStr,
      selectedMonthDateStr: draftMonthDateStr,
    });

    return () => {
      if (!settled) {
        worker.terminate();
        if (workerRef.current === worker) {
          workerRef.current = null;
        }
      }
      settled = true;
      window.clearTimeout(timer);
    };
  }, [
    birthSolarDate,
    chartInput,
    hourIndex,
    draftDecadalIndex,
    draftMonthDateStr,
    draftYearDateStr,
    selectedDecadal,
    requestKey,
  ]);

  return {
    yearOptions,
    monthOptions,
    dayOptions,
    isLoading,
    effectiveYearDateStr,
    effectiveMonthDateStr,
  };
}
