/**
 * @file 奇门已校勘经典格局与天地盘干结构事实
 * @description 正式入口输出已经逐条闭环的十一项天地盘固定格，以及只在
 * 完整时家上下文中识别的伏干格、飞干格、岁格、格勃、三奇升殿、三诈、
 * 天假/严格地假/鬼假与玉女守门中性结构事实。九遁与三奇得使已经确认存在版本定义冲突；其余三奇、
 * 人假、物假、神假、值符值使、
 * 月日时格、普通勃格、门迫、击刑、入墓等旧规则
 * 在版本、条件或适用情境完成校勘前失败关闭；可复算的落宫与五行事实仍由九宫、
 * 基础标签、组合事实和天地盘干关系提供，供后续 AI 结合具体问题继续推算。
 */

import type { QimenJiuGongGe, QimenScope } from '../../../../types/divination';
import { getXunHead, isTianGanHe } from '../../../../ganzhi';
import { isControlling, isGenerating, stemElements } from './_constants';
import { getNamedStemPairPattern, getStemPairPattern } from './stem-pair-patterns';
import {
  getDunJiaStem,
  getTianPanStemForStar,
  getTianPanStems,
  hasTianPanStar,
} from './palace-utils';

/** 已校勘、但不能退化为固定天地盘干二元映射的时家上下文格。 */
export const AUDITED_QIMEN_CONTEXT_PATTERN_NAMES = [
  '伏干格',
  '飞干格',
  '岁格',
  '格勃',
  '乙奇升殿',
  '丙奇升殿',
  '丁奇升殿',
  '真诈',
  '重诈',
  '休诈',
  '天假',
  '地假',
  '鬼假',
  '玉女守门',
] as const;

export function isAuditedQimenContextPatternName(
  name: string,
): name is (typeof AUDITED_QIMEN_CONTEXT_PATTERN_NAMES)[number] {
  return AUDITED_QIMEN_CONTEXT_PATTERN_NAMES.includes(
    name as (typeof AUDITED_QIMEN_CONTEXT_PATTERN_NAMES)[number],
  );
}

/** 已校勘经典格局命中。 */
export interface ClassicPattern {
  /** 内部稳定标识 */
  key: string;
  /** 原典固定格名称 */
  name: string;
  /** 原典分类；专项兵占格固定为 neutral */
  tone: 'good' | 'bad' | 'neutral';
  /** 条件、原典事实和使用边界 */
  summary: string;
  /** 命中宫位 */
  palace?: number;
  /** 涉及的天地盘干 */
  tokens?: string[];
}

/** 天地盘干关系。 */
export interface StemRelation {
  /** 天盘干 */
  heaven: string;
  /** 地盘干 */
  earth: string;
  /** 宫位 */
  palace: number;
  /** 关系类型 */
  type:
    | '克上'
    | '克下'
    | '相佐'
    | '比和'
    | '生上'
    | '生下'
    | '奇仪相合'
    | '命名格局'
    | '入墓'
    | '击刑'
    | '空亡';
  /** 只陈述可复核条件与边界的说明 */
  note: string;
}

/**
 * 六仪击刑固定落宫表。
 * 这里只记录命中条件，不把它包装成通用官非、成败或行动建议。
 */
const STEM_JI_XING_PALACES: Readonly<Record<string, readonly number[]>> = {
  甲: [3],
  戊: [3],
  己: [2],
  庚: [8],
  辛: [9],
  壬: [4],
  癸: [4],
};

function getStemPairNamedPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const patterns: ClassicPattern[] = [];

  for (const palace of jiuGongGe) {
    const earth = palace.diPan.stem;
    if (!earth) continue;

    for (const heaven of getTianPanStems(palace)) {
      const pattern = getNamedStemPairPattern(heaven, earth);
      if (!pattern) continue;

      patterns.push({
        key: `pattern:stemPair:${heaven}_${earth}:${palace.gong}`,
        name: pattern.name,
        tone: pattern.type,
        summary: `天盘${heaven}加地盘${earth}于${palace.name}。${pattern.summary} 条件：${pattern.condition} 边界：${pattern.limitation}`,
        palace: palace.gong,
        tokens: [heaven, earth],
      });
    }
  }

  return patterns;
}

/**
 * 识别天地盘干关系。
 *
 * 已校勘固定格优先按命名格局记录；其余组合只输出击刑、标准天干五合
 * 或五行生克结构，不据此生成现实事件、人物意图、吉凶、成败或行动建议。
 */
export function getStemRelations(jiuGongGe: QimenJiuGongGe[]): StemRelation[] {
  const relations: StemRelation[] = [];

  for (const palace of jiuGongGe) {
    const earth = palace.diPan.stem;
    if (!earth) continue;

    for (const heaven of getTianPanStems(palace)) {
      const heavenElement = stemElements[heaven];
      const earthElement = stemElements[earth];
      const namedPattern = getNamedStemPairPattern(heaven, earth);

      if (namedPattern) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '命名格局',
          note: `${namedPattern.name}：${namedPattern.summary} 条件：${namedPattern.condition} 边界：${namedPattern.limitation}`,
        });
      }

      const isJiXing = STEM_JI_XING_PALACES[heaven]?.includes(palace.gong) ?? false;
      if (isJiXing) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '击刑',
          note: `天盘${heaven}落${palace.name}，命中六仪击刑落宫表；这里只记录落宫条件，不据此单独断事`,
        });
      }

      if (namedPattern || isJiXing) continue;

      const structuralPattern = getStemPairPattern(heaven, earth);
      const boundary = structuralPattern.manifestation;

      if (isTianGanHe(heaven, earth)) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '奇仪相合',
          note: `${palace.name}天盘${heaven}与地盘${earth}为标准天干五合；${structuralPattern.summary}${boundary}`,
        });
        continue;
      }

      if (!heavenElement || !earthElement) continue;

      let type: StemRelation['type'];
      if (heavenElement === earthElement) {
        type = '比和';
      } else if (isControlling(heavenElement, earthElement)) {
        type = '克下';
      } else if (isControlling(earthElement, heavenElement)) {
        type = '克上';
      } else if (isGenerating(heavenElement, earthElement)) {
        type = '生下';
      } else if (isGenerating(earthElement, heavenElement)) {
        type = '生上';
      } else {
        continue;
      }

      relations.push({
        heaven,
        earth,
        palace: palace.gong,
        type,
        note: `${palace.name}${structuralPattern.summary}${boundary}`,
      });
    }
  }

  return relations;
}

/** 经典格局识别上下文；缺少明确时家级别或完整日柱时，日干上下文格失败关闭。 */
export interface PatternContext {
  jiuGongGe: QimenJiuGongGe[];
  zhiFu: string;
  zhiShi: string;
  scope?: QimenScope;
  yearGanZhi?: string;
  monthGanZhi?: string;
  /** @deprecated 不能单独驱动日干格；甲日必须由完整日柱确定所遁六仪。 */
  dayStem?: string;
  dayGanZhi?: string;
  hourGanZhi?: string;
}

function getDayStemContextPatterns({
  jiuGongGe,
  scope,
  dayStem,
  dayGanZhi,
}: PatternContext): ClassicPattern[] {
  if (scope !== undefined && !['hour', 'day', 'month', 'year'].includes(scope)) {
    throw new Error(`未知的奇门格局上下文级别: ${String(scope)}`);
  }

  // 原典条文与古例均以时家盘的“今日之干”为条件；年月家不外推此规则。
  if (scope !== 'hour' || !dayGanZhi) return [];

  const originalDayStem = dayGanZhi.charAt(0);
  if (dayStem !== undefined && dayStem !== originalDayStem) {
    throw new Error(`奇门日干“${dayStem}”与完整日柱“${dayGanZhi}”不一致。`);
  }

  const dayDunStem = getDunJiaStem(dayGanZhi);
  const dayStemBasis = dayGanZhi.startsWith('甲')
    ? `本日日柱${dayGanZhi}，六甲按旬首遁于${dayDunStem}`
    : `本日日柱${dayGanZhi}，日干为${dayDunStem}`;
  const limitation =
    '这里只登记可复算的时家盘面结构；原典附带的兵占、出行及主客利弊断语不泛化为通用吉凶、现实结果或行动建议';
  const patterns: ClassicPattern[] = [];

  for (const palace of jiuGongGe) {
    const earth = palace.diPan.stem;
    if (!earth) continue;

    for (const heaven of new Set(getTianPanStems(palace))) {
      if (heaven === '庚' && earth === dayDunStem) {
        patterns.push({
          key: `pattern:dayStem:fuGan:${dayGanZhi}:${palace.gong}`,
          name: '伏干格',
          tone: 'neutral',
          summary: `天盘庚加地盘${dayDunStem}于${palace.name}；${dayStemBasis}。原典固定条件为“庚加日干为伏干格”。${limitation}`,
          palace: palace.gong,
          tokens: [heaven, earth],
        });
      }

      if (heaven === dayDunStem && earth === '庚') {
        patterns.push({
          key: `pattern:dayStem:feiGan:${dayGanZhi}:${palace.gong}`,
          name: '飞干格',
          tone: 'neutral',
          summary: `天盘${dayDunStem}加地盘庚于${palace.name}；${dayStemBasis}。原典固定条件为“日干加庚飞干格”。${limitation}`,
          palace: palace.gong,
          tokens: [heaven, earth],
        });
      }
    }
  }

  return patterns;
}

function getYearStemContextPatterns({
  jiuGongGe,
  scope,
  yearGanZhi,
}: PatternContext): ClassicPattern[] {
  // 原典条文是时家盘以当年太岁之干为参照；月家、年家不套用同名规则。
  if (scope !== 'hour' || !yearGanZhi) return [];

  const yearDunStem = getDunJiaStem(yearGanZhi);
  const yearStemBasis = yearGanZhi.startsWith('甲')
    ? `本年干支${yearGanZhi}，六甲按旬首遁于${yearDunStem}`
    : `本年干支${yearGanZhi}，岁干为${yearDunStem}`;
  const limitation =
    '这里只登记《太白阴经》《遁甲演义》《奇门遁甲统宗》《奇门法窍》共同支持的时家盘面结构；原典兵占、出行和百事断语不泛化为通用吉凶、现实结果或行动建议';
  const patterns: ClassicPattern[] = [];

  for (const palace of jiuGongGe) {
    const earth = palace.diPan.stem;
    if (!earth) continue;

    for (const heaven of new Set(getTianPanStems(palace))) {
      if (heaven !== '庚' || earth !== yearDunStem) continue;

      patterns.push({
        key: `pattern:yearStem:suiGe:${yearGanZhi}:${palace.gong}`,
        name: '岁格',
        tone: 'neutral',
        summary: `天盘庚加地盘${yearDunStem}于${palace.name}；${yearStemBasis}。四书共同条件为“六庚加岁干为岁格”。${limitation}`,
        palace: palace.gong,
        tokens: [heaven, earth],
      });
    }
  }

  return patterns;
}

function getGengValueSymbolPattern({
  jiuGongGe,
  zhiFu,
  scope,
  hourGanZhi,
}: PatternContext): ClassicPattern[] {
  // “六庚为值符”只属于时家甲申旬；缺少完整时柱或值符身份时不推断。
  if (scope !== 'hour' || !hourGanZhi || !zhiFu) return [];

  const xunHead = getXunHead(hourGanZhi);
  const expectedValueSymbolStem = getDunJiaStem(xunHead);
  const valueSymbolPalaces = jiuGongGe.filter((palace) => hasTianPanStar(palace, zhiFu));
  if (valueSymbolPalaces.length !== 1) {
    throw new Error(
      `奇门值符星“${zhiFu}”在天盘应恰有一个落宫，实际为${valueSymbolPalaces.length}个。`,
    );
  }

  const palace = valueSymbolPalaces[0];
  const valueSymbolStem = getTianPanStemForStar(palace, zhiFu);
  if (valueSymbolStem !== expectedValueSymbolStem) {
    throw new Error(
      `奇门时柱“${hourGanZhi}”所属${xunHead}旬应由值符携${expectedValueSymbolStem}，实际为${valueSymbolStem || '空'}。`,
    );
  }

  if (xunHead !== '甲申' || valueSymbolStem !== '庚' || palace.diPan.stem !== '丙') return [];

  return [
    {
      key: `pattern:valueSymbol:gengOverBing:${hourGanZhi}:${palace.gong}`,
      name: '格勃',
      tone: 'neutral',
      summary: `当前时柱${hourGanZhi}属甲申旬，值符星${zhiFu}携旬首所遁六庚，天盘庚临地盘丙于${palace.name}。采用《奇门遁甲统宗》《奇门宝鉴御定》《奇门旨归》互证的“庚为值符临丙为飞勃，亦为格勃”条件；这里只登记值符身份与天地盘干可复算结构，不采用原典兵占进退、主客胜负或通用吉凶断语`,
      palace: palace.gong,
      tokens: ['庚', '丙'],
    },
  ];
}

const SAN_QI_SHENG_DIAN_BY_PALACE: Readonly<
  Record<number, { stem: '乙' | '丙' | '丁'; name: '乙奇升殿' | '丙奇升殿' | '丁奇升殿' }>
> = {
  3: { stem: '乙', name: '乙奇升殿' },
  9: { stem: '丙', name: '丙奇升殿' },
  7: { stem: '丁', name: '丁奇升殿' },
};

function getSanQiShengDianPatterns({ jiuGongGe, scope }: PatternContext): ClassicPattern[] {
  // 三书条文及《奇门法窍》时格例均以天盘三奇逐时到宫为条件；年月家不外推。
  if (scope !== 'hour') return [];

  const patterns: ClassicPattern[] = [];
  for (const palace of jiuGongGe) {
    const config = SAN_QI_SHENG_DIAN_BY_PALACE[palace.gong];
    if (!config || !new Set(getTianPanStems(palace)).has(config.stem)) continue;

    patterns.push({
      key: `pattern:sanQiShengDian:${config.stem}:${palace.gong}`,
      name: config.name,
      tone: 'neutral',
      summary: `天盘${config.stem}奇落${palace.name}，命中《奇门法窍》《奇门旨归》《奇门遁甲秘笈大全》共同记载的“三奇升殿”位置条件。这里只登记三奇与宫位的可复算结构；《奇门法窍》另要求实际取用时核对吉门、门迫与入墓，故不得仅据升殿名称生成吉凶、方位、行动或现实结果`,
      palace: palace.gong,
      tokens: [config.stem],
    });
  }

  return patterns;
}

const SAN_ZHA_BY_GOD: Readonly<
  Record<'太阴' | '九地' | '六合', { name: '真诈' | '重诈' | '休诈' }>
> = {
  太阴: { name: '真诈' },
  九地: { name: '重诈' },
  六合: { name: '休诈' },
};

const SAN_QI_STEMS = new Set(['乙', '丙', '丁']);
const SAN_JI_DOORS = new Set(['开门', '休门', '生门']);

function getSanZhaPatterns({ jiuGongGe, scope }: PatternContext): ClassicPattern[] {
  // 四书共同条件都来自时家门、奇、神三层同宫；年月家不外推，缺一层也不命名。
  if (scope !== 'hour') return [];

  const patterns: ClassicPattern[] = [];
  for (const palace of jiuGongGe) {
    const door = palace.renPan.door;
    const god = palace.shenPan.god;
    const config = SAN_ZHA_BY_GOD[god as keyof typeof SAN_ZHA_BY_GOD];
    if (!SAN_JI_DOORS.has(door) || !config) continue;

    const sanQiStems = [...new Set(getTianPanStems(palace))].filter((stem) =>
      SAN_QI_STEMS.has(stem),
    );
    if (sanQiStems.length === 0) continue;

    patterns.push({
      key: `pattern:sanZha:${config.name}:${palace.gong}`,
      name: config.name,
      tone: 'neutral',
      summary: `天盘${sanQiStems.join('、')}奇、${door}与${god}同临${palace.name}，命中《遁甲演义》《奇门法窍》《奇门旨归》《奇门遁甲秘笈大全》共同记载的“${config.name}”完整位置条件。这里只登记奇、门、神三层可复算结构；缺少任一层只保留原始盘面事实，不得据格名生成吉凶、用途、方位、行动或现实结果`,
      palace: palace.gong,
      tokens: sanQiStems,
    });
  }

  return patterns;
}

const AUDITED_WU_JIA_CONFIGS = [
  { name: '天假', stems: ['乙', '丙', '丁'], door: '景门', god: '九天' },
  { name: '地假', stems: ['丁', '己', '癸'], door: '杜门', god: '九地' },
  { name: '鬼假', stems: ['丁', '己', '癸'], door: '死门', god: '九地' },
] as const;

function getAuditedWuJiaPatterns({ jiuGongGe, scope }: PatternContext): ClassicPattern[] {
  // 四书只在这三项核心条件上名称与奇仪、门、神三层完全一致；年月家不外推。
  if (scope !== 'hour') return [];

  const patterns: ClassicPattern[] = [];
  for (const palace of jiuGongGe) {
    for (const config of AUDITED_WU_JIA_CONFIGS) {
      if (palace.renPan.door !== config.door || palace.shenPan.god !== config.god) continue;

      const stems = [...new Set(getTianPanStems(palace))].filter((stem) =>
        (config.stems as readonly string[]).includes(stem),
      );
      if (stems.length === 0) continue;

      patterns.push({
        key: `pattern:wuJia:${config.name}:${palace.gong}`,
        name: config.name,
        tone: 'neutral',
        summary: `天盘${stems.join('、')}、${config.door}与${config.god}同临${palace.name}，命中《遁甲演义》《奇门法窍》《奇门旨归》《奇门遁甲秘笈大全》共同记载的“${config.name}”核心位置条件。这里只登记天盘干、门、神三层可复算结构；人假、物假、神假以及地假太阴/六合扩展存在版本冲突，不得混入，也不得据格名生成吉凶、用途、方位、行动或现实结果`,
        palace: palace.gong,
        tokens: stems,
      });
    }
  }

  return patterns;
}

const YU_NV_SHOU_MEN_HOURS = new Set(['庚午', '己卯', '戊子', '丁酉', '丙午', '乙卯']);

function getYuNvShouMenPattern({
  jiuGongGe,
  zhiShi,
  scope,
  hourGanZhi,
}: PatternContext): ClassicPattern[] {
  // 三书共同限定为六个固定时柱，且值使门须实际落到地盘丁；缺任一条件均不命名。
  if (scope !== 'hour' || !hourGanZhi || !YU_NV_SHOU_MEN_HOURS.has(hourGanZhi) || !zhiShi) {
    return [];
  }

  const valueDoorPalaces = jiuGongGe.filter((palace) => palace.renPan.door === zhiShi);
  if (valueDoorPalaces.length !== 1) return [];

  const palace = valueDoorPalaces[0];
  if (palace.diPan.stem !== '丁') return [];

  return [
    {
      key: `pattern:valueDoor:yuNvShouMen:${hourGanZhi}:${palace.gong}`,
      name: '玉女守门',
      tone: 'neutral',
      summary: `当前时柱${hourGanZhi}属于庚午、己卯、戊子、丁酉、丙午、乙卯六时之一，值使门${zhiShi}落${palace.name}且该宫地盘干为丁，命中《武经总要》《遁甲演义》《奇门宝鉴御定》共同支持的“玉女守门”核心结构。这里只登记固定时柱、值使门与地盘丁的可复算事实，不采用原典附带的宴会、阴私、出行或吉凶断语`,
      palace: palace.gong,
      tokens: ['丁'],
    },
  ];
}

/**
 * 返回正式允许输出的经典格局。
 *
 * 当前白名单包括十一项天地盘固定格，以及独立校勘的伏干格、飞干格、岁格、
 * 格勃、三奇升殿、三诈、三项条件一致的五假与玉女守门时家上下文结构。它们只在所需干支、值符身份、天盘落宫或
 * 奇门神三层可复算时登记中性结构，不继承互有差异的现实断语。月格因“月干/月朔干”不一，时格因
 * “本时干/仅三奇/庚值符管十时”不一，普通勃格因“丙临年月日时干/丙加值符庚”
 * 不一而继续关闭；AI 如需采用，应从原始九宫事实和明示版本继续推算。
 */
export function getClassicPatterns(context: PatternContext): ClassicPattern[] {
  return [
    ...getStemPairNamedPatterns(context.jiuGongGe),
    ...getDayStemContextPatterns(context),
    ...getYearStemContextPatterns(context),
    ...getGengValueSymbolPattern(context),
    ...getSanQiShengDianPatterns(context),
    ...getSanZhaPatterns(context),
    ...getAuditedWuJiaPatterns(context),
    ...getYuNvShouMenPattern(context),
  ];
}
