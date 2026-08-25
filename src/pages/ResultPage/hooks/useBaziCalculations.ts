import { buildPersonFromInput, calculateFullBaziChart } from '@/lib/full-chart-engine/bazi';
import { createBoundedMemoryCache } from '@/lib/bounded-memory-cache';
import type { BaziChartResult } from 'mingyu-core/bazi';
import type { QueryInputState } from '@/lib/query-state';

export interface BaziCalculations {
  baziResult: BaziChartResult | null;
  partnerBaziResult: BaziChartResult | null;
  baziError: string;
}

const baziResultCache = createBoundedMemoryCache<BaziChartResult>(8);

function calculateCachedBaziChart(input: Parameters<typeof buildPersonFromInput>[0]) {
  const person = buildPersonFromInput(input);
  const cacheKey = JSON.stringify(person);
  const cached = baziResultCache.get(cacheKey);
  if (cached) return cached;

  const result = calculateFullBaziChart(person);
  baziResultCache.set(cacheKey, result);
  return result;
}

export function useBaziCalculations(inputState: QueryInputState): BaziCalculations {
  let primaryBazi: { result: BaziChartResult | null; error: string };
  try {
    primaryBazi = { result: calculateCachedBaziChart(inputState), error: '' };
  } catch (error) {
    primaryBazi = {
      result: null,
      error: error instanceof Error ? error.message : '八字排盘失败。',
    };
  }

  let partnerBazi: {
    result: BaziChartResult | null;
    error: string | undefined;
  } = { result: null, error: undefined };

  if (inputState.analysisMode === 'compatibility') {
    try {
      partnerBazi = {
        result: calculateCachedBaziChart({
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
        }),
        error: '',
      };
    } catch (error) {
      partnerBazi = {
        result: null,
        error: error instanceof Error ? error.message : '第二人八字排盘失败。',
      };
    }
  }

  return {
    baziResult: primaryBazi.result,
    partnerBaziResult: partnerBazi.result,
    baziError: partnerBazi.error !== undefined ? partnerBazi.error : primaryBazi.error,
  };
}
