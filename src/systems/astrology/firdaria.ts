/**
 * A4 · 古典西洋占星法达星限（Firdaria）计算引擎
 *
 * 严格遵循波斯/中世纪古典法达星限（75 年循环）：
 * - 昼盘顺次：太阳(10年) → 金星(8年) → 水星(13年) → 月亮(9年) → 土星(11年) → 木星(12年) → 火星(7年) → 北交点(3年) → 南交点(2年)
 * - 夜盘顺次：月亮(9年) → 土星(11年) → 木星(12年) → 火星(7年) → 太阳(10年) → 金星(8年) → 水星(13年) → 北交点(3年) → 南交点(2年)
 * - 七大传统行星主限各均分为 7 段副限（自本星起按迦勒底星序轮转）；南北交点主限无副限。
 */

const CHALDEAN_ORDER = ['土星', '木星', '火星', '太阳', '金星', '水星', '月亮'] as const;

interface FirdariaMajorDef {
  ruler: string;
  years: number;
  hasSubPeriods: boolean;
}

const DAY_SEQUENCE: readonly FirdariaMajorDef[] = [
  { ruler: '太阳', years: 10, hasSubPeriods: true },
  { ruler: '金星', years: 8, hasSubPeriods: true },
  { ruler: '水星', years: 13, hasSubPeriods: true },
  { ruler: '月亮', years: 9, hasSubPeriods: true },
  { ruler: '土星', years: 11, hasSubPeriods: true },
  { ruler: '木星', years: 12, hasSubPeriods: true },
  { ruler: '火星', years: 7, hasSubPeriods: true },
  { ruler: '北交点', years: 3, hasSubPeriods: false },
  { ruler: '南交点', years: 2, hasSubPeriods: false },
];

const NIGHT_SEQUENCE: readonly FirdariaMajorDef[] = [
  { ruler: '月亮', years: 9, hasSubPeriods: true },
  { ruler: '土星', years: 11, hasSubPeriods: true },
  { ruler: '木星', years: 12, hasSubPeriods: true },
  { ruler: '火星', years: 7, hasSubPeriods: true },
  { ruler: '太阳', years: 10, hasSubPeriods: true },
  { ruler: '金星', years: 8, hasSubPeriods: true },
  { ruler: '水星', years: 13, hasSubPeriods: true },
  { ruler: '北交点', years: 3, hasSubPeriods: false },
  { ruler: '南交点', years: 2, hasSubPeriods: false },
];

export interface FirdariaSnapshot {
  dayChart: boolean;
  ageYears: number;
  majorRuler: string;
  majorStartAge: number;
  majorEndAge: number;
  subRuler: string | null;
  subIndex: number | null;
  summaryText: string;
}

const TROPICAL_YEAR_MS = 365.24219 * 86_400_000;

export function calculateFirdaria(
  birthUtcIso: string,
  referenceUtcIso: string,
  dayChart: boolean,
): FirdariaSnapshot | null {
  const birthMs = Date.parse(birthUtcIso);
  const refMs = Date.parse(referenceUtcIso);
  if (!Number.isFinite(birthMs) || !Number.isFinite(refMs) || refMs < birthMs) return null;

  const exactAge = (refMs - birthMs) / TROPICAL_YEAR_MS;
  const cycleAge = exactAge % 75;
  const cycleBase = Math.floor(exactAge / 75) * 75;
  const seq = dayChart ? DAY_SEQUENCE : NIGHT_SEQUENCE;

  let cursor = 0;
  for (const major of seq) {
    const end = cursor + major.years;
    if (cycleAge < end || major === seq[seq.length - 1]) {
      const majorStartAge = cycleBase + cursor;
      const majorEndAge = cycleBase + end;
      let subRuler: string | null = null;
      let subIndex: number | null = null;
      if (major.hasSubPeriods) {
        const subLen = major.years / 7;
        const offset = Math.min(6, Math.max(0, Math.floor((cycleAge - cursor) / subLen)));
        const startIdx = CHALDEAN_ORDER.indexOf(major.ruler as (typeof CHALDEAN_ORDER)[number]);
        if (startIdx >= 0) {
          subRuler = CHALDEAN_ORDER[(startIdx + offset) % 7]!;
          subIndex = offset + 1;
        }
      }
      const subDesc = subRuler ? ` · 副限${subRuler}（第${subIndex}/7段）` : '（交点限不分副限）';
      return {
        dayChart,
        ageYears: Number(exactAge.toFixed(2)),
        majorRuler: major.ruler,
        majorStartAge,
        majorEndAge,
        subRuler,
        subIndex,
        summaryText: `${dayChart ? '昼盘' : '夜盘'}法达星限（实龄约 ${exactAge.toFixed(1)} 岁）：主限${major.ruler}（${majorStartAge}–${majorEndAge} 岁）${subDesc}`,
      };
    }
    cursor = end;
  }
  return null;
}
