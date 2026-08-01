/**
 * @file 节令背景（Seasonal Context）分析
 * @description 奇门遁甲节气背景分析：二十四节气五行属性映射、
 * 实际节气证据、日干与月令五行的旺相休囚死状态、精确月相、
 * 十二建除名称，以及条件闭合的干支关系事实（六合/三合三支齐见/六冲/相刑/相害）。
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
  getTianGanHeWuxing,
  isTianGanHe,
  isValidGanZhi,
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
// 2. 实际节气证据
// ============================================================================

export interface SolarTermContextResult {
  /** 节气名称 */
  jieQi: string;
  /** 当前节气的历表边界、太阳视黄经核验和精度限制 */
  solarTermEvidence: SolarTermEvidence;
}

/**
 * 由公历时刻取得实际节气及其天文证据。
 *
 * 奇门上中下元必须由正式定局入口按甲己符头或所选置闰法计算，不能把交节后
 * 经过的自然日机械切成三个五日段。这里因此只返回实际节气，不另造三元。
 */
export function getSolarTermContextByDate(date: Date): SolarTermContextResult {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('节气日期必须是有效日期。');
  }
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
  const termYear =
    jieQi === '冬至' && termStartTime.getMonth() === 12
      ? termStartTime.getYear() + 1
      : termStartTime.getYear();
  const solarTermEvidence = findSolarTermEvidence(jieQi as SolarTermName, termYear);

  return { jieQi, solarTermEvidence };
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
export type DaySeasonRelation = '旺' | '相' | '休' | '囚' | '死';

/**
 * 计算日干与节令五行的关系
 *
 * @param dayStem 日干（如 "甲"、"乙"）
 * @param seasonalElement 当前节气的当令五行
 * @returns 日干在节令中的状态
 *
 * @example
 *   getDaySeasonRelation('甲', '木') // => '旺'
 *   getDaySeasonRelation('甲', '水') // => '相'（水生木）
 *
 * 分析逻辑：
 *   以"我"为日干五行，"令"为季节当令五行：
 *   同令 → 旺；令生我 → 相；我生令 → 休；我克令 → 囚；令克我 → 死。
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
  if (!['木', '火', '土', '金', '水'].includes(seasonalElement)) {
    throw new Error(`无法识别节令五行 "${seasonalElement}"。`);
  }

  if (element === seasonalElement) {
    return {
      relation: '旺',
      description: `${dayStem}属${element}，与节令${seasonalElement}五行比和。`,
    };
  }

  // 令生我（seasonalElement 生 element）= 相
  if (isGenerating(seasonalElement, element)) {
    return {
      relation: '相',
      description: `节令${seasonalElement}生日干${dayStem}所属${element}。`,
    };
  }

  // 我生令（element 生 seasonalElement）= 休
  if (isGenerating(element, seasonalElement)) {
    return {
      relation: '休',
      description: `日干${dayStem}所属${element}生节令${seasonalElement}。`,
    };
  }

  // 令克我（seasonalElement 克 element）= 死
  if (isControlling(seasonalElement, element)) {
    return {
      relation: '死',
      description: `节令${seasonalElement}克日干${dayStem}所属${element}。`,
    };
  }

  // 我克令（element 克 seasonalElement）= 囚
  if (isControlling(element, seasonalElement)) {
    return {
      relation: '囚',
      description: `日干${dayStem}所属${element}克节令${seasonalElement}。`,
    };
  }

  throw new Error(`无法计算日干${dayStem}与节令五行${seasonalElement}的关系。`);
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
  /** 当前节气的历表边界与太阳视黄经证据 */
  solarTermEvidence: SolarTermEvidence;

  /** 日干 */
  dayStem: string;
  /** 日干五行属性 */
  dayElement: string;
  /** 日干与节令关系 */
  seasonRelation: DaySeasonRelation;
  /** 关系描述文本 */
  seasonRelationDescription: string;

  /** 月相详细名称（来自 tyme4ts 的八相名，如蛾眉月、盈凸月等） */
  lunarPhaseDetail: string;
  /** 日月黄经差、照明比例及前后朔弦望时刻 */
  moonPhaseEvidence: MoonPhaseEvidence;
  /** 历法八相名称与天文相位八分法是否一致 */
  lunarPhaseConsistency: boolean;

  /** 十二建除（建/除/满/平/定/执/破/危/成/收/开/闭） */
  dayOfficer: string;

  /** 干支互动分析结果 */
  ganzhiInteractions: GanzhiInteraction[];
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
export function buildSeasonality(ganzhi: BaseGanZhi, date: Date): SeasonalityInfo {
  // ── 1. 实际节气；上中下元由正式定局入口单独计算 ──
  const solarTermContext = getSolarTermContextByDate(date);
  const actualJieQi = solarTermContext.jieQi;
  const seasonalElement = getSeasonalElement(actualJieQi);

  // ── 2. 日干与节令关系 ──
  const dayStem = ganzhi.day.charAt(0);
  const dayElement = stemElements[dayStem] ?? '';
  const { relation, description } = getDaySeasonRelation(dayStem, seasonalElement);

  // ── 3. 月相 ──
  const solarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const tymePhase = solarDay.getLunarDay().getPhase();
  const lunarPhaseDetail = tymePhase.getName();
  const moonPhaseEvidence = calculateMoonPhaseEvidence(date.getTime());
  const lunarPhaseConsistency = lunarPhaseDetail === moonPhaseEvidence.eightPhaseName;

  // ── 4. 建除十二神 ──
  const duty = solarDay.getLunarDay().getDuty();
  const dayOfficer = duty.getName();

  // ── 5. 干支互动分析 ──
  const ganzhiInteractions = analyzeGanzhiInteractions(ganzhi);

  return {
    currentJieQi: actualJieQi,
    seasonalElement,
    solarTermEvidence: solarTermContext.solarTermEvidence,

    dayStem,
    dayElement,
    seasonRelation: relation,
    seasonRelationDescription: description,

    lunarPhaseDetail,
    moonPhaseEvidence,
    lunarPhaseConsistency,

    dayOfficer,

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
  type: '六合' | '三合' | '六冲' | '相刑' | '相害' | '天干五合' | '天干相冲';
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

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const SELF_PUNISHMENT_BRANCHES = ['辰', '午', '酉', '亥'] as const;
const COMPLETE_THREE_PUNISHMENTS = [
  { name: '无恩之刑', members: ['寅', '巳', '申'] },
  { name: '恃势之刑', members: ['丑', '戌', '未'] },
] as const;

/**
 * 分析四柱干支之间的互动关系
 *
 * 涵盖：
 *   地支：六合、三合三支齐见、六冲、条件闭合的相刑、相害
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

  if (!ganzhi || typeof ganzhi !== 'object' || Array.isArray(ganzhi)) {
    throw new Error('奇门四柱干支必须是完整对象。');
  }

  // ── 只按固定年、月、日、时四柱顺序读取，并拒绝伪干支 ──
  for (const key of PILLAR_KEYS) {
    const value = ganzhi[key];
    if (!isValidGanZhi(value)) {
      throw new Error(`${PILLAR_LABELS[key]}必须是完整且合法的六十甲子。`);
    }
    pillars.push({
      key,
      gan: value.charAt(0),
      zhi: value.charAt(1),
    });
  }

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
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}构成六合。`,
        });
      }

      // 六冲
      if (LIUCHONG_MAP[a.zhi] === b.zhi) {
        interactions.push({
          type: '六冲',
          pillars: [a.key, b.key],
          values: [a.zhi, b.zhi],
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}构成六冲。`,
        });
      }

      // 相害
      if (LIUHAI_MAP[a.zhi] === b.zhi) {
        interactions.push({
          type: '相害',
          pillars: [a.key, b.key],
          values: [a.zhi, b.zhi],
          description: `${PILLAR_LABELS[a.key]}${a.zhi}与${PILLAR_LABELS[b.key]}${b.zhi}构成相害。`,
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
          description: `${PILLAR_LABELS[a.key]}${a.gan}与${PILLAR_LABELS[b.key]}${b.gan}构成天干五合，合化五行对应${heWuxing}；是否化成须另审条件。`,
        });
      }

      // 天干相冲
      if (TIAN_GAN_CHONG[a.gan] === b.gan) {
        interactions.push({
          type: '天干相冲',
          pillars: [a.key, b.key],
          values: [a.gan, b.gan],
          description: `${PILLAR_LABELS[a.key]}${a.gan}与${PILLAR_LABELS[b.key]}${b.gan}构成天干相冲。`,
        });
      }
    }
  }

  // ── 子卯相刑：两支互见的固定双支关系 ──
  const ziMaoPillars = pillars.filter((pillar) => pillar.zhi === '子' || pillar.zhi === '卯');
  if (
    ziMaoPillars.some((pillar) => pillar.zhi === '子') &&
    ziMaoPillars.some((pillar) => pillar.zhi === '卯')
  ) {
    interactions.push({
      type: '相刑',
      pillars: ziMaoPillars.map((pillar) => pillar.key),
      values: ['子', '卯'],
      description: '子、卯两支齐见，构成子卯相刑固定支对；这里只记录支对，不直接推断吉凶。',
    });
  }

  // ── 自刑：同一自刑支至少在两柱重复出现 ──
  for (const branch of SELF_PUNISHMENT_BRANCHES) {
    const matchedPillars = pillars.filter((pillar) => pillar.zhi === branch);
    if (matchedPillars.length < 2) continue;
    interactions.push({
      type: '相刑',
      pillars: matchedPillars.map((pillar) => pillar.key),
      values: [branch, branch],
      description: `${branch}支在${matchedPillars.map((pillar) => PILLAR_LABELS[pillar.key]).join('、')}重复出现，构成${branch}${branch}自刑固定结构；这里只记录重复支，不直接推断吉凶。`,
    });
  }

  // ── 寅巳申、丑戌未三刑：三支全见才登记，二支版本失败关闭 ──
  const branchValues = pillars.map((pillar) => pillar.zhi);
  for (const punishment of COMPLETE_THREE_PUNISHMENTS) {
    if (!punishment.members.every((branch) => branchValues.includes(branch))) continue;
    const matchedPillars = pillars.filter((pillar) =>
      (punishment.members as readonly string[]).includes(pillar.zhi),
    );
    interactions.push({
      type: '相刑',
      pillars: matchedPillars.map((pillar) => pillar.key),
      values: [...punishment.members],
      description: `${punishment.members.join('、')}三支齐见，为${punishment.name}的完整成员结构；这里只记录三支齐见，不把任意两支自动命名为相刑，也不直接推断吉凶。`,
    });
  }

  // ── 三合：只登记生、旺、墓三支全见，不自动裁定成局或合化 ──
  const completeSanhe = findCompleteSanhe(branchValues);
  for (const { group, members } of completeSanhe) {
    const matchedPillars = pillars.filter((pillar) => members.includes(pillar.zhi));
    interactions.push({
      type: '三合',
      pillars: matchedPillars.map((pillar) => pillar.key),
      values: members,
      description: `${members.join('、')}为${group}所需生、旺、墓三支齐见；这里只记录完整支组，不等于已经成局、合化或产生吉凶。`,
    });
  }

  return interactions;
}

/**
 * 查找四柱中构成完整三合局的地支组合
 */
function findCompleteSanhe(branches: string[]): Array<{ group: string; members: string[] }> {
  const results: Array<{ group: string; members: string[] }> = [];
  const branchSet = new Set(branches);

  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (members.every((member) => branchSet.has(member))) {
      results.push({ group, members: [...members] });
    }
  }

  return results;
}
