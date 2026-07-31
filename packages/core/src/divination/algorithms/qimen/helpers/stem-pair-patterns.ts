/**
 * @file 奇门天地盘十干组合事实
 * @description 完整保留三奇六仪 9 × 9 共 81 种组合，但只把已经与原典逐条闭环的
 * 固定格作为传统命中。其余组合仅陈述天干、五行生克与标准天干五合，不自动扩写吉凶、
 * 现实事件、角色关系、成败或行动建议。
 */

import { isTianGanHe } from '../../../../ganzhi';
import { isControlling, isGenerating, stemElements } from './_constants';

export interface StemPairPattern {
  /** 天盘干 */
  heavenStem: string;
  /** 地盘干 */
  earthStem: string;
  /** 已校勘传统格名称，或结构事实名称 */
  name: string;
  /** 原典明确分类；结构事实固定为 neutral */
  type: 'good' | 'bad' | 'neutral';
  /** 可复核的简要事实 */
  summary: string;
  /** 对事实口径的说明 */
  interpretation: string;
  /** 明确的推断边界 */
  manifestation: string;
  /** 规则是否已经逐条校勘 */
  auditStatus: '已校勘' | '结构事实';
  /** 适用条件 */
  condition: string;
  /** 使用限制 */
  limitation: string;
  /** 原典或公共计算入口 */
  sources: Array<{
    title: string;
    url?: string;
    quote?: string;
  }>;
}

const HEAVEN_STEMS = ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTH_STEMS = ['乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

const DUNJIA_YANYI_VOLUME_1_URL = 'https://zh.wikisource.org/wiki/遁甲演義_(四庫全書本)/卷1';
const DUNJIA_YANYI_VOLUME_2_URL = 'https://zh.wikisource.org/wiki/遁甲演義_(四庫全書本)/卷2';

interface AuditedPatternInput {
  name: string;
  type: StemPairPattern['type'];
  summary: string;
  condition: string;
  quote: string;
  volume?: 1 | 2;
}

function createAuditedPattern(
  input: AuditedPatternInput,
): Omit<StemPairPattern, 'heavenStem' | 'earthStem'> {
  const volume = input.volume ?? 2;
  return {
    name: input.name,
    type: input.type,
    summary: input.summary,
    interpretation: `《遁甲演义》卷${volume === 1 ? '一' : '二'}明确记录“${input.name}”及对应天地盘干条件。`,
    manifestation:
      '这里只保留原典固定格名称与原文分类；具体事项仍须由提问、宫位及其他原始盘面事实继续推算。',
    auditStatus: '已校勘',
    condition: input.condition,
    limitation: '不得脱离原典适用语境扩写成现代审批、财务、人际、健康、成败或行动保证。',
    sources: [
      {
        title: `《遁甲演义》卷${volume === 1 ? '一' : '二'}`,
        url: volume === 1 ? DUNJIA_YANYI_VOLUME_1_URL : DUNJIA_YANYI_VOLUME_2_URL,
        quote: input.quote,
      },
    ],
  };
}

/**
 * 已逐条核对《遁甲演义》的固定天地盘干格。
 *
 * 原典的甲在当前九干盘中按甲子遁戊表示，因此甲加丙、丙加甲分别落为戊丙、丙戊。
 * 乙加庚等存在版本异说的组合暂不启用，留待后续按同一版本、同一条件闭环。
 */
const AUDITED_NAMED_PATTERNS: Record<string, Omit<StemPairPattern, 'heavenStem' | 'earthStem'>> = {
  戊_丙: createAuditedPattern({
    name: '青龙返首',
    type: 'good',
    summary: '原典列“甲加丙”为青龙返首，并与飞鸟跌穴并列为吉神；当前九干盘以甲子遁戊表示甲。',
    condition: '同一宫位天盘见甲子戊、地盘见丙。',
    quote: '丙加甲兮鸟跌穴，甲加丙兮龙返首……只此二者是吉神。',
    volume: 1,
  }),
  丙_戊: createAuditedPattern({
    name: '飞鸟跌穴',
    type: 'good',
    summary: '原典列“丙加甲”为飞鸟跌穴，并与青龙返首并列为吉神；当前九干盘以甲子遁戊表示甲。',
    condition: '同一宫位天盘见丙、地盘见甲子戊。',
    quote: '丙加甲兮鸟跌穴，甲加丙兮龙返首……只此二者是吉神。',
    volume: 1,
  }),
  乙_辛: createAuditedPattern({
    name: '青龙逃走',
    type: 'bad',
    summary: '原典明确以天盘六乙加地盘六辛为青龙逃走，并列入四凶神。',
    condition: '同一宫位天盘见乙、地盘见辛。',
    quote: '六乙加辛龙逃走……请观四者是凶神。',
    volume: 1,
  }),
  辛_乙: createAuditedPattern({
    name: '白虎猖狂',
    type: 'bad',
    summary: '原典明确以天盘六辛加地盘六乙为白虎猖狂，并列入四凶神。',
    condition: '同一宫位天盘见辛、地盘见乙。',
    quote: '六辛加乙虎猖狂……请观四者是凶神。',
    volume: 1,
  }),
  丁_癸: createAuditedPattern({
    name: '朱雀投江',
    type: 'bad',
    summary: '原典明确以天盘六丁加地盘六癸为朱雀入江或朱雀投江，并列入四凶神。',
    condition: '同一宫位天盘见丁、地盘见癸。',
    quote: '天上六丁加地下六癸名曰朱雀入江……是为朱雀投江也。',
  }),
  癸_丁: createAuditedPattern({
    name: '螣蛇跃蹻',
    type: 'bad',
    summary: '原典明确以天盘六癸加地盘六丁为螣蛇跃蹻，并列入四凶神。',
    condition: '同一宫位天盘见癸、地盘见丁。',
    quote: '天上六癸加地下六丁名螣蛇跃蹻，此时百事不利。',
  }),
  丙_庚: createAuditedPattern({
    name: '荧入太白',
    type: 'neutral',
    summary: '原典明确以天盘六丙加地盘六庚为荧入太白；所载趋避属于兵占语境，不泛化为通用吉凶。',
    condition: '同一宫位天盘见丙、地盘见庚。',
    quote: '歌曰六丙加庚荧入白……天盘丙加地盘庚是火入金乡。',
  }),
  庚_丙: createAuditedPattern({
    name: '太白入荧',
    type: 'neutral',
    summary: '原典明确以天盘六庚加地盘六丙为太白入荧；所载趋避属于兵占语境，不泛化为通用吉凶。',
    condition: '同一宫位天盘见庚、地盘见丙。',
    quote: '歌曰六庚加丙白入荧……天盘庚加地盘丙乃金入火乡而受克。',
  }),
  庚_癸: createAuditedPattern({
    name: '大格',
    type: 'bad',
    summary: '原典明确以天盘六庚加地盘六癸为大格，并记此时不可用、百事凶。',
    condition: '同一宫位天盘见庚、地盘见癸。',
    quote: '六庚加癸名曰大格时也，谓天上六庚临地下六癸，此时不可用百事凶。',
  }),
  庚_己: createAuditedPattern({
    name: '刑格',
    type: 'bad',
    summary: '原典明确以天盘六庚加地盘六己为刑格。',
    condition: '同一宫位天盘见庚、地盘见己。',
    quote: '六庚加六己为刑格，谓天上六庚加地下六己。',
  }),
  庚_壬: createAuditedPattern({
    name: '小格',
    type: 'bad',
    summary: '原典明确以天盘六庚加地盘六壬为小格，并记当此之时不宜出师。',
    condition: '同一宫位天盘见庚、地盘见壬。',
    quote: '六庚加六壬谓之小格，一云伏格，当此之时并不宜出师。',
  }),
};

/** 正式入口允许输出的经典格名称；供生成端与证据消费端共用同一白名单。 */
export const AUDITED_QIMEN_CLASSIC_PATTERN_NAMES: readonly string[] = Object.freeze(
  Object.values(AUDITED_NAMED_PATTERNS).map((pattern) => pattern.name),
);

export function isAuditedQimenClassicPatternName(name: string): boolean {
  return AUDITED_QIMEN_CLASSIC_PATTERN_NAMES.includes(name);
}

if (Object.keys(AUDITED_NAMED_PATTERNS).length !== 11) {
  throw new Error('奇门已校勘天地盘固定格数量必须为11项。');
}

function assertValidStem(stem: string, label: string): void {
  if (!stemElements[stem]) {
    throw new Error(`${label}必须是合法十天干（甲乙丙丁戊己庚辛壬癸）。`);
  }
}

function getStructuralPattern(heavenStem: string, earthStem: string): StemPairPattern {
  const heavenElement = stemElements[heavenStem];
  const earthElement = stemElements[earthStem];

  if (!heavenElement || !earthElement) {
    throw new Error(`奇门十干组合五行数据缺失：天盘${heavenStem}、地盘${earthStem}。`);
  }

  let relation: string;
  if (heavenElement === earthElement) {
    relation = `天盘${heavenStem}与地盘${earthStem}五行同为${heavenElement}`;
  } else if (isControlling(heavenElement, earthElement)) {
    relation = `天盘${heavenStem}（${heavenElement}）克地盘${earthStem}（${earthElement}）`;
  } else if (isControlling(earthElement, heavenElement)) {
    relation = `地盘${earthStem}（${earthElement}）克天盘${heavenStem}（${heavenElement}）`;
  } else if (isGenerating(heavenElement, earthElement)) {
    relation = `天盘${heavenStem}（${heavenElement}）生地盘${earthStem}（${earthElement}）`;
  } else if (isGenerating(earthElement, heavenElement)) {
    relation = `地盘${earthStem}（${earthElement}）生天盘${heavenStem}（${heavenElement}）`;
  } else {
    throw new Error(`奇门十干组合五行关系无法判定：天盘${heavenStem}、地盘${earthStem}。`);
  }

  const combines = isTianGanHe(heavenStem, earthStem);
  const combineFact = combines ? `；${heavenStem}${earthStem}同时属于标准天干五合` : '';

  return {
    heavenStem,
    earthStem,
    name: combines ? '天干五合与五行结构' : '五行结构事实',
    type: 'neutral',
    summary: `${relation}${combineFact}。`,
    interpretation: '这里只记录可由天干五行和公共五合入口复算的结构关系。',
    manifestation: '不得仅据此生成吉凶、现实事件、角色关系、成败判断或行动建议。',
    auditStatus: '结构事实',
    condition: `同一宫位天盘见${heavenStem}、地盘见${earthStem}。`,
    limitation: '该组合尚未完成固定传统格名称与原文条件的逐条校勘，因此不作为传统格局命中。',
    sources: [{ title: 'mingyu-core 公共天干五行与天干五合入口' }],
  };
}

/**
 * 获取天地盘干组合事实。
 *
 * 已校勘组合返回固定传统格；其余组合只返回五行与标准天干五合结构事实。
 */
export function getStemPairPattern(heavenStem: string, earthStem: string): StemPairPattern {
  assertValidStem(heavenStem, '天盘干');
  assertValidStem(earthStem, '地盘干');

  const named = AUDITED_NAMED_PATTERNS[`${heavenStem}_${earthStem}`];
  return named ? { ...named, heavenStem, earthStem } : getStructuralPattern(heavenStem, earthStem);
}

/** 只获取已经逐条校勘的固定传统格；未校勘组合返回 null。 */
export function getNamedStemPairPattern(
  heavenStem: string,
  earthStem: string,
): StemPairPattern | null {
  assertValidStem(heavenStem, '天盘干');
  assertValidStem(earthStem, '地盘干');

  const named = AUDITED_NAMED_PATTERNS[`${heavenStem}_${earthStem}`];
  return named ? { ...named, heavenStem, earthStem } : null;
}

/** 获取三奇六仪 9 × 9 共 81 种天地盘干组合事实。 */
export function listAllStemPairs(): StemPairPattern[] {
  const results: StemPairPattern[] = [];

  for (const heavenStem of HEAVEN_STEMS) {
    for (const earthStem of EARTH_STEMS) {
      results.push(getStemPairPattern(heavenStem, earthStem));
    }
  }

  return results;
}
