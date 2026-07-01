/**
 * @file 奇门遁甲模式标签与宫位洞察
 * @description 提供奇门遁甲基础格局标签识别（伏吟、反吟、门迫、击刑、入墓、
 * 三奇得、符使同宫、三奇得使、马星）、标签转详情、以及宫位级洞察。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「星反吟兮门反吟，门迫宫兮事难行」
 *   - 《烟波钓叟歌》：「击刑之处防官非，十干入墓主事迟」
 *   - 《烟波钓叟歌》：「三奇得使最为良，符使同宫事必成」
 *   - 《遁甲演义》：「天马方为动应之神，驿马冲则事速」
 *
 * @module patterns
 */

import type { QimenJiuGongGe } from '../../../../types/divination';
import { qimen } from '../../../../divination/divination-data';
import { isKe } from '../../_shared';
import { getDoorElement, getOppositePalace } from './palace-utils';
import { STEM_TOMB_MAP } from './_constants';

const { palaceStars, doorPalaceMap } = qimen;

// ============================================================================
// 常量表
// ============================================================================

/** 三奇天干（乙为日奇、丙为月奇、丁为星奇） */
const SAN_QI = ['乙', '丙', '丁'];

/** 三奇显示名称映射 */
const SAN_QI_NAME: Record<string, string> = {
  乙: '乙奇（日奇）',
  丙: '丙奇（月奇）',
  丁: '丁奇（星奇）',
};

/**
 * 击刑规则：时干落击刑宫
 * 《烟波钓叟歌》：「击刑之处防官非」
 * 戊在震3，己在坤2，庚在艮8，辛在离9，壬在巽4，癸在巽4
 */
const JI_XING_MAP: Record<string, number> = {
  戊: 3,
  己: 2,
  庚: 8,
  辛: 9,
  壬: 4,
  癸: 4,
};

/** 三吉门（开休生） */
const GOOD_DOORS = new Set(['开门', '休门', '生门']);

/** 三凶门（伤死惊） */
const RISK_DOORS = new Set(['伤门', '死门', '惊门']);

/** 吉神 */
const GOOD_GODS = new Set(['值符', '六合', '九天', '太阴']);

/** 凶神 */
const RISK_GODS = new Set(['白虎', '玄武', '螣蛇']);

// ============================================================================
// 内部工具函数
// ============================================================================

/**
 * 遍历所有宫位，识别门克宫（门迫）的标签
 *
 * 《烟波钓叟歌》：「门迫宫兮事难行」
 * 门克宫为门迫，如 惊门（金）克离九宫（火）、开门（金）克离九宫（火）。
 */
function getMenPoTags(jiuGongGe: QimenJiuGongGe[]): string[] {
  return jiuGongGe
    .filter((gong) => gong.renPan.door)
    .filter((gong) => isKe(getDoorElement(gong.renPan.door), gong.element))
    .map((gong) => `门迫（${gong.name}${gong.renPan.door}）`);
}

/**
 * 获取击刑标签（单宫判断）
 *
 * 时干遁干落在击刑宫位时生成对应标签。
 *
 * @param stem - 时干遁干
 * @param landingPalace - 落宫编号
 * @param palaceName - 宫位中文名
 * @returns 击刑标签字符串，不命中时返回 null
 */
function getJiXingTag(stem: string, landingPalace: number, palaceName: string): string | null {
  if (JI_XING_MAP[stem] === landingPalace) {
    return `击刑（时干${stem}落${palaceName}）`;
  }
  return null;
}

/**
 * 获取入墓标签（单宫判断）
 *
 * 时干遁干落入墓宫时生成对应标签。
 *
 * @param stem - 时干遁干
 * @param landingPalace - 落宫编号
 * @param palaceName - 宫位中文名
 * @returns 入墓标签字符串，不命中时返回 null
 */
function getRuMuTag(stem: string, landingPalace: number, palaceName: string): string | null {
  const muPalace = STEM_TOMB_MAP[stem]?.palace;
  if (muPalace === landingPalace) {
    return `入墓（时干${stem}落${palaceName}）`;
  }
  return null;
}

/**
 * 判断一组模式标签中哪些属于风险类（门迫、击刑、入墓）
 *
 * 用于后续宫位洞察时，将风险标签映射到对应宫位。
 *
 * @param tags - 全部模式标签数组
 * @returns 仅包含风险类 (门迫/击刑/入墓) 的标签子集
 */
function filterRiskTags(tags: string[]): string[] {
  return tags.filter(
    (tag) => tag.startsWith('门迫') || tag.startsWith('击刑') || tag.startsWith('入墓'),
  );
}

// ============================================================================
// getQimenPatternTags
// ============================================================================

/**
 * 标签识别函数 getQimenPatternTags 的输入参数
 */
export interface QimenPatternTagParams {
  /** 值符星名称（如 天蓬、天芮） */
  zhiFu: string;
  /** 值使门名称（如 休门、生门） */
  zhiShi: string;
  /** 值符星落宫编号（1-9） */
  zhiFuLandingPalace: number;
  /** 值使门落宫编号（1-9） */
  zhiShiLandingPalace: number;
  /** 九宫格完整数据 */
  jiuGongGe: QimenJiuGongGe[];
  /** 时干遁干（用于击刑/入墓判断） */
  hourGanForFind: string;
  /**
   * 马星落宫编号（可选）
   * 由调用方传入（通常为时支驿马所在宫位）。
   * 不传或 undefined 时不输出马星标签。
   */
  horsePalace?: number;
  /**
   * 马星名称（可选，配合 horsePalace 使用）
   * 如果不传则默认以 "驿马" 称呼。
   */
  horsePalaceName?: string;
}

/**
 * 识别奇门遁甲基础模式标签
 *
 * 依次检测以下标签（每类标签可能输出0到多条）：
 *
 * **伏吟 / 反吟（全局层面）**
 *   - 星伏吟：值符星落回原宫（九星原位），主事缓盘桓
 *   - 星反吟：值符星落原宫对冲宫，主波动反复
 *   - 门伏吟：值使门落回原宫（八门本位），主事迟待机
 *   - 门反吟：值使门落原宫对冲宫，主突变调整
 *
 * **宫位层面**
 *   - 门迫：门克宫，该宫事务易受阻
 *   - 击刑：时干遁干落击刑宫，主压力掣肘
 *   - 入墓：时干遁干落入墓宫，主能量被困
 *
 * **吉格局**
 *   - 三奇得：乙/丙/丁在天盘显现
 *   - 符使同宫：值符星与值使门同落一宫
 *   - 三奇得使：乙/丙/丁临值使门所在宫
 *   - 马星：驿马所在宫（需传入 horsePalace）
 *
 * @param params - 标签识别参数
 * @returns 模式标签字符串数组
 *
 * @example
 * ```ts
 * const tags = getQimenPatternTags({
 *   zhiFu: '天蓬',
 *   zhiShi: '休门',
 *   zhiFuLandingPalace: 1,
 *   zhiShiLandingPalace: 8,
 *   jiuGongGe,
 *   hourGanForFind: '戊',
 *   horsePalace: 3,
 * });
 * // => ['星伏吟', '三奇得（乙奇到震三宫）', '马星（驿马落震三宫）']
 * ```
 */
export function getQimenPatternTags(params: QimenPatternTagParams): string[] {
  const {
    zhiFu,
    zhiShi,
    zhiFuLandingPalace,
    zhiShiLandingPalace,
    jiuGongGe,
    hourGanForFind,
    horsePalace,
    horsePalaceName,
  } = params;

  const tags: string[] = [];

  // ── 1. 星伏吟 / 星反吟 ──
  // 《烟波钓叟歌》：「星反吟兮门反吟」
  // 星伏吟：值符落回原宫（palaceStars 索引+1）
  // 星反吟：值符落原宫的对冲宫
  const zhiFuOriginalPalace = palaceStars.indexOf(zhiFu) + 1;
  if (zhiFuLandingPalace === zhiFuOriginalPalace) {
    tags.push('星伏吟');
  } else if (getOppositePalace(zhiFuOriginalPalace) === zhiFuLandingPalace) {
    tags.push('星反吟');
  }

  // ── 2. 门伏吟 / 门反吟 ──
  // 门伏吟：值使落回原宫（doorPalaceMap 中该门对应宫位）
  // 门反吟：值使落原宫的对冲宫
  const zhiShiOriginalPalace = doorPalaceMap[zhiShi as keyof typeof doorPalaceMap] || 0;
  if (zhiShiLandingPalace === zhiShiOriginalPalace) {
    tags.push('门伏吟');
  } else if (getOppositePalace(zhiShiOriginalPalace) === zhiShiLandingPalace) {
    tags.push('门反吟');
  }

  // ── 3. 门迫 ──
  // 遍历所有宫位检查门克宫
  tags.push(...getMenPoTags(jiuGongGe));

  // ── 4. 击刑（时干落值符宫） ──
  const zhiFuLandingGong = jiuGongGe.find((gong) => gong.gong === zhiFuLandingPalace);
  const jiXingTag = zhiFuLandingGong
    ? getJiXingTag(hourGanForFind, zhiFuLandingPalace, zhiFuLandingGong.name)
    : null;
  if (jiXingTag) {
    tags.push(jiXingTag);
  }

  // ── 5. 入墓（时干落值符宫） ──
  const ruMuTag = zhiFuLandingGong
    ? getRuMuTag(hourGanForFind, zhiFuLandingPalace, zhiFuLandingGong.name)
    : null;
  if (ruMuTag) {
    tags.push(ruMuTag);
  }

  // ── 6. 三奇得 ──
  // 检测天盘是否有乙/丙/丁三奇显现
  // 《烟波钓叟歌》：「三奇得使最为良」
  // 三奇在天盘显现为吉，依各自五行属性各有所主
  const sanQiPalaces = jiuGongGe.filter((gong) => SAN_QI.includes(gong.tianPan.stem));
  for (const gong of sanQiPalaces) {
    const qiDisplay = SAN_QI_NAME[gong.tianPan.stem] || gong.tianPan.stem;
    tags.push(`三奇得（${qiDisplay}到${gong.name}）`);
  }

  // ── 7. 符使同宫 ──
  // 《烟波钓叟歌》：「符使同宫事必成」
  // 值符星与值使门落在同一宫，力量集中
  const fuPalace = jiuGongGe.find((gong) => gong.tianPan.star === zhiFu);
  const shiPalace = jiuGongGe.find((gong) => gong.renPan.door === zhiShi);
  if (fuPalace && shiPalace && fuPalace.gong === shiPalace.gong) {
    tags.push(`符使同宫（值符${zhiFu}与值使${zhiShi}同落${fuPalace.name}）`);
  }

  // ── 8. 三奇得使 ──
  // 《烟波钓叟歌》：「三奇得使最为良」
  // 《奇门遁甲秘籍大全》：乙/丙/丁三奇临值使门所在宫为"得使"
  // 乙奇+值使门 = 日奇得使，丙奇+值使门 = 月奇得使，丁奇+值使门 = 星奇得使
  if (shiPalace && SAN_QI.includes(shiPalace.tianPan.stem)) {
    const qiName = SAN_QI_NAME[shiPalace.tianPan.stem] || shiPalace.tianPan.stem;
    tags.push(`三奇得使（${qiName}临值使${zhiShi}所在${shiPalace.name}）`);
  }

  // ── 9. 马星 ──
  // 《遁甲演义》：「天马方为动应之神」
  // 驿马所在宫位主变动、加速、远行
  if (horsePalace !== undefined) {
    const horseGong = jiuGongGe.find((gong) => gong.gong === horsePalace);
    if (horseGong) {
      const displayName = horsePalaceName || horseGong.name;
      tags.push(`马星（驿马落${displayName}）`);
    }
  }

  return tags;
}

// ============================================================================
// buildPatternDetails
// ============================================================================

/**
 * 模式标签详情条目
 */
export interface PatternDetail {
  /** 原始标签文本 */
  tag: string;
  /** 面向用户的简要解读 */
  summary: string;
}

/**
 * 根据标签名获取面向用户的简要解读
 *
 * @param tag - 模式标签字符串
 * @returns 中文解读文本
 */
function getPatternSummary(tag: string): string {
  // 伏吟 / 反吟
  if (tag === '星伏吟') {
    return '九星回原位，事情多原地盘旋、推进偏慢。';
  }
  if (tag === '星反吟') {
    return '九星临对冲宫，局势波动较大，易反复。';
  }
  if (tag === '门伏吟') {
    return '八门回原位，事项推进迟滞，宜耐心等待。';
  }
  if (tag === '门反吟') {
    return '八门落反吟位，节奏多突变，计划易临时调整。';
  }

  // 门迫
  if (tag.startsWith('门迫')) {
    return '门受宫克，该宫事项易受压制，行动阻力偏大。';
  }

  // 击刑
  if (tag.startsWith('击刑')) {
    return '时干落击刑位，主压力、掣肘或规章束缚，宜谨慎行事。';
  }

  // 入墓
  if (tag.startsWith('入墓')) {
    return '时干入墓宫，主能量被困、事情停滞或难以施展，宜等待时机或寻求突破。';
  }

  // 三奇得
  if (tag.startsWith('三奇得（')) {
    return '三奇到宫，主该宫方位有吉气临照，可借助该方位之利推进事项。';
  }

  // 符使同宫
  if (tag.startsWith('符使同宫')) {
    return '值符与值使同宫，力量高度集中，专注之事易出成果，但也需注意过于偏执。';
  }

  // 三奇得使
  if (tag.startsWith('三奇得使')) {
    return '三奇临值使门，吉格相助，所谋之事有贵人暗助，宜主动把握。';
  }

  // 马星
  if (tag.startsWith('马星')) {
    return '驿马发动，主变动、加速或远行，该宫方位之事会较快推进。';
  }

  return '需结合全局继续参看。';
}

/**
 * 将模式标签数组转换为带解读的详情对象数组
 *
 * 每个标签映射为 { tag, summary } 结构，方便前端直接使用。
 *
 * @param patternTags - 模式标签字符串数组
 * @returns 详情对象数组
 *
 * @example
 * ```ts
 * buildPatternDetails(['星伏吟', '门迫（离九宫景门）']);
 * // => [
 * //   { tag: '星伏吟', summary: '九星回原位，事情多原地盘旋、推进偏慢。' },
 * //   { tag: '门迫（离九宫景门）', summary: '门受宫克，该宫事项易受压制，行动阻力偏大。' },
 * // ]
 * ```
 */
export function buildPatternDetails(patternTags: string[]): PatternDetail[] {
  return patternTags.map((tag) => ({
    tag,
    summary: getPatternSummary(tag),
  }));
}

// ============================================================================
// buildPalaceInsights
// ============================================================================

/**
 * 宫位洞察函数 buildPalaceInsights 的输入参数
 */
export interface PalaceInsightParams {
  /** 九宫格完整数据 */
  jiuGongGe: QimenJiuGongGe[];
  /** 值符星名称 */
  zhiFu: string;
  /** 值使门名称 */
  zhiShi: string;
  /** 全部模式标签（用于风险类标签匹配检测） */
  patternTags: string[];
}

/**
 * 宫位洞察条目
 */
export interface PalaceInsight {
  /** 宫位编号（1-9） */
  gong: number;
  /** 宫位中文名（如 坎一宫、离九宫） */
  name: string;
  /**
   * 洞察等级：
   *   - 有利：该宫有吉门、吉神或值使，适合行动
   *   - 关注：该宫有值符，是全局核心观察位
   *   - 风险：该宫有凶门、凶神或携带风险类标签
   */
  level: '有利' | '风险' | '关注';
  /** 面向用户的中文解读 */
  summary: string;
}

/**
 * 生成宫位级洞察
 *
 * 对每个宫位，综合门、神、星和现有模式标签，给出以下三类判断：
 *
 * **有利（绿色）**
 *   该宫携带值使门、吉门（开/休/生）或吉神（值符/六合/九天/太阴）。
 *   可作为推进、求助或争取资源的优先方位。
 *
 * **关注（黄色）**
 *   该宫有值符星（大值符），是局核心观察位。
 *   代表当前事体的统领方，需重点关注此宫动静。
 *
 * **风险（红色）**
 *   该宫带有门迫/击刑/入墓等风险标签，或携凶门（伤/死/惊）/凶神（白虎/玄武/螣蛇）。
 *   行为阻滞和牵制较明显，宜谨慎行事。
 *
 * 注意：同一宫位可能同时属于多个等级（如有值符同时也有凶门），
 * 此时会输出多条洞察，风险优先展示。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「八门若遇开休生，诸事逢之总称情」
 *   - 《烟波钓叟歌》：「伤死惊门皆凶恶，杜门无事好躲藏」
 *   - 《遁甲演义》：「值符为八神之主，其所在宫为全局枢纽」
 *
 * @param args - 宫位洞察输入参数
 * @returns 宫位洞察条目数组
 *
 * @example
 * ```ts
 * const insights = buildPalaceInsights({
 *   jiuGongGe,
 *   zhiFu: '天蓬',
 *   zhiShi: '休门',
 *   patternTags,
 * });
 * // 返回值示例：
 * // [
 * //   { gong: 1, name: '坎一宫', level: '风险',
 * //     summary: '该宫带有门迫（坎一宫休门），行事阻滞和牵制较明显。' },
 * //   { gong: 1, name: '坎一宫', level: '关注',
 * //     summary: '值符落坎一宫，是当前局的核心观察位。' },
 * // ]
 * ```
 */
export function buildPalaceInsights(args: PalaceInsightParams): PalaceInsight[] {
  const { jiuGongGe, zhiFu, zhiShi, patternTags } = args;

  // 预先过滤出风险类标签（排除三奇得、马星等正/中性标签）
  const riskTags = filterRiskTags(patternTags);

  return jiuGongGe.flatMap((gong) => {
    const insights: PalaceInsight[] = [];

    // ── 1. 风险 ← 门迫/击刑/入墓 标签 ──
    // 风险标签已经在标签名中包含了宫位名，通过匹配宫位名来确定归属
    const relatedRiskTags = riskTags.filter(
      (tag) => tag.includes(`（${gong.name}`) || tag.includes(`落${gong.name}`),
    );
    if (relatedRiskTags.length > 0) {
      insights.push({
        gong: gong.gong,
        name: gong.name,
        level: '风险',
        summary: `该宫带有${relatedRiskTags.join('、')}，行事阻滞和牵制较明显。`,
      });
    }

    // ── 2. 风险 ← 凶门 / 凶神（仅当该宫未因标签标记为风险时检查） ──
    if (RISK_DOORS.has(gong.renPan.door) || RISK_GODS.has(gong.shenPan.god)) {
      const reasons = [
        RISK_DOORS.has(gong.renPan.door) ? gong.renPan.door : '',
        RISK_GODS.has(gong.shenPan.god) ? gong.shenPan.god : '',
      ].filter(Boolean);
      insights.push({
        gong: gong.gong,
        name: gong.name,
        level: '风险',
        summary: `${reasons.join('、')}同宫，宜防阻力、口舌或反复。`,
      });
    }

    // ── 3. 关注 ← 值符 ──
    // 值符星（大值符）所在宫为全局核心观察位
    if (gong.tianPan.star === zhiFu) {
      insights.push({
        gong: gong.gong,
        name: gong.name,
        level: '关注',
        summary: `值符落${gong.name}，是当前局的核心观察位。`,
      });
    }

    // ── 4. 有利 ← 值使 ──
    // 值使门所在宫，门气正旺，是行动重点方位
    if (gong.renPan.door === zhiShi) {
      insights.push({
        gong: gong.gong,
        name: gong.name,
        level: '有利',
        summary: `值使（${zhiShi}）在${gong.name}，门气正旺，是行动重点方位。`,
      });
    }

    // ── 5. 有利 ← 吉门 / 吉神 ──
    // 吉门（开休生）或吉神（值符/六合/九天/太阴）所在宫
    if (GOOD_DOORS.has(gong.renPan.door) || GOOD_GODS.has(gong.shenPan.god)) {
      const goodParts = [
        GOOD_DOORS.has(gong.renPan.door) ? gong.renPan.door : '',
        GOOD_GODS.has(gong.shenPan.god) ? gong.shenPan.god : '',
      ].filter(Boolean);
      insights.push({
        gong: gong.gong,
        name: gong.name,
        level: '有利',
        summary: `${goodParts.join('、')}同宫，可作为推进、求助或争取资源的优先方位。`,
      });
    }

    return insights;
  });
}
