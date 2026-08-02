import type { SsgwData } from '../../types/divination';
import { SSGW_SIGNS } from '../../divination/ssgw-data';
import { getRequiredDivinationTime } from '../../calendar/timeManager';
import type { RandomOptions } from '../../shared/random';
import { createRandomContext, randomInt } from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeSsgwEvidence } from '../ssgw-evidence';

export {
  analyzeSsgwEvidence,
  conditionSsgwInterpretation,
  rebuildAuditedSsgwData,
} from '../ssgw-evidence';
export type {
  SsgwCoverageFact,
  SsgwCounterEvidenceFact,
  SsgwCounterSummaryFact,
  SsgwDrawFact,
  SsgwEvidenceAnalysis,
  SsgwInterpretationFact,
  SsgwLimitationFact,
  SsgwMissingFieldFact,
  SsgwRandomFact,
  SsgwRitualFact,
  SsgwRitualThrowEvidenceFact,
  SsgwRitualThrowFact,
  SsgwSignFact,
  SsgwSourceFact,
} from '../ssgw-evidence';

/**
 * @file 灵签抽签算法（神算鬼谋）
 * @description 从1至92连续签号池中随机抽取编号，并保留可重放的抽取轨迹。
 * @注意 此文件实现的是**随机抽签求签**功能，并非大六壬「金口诀」算法。
 *        金口诀（大六壬金口诀）的完整排盘与断课由其他模块实现。
 *        本文件名沿用历史命名，功能定位为灵签/神签抽签系统。
 */

const ssgwSigns: Omit<SsgwData, 'ganzhi' | 'timestamp'>[] = SSGW_SIGNS.map((sign) => ({
  number: sign.id,
  title: sign.title,
  poem: sign.qianwen,
  story: sign.story,
  details: sign.details,
}));

/**
 * 随机抽取签号
 *
 * 从三山国王 92 个连续签号中随机抽取一个编号，
 * 自动附带求签时间的干支和 Unix 时间戳。
 *
 * @param customDate 明确的求签时间。交互入口若使用“当前时间”，应先固定一个 Date 再传入。
 *   签文结果的 `ganzhi` 和 `timestamp` 会基于该时间生成。
 * @returns 抽签结果 SsgwData，包含签号、待校状态、抽取轨迹及求签时间干支。
 * @remarks 掷筊流程、杯象判定与终止规则来源未闭合，底层不自动模拟或输出确认结论。
 *
 * @example
 * ```ts
 * const sign = drawRandomSign(new Date('2025-06-15T10:00:00+08:00'));
 * ```
 */
export function drawRandomSign(
  customDate: Date,
  options?: RandomOptions,
): SsgwData {
  const { ganzhi, timestamp } = getRequiredDivinationTime(customDate, '求签时间');
  const context = createRandomContext(options);
  const randomIndex = randomInt(ssgwSigns.length, context.random);
  const sign = ssgwSigns[randomIndex];
  const base = attachResultMeta(
    {
      ...sign,
      timestamp,
      ganzhi,
      draw: {
        method: 'random' as const,
        poolSize: ssgwSigns.length,
        selectedIndex: randomIndex,
        selectedNumber: sign.number,
      },
    },
    {
      algorithm: 'ssgw.draw',
      input: { timestamp },
      calculatedAt: timestamp,
      random: context.getTrace(),
    },
  );
  return { ...base, evidenceAnalysis: analyzeSsgwEvidence(base) };
}

/** 核对用户已取得的签号，不模拟抽签或掷筊。 */
export function resolveSignByNumber(number: number, customDate: Date): SsgwData {
  if (!Number.isInteger(number) || number < 1 || number > ssgwSigns.length) {
    throw new Error(`签号需为1至${ssgwSigns.length}的整数`);
  }
  const sign = ssgwSigns.find((item) => item.number === number);
  if (!sign) {
    throw new Error(`未找到第${number}签`);
  }
  const { ganzhi, timestamp } = getRequiredDivinationTime(customDate, '求签时间');
  const base = attachResultMeta(
    {
      ...sign,
      timestamp,
      ganzhi,
      draw: {
        method: 'manual' as const,
        poolSize: ssgwSigns.length,
        selectedIndex: null,
        selectedNumber: sign.number,
      },
    },
    {
      algorithm: 'ssgw.resolve.manual',
      input: { number, timestamp },
      calculatedAt: timestamp,
    },
  );
  return { ...base, evidenceAnalysis: analyzeSsgwEvidence(base) };
}
