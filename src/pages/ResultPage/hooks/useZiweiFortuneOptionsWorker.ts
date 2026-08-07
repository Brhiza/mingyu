import { useEffect, useRef, useState } from 'react';
import type { ChartInput } from '@/types/chart';
import { createSecureId } from '@/lib/secure-id';
import type { ZiweiDayOption, ZiweiMonthOption, ZiweiYearOption } from '../ResultPage.types';

interface SelectedDecadal {
  startAge: number;
  endAge: number;
  dateStr: string;
}

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
  const [yearOptions, setYearOptions] = useState<ZiweiYearOption[]>([]);
  const [monthOptions, setMonthOptions] = useState<ZiweiMonthOption[]>([]);
  const [dayOptions, setDayOptions] = useState<ZiweiDayOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [effectiveYearDateStr, setEffectiveYearDateStr] = useState<string | undefined>(undefined);
  const [effectiveMonthDateStr, setEffectiveMonthDateStr] = useState<string | undefined>(undefined);
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
        setYearOptions(event.data.yearOptions ?? []);
        setMonthOptions(event.data.monthOptions ?? []);
        setDayOptions(event.data.dayOptions ?? []);
        setEffectiveYearDateStr(event.data.effectiveYearDateStr);
        setEffectiveMonthDateStr(event.data.effectiveMonthDateStr);
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
