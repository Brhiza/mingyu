/**
 * @file 奇门遁甲排盘算法（主入口）
 * @description 基于转盘法，实现时家/日家/月家/年家奇门完整排盘，
 * 含定局、布盘、格局识别、方位建议、应期判断。
 * @流派 转盘奇门（拆补法定局）
 * @古籍依据 《烟波钓叟歌》《遁甲演义》《奇门遁甲秘籍大全》
 *
 * @核心流程
 * 1. 定局数（拆补法/月家法/年家法）：根据 scope 选择不同定局方式
 * 2. 寻值符值使：由对应级别的干支旬首定位值符星和值使门
 * 3. 排九宫格：布地盘三奇六仪 -> 定值符值使落宫 -> 排天盘九星 -> 排人盘八门 -> 排神盘八神
 * 4. 识格局：基础标签（伏吟/反吟/门迫等）+ 经典双元格局（九遁、三奇格局、门迫、击刑、入墓）
 * 5. 辅助分析：方位吉凶、应期估算
 *
 * 《烟波钓叟歌》核心法理（下称《歌》）：
 *   "阴阳二遁分顺逆，一气三元人莫测"        —— 拆补法定局
 *   "直符直使各有时，时干直符时支使"        —— 旬首寻值符值使
 *   "星随符转，门随地转，八神随遁顺逆"      —— 转盘排盘
 *   "星反吟兮门反吟，门迫宫兮事难行"        —— 格局判读
 *   "天遁地遁与人遁，龙遁虎遁与风遁"        —— 九遁格局
 *   "三奇得使最为良，玉女守门喜非常"        —— 吉格判据
 *   "十干入墓主事迟，击刑之处防官非"        —— 凶格判据
 */

import type { QimenData, QimenJiuGongGe, QimenScope } from '../../../types/divination';
import type { ClassicPattern, PatternContext, StemRelation } from './helpers/classic-patterns';
import type { QimenMethod } from './helpers/layout';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getVoidBranches } from '../../../calendar/lunar';
import { diPanPalaces, STEM_TOMB_MAP } from './helpers/_constants';
import {
  getQimenJuShu,
  getZhiFuZhiShi,
  getZhiFuZhiShiByGanZhi,
  getDunJiaStem,
} from './helpers/jushu';
import { getMonthQimenJuShu, getYearQimenJuShu } from './helpers/jushu-extended';
import { arrangeJiuGongGe, resolveZhiShiLandingPalace } from './helpers/layout';
import { getQimenPatternTags, buildPatternDetails, buildPalaceInsights } from './helpers/patterns';
import { getStemRelations, getClassicPatterns } from './helpers/classic-patterns';
import { buildDirectionAdvice } from './helpers/directions';
import { estimateYingQi } from './helpers/ying-qi';
import { buildSeasonality } from './helpers/seasonality';
import { detectQimenPatternCombos } from './helpers/pattern-combos';

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
  return patterns.map((p) => ({
    name: p.name,
    type: p.tone,
    score: p.score,
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
 * 支持时家（hour）、日家（day）、月家（month）、年家（year）四种级别。
 * 默认时家奇门（精确到时辰），使用拆补法定局。
 *
 * 遵循拆补法定局、转盘法排盘，完整输出九宫四盘（天地人神）、
 * 格局标签、经典格局（九遁、三奇、门迫、击刑、入墓等）、
 * 宫位洞察、方位吉凶指引和应期估算。
 *
 * ── 排盘流程 ──
 *
 * 1. **时间信息**：《歌》"先须掌上排九宫，纵横十五在其中"
 *    - 获取公历、农历、节气、干支等完整时间数据
 *
 * 2. **定局数**：《歌》"阴阳二遁分顺逆，一气三元人莫测"
 *    - 时家/日家：拆补法（以节气为界）
 *    - 月家：月支循环定局
 *    - 年家：年干分组 + 三元甲子周期
 *
 * 3. **寻值符值使（旬首法）**：《歌》"直符直使各有时，时干直符时支使"
 *    - 由对应级别干支的旬首定位值符星和值使门
 *
 * 4. **排九宫格（转盘法）**：《歌》"星随符转，门随地转，八神随遁顺逆"
 *    - 布地盘三奇六仪 -> 定值符值使落宫 -> 排天盘九星 -> 排人盘八门 -> 排神盘八神
 *
 * 5. **辅助数据**：空亡地支配对、驿马定位
 *
 * 6. **基础格局标签**：《歌》"星反吟兮门反吟，门迫宫兮事难行"
 *    - 伏吟/反吟、门迫、击刑、入墓、三奇得、符使同宫、三奇得使、马星
 *
 * 7. **经典格局**：《歌》"天遁地遁与人遁，龙遁虎遁与风遁"
 *    - 九大遁格、三奇得使/升殿/入墓/会甲、符使同宫等
 *
 * 8. **天地盘干关系**：每个宫位天盘干与地盘干的五行生克
 *
 * 9. **宫位洞察**：综合门、神、星、格局标签判定各宫等级
 *
 * 10. **方位建议**：《歌》"八门若遇开休生，诸事逢之总称情"
 *     - 按门、神、星、三奇综合评分，推荐吉方与避方
 *
 * 11. **应期估算**：《奇门遁甲大全》庚格应期法
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
 * // 日家奇门
 * const result = generateQimen(undefined, 'zhuanpan', 'day');
 *
 * // 年家奇门
 * const result = generateQimen(new Date('2025-01-01'), 'zhuanpan', 'year');
 * ```
 */
export function generateQimen(
  customDate?: Date,
  method: QimenMethod = 'zhuanpan',
  scope: QimenScope = 'hour',
): QimenData {
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
  const jushuResult = getJushuForScope(scope, ganzhi, timeInfo);
  const { isYangDun, juShu, yuan } = jushuResult;

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 3：寻值符与值使（旬首法）
  // ──────────────────────────────────────────────────────────────────────────
  const zhiFuShiResult = getZhiFuShiForScope(scope, activeGanZhi, ganzhi);
  const { zhiFu, zhiShi, specialConditions } = zhiFuShiResult;

  // ── 后续步骤 4-12 与 scope 无关，共用同一套排盘逻辑 ──

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 4：排九宫格（转盘法）
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

  const zhiFuLandingPalace = jiuGongGe.find((gong) => gong.tianPan.star === zhiFu)?.gong;
  if (zhiFuLandingPalace === undefined) {
    throw new Error(`找不到值符星 "${zhiFu}" 落宫。`);
  }
  const zhiShiLandingPalace = resolveZhiShiLandingPalace(isYangDun, zhiShi, activeGanZhi);

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
    horsePalace: horsePalace?.palace,
    horsePalaceName: horsePalace?.name,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 7：标签详情
  // ──────────────────────────────────────────────────────────────────────────
  const patternDetails = buildPatternDetails(patternTags);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 8：经典格局
  // ──────────────────────────────────────────────────────────────────────────
  const dayStem = ganzhi.day.charAt(0);
  const classicPatternContext: PatternContext = {
    jiuGongGe,
    zhiFu,
    zhiShi,
    dayStem,
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
  const seasonality = buildSeasonality(ganzhi, jushuResult.jieQi || jieQi, seasonalityDate);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 11：宫位洞察
  // ──────────────────────────────────────────────────────────────────────────
  const palaceInsights = buildPalaceInsights({
    jiuGongGe,
    zhiFu,
    zhiShi,
    patternTags,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 12：方位建议
  // ──────────────────────────────────────────────────────────────────────────
  const directions = buildDirectionAdvice(jiuGongGe, voidBranches, classicPatternsRaw);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 13：应期估算
  // ──────────────────────────────────────────────────────────────────────────
  const isFuyin = patternTags.some((t) => t.includes('伏吟'));
  const isFanyin = patternTags.some((t) => t.includes('反吟'));
  const hasVoid = voidBranches.length > 0;
  const hasHorse = !!horsePalace;
  const yingQi = estimateYingQi(jiuGongGe, zhiFuLandingPalace, {
    isFuyin,
    isFanyin,
    hasHorse,
    hasVoid,
    zhiFuLandingPalace,
    zhiShiLandingPalace,
    hourGanZhi: activeGanZhi,
    classicPatterns: classicPatternsRaw,
    voidBranches,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 14：复合格局
  // ──────────────────────────────────────────────────────────────────────────
  const patternCombos = detectQimenPatternCombos({
    classicPatterns: classicPatternsRaw,
    patternTags,
    voidPalaces,
    horseStar: horsePalace || undefined,
    zhiShi,
    jiuGongGe,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 15：返回完整 QimenData
  // ──────────────────────────────────────────────────────────────────────────
  return {
    scope,
    timeInfo: {
      solarTerm: jushuResult.jieQi || jieQi,
      epoch: jushuResult.yuan,
    },
    ganzhi,
    isYangDun: jushuResult.isYangDun,
    juShu: jushuResult.juShu,
    zhiFu,
    zhiShi,
    patternTags,
    patternDetails,
    palaceInsights,
    voidBranches,
    voidPalaces,
    horseStar: horsePalace ? { ...horsePalace, sourceBranch: activeZhi } : undefined,
    specialConditions,
    seasonality,
    jiuGongGe,
    classicPatterns,
    stemRelations,
    patternCombos,
    directions,
    yingQi,
    timestamp,
  };
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
  timeInfo: { solar: { year: number; month: number; day: number }; jieQi: string },
): { isYangDun: boolean; juShu: number; yuan: string; jieQi?: string } {
  switch (scope) {
    case 'year': {
      const r = getYearQimenJuShu(ganzhi.year);
      return { ...r, jieQi: timeInfo.jieQi };
    }
    case 'month': {
      const r = getMonthQimenJuShu(ganzhi.month, ganzhi.year);
      return { ...r, jieQi: timeInfo.jieQi };
    }
    case 'day':
    case 'hour':
    default: {
      return getQimenJuShu({
        jieQi: timeInfo.jieQi,
        ganzhi: { day: ganzhi.day },
        solar: {
          year: timeInfo.solar.year,
          month: timeInfo.solar.month,
          day: timeInfo.solar.day,
        },
      });
    }
  }
}

/** 根据 scope 获取值符值使 */
function getZhiFuShiForScope(
  scope: QimenScope,
  activeGanZhi: string,
  ganzhi: { day: string },
): { zhiFu: string; zhiShi: string; specialConditions: QimenData['specialConditions'] } {
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
      const result = getZhiFuZhiShi(activeGanZhi, ganzhi.day);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        specialConditions: result.specialConditions,
      };
    }
    case 'day': {
      // 日家奇门：使用通用旬首法，补充日干入墓检查
      const result = getZhiFuZhiShiByGanZhi(activeGanZhi);
      const conditions = { ...defaultSpecialConditions };
      checkDayRuMu(ganzhi.day, conditions);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        specialConditions: conditions,
      };
    }
    case 'month':
    case 'year':
    default: {
      // 月家/年家：使用通用旬首法（无特殊条件）
      const result = getZhiFuZhiShiByGanZhi(activeGanZhi);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        specialConditions: defaultSpecialConditions,
      };
    }
  }
}

/**
 * 检查日干入墓
 *
 * 日干五行入墓支：木墓在未、火墓在戌、金墓在丑、水土墓在辰
 * 与《烟波钓叟歌》"时干入墓凶无疑"同一套规则，但应用于日干级别。
 */
function checkDayRuMu(
  dayGanZhi: string,
  conditions: Exclude<QimenData['specialConditions'], undefined>,
): void {
  const dayGan = dayGanZhi.charAt(0);
  const dayZhi = dayGanZhi.charAt(1);
  const ruMuMap = STEM_TOMB_MAP;
  const ruMuInfo = ruMuMap[dayGan];
  if (ruMuInfo && dayZhi === ruMuInfo.branch) {
    conditions.isShiGanRuMu = true;
    conditions.description += `日干${dayGan}入墓（${dayGan}入${ruMuInfo.palace}宫/${ruMuInfo.branch}支），大势迟滞，宜静不宜动；`;
  }
}

export type { QimenScope, QimenMethod }; // re-export for consumer convenience

// ============================================================================
// 导出内部工具（供外部模块或测试使用）
// ============================================================================

export { getHorseBranch, resolveQimenBranchPalace, resolveZhiShiLandingPalace };
