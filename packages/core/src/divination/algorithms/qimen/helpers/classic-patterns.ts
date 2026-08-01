/**
 * @file 奇门已校勘经典格局与天地盘干结构事实
 * @description 正式入口输出已经逐条闭环的十一项天地盘固定格，以及只在
 * 完整时家日柱上下文中识别的伏干格、飞干格两项中性结构事实。
 * 九遁、三奇、三诈五假、值符值使、岁月日时格、门迫、击刑、入墓等旧规则
 * 在版本、条件或适用情境完成校勘前失败关闭；可复算的落宫与五行事实仍由九宫、
 * 基础标签、组合事实和天地盘干关系提供，供后续 AI 结合具体问题继续推算。
 */

import type { QimenJiuGongGe, QimenScope } from '../../../../types/divination';
import { isTianGanHe } from '../../../../ganzhi';
import { isControlling, isGenerating, stemElements, STEM_TOMB_MAP } from './_constants';
import { getNamedStemPairPattern, getStemPairPattern } from './stem-pair-patterns';
import { getDunJiaStem, getTianPanStems } from './palace-utils';

/** 已校勘、但不能退化为固定天地盘干二元映射的日干上下文格。 */
export const AUDITED_QIMEN_CONTEXT_PATTERN_NAMES = ['伏干格', '飞干格'] as const;

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
 * 已校勘固定格优先按命名格局记录；其余组合只输出入墓、击刑、标准天干五合
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

      const tomb = STEM_TOMB_MAP[heaven];
      const isTomb = tomb?.palace === palace.gong;
      if (isTomb) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '入墓',
          note: `天盘${heaven}落${palace.name}，命中统一入墓表（墓支${tomb.branch}）；这里只记录落宫条件，不据此单独断事`,
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

      if (namedPattern || isTomb || isJiXing) continue;

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

/**
 * 返回正式允许输出的经典格局。
 *
 * 当前白名单包括十一项天地盘固定格，以及《遁甲演义》《奇门遁甲统宗》与
 * 《奇门法窍》互证的伏干格、飞干格。后两项只在时家、完整日柱和六甲遁干均
 * 可复算时登记中性结构，不继承互有差异的现实断语。其余尚未闭合版本、条件和
 * 使用情境的旧规则都不进入结果；AI 如需继续推算，应从原始九宫事实出发。
 */
export function getClassicPatterns(context: PatternContext): ClassicPattern[] {
  return [...getStemPairNamedPatterns(context.jiuGongGe), ...getDayStemContextPatterns(context)];
}
