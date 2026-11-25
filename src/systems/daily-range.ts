/**
 * 手动区间流日解析与压平渲染（支持自定义 1–31 天区间、整周 7 天、整月 28–31 天）
 *
 * 严格遵循“精简不冗长、不写逐日喜忌”原则：
 * - 八字流日：每 7–8 天一行，仅输出 M/D干支 与关键月日支六冲（冲日支/冲月支/冲月日支），31 天仅约 320 字
 * - 紫微流日：每 7–8 天一行，输出 M/D干支(落X宫·忌Y)，按流日地支定位对应本命宫位与流日天干化忌星
 */
import { getSixtyCycleName, isLiuchong } from './ganzhi-foundation';
import type { BaziPillar, PillarName } from './bazi/pillars';
import type { TargetDate } from '../router-model/fortune-scope';

export type DailyRangeInput =
  | { startDate: string; endDate: string }
  | { preset: 'week'; anchorDate?: string }
  | { preset: 'month'; year?: number; month?: number; anchorDate?: string };

export interface ResolvedDailyRange {
  startDate: string;
  endDate: string;
  daysCount: number;
  label: string;
  dates: TargetDate[];
}

const BEIJING_OFFSET_MS = 8 * 3_600_000;
const BASE_DAY_UTC = Date.UTC(2000, 0, 1); // 2000-01-01 = 戊午 (54)
const MAX_RANGE_DAYS = 31;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYMD(d: TargetDate): string {
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

function parseYMD(str: string): TargetDate {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`无效日期格式：${str}，请使用 YYYY-MM-DD`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    throw new Error(`不存在的公历日期：${str}`);
  }
  return { year, month, day };
}

function getBeijingToday(refTimestamp?: number): TargetDate {
  const ts = typeof refTimestamp === 'number' && Number.isFinite(refTimestamp) ? refTimestamp : Date.now();
  const d = new Date(ts + BEIJING_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addUtcDays(base: TargetDate, delta: number): TargetDate {
  const dt = new Date(Date.UTC(base.year, base.month - 1, base.day + delta));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function getExactDayGanZhi(year: number, month: number, day: number): string {
  const diffDays = Math.round((Date.UTC(year, month - 1, day) - BASE_DAY_UTC) / 86_400_000);
  return getSixtyCycleName(54 + diffDays);
}

/** 将任意手动 dailyRange 参数解析为 1–31 天精确公历日期数组 */
export function resolveDailyRange(
  input: DailyRangeInput,
  referenceTimestamp?: number,
): ResolvedDailyRange {
  const today = getBeijingToday(referenceTimestamp);

  if ('preset' in input) {
    if (input.preset === 'week') {
      const anchor = input.anchorDate ? parseYMD(input.anchorDate) : today;
      const dates = Array.from({ length: 7 }, (_, i) => addUtcDays(anchor, i));
      return {
        startDate: formatYMD(dates[0]),
        endDate: formatYMD(dates[dates.length - 1]),
        daysCount: dates.length,
        label: `整周流日（${formatYMD(dates[0])} 至 ${formatYMD(dates[6])}，共7天）`,
        dates,
      };
    }
    // preset === 'month'
    const anchor = input.anchorDate ? parseYMD(input.anchorDate) : today;
    const year = input.year ?? anchor.year;
    const month = input.month ?? anchor.month;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dates = Array.from({ length: lastDay }, (_, i) => ({ year, month, day: i + 1 }));
    return {
      startDate: formatYMD(dates[0]),
      endDate: formatYMD(dates[dates.length - 1]),
      daysCount: dates.length,
      label: `整月流日（${year}年${month}月，共${lastDay}天）`,
      dates,
    };
  }

  const start = parseYMD(input.startDate);
  const end = parseYMD(input.endDate);
  const diff = Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) /
      86_400_000,
  );
  if (diff < 0) {
    throw new Error(`流日区间结束日期（${input.endDate}）不能早于开始日期（${input.startDate}）`);
  }
  if (diff + 1 > MAX_RANGE_DAYS) {
    throw new Error(`单次手动区间流日最多支持 ${MAX_RANGE_DAYS} 天（当前请求 ${diff + 1} 天）`);
  }
  const dates = Array.from({ length: diff + 1 }, (_, i) => addUtcDays(start, i));
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    daysCount: dates.length,
    label: `指定区间流日（${input.startDate} 至 ${input.endDate}，共${dates.length}天）`,
    dates,
  };
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** 压平渲染八字手动区间流日（不写逐日喜忌，仅标干支与月日支六冲） */
export function formatBaziDailyRangeBlock(
  resolved: ResolvedDailyRange,
  natalPillars: Record<PillarName, BaziPillar>,
): string {
  const dayZhi = natalPillars.day.zhi;
  const monthZhi = natalPillars.month.zhi;
  const tokens = resolved.dates.map((d) => {
    const gz = getExactDayGanZhi(d.year, d.month, d.day);
    const zhi = gz[1];
    const clashDay = isLiuchong(zhi, dayZhi);
    const clashMonth = isLiuchong(zhi, monthZhi);
    const clash =
      clashDay && clashMonth ? '(冲月日支)' : clashDay ? '(冲日支)' : clashMonth ? '(冲月支)' : '';
    return `${d.month}/${d.day}${gz}${clash}`;
  });
  const rows = chunkItems(tokens, 8).map((row) => row.join('｜'));
  return [`【手动区间流日一览】`, `${resolved.label}`, ...rows].join('\n');
}

const DEFAULT_JI_STAR: Record<string, string> = {
  甲: '太阳', 乙: '太阴', 丙: '廉贞', 丁: '巨门', 戊: '天机',
  己: '文曲', 庚: '天同', 辛: '文昌', 壬: '武曲', 癸: '贪狼',
};

/** 压平渲染紫微手动区间流日（精确公历日干支 + 流日地支对应本命宫 + 流日天干化忌星） */
export function formatZiweiDailyRangeBlock(
  resolved: ResolvedDailyRange,
  natalPalaces: ReadonlyArray<{ name: string; earthlyBranch: string }>,
): string {
  const branchToPalace = new Map<string, string>();
  for (const p of natalPalaces) {
    branchToPalace.set(p.earthlyBranch, p.name);
  }
  const tokens = resolved.dates.map((d) => {
    const gz = getExactDayGanZhi(d.year, d.month, d.day);
    const stem = gz[0];
    const branch = gz[1];
    const palaceName = branchToPalace.get(branch) || branch;
    const ji = DEFAULT_JI_STAR[stem] || '';
    return `${d.month}/${d.day}${gz}(${palaceName}${ji ? `·忌${ji.slice(0, 2)}` : ''})`;
  });
  const rows = chunkItems(tokens, 6).map((row) => row.join('｜'));
  return [`【手动区间流日一览】`, `${resolved.label}（按流日干支对应本命宫位与日干化忌）`, ...rows].join('\n');
}
