/**
 * @file 奇门已校勘经典格局与天地盘干结构事实
 * @description 正式入口只输出已经按同一原典逐条闭环的十一项天地盘固定格。
 * 九遁、三奇、三诈五假、值符值使、岁月日时格、门迫、击刑、入墓等旧规则
 * 在版本、条件或适用情境完成校勘前失败关闭；可复算的落宫与五行事实仍由九宫、
 * 基础标签、组合事实和天地盘干关系提供，供后续 AI 结合具体问题继续推算。
 */

import type { QimenJiuGongGe } from '../../../../types/divination';
import { isTianGanHe } from '../../../../ganzhi';
import { isControlling, isGenerating, stemElements, STEM_TOMB_MAP } from './_constants';
import { getNamedStemPairPattern, getStemPairPattern } from './stem-pair-patterns';
import { getTianPanStems } from './palace-utils';

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

/** 经典格局识别上下文；历史字段保留以兼容既有调用，但不再驱动未审核规则。 */
export interface PatternContext {
  jiuGongGe: QimenJiuGongGe[];
  zhiFu: string;
  zhiShi: string;
  yearGanZhi?: string;
  monthGanZhi?: string;
  dayStem?: string;
  dayGanZhi?: string;
  hourGanZhi?: string;
}

/**
 * 返回正式允许输出的经典格局。
 *
 * 当前白名单只有《遁甲演义》逐项校勘的十一项天地盘固定格。任何尚未闭合版本、
 * 条件和使用情境的旧规则都不进入结果；AI 如需继续推算，应从原始九宫事实出发。
 */
export function getClassicPatterns({ jiuGongGe }: PatternContext): ClassicPattern[] {
  return getStemPairNamedPatterns(jiuGongGe);
}
