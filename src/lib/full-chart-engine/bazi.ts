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
  const hasClockTime = [input.birthHour, input.birthMinute].every(
    (value) => value !== undefined && String(value).trim() !== '',
  );
  const hasPreciseStandardTime =
    !input.useTrueSolarTime && input.birthSecond !== undefined && input.birthSecond !== '';
  if (!input.useTrueSolarTime && input.timeIndex === -1 && !hasPreciseStandardTime) {
    const validated = buildBaziPersonInput(
      applyFrontendBirthTimeDefaults({ ...input, timeIndex: 6 }),
    );
    return { ...validated, timeIndex: -1, isThreePillars: true };
  }
  // 精准时间表单没有单独的秒字段；未选时辰时，以完整时分和零秒传入核心。
  const preciseInput =
    !input.useTrueSolarTime &&
    input.timeIndex === '' &&
    hasClockTime &&
    (input.birthSecond === undefined || input.birthSecond === '')
      ? { ...input, birthSecond: 0 }
      : input;
  return buildBaziPersonInput(applyFrontendBirthTimeDefaults(preciseInput));
}

/** 页面兼容名称；传统盘计算直接复用 mingyu-core。 */
export function calculateFullBaziChart(person: Person): BaziChartResult {
  return baziCalculator.calculateBazi(person);
}
