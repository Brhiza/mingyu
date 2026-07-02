/**
 * @file 排盘边界预警
 * @description
 * 当出生时刻贴近"换柱边界"时，排盘结果存在翻转风险：
 * 1. 节气交接（换月柱，立春同时换年柱）——底层节气常数表存在 ±20 秒级偏差，
 *    出生时间记录本身也常有数分钟误差；
 * 2. 时辰边界（奇数整点换时柱）——真太阳时均时差为近似公式（±1~2 分钟）；
 * 3. 23:00 换日线——早晚子时流派之争，日柱归属两可。
 * 距边界 ±BOUNDARY_THRESHOLD_MINUTES 分钟内时输出预警并给出两种候选，
 * 而非沉默地二选一。
 */
import { SolarTerm } from 'tyme4ts';

/** 边界预警阈值（分钟） */
export const BOUNDARY_THRESHOLD_MINUTES = 3;

/** 十二"节"（换月柱的交接点；"气"不换柱，不预警） */
const JIE_NAMES = new Set([
  '立春',
  '惊蛰',
  '清明',
  '立夏',
  '芒种',
  '小暑',
  '立秋',
  '白露',
  '寒露',
  '立冬',
  '大雪',
  '小寒',
]);

export interface BoundaryCheckInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

const TIME_BRANCH_NAMES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
];

function toUtcMs(t: BoundaryCheckInput): number {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second ?? 0);
}

function formatMinutes(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 奇数整点 hour 对应"其后开始的时辰"名（如 3 点 → 寅时） */
function branchNameStartingAtHour(oddHour: number): string {
  const index = (Math.floor((oddHour + 1) / 2) + 12) % 12;
  return TIME_BRANCH_NAMES[index];
}

/**
 * 检查出生时刻是否贴近节气交接（仅检查换柱的"节"）。
 * 返回预警文案数组（无预警时为空数组）。
 */
export function checkJieqiBoundary(t: BoundaryCheckInput): string[] {
  const warnings: string[] = [];
  const birthMs = toUtcMs(t);
  let best: { name: string; diffMinutes: number; before: boolean } | null = null;

  for (const y of [t.year - 1, t.year, t.year + 1]) {
    for (let i = 0; i < 24; i++) {
      let term: SolarTerm;
      try {
        term = SolarTerm.fromIndex(y, i);
      } catch {
        continue;
      }
      const name = term.getName();
      if (!JIE_NAMES.has(name)) {
        continue;
      }
      const st = term.getJulianDay().getSolarTime();
      const termMs = Date.UTC(
        st.getYear(),
        st.getMonth() - 1,
        st.getDay(),
        st.getHour(),
        st.getMinute(),
        st.getSecond(),
      );
      const diffMinutes = Math.abs(termMs - birthMs) / 60000;
      if (!best || diffMinutes < best.diffMinutes) {
        best = { name, diffMinutes, before: birthMs < termMs };
      }
    }
  }

  if (best && best.diffMinutes <= BOUNDARY_THRESHOLD_MINUTES) {
    const side = best.before ? '前' : '后';
    const extra = best.name === '立春' ? '年柱与月柱' : '月柱';
    warnings.push(
      `出生时刻距「${best.name}」交节仅约 ${formatMinutes(best.diffMinutes)} 分钟（交节${side}）。` +
        `节气历表存在秒级偏差、出生时间记录亦常有误差，${extra}存在交节前后两种可能，建议按两种盘分别参详。`,
    );
  }
  return warnings;
}

/**
 * 检查出生时刻是否贴近时辰边界（奇数整点），23:00 边界额外提示换日流派问题。
 * 返回预警文案数组（无预警时为空数组）。
 */
export function checkShichenBoundary(t: BoundaryCheckInput): string[] {
  const warnings: string[] = [];
  const minuteOfDay = t.hour * 60 + t.minute + (t.second ?? 0) / 60;

  // 时辰边界位于奇数整点，即 minuteOfDay ≡ 60 (mod 120)
  const phase = (((minuteOfDay - 60) % 120) + 120) % 120;
  const distance = Math.min(phase, 120 - phase);
  if (distance > BOUNDARY_THRESHOLD_MINUTES) {
    return warnings;
  }

  // 找到最近的奇数整点
  const nearestBoundaryMinute =
    phase <= 60 ? minuteOfDay - phase : minuteOfDay + (120 - phase);
  const boundaryHour = ((Math.round(nearestBoundaryMinute / 60) % 24) + 24) % 24;
  const nextBranch = branchNameStartingAtHour(boundaryHour);
  const prevBranch = TIME_BRANCH_NAMES[(TIME_BRANCH_NAMES.indexOf(nextBranch) + 11) % 12];

  warnings.push(
    `出生时刻距 ${String(boundaryHour).padStart(2, '0')}:00 时辰边界仅约 ${formatMinutes(distance)} 分钟，` +
      `时柱存在「${prevBranch}时/${nextBranch}时」两种可能（真太阳时均时差近似亦有 ±1~2 分钟误差），建议按两种时柱分别参详。`,
  );

  if (boundaryHour === 23) {
    warnings.push(
      '出生时刻贴近 23:00 换日线：晚子时的日柱归属存在「换日（本引擎采用）/不换日」两派之争，日柱亦可能不同，请知悉流派差异。',
    );
  }
  return warnings;
}

/**
 * 汇总边界预警。仅在具备分钟级精度的输入（真太阳时模式）下调用才有意义。
 */
export function collectBoundaryWarnings(t: BoundaryCheckInput): string[] {
  return [...checkJieqiBoundary(t), ...checkShichenBoundary(t)];
}
