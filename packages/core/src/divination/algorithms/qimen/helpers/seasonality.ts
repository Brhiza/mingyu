/**
 * @file 节令背景（Seasonal Context）分析
 * @description 奇门遁甲节气背景分析：二十四节气五行属性映射、
 * 节气三元阶段判定、日干与节令五行的旺相关系、月相、
 * 十二建除、以及干支互动（六合/三合/半合/六冲/相刑/相害）。
 *
 * 古籍依据：
 *   - 《协纪辨方书》卷三"二十四节气"篇：「立春寅月节……大寒丑月中」
 *   - 《淮南子·天文训》：「日行一度，十五日为一节，以生二十四时之变」
 *   - 《淮南子·时则训》四时五行配属
 *   - 《奇门遁甲秘籍大全》卷三"定局成局诀"
 *   - 《烟波钓叟歌》：「先须掌上排九宫，纵横十五其中。次将八卦论八节，一气统三为正宗。」
 *   - 《太白阴经》卷四"建除十二神"篇
 *   - 《礼记·月令》「孟春之月，日在营室；仲春之月，日在奎……」
 *   - 《五行大义》论旺相休囚死
 */

import { SolarDay } from 'tyme4ts';
import { stemElements, isGenerating, isControlling } from './_constants';
import {
  LIUHE_MAP,
  LIUCHONG_MAP,
  LIUHAI_MAP,
  SANHE_GROUPS,
  isTianGanHe,
} from '../../_shared/wuxing';
import type { BaseGanZhi } from '../../../../types/divination';

// ============================================================================
// 1. 二十四节气 → 五行映射
// ============================================================================

/**
 * 二十四节气五行属性映射表
 *
 * 以月建（地支）之五行定节气所属。每月含一个节一个气（节为月首，气为月中）。
 * 十二月建分属五行：
 *   寅卯属木，巳午属火，申酉属金，亥子属水，辰戌丑未属土。
 *
 * 《协纪辨方书》卷三"二十四节气"：
 *   "正月立春寅节、雨水寅中……二月惊蛰卯节、春分卯中……
 *    三月清明辰节、谷雨辰中……四月立夏巳节、小满巳中……
 *    五月芒种午节、夏至午中……六月小暑未节、大暑未中……
 *    七月立秋申节、处暑申中……八月白露酉节、秋分酉中……
 *    九月寒露戌节、霜降戌中……十月立冬亥节、小雪亥中……
 *    十一月大雪子节、冬至子中……十二月小寒丑节、大寒丑中。"
 *
 * 《淮南子·天文训》：
 *   "日行一度，十五日为一节，以生二十四时之变。"
 *   十二月建分属五行：寅卯属木，巳午属火，申酉属金，亥子属水，辰戌丑未属土。
 */
export const JIE_QI_SEASONS: Record<string, string> = {
  // 寅月 — 木（正月，立春为节、雨水为气）
  立春: '木',
  雨水: '木',
  // 卯月 — 木（二月，惊蛰为节、春分为气）
  惊蛰: '木',
  春分: '木',
  // 辰月 — 土（三月，清明为节、谷雨为气）
  清明: '土',
  谷雨: '土',
  // 巳月 — 火（四月，立夏为节、小满为气）
  立夏: '火',
  小满: '火',
  // 午月 — 火（五月，芒种为节、夏至为气）
  芒种: '火',
  夏至: '火',
  // 未月 — 土（六月，小暑为节、大暑为气）
  小暑: '土',
  大暑: '土',
  // 申月 — 金（七月，立秋为节、处暑为气）
  立秋: '金',
  处暑: '金',
  // 酉月 — 金（八月，白露为节、秋分为气）
  白露: '金',
  秋分: '金',
  // 戌月 — 土（九月，寒露为节、霜降为气）
  寒露: '土',
  霜降: '土',
  // 亥月 — 水（十月，立冬为节、小雪为气）
  立冬: '水',
  小雪: '水',
  // 子月 — 水（十一月，大雪为节、冬至为气）
  大雪: '水',
  冬至: '水',
  // 丑月 — 土（十二月，小寒为节、大寒为气）
  小寒: '土',
  大寒: '土',
};

/**
 * 获取节气对应的五行属性
 * @param jieQi 节气名称（如 "立春"、"冬至"）
 * @returns 五行名，未找到时返回空字符串
 */
export function getSeasonalElement(jieQi: string): string {
  return JIE_QI_SEASONS[jieQi] ?? '';
}

// ============================================================================
// 2. 节气三元阶段判定
// ============================================================================

/**
 * 节气三元阶段结果
 */
export interface JieQiPhaseResult {
  /** 节气名称 */
  jieQi: string;
  /** 三元：上元（初）、中元、下元（末） */
  phase: '上元' | '中元' | '下元';
  /** 数字索引：0 → 上元，1 → 中元，2 → 下元 */
  phaseIndex: number;
}

/**
 * 二十四节气的农历月日近似起始（用于无太阳历日期时的粗略估算）
 *
 * 由于阴阳历之间的偏移，每年各节气在农历中的日期有 ±2-3 天的浮动。
 * 此处取常见年份的平均值作为近似参考。
 *
 * 《协纪辨方书》：
 *   节气之日所在，随闰移易，难以固定，但大致每月一节一气。
 */
const JIE_QI_LUNAR_ESTIMATE: Record<string, { lunarMonth: number; startDay: number }> = {
  立春: { lunarMonth: 1, startDay: 5 },
  雨水: { lunarMonth: 1, startDay: 20 },
  惊蛰: { lunarMonth: 2, startDay: 5 },
  春分: { lunarMonth: 2, startDay: 20 },
  清明: { lunarMonth: 3, startDay: 6 },
  谷雨: { lunarMonth: 3, startDay: 21 },
  立夏: { lunarMonth: 4, startDay: 6 },
  小满: { lunarMonth: 4, startDay: 21 },
  芒种: { lunarMonth: 5, startDay: 6 },
  夏至: { lunarMonth: 5, startDay: 21 },
  小暑: { lunarMonth: 6, startDay: 7 },
  大暑: { lunarMonth: 6, startDay: 22 },
  立秋: { lunarMonth: 7, startDay: 7 },
  处暑: { lunarMonth: 7, startDay: 22 },
  白露: { lunarMonth: 8, startDay: 7 },
  秋分: { lunarMonth: 8, startDay: 22 },
  寒露: { lunarMonth: 9, startDay: 7 },
  霜降: { lunarMonth: 9, startDay: 22 },
  立冬: { lunarMonth: 10, startDay: 7 },
  小雪: { lunarMonth: 10, startDay: 22 },
  大雪: { lunarMonth: 11, startDay: 7 },
  冬至: { lunarMonth: 11, startDay: 21 },
  小寒: { lunarMonth: 12, startDay: 6 },
  大寒: { lunarMonth: 12, startDay: 20 },
};

/**
 * 由太阳历日期精确计算节气三元阶段
 *
 * 每个节气跨度约 15 天，拆分为上元（第 1-5 天）、中元（第 6-10 天）、
 * 下元（第 11-15 天）。此划分与奇门遁甲三元定局法相呼应。
 *
 * @param date 太阳历（公历）日期
 * @returns 节气三元阶段信息
 */
export function getJieQiPhaseByDate(date: Date): JieQiPhaseResult {
  const solarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const term = solarDay.getTerm();
  const jieQi = term.getName();
  const termStart = term.getSolarDay();
  const diff = Math.round(Number(solarDay.getJulianDay()) - Number(termStart.getJulianDay()));
  const phaseIndex = Math.min(2, Math.floor(diff / 5));
  const phase = (['上元', '中元', '下元'] as const)[phaseIndex];

  return { jieQi, phase, phaseIndex };
}

/**
 * 由农历月日估算节气三元阶段（近似方法）
 *
 * 当不具备太阳历日期信息时，通过农历月日结合节气名称进行粗略估算。
 * 由于节气在农历中的日期每年有 ±2-3 天浮动，此方法仅供参考，
 * 精确判定应使用 getJieQiPhaseByDate。
 *
 * 《奇门遁甲秘籍大全》卷三"定局成局诀"：
 *   一气统三，各含上中下三元，每元五日，共十五日。
 *
 * @param jieQi 节气名称
 * @param lunarMonth 农历月份（1-12）
 * @param lunarDay 农历日（1-30）
 * @returns 节气三元阶段信息
 */
export function getJieQiPhase(
  jieQi: string,
  lunarMonth: number,
  lunarDay: number,
): JieQiPhaseResult {
  const estimate = JIE_QI_LUNAR_ESTIMATE[jieQi];
  if (!estimate) {
    // 未知节气，默认为中元
    return { jieQi, phase: '中元', phaseIndex: 1 };
  }

  // 如果当前农历月与节气所在月不同，尝试调整
  let dayOffset: number;
  if (lunarMonth === estimate.lunarMonth) {
    dayOffset = lunarDay - estimate.startDay;
  } else if (lunarMonth < estimate.lunarMonth) {
    // 在节气开始之前，属上一节气末段
    dayOffset = lunarDay - estimate.startDay; // 负值
  } else if (lunarMonth === estimate.lunarMonth + 1) {
    // 进入下一农历月但仍在同一节气内：前月最后几天到当前月初
    dayOffset = 30 - estimate.startDay + lunarDay;
  } else if (estimate.lunarMonth === 12 && lunarMonth === 1 && jieQi === '立春') {
    // 跨年：立春可能在正月，但十二月接正月
    dayOffset = 30 - estimate.startDay + lunarDay;
  } else {
    dayOffset = lunarDay - estimate.startDay;
  }

  // 超出节气范围的处理
  if (dayOffset < 0) {
    // 节气尚未开始，归入本节气上元（兜底）
    return { jieQi, phase: '上元', phaseIndex: 0 };
  }

  const phaseIndex = Math.min(2, Math.floor(dayOffset / 5));
  const phase = (['上元', '中元', '下元'] as const)[phaseIndex];

  return { jieQi, phase, phaseIndex };
}

// ============================================================================
// 3. 日干与节令五行的关系
// ============================================================================

/**
 * 日干与节令五行关系类型
 *
 * 《五行大义》论旺相休囚死：
 *   同令为旺（日干与当令五行相同）→ 得时
 *   令生为相（当令五行生日干）   → 受生
 *   克令为囚（日干克当令五行）   → neutral（持平）
 *   生令为休（日干生当令五行）   → 被耗
 *   令克为死（当令五行克日干）   → 受克
 */
export type DaySeasonRelation = '得时' | '受生' | '受克' | '被耗' | 'neutral';

/**
 * 计算日干与节令五行的关系
 *
 * @param dayStem 日干（如 "甲"、"乙"）
 * @param seasonalElement 当前节气的当令五行
 * @returns 日干在节令中的状态
 *
 * @example
 *   getDaySeasonRelation('甲', '木') // => '得时'（同为木）
 *   getDaySeasonRelation('乙', '火') // => '受生'（木生火→季节生日干…实际需反向：火→木？）
 *
 * 分析逻辑：
 *   以"我"为日干五行，"令"为季节当令五行：
 *   同令 → 旺（得时）相 → 令生为相（受生）
 *   令克 → 死（受克）  生令 → 休（被耗）
 *   克令 → 囚（neutral）
 */
export function getDaySeasonRelation(
  dayStem: string,
  seasonalElement: string,
): {
  relation: DaySeasonRelation;
  description: string;
} {
  const element = stemElements[dayStem];
  if (!element || !seasonalElement) {
    return { relation: 'neutral', description: '无法判定' };
  }

  if (element === seasonalElement) {
    return {
      relation: '得时',
      description: `${dayStem}属${element}，与节令${seasonalElement}比和，当令而旺。`,
    };
  }

  // 令生我（seasonalElement 生 element）= 相
  if (isGenerating(seasonalElement, element)) {
    return {
      relation: '受生',
      description: `节令${seasonalElement}生${dayStem}之${element}，得令相助。`,
    };
  }

  // 我生令（element 生 seasonalElement）= 休
  if (isGenerating(element, seasonalElement)) {
    return {
      relation: '被耗',
      description: `${dayStem}之${element}生节令${seasonalElement}，泄气被耗。`,
    };
  }

  // 令克我（seasonalElement 克 element）= 死
  if (isControlling(seasonalElement, element)) {
    return {
      relation: '受克',
      description: `节令${seasonalElement}克${dayStem}之${element}，受制不吉。`,
    };
  }

  // 我克令（element 克 seasonalElement）= 囚
  if (isControlling(element, seasonalElement)) {
    return {
      relation: 'neutral',
      description: `${dayStem}之${element}克节令${seasonalElement}，虽能克令但亦耗力，持平。`,
    };
  }

  return { relation: 'neutral', description: '无明显生克关系' };
}

// ============================================================================
// 4. 月相判定
// ============================================================================

/**
 * 四相月相类型
 *
 * 《协纪辨方书》引《淮南子》：
 *   月有盈亏，朔（新月）望（满月）弦（上下弦）为四正相位，
 *   各主阴阳消长之机。
 */
export type LunarPhase = '新月' | '上弦' | '满月' | '下弦';

/**
 * 月相名称与值的映射说明
 *
 * tyme4ts Phase.names 返回 8 个月相名：
 *   index 0: 新月（朔）
 *   index 1: 蛾眉月（朔后→上弦）
 *   index 2: 上弦月
 *   index 3: 盈凸月（上弦→望）
 *   index 4: 满月（望）
 *   index 5: 亏凸月（望→下弦）
 *   index 6: 下弦月
 *   index 7: 残月（下弦→朔）
 *
 * 映射为四相月相：
 *   新月 = 0
 *   上弦 = 1, 2
 *   满月 = 3, 4
 *   下弦 = 5, 6, 7
 */
const MOON_PHASE_MAP: Record<number, LunarPhase> = {
  0: '新月',
  1: '上弦',
  2: '上弦',
  3: '满月',
  4: '满月',
  5: '下弦',
  6: '下弦',
  7: '下弦',
};

/**
 * 获取农历日对应的四相月相
 * @param date 公历日期
 * @returns 月相
 */
export function getLunarPhase(date: Date): LunarPhase {
  const solarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const phase = solarDay.getLunarDay().getPhase();
  return MOON_PHASE_MAP[phase.getIndex()] ?? '新月';
}

// ============================================================================
// 5. 完整节令背景
// ============================================================================

/**
 * 节令背景信息
 */
export interface SeasonalityInfo {
  /** 当前节气名称 */
  currentJieQi: string;
  /** 节气对应的五行属性 */
  seasonalElement: string;
  /** 节气三元阶段（上元/中元/下元） */
  jieQiPhase: JieQiPhaseResult;

  /** 日干 */
  dayStem: string;
  /** 日干五行属性 */
  dayElement: string;
  /** 日干与节令关系 */
  seasonRelation: DaySeasonRelation;
  /** 关系描述文本 */
  seasonRelationDescription: string;

  /** 四相月相 */
  lunarPhase: LunarPhase;
  /** 月相详细名称（来自 tyme4ts 的八相名，如蛾眉月、盈凸月等） */
  lunarPhaseDetail: string;

  /** 十二建除（建/除/满/平/定/执/破/危/成/收/开/闭） */
  dayOfficer: string;
  /** 建除十二神吉凶倾向 */
  dayOfficerFortuneLabel: string;
  /** 建除十二神宜忌简述 */
  dayOfficerAdvice: string;

  /** 干支互动分析结果 */
  ganzhiInteractions: GanzhiInteraction[];
}

/**
 * 建除十二神宜忌简表
 *
 * 《太白阴经》卷四"建除十二神"：
 *   建为岁君、除为扫舍、满为福德、平为六合、定为官符、
 *   执为小耗、破为大耗、危为极富、成为天府、收为天仓、
 *   开为文昌、闭为天狱。
 *
 * 吉凶倾向：
 *   黄道（吉）：除、危、定、执、成、开
 *   黑道（凶）：建、满、平、破、收、闭
 */
const DAY_OFFICER_INFO: Record<string, { fortune: '吉' | '凶' | '平'; meaning: string }> = {
  建: { fortune: '凶', meaning: '建为岁君，宜不宜动土、开仓，出行上任尚可' },
  除: { fortune: '吉', meaning: '除为扫舍，宜解除、治病、扫舍，忌出行嫁娶' },
  满: { fortune: '凶', meaning: '满为福德，宜祭祀、祈福、进人口，忌栽种下葬' },
  平: { fortune: '凶', meaning: '平为六合，宜修造、动土，忌嫁娶出行' },
  定: { fortune: '吉', meaning: '定为官符，宜冠带、嫁娶、订盟，忌词讼出行' },
  执: { fortune: '吉', meaning: '执为小耗，宜祭祀、捕捉、修造，忌移徙出行' },
  破: { fortune: '凶', meaning: '破为大耗，诸事不宜，宜破屋坏垣' },
  危: { fortune: '吉', meaning: '危为极富，宜安床、祭祀，忌登高出行' },
  成: { fortune: '吉', meaning: '成为天府，宜开市、嫁娶、签约，忌词讼出行' },
  收: { fortune: '凶', meaning: '收为天仓，宜收债、纳财，忌开市出行' },
  开: { fortune: '吉', meaning: '开为文昌，宜开市、嫁娶，忌安葬出行' },
  闭: { fortune: '凶', meaning: '闭为天狱，宜安葬、收藏，忌开市出行' },
};

/**
 * 构建完整节令背景信息
 *
 * 综合节气、三元、日干旺衰、月相、建除十二神及干支互动，
 * 产出奇门遁甲起盘时所需的完整时令季节上下文。
 *
 * @param ganzhi 四柱干支
 * @param jieQi 节气名称
 * @param date 公历日期（用于从 tyme4ts 获取精确节气、月相、建除等数据）
 * @returns 节令背景信息
 */
export function buildSeasonality(ganzhi: BaseGanZhi, jieQi: string, date: Date): SeasonalityInfo {
  // ── 1. 节气与三元阶段（优先以太阳历准确定位节气） ──
  const jieQiPhase = getJieQiPhaseByDate(date);
  // 使用参数传人的节气名作为兜底，优先以太阳历实际节气为准
  const actualJieQi = jieQiPhase.jieQi || jieQi;
  const seasonalElement = getSeasonalElement(actualJieQi);

  // ── 2. 日干与节令关系 ──
  const dayStem = ganzhi.day.charAt(0);
  const dayElement = stemElements[dayStem] ?? '';
  const { relation, description } = getDaySeasonRelation(dayStem, seasonalElement);

  // ── 3. 月相 ──
  const solarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const tymePhase = solarDay.getLunarDay().getPhase();
  const phaseIndex = tymePhase.getIndex();
  const lunarPhase = MOON_PHASE_MAP[phaseIndex] ?? '新月';
  const lunarPhaseDetail = tymePhase.getName();

  // ── 4. 建除十二神 ──
  const duty = solarDay.getLunarDay().getDuty();
  const dayOfficer = duty.getName();
  const officerInfo = DAY_OFFICER_INFO[dayOfficer] ?? {
    fortune: '平' as const,
    meaning: '未知建除',
  };

  // ── 5. 干支互动分析 ──
  const ganzhiInteractions = analyzeGanzhiInteractions(ganzhi);

  return {
    currentJieQi: actualJieQi,
    seasonalElement,
    jieQiPhase,

    dayStem,
    dayElement,
    seasonRelation: relation,
    seasonRelationDescription: description,

    lunarPhase,
    lunarPhaseDetail,

    dayOfficer,
    dayOfficerFortuneLabel: officerInfo.fortune,
    dayOfficerAdvice: officerInfo.meaning,

    ganzhiInteractions,
  };
}

// ============================================================================
// 6. 干支互动分析
// ============================================================================

/**
 * 干支互动类型
 */
export interface GanzhiInteraction {
  /** 互动类型 */
  type: '六合' | '三合' | '半合' | '六冲' | '相刑' | '相害' | '天干五合' | '天干相冲';
  /** 涉及的四柱字段（如 "year"、"month"、"day"、"hour"） */
  pillars: string[];
  /** 涉及的具体干支值 */
  values: string[];
  /** 互动描述文本 */
  description: string;
}

/**
 * 四柱字段名称
 */
const PILLAR_LABELS: Record<string, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

/**
 * 分析四柱干支之间的互动关系
 *
 * 涵盖：
 *   地支：六合、三合、半合、六冲、相刑、相害
 *   天干：天干五合、天干相冲
 *
 * 《协纪辨方书》论三合六合：
 *   "三合者，申子辰合水、亥卯未合木、寅午戌合火、巳酉丑合金。"
 *   "六合者，子丑合土、寅亥合木、卯戌合火、辰酉合金、巳申合水、午未合土。"
 *
 * 《淮南子·天文训》：
 *   "子午、丑未、寅申、卯酉、辰戌、巳亥相冲。"
 *   "子卯相刑，寅巳申三刑，丑未戌三刑。"
 *
 * @param ganzhi 四柱干支
 * @returns 所有检测到的干支互动关系
 */
export function analyzeGanzhiInteractions(ganzhi: BaseGanZhi): GanzhiInteraction[] {
  const interactions: GanzhiInteraction[] = [];
  const pillars: Array<{ key: string; gan: string; zhi: string }> = [];

  // ── 缓存四柱的天干地支 ──
  for (const [key, value] of Object.entries(ganzhi)) {
    if (!value || value.length < 2) continue;
    pillars.push({
      key,
      gan: value.charAt(0),
      zhi: value.charAt(1),
    });
  }

  // 需要至少两根柱子才能产生互动
  if (pillars.length < 2) return interactions;

  // ── 遍历两两配对 ──
  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const a = pillars[i];
      const b = pillars[j];

      // ── 地支互动 ──

      // 六合
      if (LIUHE_MAP[a.zhi] === b.zhi) {
        interactions.push({
          type: '六合',
          pillars: [a.key, b.key],
          values: [a.zhi, b.zhi],
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}六合，主和合顺利。`,
        });
      }

      // 六冲
      if (LIUCHONG_MAP[a.zhi] === b.zhi) {
        interactions.push({
          type: '六冲',
          pillars: [a.key, b.key],
          values: [a.zhi, b.zhi],
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}六冲，主冲突变动。`,
        });
      }

      // 相害
      if (LIUHAI_MAP[a.zhi] === b.zhi) {
        interactions.push({
          type: '相害',
          pillars: [a.key, b.key],
          values: [a.zhi, b.zhi],
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}相害，主暗伤不利。`,
        });
      }

      // 相刑
      if (isSanxingPair(a.zhi, b.zhi)) {
        const typeLabel = getSanxingLabel(a.zhi, b.zhi);
        interactions.push({
          type: '相刑',
          pillars: [a.key, b.key],
          values: [a.zhi, b.zhi],
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}${typeLabel}，主是非官非。`,
        });
      }

      // ── 天干互动 ──

      // 天干五合
      if (isTianGanHe(a.gan, b.gan)) {
        const heWuxing = getTianGanHeWuxingLabel(a.gan);
        interactions.push({
          type: '天干五合',
          pillars: [a.key, b.key],
          values: [a.gan, b.gan],
          description: `${PILLAR_LABELS[a.key]}${a.gan}与${PILLAR_LABELS[b.key]}${b.gan}天干五合（化${heWuxing}），主合作契机。`,
        });
      }

      // 天干相冲
      if (isTianGanChong(a.gan, b.gan)) {
        interactions.push({
          type: '天干相冲',
          pillars: [a.key, b.key],
          values: [a.gan, b.gan],
          description: `${PILLAR_LABELS[a.key]}${a.gan}与${PILLAR_LABELS[b.key]}${b.gan}天干相冲，主对立矛盾。`,
        });
      }
    }
  }

  // ── 三合、半合（需要两两配对后聚合成组） ──
  const branchValues = pillars.map((p) => p.zhi);
  const pillarByBranch = Object.fromEntries(pillars.map((p) => [p.zhi, p.key]));

  // 三合
  const completeSanhe = findCompleteSanhe(branchValues);
  for (const { group, members } of completeSanhe) {
    const pillarKeys = members.map((b) => pillarByBranch[b]).filter(Boolean);
    interactions.push({
      type: '三合',
      pillars: pillarKeys,
      values: members,
      description: `${members.join('、')}合${group}，主气运凝聚。`,
    });
  }

  // 半合（排除已被三合覆盖的组合）
  const sanheMembers = new Set(completeSanhe.flatMap((s) => s.members));
  const halfSanhe = findHalfSanhe(branchValues.filter((b) => !sanheMembers.has(b)));
  for (const { group, members } of halfSanhe) {
    const pillarKeys = members.map((b) => pillarByBranch[b]).filter(Boolean);
    interactions.push({
      type: '半合',
      pillars: pillarKeys,
      values: members,
      description: `${members.join('、')}半合${group}，合而不全，有合作之意但力未足。`,
    });
  }

  return interactions;
}

/**
 * 检查两个天干是否相冲
 */
function isTianGanChong(a: string, b: string): boolean {
  // 甲庚冲、乙辛冲、丙壬冲、丁癸冲
  const chongPairs: Record<string, string> = {
    甲: '庚',
    庚: '甲',
    乙: '辛',
    辛: '乙',
    丙: '壬',
    壬: '丙',
    丁: '癸',
    癸: '丁',
  };
  return chongPairs[a] === b;
}

/**
 * 获取天干五合的化气五行
 */
function getTianGanHeWuxingLabel(stem: string): string {
  const map: Record<string, string> = {
    甲: '土',
    乙: '金',
    丙: '水',
    丁: '木',
    戊: '火',
    己: '土',
    庚: '金',
    辛: '水',
    壬: '木',
    癸: '火',
  };
  return map[stem] ?? '';
}

/**
 * 查找四柱中构成完整三合局的地支组合
 */
function findCompleteSanhe(branches: string[]): Array<{ group: string; members: string[] }> {
  const results: Array<{ group: string; members: string[] }> = [];
  const used = new Set<string>();

  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    const membersArr = members as string[];
    const present = membersArr.filter((m) => branches.includes(m));
    if (present.length === 3 && !used.has(group)) {
      results.push({ group, members: present });
      used.add(group);
    }
  }

  // 如果已经找到完整三合，优先只返回一个（最多两个三合同时出现的情况极罕见）
  return results;
}

/**
 * 查找四柱中构成半合（三合缺一）的地支组合
 */
function findHalfSanhe(branches: string[]): Array<{ group: string; members: string[] }> {
  const results: Array<{ group: string; members: string[] }> = [];
  const usedGroups = new Set<string>();

  // 对每个三合局检查是否有两个地支出现
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    const membersArr = members as string[];
    const present = membersArr.filter((m) => branches.includes(m));
    if (present.length === 2 && !usedGroups.has(group)) {
      results.push({ group, members: present });
      usedGroups.add(group);
    }
  }

  return results;
}

/**
 * 获取三刑的具体类型标签
 *
 * 《阴符经》三刑定例：
 *   子卯相刑为无礼之刑
 *   寅巳申三刑为无恩之刑
 *   丑未戌三刑为恃势之刑
 *   辰午酉亥自刑
 */
function getSanxingLabel(a: string, b: string): string {
  if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) {
    return '无礼之刑';
  }
  if (a === b && ['辰', '午', '酉', '亥'].includes(a)) {
    return '自刑';
  }
  if (a !== b && ['寅', '巳', '申'].includes(a) && ['寅', '巳', '申'].includes(b)) {
    return '无恩之刑';
  }
  if (a !== b && ['丑', '戌', '未'].includes(a) && ['丑', '戌', '未'].includes(b)) {
    return '恃势之刑';
  }
  return '';
}

function isSanxingPair(a: string, b: string): boolean {
  return getSanxingLabel(a, b) !== '';
}
