import {
  baziCalculator,
  buildBaziPersonInput,
  type BaziChartResult,
  type BaziChartInputDraft,
  type Person,
} from 'mingyu-core/bazi';
import { applyFrontendBirthTimeDefaults } from '@/lib/time-policy';

/** 页面兼容名称；实际输入校验与转换由 mingyu-core 统一提供。 */
export function buildPersonFromInput(input: BaziChartInputDraft): Person {
  const hasClockInput = [input.birthHour, input.birthMinute, input.birthSecond].some(
    (value) => value !== undefined && String(value).trim() !== '',
  );
  if (!input.useTrueSolarTime && input.timeIndex === -1 && !hasClockInput) {
    const validated = buildBaziPersonInput(
      applyFrontendBirthTimeDefaults({ ...input, timeIndex: 6 }),
    );
    return { ...validated, timeIndex: -1, isThreePillars: true };
  }
  return buildBaziPersonInput(applyFrontendBirthTimeDefaults(input));
}

/** 页面兼容名称；传统盘计算直接复用 mingyu-core。 */
export function calculateFullBaziChart(person: Person): BaziChartResult {
  return baziCalculator.calculateBazi(person);
}
