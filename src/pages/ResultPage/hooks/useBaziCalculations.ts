import { useMemo } from 'react';
import { buildPersonFromInput, calculateFullBaziChart } from '@/lib/full-chart-engine';
import type { BaziChartResult } from 'mingyu-core/bazi';
import type { QueryInputState } from '@/lib/query-state';

export interface BaziCalculations {
  baziResult: BaziChartResult | null;
  partnerBaziResult: BaziChartResult | null;
  baziError: string;
}

export function useBaziCalculations(inputState: QueryInputState): BaziCalculations {
  const primaryBazi = useMemo(() => {
    try {
      return { result: calculateFullBaziChart(buildPersonFromInput(inputState)), error: '' };
    } catch (error) {
      return {
        result: null as BaziChartResult | null,
        error: error instanceof Error ? error.message : '八字排盘失败。',
      };
    }
  }, [inputState]);

  const partnerBazi = useMemo(() => {
    if (inputState.analysisMode !== 'compatibility') {
      return { result: null as BaziChartResult | null, error: undefined as string | undefined };
    }

    try {
      const partner = buildPersonFromInput({
        gender: inputState.partnerGender,
        year: inputState.partnerYear,
        month: inputState.partnerMonth,
        day: inputState.partnerDay,
        timeIndex: inputState.partnerTimeIndex,
        dateType: inputState.partnerDateType,
        isLeapMonth: inputState.partnerIsLeapMonth,
        useTrueSolarTime: inputState.partnerUseTrueSolarTime,
        birthHour: inputState.partnerBirthHour,
        birthMinute: inputState.partnerBirthMinute,
        birthPlace: inputState.partnerBirthPlace,
        birthLongitude: inputState.partnerBirthLongitude,
      });
      return { result: calculateFullBaziChart(partner), error: '' };
    } catch (error) {
      return {
        result: null as BaziChartResult | null,
        error: error instanceof Error ? error.message : '第二人八字排盘失败。',
      };
    }
  }, [inputState]);

  return {
    baziResult: primaryBazi.result,
    partnerBaziResult: partnerBazi.result,
    baziError: partnerBazi.error !== undefined ? partnerBazi.error : primaryBazi.error,
  };
}
