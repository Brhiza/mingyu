/**
 * @file 节令背景（Seasonal Context）分析
 * @description 奇门遁甲节气背景分析：二十四节气五行属性映射、
 * 节气内自然日阶段、日干与节令五行的旺相关系、月相、
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

import { SolarDay, SolarTime } from 'tyme4ts';
import {
  findSolarTermEvidence,
  type SolarTermEvidence,
  type SolarTermName,
} from '../../../../calendar/solar-term-evidence';
import {
  calculateMoonPhaseEvidence,
  type MoonPhaseEvidence,
} from '../../../../calendar/moon-phase-evidence';
import { stemElements, isGenerating, isControlling } from './_constants';
import {
  LIUHE_MAP,
  LIUCHONG_MAP,
  LIUHAI_MAP,
  SANHE_GROUPS,
  TIAN_GAN_CHONG,
  getSanxingType,
  getTianGanHeWuxing,
  isSanxing,
  isTianGanHe,
} from '../../../../ganzhi';
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
 * @returns 五行名
 */
export function getSeasonalElement(jieQi: string): string {
  const element = JIE_QI_SEASONS[jieQi];
  if (!element) {
    throw new Error(`无法识别节气 "${jieQi}" 的五行属性。`);
  }
  return element;
}

// ============================================================================
// 2. 节气内自然日阶段判定
// ============================================================================

/**
 * 交节后自然日阶段结果
 */
export interface JieQiPhaseResult {
  /** 节气名称 */
  jieQi: string;
  /** 节气内自然日阶段：上元（初）、中元、下元（末），不作为奇门正式定局三元 */
  phase: '上元' | '中元' | '下元';
  /** 数字索引：0 → 上元，1 → 中元，2 → 下元 */
  phaseIndex: number;
  /** 当前节气的历表边界、太阳视黄经核验和精度限制 */
  solarTermEvidence: SolarTermEvidence;
}

/**
 * 由太阳历日期计算交节后的自然日阶段
 *
 * 每个节气跨度约 15 天，拆分为上元（第 1-5 天）、中元（第 6-10 天）、
 * 下元（第 11-15 天）。此字段只描述节气内日期位置；正式定局三元由定局算法给出。
 *
 * @param date 太阳历（公历）日期
 * @returns 节气内自然日阶段信息
 */
export function getJieQiPhaseByDate(date: Date): JieQiPhaseResult {
  const solarTime = SolarTime.fromYmdHms(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
  const term = solarTime.getTerm();
  const jieQi = term.getName();
  const termStartTime = term.getJulianDay().getSolarTime();
  const diff = Math.floor(
    solarTime.getJulianDay().getDay() - termStartTime.getJulianDay().getDay(),
  );
  const phaseIndex = Math.min(2, Math.floor(diff / 5));
  const phase = (['上元', '中元', '下元'] as const)[phaseIndex];
  const termYear =
    jieQi === '冬至' && termStartTime.getMonth() === 12
      ? termStartTime.getYear() + 1
      : termStartTime.getYear();
  const solarTermEvidence = findSolarTermEvidence(jieQi as SolarTermName, termYear);

  return { jieQi, phase, phaseIndex, solarTermEvidence };
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
 *   克令为囚（日干克当令五行）   → 持平
 *   生令为休（日干生当令五行）   → 被耗
 *   令克为死（当令五行克日干）   → 受克
 */
export type DaySeasonRelation = '得时' | '受生' | '受克' | '被耗' | '持平';

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
 *   克令 → 囚（持平）
 */
export function getDaySeasonRelation(
  dayStem: string,
  seasonalElement: string,
): {
  relation: DaySeasonRelation;
  description: string;
} {
  const element = stemElements[dayStem];
  if (!element) {
    throw new Error(`无法识别日干 "${dayStem}" 的五行属性。`);
  }
  if (!seasonalElement) {
    throw new Error('节令五行不能为空。');
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
      relation: '持平',
      description: `${dayStem}之${element}克节令${seasonalElement}，虽能克令但亦耗力，持平。`,
    };
  }

  return { relation: '持平', description: '无明显生克关系' };
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

export function getLunarPhaseByIndex(index: number): LunarPhase {
  const phase = MOON_PHASE_MAP[index];
  if (!phase) {
    throw new Error(`无法识别历法月相索引 "${index}"。`);
  }
  return phase;
}

/**
 * 获取农历日对应的四相月相
 * @param date 公历日期
 * @returns 月相
 */
export function getLunarPhase(date: Date): LunarPhase {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('月相日期必须是有效日期。');
  }
  const solarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const phase = solarDay.getLunarDay().getPhase();
  return getLunarPhaseByIndex(phase.getIndex());
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
  /** 交节后自然日阶段（上元/中元/下元），不作为正式定局三元 */
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
  /** 日月黄经差、照明比例及前后朔弦望时刻 */
  moonPhaseEvidence: MoonPhaseEvidence;
  /** 历法八相名称与天文相位八分法是否一致 */
  lunarPhaseConsistency: boolean;

  /** 十二建除（建/除/满/平/定/执/破/危/成/收/开/闭） */
  dayOfficer: string;
  /** 建除十二神吉凶倾向 */
  dayOfficerFortuneLabel: '吉' | '凶' | '平';
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

export function getDayOfficerInfo(dayOfficer: string) {
  const info = DAY_OFFICER_INFO[dayOfficer];
  if (!info) {
    throw new Error(`无法识别建除十二神 "${dayOfficer}"。`);
  }
  return info;
}

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
  const lunarPhase = getLunarPhaseByIndex(phaseIndex);
  const lunarPhaseDetail = tymePhase.getName();
  const moonPhaseEvidence = calculateMoonPhaseEvidence(date.getTime());
  const lunarPhaseConsistency = lunarPhaseDetail === moonPhaseEvidence.eightPhaseName;

  // ── 4. 建除十二神 ──
  const duty = solarDay.getLunarDay().getDuty();
  const dayOfficer = duty.getName();
  const officerInfo = getDayOfficerInfo(dayOfficer);

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
    moonPhaseEvidence,
    lunarPhaseConsistency,

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
      if (isSanxing(a.zhi, b.zhi)) {
        const typeLabel = getSanxingType(a.zhi) ?? '';
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
        const heWuxing = getTianGanHeWuxing(a.gan) ?? '';
        interactions.push({
          type: '天干五合',
          pillars: [a.key, b.key],
          values: [a.gan, b.gan],
          description: `${PILLAR_LABELS[a.key]}${a.gan}与${PILLAR_LABELS[b.key]}${b.gan}天干五合（化${heWuxing}），主合作契机。`,
        });
      }

      // 天干相冲
      if (TIAN_GAN_CHONG[a.gan] === b.gan) {
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
