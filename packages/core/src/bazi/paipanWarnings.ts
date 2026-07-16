/**
 * @file 排盘边界预警
 * @description
 * 当出生时刻贴近"换柱边界"时，说明当前结果采用的计算口径：
 * 1. 节气交接（换月柱，立春同时换年柱）——采用节气历表与输入时刻直接定柱；
 * 2. 时辰边界（奇数整点换时柱）——采用校正后的唯一时刻定柱；
 * 3. 23:00 换日线——采用晚子时换日口径。
 * 输入必须先通过完整性校验；提示词只写已采用的唯一结果。
 */
import { SolarTerm } from 'tyme4ts';
import { EARTHLY_BRANCHES } from '../ganzhi/data';
import type { BaziWarningFact, BaziWarningSummaryFact } from './baziTypes';

/** 边界预警阈值（分钟） */
export const BOUNDARY_THRESHOLD_MINUTES = 3;

const WARNING_LIMITATION =
  '边界说明只记录当前输入下已经采用的时间口径与唯一定盘结果；不另起第二套盘面，也不改写已确定的四柱' as const;
const SUMMARY_LIMITATION =
  '预警汇总只说明当前盘面是否贴近交界时刻，不改变已经按输入确定的时柱' as const;

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
        `本次${extra}已按节气历表与输入时刻确定，并作为唯一定盘结果使用。`,
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
      `本次已按校正后时刻确定为「${phase <= 60 ? nextBranch : prevBranch}时」，并作为唯一时柱使用。`,
  );

  if (boundaryHour === 23) {
    warnings.push(
      '出生时刻贴近 23:00 换日线：本次统一采用晚子时换日口径，日柱与时柱均按该口径确定。',
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

function classifyWarning(text: string): BaziWarningFact['type'] {
  if (text.includes('节气') || text.includes('交节')) return '节气交接边界';
  if (text.includes('23:00') || text.includes('换日')) return '换日流派边界';
  if (text.includes('时辰边界') || text.includes('时柱')) {
    return '时辰边界';
  }
  if (text.includes('夏令时')) return '历史夏令时边界';
  return '输入时间边界';
}

function classifyWarningStatus(
  text: string,
  type: BaziWarningFact['type'],
): BaziWarningFact['status'] {
  if (
    text.includes('并不存在') ||
    text.includes('出现两次') ||
    text.includes('无法唯一') ||
    text.includes('重复时段') ||
    text.includes('跳变时段')
  ) {
    return '需核验原始记录';
  }
  return type === '历史夏令时边界' && text.includes('已自动回拨') ? '已校正' : '已确定当前口径';
}

export function buildBaziWarningEvidence(warnings: string[]): {
  warningFacts: BaziWarningFact[];
  warningSummaryFact: BaziWarningSummaryFact;
} {
  const warningFacts = warnings.map((promptText, index) => {
    const type = classifyWarning(promptText);
    const status = classifyWarningStatus(promptText, type);
    return {
      key: `bazi:warning:${index + 1}:${type}`,
      type,
      status,
      referenceKeys:
        type === '历史夏令时边界'
          ? ['bazi:timing:china-dst']
          : type === '节气交接边界'
            ? ['bazi:calendar:solar-term']
            : type === '时辰边界'
              ? ['bazi:calendar:shichen']
              : ['bazi:time:boundary'],
      promptText,
      sources:
        type === '节气交接边界'
          ? ['节气历表与出生时刻比较']
          : type === '历史夏令时边界'
            ? ['中国历史夏令时规则与校正结果']
            : type === '时辰边界'
              ? ['时辰边界规则与校正后时刻']
              : ['出生时间口径说明'],
      limitation: WARNING_LIMITATION,
    } satisfies BaziWarningFact;
  });
  const needsReview = warningFacts.some((item) => item.status === '需核验原始记录');
  const warningSummaryFact: BaziWarningSummaryFact = {
    key: 'bazi:warning-summary',
    status: needsReview ? '存在需核验事项' : warningFacts.length ? '存在边界提示' : '无预警',
    factKeys: warningFacts.map((item) => item.key),
    promptText: needsReview
      ? `共记录${warningFacts.length}条边界预警，其中存在需要结合原始记录核验的事项`
      : warningFacts.length
        ? `共记录${warningFacts.length}条边界预警；本次仍按已确认输入确定当前时柱`
        : '未见节气、时辰、换日或历史夏令时边界预警',
    sources: ['八字时间边界预警汇总'],
    limitation: SUMMARY_LIMITATION,
  };
  return { warningFacts, warningSummaryFact };
}
