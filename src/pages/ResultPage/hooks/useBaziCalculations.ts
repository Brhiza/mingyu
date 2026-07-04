import { useMemo } from 'react';
import { buildPersonFromInput, calculateFullBaziChart } from '@/lib/full-chart-engine';
import {
  buildThreePillarsProfile,
  isUnknownTimeIndex,
  type ThreePillarsProfile,
} from '@/lib/birth-time-reverse';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { QueryInputState } from '@/lib/query-state';

export interface BaziCalculations {
  baziResult: BaziChartResult | null;
  partnerBaziResult: BaziChartResult | null;
  baziError: string;
  primaryThreePillarsState: { profile: ThreePillarsProfile | null; error: string };
  partnerThreePillarsState: { profile: ThreePillarsProfile | null; error: string };
  primaryHasUnknownTime: boolean;
  partnerHasUnknownTime: boolean;
  hasUnknownBirthTime: boolean;
}

export function useBaziCalculations(inputState: QueryInputState): BaziCalculations {
  const primaryHasUnknownTime =
    !inputState.useTrueSolarTime && isUnknownTimeIndex(inputState.timeIndex);
  const partnerHasUnknownTime =
    inputState.analysisMode === 'compatibility' &&
    !inputState.partnerUseTrueSolarTime &&
    isUnknownTimeIndex(inputState.partnerTimeIndex);
  const hasUnknownBirthTime = primaryHasUnknownTime || partnerHasUnknownTime;

  const primaryThreePillarsState = useMemo(() => {
    if (!primaryHasUnknownTime) {
      return { profile: null as ThreePillarsProfile | null, error: '' };
    }
    try {
      return {
        profile: buildThreePillarsProfile({
          gender: inputState.gender,
          dateType: inputState.dateType,
          year: inputState.year,
          month: inputState.month,
          day: inputState.day,
          isLeapMonth: inputState.isLeapMonth,
        }),
        error: '',
      };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : '三柱排盘失败。',
      };
    }
  }, [
    inputState.dateType,
    inputState.day,
    inputState.gender,
    inputState.isLeapMonth,
    inputState.month,
    inputState.year,
    primaryHasUnknownTime,
  ]);

  const partnerThreePillarsState = useMemo(() => {
    if (!partnerHasUnknownTime) {
      return { profile: null as ThreePillarsProfile | null, error: '' };
    }
    try {
      return {
        profile: buildThreePillarsProfile({
          gender: inputState.partnerGender,
          dateType: inputState.partnerDateType,
          year: inputState.partnerYear,
          month: inputState.partnerMonth,
          day: inputState.partnerDay,
          isLeapMonth: inputState.partnerIsLeapMonth,
        }),
        error: '',
      };
    } catch (error) {
      return {
        profile: null,
        error: error instanceof Error ? error.message : '第二人三柱排盘失败。',
      };
    }
  }, [
    inputState.partnerDateType,
    inputState.partnerDay,
    inputState.partnerGender,
    inputState.partnerIsLeapMonth,
    inputState.partnerMonth,
    inputState.partnerYear,
    partnerHasUnknownTime,
  ]);

  const primaryBazi = useMemo(() => {
    if (primaryHasUnknownTime) {
      return { result: null as BaziChartResult | null, error: primaryThreePillarsState.error };
    }
    try {
      return { result: calculateFullBaziChart(buildPersonFromInput(inputState)), error: '' };
    } catch (err) {
      return {
        result: null as BaziChartResult | null,
        error: err instanceof Error ? err.message : '八字排盘失败。',
      };
    }
  }, [inputState, primaryHasUnknownTime, primaryThreePillarsState.error]);

  const partnerBazi = useMemo(() => {
    if (inputState.analysisMode !== 'compatibility') {
      return { result: null as BaziChartResult | null, error: undefined as string | undefined };
    }
    if (partnerHasUnknownTime) {
      return { result: null as BaziChartResult | null, error: partnerThreePillarsState.error };
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
    } catch (err) {
      return {
        result: null as BaziChartResult | null,
        error: err instanceof Error ? err.message : '第二人八字排盘失败。',
      };
    }
  }, [inputState, partnerHasUnknownTime, partnerThreePillarsState.error]);

  const baziResult = primaryBazi.result;
  const partnerBaziResult = partnerBazi.result;
  const baziError = partnerBazi.error !== undefined ? partnerBazi.error : primaryBazi.error;

  return {
    baziResult,
    partnerBaziResult,
    baziError,
    primaryThreePillarsState,
    partnerThreePillarsState,
    primaryHasUnknownTime,
    partnerHasUnknownTime,
    hasUnknownBirthTime,
  };
}
