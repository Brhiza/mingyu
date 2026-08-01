/**
 * @file 奇门遁甲排盘算法（主入口）
 * @description 基于转盘法或飞盘法，实现时家、月家、年家奇门完整排盘，
 * 含定局、布盘与已校勘格局事实。
 * @流派 转盘奇门为默认口径，飞盘奇门为可选布局；时家另选拆补或置闰定局
 * @古籍依据 《烟波钓叟歌》《遁甲演义》《奇门遁甲秘籍大全》
 *
 * @核心流程
 * 1. 定局数（时家拆补或置闰/月家五年段三元/年家一百八十年三元）
 * 2. 寻值符值使：由对应级别的干支旬首定位值符星和值使门
 * 3. 排九宫格：布地盘三奇六仪 -> 定值符值使落宫 -> 排天盘九星 -> 排人盘八门 -> 排神盘八神
 * 4. 识别可复算位置标签、十一项天地盘固定格、时家上下文格、三奇升殿、三诈与三项条件一致五假位置结构
 * 5. 辅助分析：保留九宫方位、旬空与马星等原始事实
 *
 * 《烟波钓叟歌》核心法理（下称《歌》）：
 *   "阴阳二遁分顺逆，一气三元人莫测"        —— 拆补法定局
 *   "直符直使各有时，时干直符时支使"        —— 旬首寻值符值使
 *   "星随符转，门随地转，八神随遁顺逆"      —— 转盘排盘
 *   "星反吟兮门反吟，门迫宫兮事难行"        —— 位置与五行关系来源
 *   《遁甲演义》卷一、卷二                     —— 十一项天地盘固定格来源
 *
 * 日家奇门以及其余三奇、人假、物假、神假、五假扩展、符使、月格、时格、普通勃格等旧规则尚未
 * 完成统一版本、完整条件与适用边界审核；九遁与三奇得使已经确认存在定义冲突。以上规则正式入口
 * 均失败关闭，不据原始盘面自动补算。
 */

import type { QimenData, QimenJiuGongGe, QimenScope } from '../../../types/divination';
import type { ClassicPattern, PatternContext, StemRelation } from './helpers/classic-patterns';
import type { QimenMethod } from './helpers/layout';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getVoidBranches } from '../../../calendar/lunar';
import { diPanPalaces } from './helpers/_constants';
import {
  getQimenJuShu,
  getZhiFuZhiShi,
  getZhiFuZhiShiByGanZhi,
  getDunJiaStem,
} from './helpers/jushu';
import type { QimenJuMethod, QimenJuShuResult } from './helpers/jushu';
import { getMonthQimenJuShu, getYearQimenJuShu } from './helpers/jushu-extended';
import { arrangeJiuGongGe, resolveZhiShiLandingPalace } from './helpers/layout';
import { getQimenPatternTags, buildPatternDetails } from './helpers/patterns';
import { getStemRelations, getClassicPatterns } from './helpers/classic-patterns';
import { buildSeasonality } from './helpers/seasonality';
import { detectQimenPatternCombos } from './helpers/pattern-combos';
import { analyzeQimenEvidence } from '../../qimen-evidence';
import { hasTianPanStar } from './helpers/palace-utils';

export {
  AUDITED_QIMEN_CLASSIC_PATTERN_NAMES,
  isAuditedQimenClassicPatternName,
} from './helpers/stem-pair-patterns';
export {
  AUDITED_QIMEN_CONTEXT_PATTERN_NAMES,
  isAuditedQimenContextPatternName,
} from './helpers/classic-patterns';
export {
  analyzeQimenEvidence,
  conditionQimenTraditionalText,
  rebuildAuditedQimenData,
} from '../../qimen-evidence';
export type {
  QimenCalculationEvidenceFact,
  QimenCounterEvidenceFact,
  QimenCounterSummaryFact,
  QimenDirectionBoundaryFact,
  QimenEvidenceAnalysis,
  QimenPalaceIndexFact,
  QimenPalaceIndexSource,
  QimenPalaceFact,
  QimenPalaceCoverageFact,
  QimenPalaceRelationEvidence,
  QimenPatternEvidenceFact,
  QimenRuleSourceFact,
  QimenStemRelationFact,
  QimenTimingFact,
  QimenTimingSummaryFact,
} from '../../qimen-evidence';

// ============================================================================
// 内部工具函数
// ============================================================================

/**
 * 获取宫位中文名
 * @param jiuGongGe 九宫格数据
 * @param palace    宫位编号（1-9）
 * @returns 宫位中文名（如"坎一宫"）
 */
function getPalaceName(jiuGongGe: QimenJiuGongGe[], palace: number): string {
  return jiuGongGe.find((item) => item.gong === palace)?.name || `${palace}宫`;
}

/**
 * 根据地支解析所属宫位
 *
 * @param branch     地支（如"子""午"）
 * @param jiuGongGe  九宫格数据
 * @returns 宫位对象（含地支、宫号、宫名），找不到时返回 null
 */
function resolveQimenBranchPalace(
  branch: string,
  jiuGongGe: QimenJiuGongGe[],
): { branch: string; palace: number; name: string } | null {
  const palace = diPanPalaces[branch];
  if (!palace) return null;
  return { branch, palace, name: getPalaceName(jiuGongGe, palace) };
}

/**
 * 获取驿马地支
 *
 * 《烟波钓叟歌》：「天马方为动应之神，驿马冲则事速」
 * 寅午戌马在申，申子辰马在寅，
 * 巳酉丑马在亥，亥卯未马在巳。
 *
 * @param sourceBranch 时支
 * @returns 驿马地支，无匹配时返回空字符串
 */
function getHorseBranch(sourceBranch: string): string {
  if (['申', '子', '辰'].includes(sourceBranch)) return '寅';
  if (['寅', '午', '戌'].includes(sourceBranch)) return '申';
  if (['亥', '卯', '未'].includes(sourceBranch)) return '巳';
  if (['巳', '酉', '丑'].includes(sourceBranch)) return '亥';
  return '';
}

function assertQimenScope(scope: QimenScope): void {
  if (!['hour', 'day', 'month', 'year'].includes(scope)) {
    throw new Error(`未知的奇门排盘级别: ${String(scope)}`);
  }
  if (scope === 'day') {
    throw new Error(
      '日家奇门存在多套互相冲突的古法，当前旧实现曾错误复用时家定局与布局；在选定并完整校勘单一版本前不开放。',
    );
  }
}

/**
 * 将 ClassicPattern（classic-patterns 模块原始输出）映射为 QimenData 兼容的格式
 *
 * classic-patterns 使用 tone/palace 字段，
 * 而 QimenData.classicPatterns 使用 type/palaces 字段。
 *
 * @param patterns 原始 ClassicPattern 列表
 * @returns 映射后的 QimenData.classicPatterns 列表
 */
function mapClassicPatterns(
  patterns: ClassicPattern[],
): Exclude<QimenData['classicPatterns'], undefined> {
  // 检测器本身按传统格局类别依次输出；不再用任意分值重排“影响强度”。
  return patterns.map((p) => ({
    name: p.name,
    type: p.tone,
    summary: p.summary,
    palaces: p.palace ? [p.palace] : [],
  }));
}

/**
 * 将 StemRelation（classic-patterns 模块原始输出）映射为 QimenData 兼容的格式
 *
 * stem-pair-patterns 使用 heaven/earth/palace/type/note 字段，
 * 而 QimenData.stemRelations 使用 gong/heavenStem/earthStem/relation/pattern 字段。
 *
 * @param relations 原始 StemRelation 列表
 * @returns 映射后的 QimenData.stemRelations 列表
 */
function mapStemRelations(
  relations: StemRelation[],
): Exclude<QimenData['stemRelations'], undefined> {
  return relations.map((r) => ({
    gong: r.palace,
    heavenStem: r.heaven,
    earthStem: r.earth,
    relation: r.type,
    pattern: r.note,
  }));
}

// ============================================================================
// 主入口函数
// ============================================================================

/**
 * 生成奇门遁甲完整排盘
 *
 * 支持时家（hour）、月家（month）、年家（year）三个已校勘级别。
 * `day` 仅保留类型兼容，运行时明确拒绝，不再复用时家算法。
 * 默认时家奇门（精确到时辰），使用拆补法定局。
 *
 * 遵循拆补法定局，并按所选转盘法或飞盘法完整输出九宫四盘（天地人神）、
 * 可复算位置标签、已校勘十一项天地盘固定格、时家上下文格与中性位置索引。
 *
 * ── 排盘流程 ──
 *
 * 1. **时间信息**：《歌》"先须掌上排九宫，纵横十五在其中"
 *    - 获取公历、农历、节气、干支等完整时间数据
 *
 * 2. **定局数**：《歌》"阴阳二遁分顺逆，一气三元人莫测"
 *    - 时家：拆补法或置闰法（以节气为界）
 *    - 月家：按行年干支所属五年段定上、中、下元，均用阴遁一、四、七局
 *    - 年家：按一百八十年三元甲子周期，均用阴遁一、四、七局
 *
 * 3. **寻值符值使（旬首法）**：《歌》"直符直使各有时，时干直符时支使"
 *    - 由对应级别干支的旬首定位值符星和值使门
 *
 * 4. **排九宫格（转盘法或飞盘法）**：按所选方法排列九星、八门、八神与天地盘干
 *    - 布地盘三奇六仪 -> 定值符值使落宫 -> 排天盘九星 -> 排人盘八门 -> 排神盘八神
 *
 * 5. **辅助数据**：空亡地支配对、驿马定位
 *
 * 6. **可复算位置标签**
 *    - 星门伏吟/反吟与六仪击刑落宫仅限时家；门克宫、马星落宫保留结构事实
 *
 * 7. **已校勘经典格局**：《遁甲演义》卷一、卷二
 *    - 输出十一项条件已闭合的天地盘固定格
 *    - 时家另按完整日柱输出伏干格、飞干格，按完整年干支输出岁格
 *    - 仅在完整时柱属甲申旬、值符实际携庚且临地盘丙时输出格勃
 *    - 天盘乙到震三、丙到离九、丁到兑七时分别输出中性三奇升殿位置结构
 *    - 天盘三奇、开休生门与太阴/九地/六合同宫时分别输出中性真诈/重诈/休诈结构
 *    - 天盘奇仪、指定门与九天/九地同宫时输出中性天假、严格地假、鬼假结构
 *    - 月格、时格、普通勃格、天辅时、五合时名称、天网/天网四张、三奇/时干入墓、三奇受制与三奇会甲因版本冲突或原文不足继续失败关闭
 *
 * 8. **天地盘干关系**：每个宫位天盘干与地盘干的五行生克
 *
 * 9. **位置索引**：只标记值符、值使等可复算位置，不自动指定用神或主次
 *
 * 10. **方位事实**：保留九宫方向、门、星、神、干、空亡等原始数据；
 *     通用入口不生成吉方、避方或现代事项用途
 *
 * @param customDate 自定义时间（可选，默认当前时间）
 * @param method     排盘方法，默认 'zhuanpan'（转盘法）
 * @param scope      排盘级别，默认 'hour'（时家奇门）
 * @returns 完整的奇门遁甲数据 QimenData
 *
 * @example
 * ```ts
 * // 时家奇门（默认）
 * const result = generateQimen();
 *
 * // 年家奇门
 * const result = generateQimen(new Date('2025-01-01'), 'zhuanpan', 'year');
 * ```
 */
export function generateQimen(
  customDate?: Date,
  method: QimenMethod = 'zhuanpan',
  scope: QimenScope = 'hour',
  juMethod: QimenJuMethod = 'chaibu',
): QimenData {
  assertQimenScope(scope);
  if (scope !== 'hour' && juMethod !== 'chaibu') {
    throw new Error(
      `${scope === 'month' ? '月家' : '年家'}奇门不接受时家${juMethod === 'zhirun' ? '置闰法' : `定局方法“${String(juMethod)}”`}；请使用该级别已校勘的三元定局法。`,
    );
  }
  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 1：获取统一占卜时间信息
  // ──────────────────────────────────────────────────────────────────────────
  const { timeInfo, ganzhi, timestamp } = getDivinationTime(customDate);
  const { jieQi } = timeInfo;

  // 根据 scope 确定"主动干支"（用于定局、寻符使、空亡、驿马）
  const activeGanZhi = getActiveGanZhi(ganzhi, scope);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 2：定局数
  // ──────────────────────────────────────────────────────────────────────────
  const jushuResult = getJushuForScope(scope, ganzhi, timeInfo, juMethod);
  const { isYangDun, juShu } = jushuResult;

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 3：寻值符与值使（旬首法）
  // ──────────────────────────────────────────────────────────────────────────
  const zhiFuShiResult = getZhiFuShiForScope(scope, activeGanZhi, ganzhi, jushuResult);
  const { zhiFu, zhiShi, zhiFuPalace, specialConditions } = zhiFuShiResult;

  // ── 后续步骤 4-12 与 scope 无关，共用同一套排盘逻辑 ──

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 4：按所选转盘法或飞盘法排九宫格
  // ──────────────────────────────────────────────────────────────────────────
  const jiuGongGe = arrangeJiuGongGe(
    isYangDun,
    juShu,
    zhiFu,
    zhiShi,
    { hour: activeGanZhi },
    method,
  );
  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 5：辅助数据（空亡、驿马）
  // ──────────────────────────────────────────────────────────────────────────
  const activeZhi = activeGanZhi.charAt(1);
  const activeGanForFind = getDunJiaStem(activeGanZhi);

  const voidBranches = getVoidBranches(activeGanZhi) || [];
  const voidPalaces = voidBranches
    .map((branch: string) => resolveQimenBranchPalace(branch, jiuGongGe))
    .filter((item): item is { branch: string; palace: number; name: string } => Boolean(item));

  const horseBranch = getHorseBranch(activeZhi);
  const horsePalace = horseBranch ? resolveQimenBranchPalace(horseBranch, jiuGongGe) : null;

  const zhiFuLandingPalace = jiuGongGe.find((gong) => hasTianPanStar(gong, zhiFu))?.gong;
  if (zhiFuLandingPalace === undefined) {
    throw new Error(`找不到值符星 "${zhiFu}" 落宫。`);
  }
  const zhiShiLandingPalace = resolveZhiShiLandingPalace(
    isYangDun,
    zhiShi,
    activeGanZhi,
    zhiFuPalace,
    method,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 6：基础格局标签
  // ──────────────────────────────────────────────────────────────────────────
  const patternTags = getQimenPatternTags({
    zhiFu,
    zhiShi,
    zhiFuLandingPalace,
    zhiShiLandingPalace,
    jiuGongGe,
    hourGanForFind: activeGanForFind,
    scope,
    horsePalace: horsePalace?.palace,
    horsePalaceName: horsePalace?.name,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 7：标签详情
  // ──────────────────────────────────────────────────────────────────────────
  const patternDetails = buildPatternDetails(patternTags);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 8：已校勘经典格局白名单
  // ──────────────────────────────────────────────────────────────────────────
  const dayStem = ganzhi.day.charAt(0);
  const monthBranch = ganzhi.month.charAt(1);
  const classicPatternContext: PatternContext = {
    jiuGongGe,
    zhiFu,
    zhiShi,
    scope,
    yearGanZhi: ganzhi.year,
    monthGanZhi: ganzhi.month,
    dayStem,
    dayGanZhi: ganzhi.day,
    hourGanZhi: ganzhi.hour,
  };
  const classicPatternsRaw = getClassicPatterns(classicPatternContext);
  const classicPatterns = mapClassicPatterns(classicPatternsRaw);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 9：天地盘干关系
  // ──────────────────────────────────────────────────────────────────────────
  const stemRelationsRaw = getStemRelations(jiuGongGe);
  const stemRelations = mapStemRelations(stemRelationsRaw);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 10：节令背景
  // ──────────────────────────────────────────────────────────────────────────
  const seasonalityDate = new Date(
    timeInfo.solar.year,
    timeInfo.solar.month - 1,
    timeInfo.solar.day,
    timeInfo.solar.hour ?? 0,
    timeInfo.solar.minute ?? 0,
  );
  const seasonality = buildSeasonality(ganzhi, jushuResult.actualJieQi || jieQi, seasonalityDate);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 11：方位结论边界（通用入口失败关闭，九宫方向事实仍保留）
  // ──────────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 12：已校勘组合规则
  // ──────────────────────────────────────────────────────────────────────────
  const patternCombos = detectQimenPatternCombos({
    monthBranch,
    jiuGongGe,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 13：返回完整 QimenData
  // ──────────────────────────────────────────────────────────────────────────
  const result: QimenData = {
    method,
    scope,
    juMethod: jushuResult.juMethod,
    timeInfo: {
      solarTerm: jushuResult.actualJieQi || jieQi,
      juTerm: jushuResult.jieQi || jieQi,
      epoch: jushuResult.yuan,
      juMethod: jushuResult.juMethod,
      ...(jushuResult.fuTou ? { fuTou: jushuResult.fuTou } : {}),
      ...(jushuResult.fuTouDate ? { fuTouDate: jushuResult.fuTouDate } : {}),
      ...(jushuResult.chaoShenOrJieQi ? { chaoShenOrJieQi: jushuResult.chaoShenOrJieQi } : {}),
      ...(jushuResult.isZhiRun !== undefined ? { isZhiRun: String(jushuResult.isZhiRun) } : {}),
      ...(jushuResult.juMethodNote ? { juMethodNote: jushuResult.juMethodNote } : {}),
    },
    ganzhi,
    isYangDun: jushuResult.isYangDun,
    juShu: jushuResult.juShu,
    zhiFu,
    zhiShi,
    patternTags,
    patternDetails,
    voidBranches,
    voidPalaces,
    horseStar: horsePalace ? { ...horsePalace, sourceBranch: activeZhi } : undefined,
    specialConditions,
    seasonality,
    jiuGongGe,
    classicPatterns,
    stemRelations,
    patternCombos,
    timestamp,
  };
  result.evidenceAnalysis = analyzeQimenEvidence(result);
  return result;
}

// ============================================================================
// 内部辅助函数（不同 scope 对应的定局/寻符使逻辑）
// ============================================================================

/** 根据 scope 获取主动干支 */
function getActiveGanZhi(
  ganzhi: { year: string; month: string; day: string; hour: string },
  scope: QimenScope,
): string {
  switch (scope) {
    case 'year':
      return ganzhi.year;
    case 'month':
      return ganzhi.month;
    case 'day':
      return ganzhi.day;
    default:
      return ganzhi.hour;
  }
}

/** 根据 scope 获取定局结果 */
function getJushuForScope(
  scope: QimenScope,
  ganzhi: { year: string; month: string; day: string; hour: string },
  timeInfo: {
    solar: { year: number; month: number; day: number; hour?: number; minute?: number };
    jieQi: string;
  },
  juMethod: QimenJuMethod = 'chaibu',
): QimenJuShuResult {
  switch (scope) {
    case 'year': {
      const r = getYearQimenJuShu(ganzhi.year, timeInfo.solar.year);
      return {
        ...r,
        jieQi: timeInfo.jieQi,
        juMethod: 'nianjia',
        isZhiRun: false,
        juMethodNote: '年家奇门按一百八十年三元甲子定局：上元阴遁一局、中元阴遁四局、下元阴遁七局',
      };
    }
    case 'month': {
      const r = getMonthQimenJuShu(ganzhi.month, ganzhi.year);
      return {
        ...r,
        jieQi: timeInfo.jieQi,
        juMethod: 'yuejia',
        isZhiRun: false,
        juMethodNote: '月家奇门按行年干支所属五年段定局：上元阴遁一局、中元阴遁四局、下元阴遁七局',
      };
    }
    case 'day':
      throw new Error('日家奇门尚未完成单一版本的定局与布局校勘，当前不开放。');
    case 'hour':
    default: {
      return getQimenJuShu(
        {
          jieQi: timeInfo.jieQi,
          ganzhi: { day: ganzhi.day },
          solar: {
            year: timeInfo.solar.year,
            month: timeInfo.solar.month,
            day: timeInfo.solar.day,
            hour: timeInfo.solar.hour,
            minute: timeInfo.solar.minute,
          },
        },
        juMethod,
      );
    }
  }
}

/** 根据 scope 获取值符值使 */
function getZhiFuShiForScope(
  scope: QimenScope,
  activeGanZhi: string,
  ganzhi: { day: string },
  jushuResult: { isYangDun: boolean; juShu: number },
): {
  zhiFu: string;
  zhiShi: string;
  zhiFuPalace: number;
  specialConditions: QimenData['specialConditions'];
} {
  const defaultSpecialConditions = {
    isLiuJiaHour: false,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: '',
  };

  switch (scope) {
    case 'hour': {
      // 时家奇门：支持特殊时辰检查
      const result = getZhiFuZhiShi(activeGanZhi, ganzhi.day, jushuResult);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        zhiFuPalace: result.zhiFuPalace,
        specialConditions: result.specialConditions,
      };
    }
    case 'day':
      throw new Error('日家奇门尚未完成单一版本的值符值使与布局校勘，当前不开放。');
    case 'month':
    case 'year':
    default: {
      // 月家/年家：使用通用旬首法（无特殊条件）
      const result = getZhiFuZhiShiByGanZhi(activeGanZhi, jushuResult);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        zhiFuPalace: result.xunShouPalace,
        specialConditions: defaultSpecialConditions,
      };
    }
  }
}

export type { QimenScope, QimenMethod }; // re-export for consumer convenience

// ============================================================================
// 导出内部工具（供外部模块或测试使用）
// ============================================================================

export { getHorseBranch, resolveQimenBranchPalace, resolveZhiShiLandingPalace };
