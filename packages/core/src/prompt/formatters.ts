import { getDivinationTime, LunarUtil } from '../calendar';
import type { DivinationMethodId } from '../divination/config';
import type { DivinationData, SupplementaryInfo } from '../types/divination';

type SupportedMethod = Exclude<DivinationMethodId, 'random'>;

function resolveDivinationDate(data?: DivinationData): Date | undefined {
  if (!data || !('timestamp' in data)) return undefined;
  if (typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp)) {
    throw new TypeError('占课时间戳必须是有限毫秒数。');
  }
  const date = new Date(data.timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('占课时间戳无法转换为有效日期。');
  }
  return date;
}

export function resolveDivinationTimezoneOffset(data?: DivinationData): number | undefined {
  if (data && 'timezoneOffsetMinutes' in data) return data.timezoneOffsetMinutes;
  return data && 'mainHexagram' in data ? data.calculation?.timezoneOffsetMinutes : undefined;
}

/** 格式化占课时间；没有时间戳时使用当前时间，显式无效时间戳直接报错。 */
export function buildTimeInfoText(data?: DivinationData) {
  const date = resolveDivinationDate(data);
  const termTimestamp =
    data && 'termReferenceTimestamp' in data ? data.termReferenceTimestamp : undefined;
  if (
    termTimestamp !== undefined &&
    (typeof termTimestamp !== 'number' || !Number.isFinite(termTimestamp))
  ) {
    throw new TypeError('节气参考时间戳必须是有限毫秒数。');
  }
  const termReferenceDate = termTimestamp === undefined ? undefined : new Date(termTimestamp);
  const isXiaoliuren = Boolean(data && 'lunarMonth' in data && 'hourIndex' in data);
  const savedOffset = resolveDivinationTimezoneOffset(data);
  const timeInfo = date
    ? getDivinationTime(date, isXiaoliuren ? 480 : savedOffset, termReferenceDate).timeInfo
    : getDivinationTime().timeInfo;
  const civilLunar =
    isXiaoliuren && termReferenceDate
      ? getDivinationTime(termReferenceDate, 480).timeInfo.lunar
      : undefined;
  const display = LunarUtil.formatTimeDisplay(
    civilLunar
      ? { ...timeInfo, lunar: { ...civilLunar, hourInChinese: timeInfo.lunar.hourInChinese } }
      : timeInfo,
  );
  return [display.solar, display.lunar, display.ganzhi, `节气：${timeInfo.jieQi}`].join('\n');
}

/** 只格式化当地民用公历时间；显式无效时间戳直接报错。 */
export function buildSolarTimeInfoText(data?: DivinationData) {
  const date = resolveDivinationDate(data);
  const savedOffset = resolveDivinationTimezoneOffset(data);
  const timeInfo = date
    ? getDivinationTime(date, savedOffset).timeInfo
    : getDivinationTime().timeInfo;
  return LunarUtil.formatTimeDisplay(timeInfo).solar;
}

export function formatGanzhi(ganzhi?: { year: string; month: string; day: string; hour: string }) {
  if (!ganzhi) return '干支：未给出';
  return `干支：${ganzhi.year}年 ${ganzhi.month}月 ${ganzhi.day}日 ${ganzhi.hour}时`;
}

/**
 * 将跨页面复用的补充资料转换为提示词正文。
 * 这里只处理客观输入，不包含表单状态、按钮文案或存储字段。
 */
export function formatSupplementaryInfoSection(
  method: SupportedMethod,
  supplementaryInfo?: SupplementaryInfo,
) {
  if (!supplementaryInfo) return '';

  const lines: string[] = [];
  const subjectParts = [
    supplementaryInfo.gender ? supplementaryInfo.gender : '',
    method !== 'qimen' && supplementaryInfo.birthYear
      ? `出生年份：${supplementaryInfo.birthYear}`
      : '',
  ].filter(Boolean);
  if (subjectParts.length) {
    lines.push(`求测人：${subjectParts.join('；')}`);
  }
  if (supplementaryInfo.userSupplement?.trim()) {
    lines.push(
      method === 'almanac'
        ? `择日补充：${supplementaryInfo.userSupplement.trim()}`
        : `现实背景：${supplementaryInfo.userSupplement.trim()}`,
    );
  }

  const contextFields = [
    ['当前情况', supplementaryInfo.currentSituation],
    ['当前状态', supplementaryInfo.currentState],
    ['已知事实', supplementaryInfo.knownFacts],
    ['期望结果', supplementaryInfo.desiredOutcome],
    ['现实限制', supplementaryInfo.constraints],
  ] as const;
  for (const [label, value] of contextFields) {
    if (value?.trim()) lines.push(`${label}：${value.trim()}`);
  }
  return lines.join('\n');
}

/** 创建不带方括号的通用文本分段，便于外部自行组合任务书。 */
export function buildSection(title: string, content: string) {
  const body = content.trim();
  return body ? `${title}\n${body}` : '';
}
