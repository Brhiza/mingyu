import type { QizhengInput } from 'mingyu-core/qizheng';

export type QizhengFlowTarget = Pick<
  QizhengInput,
  'flowYear' | 'flowMonth' | 'flowDay' | 'flowHour' | 'flowMinute'
>;

export const QIZHENG_FLOW_TARGET_PARAM = 'qf';
const FIELDS = ['flowYear', 'flowMonth', 'flowDay', 'flowHour', 'flowMinute'] as const;

/** URL 中只保存明确选择的流曜目标，本命身份由原出生输入提供。 */
export function parseQizhengFlowTarget(value: string | null): QizhengFlowTarget {
  if (value === null || value === '') return {};
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new Error('七政流曜目标格式无效，请重新选择目标时间。');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('七政流曜目标格式无效，请重新选择目标时间。');
  }
  const target = raw as Record<string, unknown>;
  if (
    Object.keys(target).some((key) => !FIELDS.includes(key as (typeof FIELDS)[number])) ||
    Object.values(target).some((item) => typeof item !== 'number' || !Number.isInteger(item))
  ) {
    throw new Error('七政流曜目标只能包含有效的年月日时分。');
  }
  const result = target as QizhengFlowTarget;
  if (Object.keys(target).length === 0) return {};
  if (result.flowYear === undefined || result.flowYear < 1900 || result.flowYear > 2200) {
    throw new Error('七政流年需在 1900 至 2200 年之间。');
  }
  if (result.flowMonth !== undefined && (result.flowMonth < 1 || result.flowMonth > 12)) {
    throw new Error('七政流月需在 1 至 12 月之间。');
  }
  if (result.flowDay !== undefined) {
    if (result.flowMonth === undefined) throw new Error('选择流日时需要同时选择月份。');
    const maxDay = new Date(Date.UTC(result.flowYear, result.flowMonth, 0)).getUTCDate();
    if (result.flowDay < 1 || result.flowDay > maxDay) throw new Error('七政流日日期无效。');
  }
  if (result.flowHour !== undefined || result.flowMinute !== undefined) {
    if (result.flowDay === undefined) throw new Error('选择流曜时分时需要完整年月日。');
    if (result.flowHour !== undefined && (result.flowHour < 0 || result.flowHour > 23)) {
      throw new Error('七政流曜小时需在 0 至 23 之间。');
    }
    if (result.flowMinute !== undefined && (result.flowMinute < 0 || result.flowMinute > 59)) {
      throw new Error('七政流曜分钟需在 0 至 59 之间。');
    }
  }
  return result;
}
