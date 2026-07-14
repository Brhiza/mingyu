/**
 * @file 排盘边界预警
 * @description
 * 当出生时刻贴近"换柱边界"时，说明当前结果采用的计算口径：
 * 1. 节气交接（换月柱，立春同时换年柱）——底层节气常数表存在 ±20 秒级偏差，
 * 2. 时辰边界（奇数整点换时柱）——真太阳时均时差为近似公式（±1~2 分钟）；
 * 3. 23:00 换日线——说明本引擎采用的换日流派。
 * 输入必须先通过完整性校验；这里不生成候选盘或敏感性结果。
 */
import { SolarTerm } from 'tyme4ts';
import { EARTHLY_BRANCHES } from '../ganzhi/data';

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

function toUtcMs(t: BoundaryCheckInput): number {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second ?? 0);
}

function formatMinutes(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 奇数整点 hour 对应"其后开始的时辰"名（如 3 点 → 寅时） */
function branchNameStartingAtHour(oddHour: number): (typeof EARTHLY_BRANCHES)[number] {
  const index = (Math.floor((oddHour + 1) / 2) + 12) % 12;
  return EARTHLY_BRANCHES[index];
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
      try {
        const term = SolarTerm.fromIndex(y, i);
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
      } catch {
        continue;
      }
    }
  }

  if (best && best.diffMinutes <= BOUNDARY_THRESHOLD_MINUTES) {
    const side = best.before ? '前' : '后';
    const extra = best.name === '立春' ? '年柱与月柱' : '月柱';
    warnings.push(
      `出生时刻距「${best.name}」交节仅约 ${formatMinutes(best.diffMinutes)} 分钟（交节${side}）。` +
        `本次${extra}已按项目节气历表和输入时刻确定；该提示仅记录历表精度边界，不生成候选盘。`,
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
  const nearestBoundaryMinute = phase <= 60 ? minuteOfDay - phase : minuteOfDay + (120 - phase);
  const boundaryHour = ((Math.round(nearestBoundaryMinute / 60) % 24) + 24) % 24;
  const nextBranch = branchNameStartingAtHour(boundaryHour);
  const prevBranch =
    EARTHLY_BRANCHES[(EARTHLY_BRANCHES.indexOf(nextBranch) + EARTHLY_BRANCHES.length - 1) % 12];

  warnings.push(
    `出生时刻距 ${String(boundaryHour).padStart(2, '0')}:00 时辰边界仅约 ${formatMinutes(distance)} 分钟，` +
      `本次已按校正后时刻确定为「${phase <= 60 ? nextBranch : prevBranch}时」；真太阳时均时差采用近似公式，该提示不生成候选时柱。`,
  );

  if (boundaryHour === 23) {
    warnings.push(
      '出生时刻贴近 23:00 换日线：本引擎采用晚子时换日口径；其他流派可能采用不同规则，此处不生成候选盘。',
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
