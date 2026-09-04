/**
 * @file 八字合婚深层古典理法算法
 * @传统依据 《渊海子平》《三命通会》《星平会海》：年命纳音生克比和、夫妻宫天地德合与天克地冲、双向喜用神五行互补。
 */
import type { BaziChartResult, Wuxing } from './baziTypes';
import { NAYIN_MAP } from './baziMappingsData';
import {
  TIAN_GAN_CHONG,
  TIAN_GAN_HE,
  LIUCHONG_MAP,
  LIUHE_MAP,
  LIUHAI_MAP,
  isSanxing,
  isSheng,
  isKe,
} from '../ganzhi/relations';
import { getWuxing } from './baziUtils';

export interface NayinCompatibilityResult {
  person1YearGanZhi: string;
  person1Nayin: string;
  person1Element: Wuxing;
  person2YearGanZhi: string;
  person2Nayin: string;
  person2Element: Wuxing;
  relation: '比和' | '生对方' | '受对方生' | '克对方' | '受对方克';
  judgment: string;
}

export interface SpousePalaceDeepRelationResult {
  person1DayGanZhi: string;
  person2DayGanZhi: string;
  stemRelation: '五合' | '天干冲' | '相生' | '相克' | '比和';
  branchRelation: '六合' | '六冲' | '相刑' | '相害' | '同支' | '相生' | '相克' | '无明显刑冲合害';
  isTianDeHe: boolean; // 天合地合 (天地德合)
  isTianKeDiChong: boolean; // 天克地冲
  judgment: string;
}

export interface UsefulGodComplementarityResult {
  person1Useful: string[];
  person2Useful: string[];
  person1CoveredByPerson2Count: number;
  person2CoveredByPerson1Count: number;
  level: '互为喜用' | '单向得益' | '中和相济' | '互见忌神';
  judgment: string;
}

export interface BaziMarriageDeepEvaluation {
  nayin: NayinCompatibilityResult;
  spousePalace: SpousePalaceDeepRelationResult;
  usefulGodComplementarity: UsefulGodComplementarityResult;
  summary: string;
}

const WUXING_ELEMENTS: Record<string, Wuxing> = {
  金: '金',
  木: '木',
  水: '水',
  火: '火',
  土: '土',
};

/**
 * 评估年柱纳音五行生克配对
 */
export function evaluateNayinCompatibility(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
): NayinCompatibilityResult {
  const p1Gz = chart1.pillars.year.ganZhi;
  const p2Gz = chart2.pillars.year.ganZhi;

  const na1 = NAYIN_MAP[p1Gz] ?? '未知';
  const na2 = NAYIN_MAP[p2Gz] ?? '未知';

  const elem1 = WUXING_ELEMENTS[na1.slice(-1)] ?? '土';
  const elem2 = WUXING_ELEMENTS[na2.slice(-1)] ?? '土';

  let relation: NayinCompatibilityResult['relation'];
  let judgment: string;

  if (elem1 === elem2) {
    relation = '比和';
    judgment = '年命纳音同气比和，声气相求，门户根基相得益彰';
  } else if (isSheng(elem1, elem2)) {
    relation = '生对方';
    judgment = `年命纳音${elem1}生${elem2}，一方倾心相待，情意绵长`;
  } else if (isSheng(elem2, elem1)) {
    relation = '受对方生';
    judgment = `年命纳音${elem2}生${elem1}，得配偶照拂滋养，根基敦实`;
  } else if (isKe(elem1, elem2)) {
    relation = '克对方';
    judgment = `年命纳音${elem1}克${elem2}，以克为制，主导配合中见张力`;
  } else {
    relation = '受对方克';
    judgment = `年命纳音${elem2}克${elem1}，顺承包容，宜多加调适理解`;
  }

  return {
    person1YearGanZhi: p1Gz,
    person1Nayin: na1,
    person1Element: elem1,
    person2YearGanZhi: p2Gz,
    person2Nayin: na2,
    person2Element: elem2,
    relation,
    judgment,
  };
}

/**
 * 评估日柱夫妻宫天合地合与天克地冲深层关系
 */
export function evaluateSpousePalaceDeepRelation(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
): SpousePalaceDeepRelationResult {
  const p1 = chart1.pillars.day;
  const p2 = chart2.pillars.day;

  const stem1 = p1.gan;
  const stem2 = p2.gan;
  const zhi1 = p1.zhi;
  const zhi2 = p2.zhi;

  // 天干关系
  let stemRelation: SpousePalaceDeepRelationResult['stemRelation'] = '比和';
  if (TIAN_GAN_HE[stem1]?.partner === stem2) {
    stemRelation = '五合';
  } else if (TIAN_GAN_CHONG[stem1] === stem2) {
    stemRelation = '天干冲';
  } else if (
    isSheng(chart1.dayMaster.element, chart2.dayMaster.element) ||
    isSheng(chart2.dayMaster.element, chart1.dayMaster.element)
  ) {
    stemRelation = '相生';
  } else if (
    isKe(chart1.dayMaster.element, chart2.dayMaster.element) ||
    isKe(chart2.dayMaster.element, chart1.dayMaster.element)
  ) {
    stemRelation = '相克';
  }

  // 地支关系
  let branchRelation: SpousePalaceDeepRelationResult['branchRelation'] = '无明显刑冲合害';
  if (zhi1 === zhi2) {
    branchRelation = '同支';
  } else if (LIUHE_MAP[zhi1] === zhi2) {
    branchRelation = '六合';
  } else if (LIUCHONG_MAP[zhi1] === zhi2) {
    branchRelation = '六冲';
  } else if (isSanxing(zhi1, zhi2)) {
    branchRelation = '相刑';
  } else if (LIUHAI_MAP[zhi1] === zhi2) {
    branchRelation = '相害';
  }

  const isTianDeHe = stemRelation === '五合' && branchRelation === '六合';
  const isTianKeDiChong =
    (stemRelation === '天干冲' || stemRelation === '相克') && branchRelation === '六冲';

  let judgment: string;
  if (isTianDeHe) {
    judgment = '日柱夫妻宫天地德合，干合支连，如鸳鸯交颈，性情相投，默契天成';
  } else if (isTianKeDiChong) {
    judgment = '日柱夫妻宫天克地冲，气场抵触，主见各自刚毅，相处宜各存空间、求同存异';
  } else if (stemRelation === '五合') {
    judgment = `日干天合配${branchRelation}，情意相通，精神契合度高`;
  } else if (branchRelation === '六合') {
    judgment = `日支六合配天干${stemRelation}，日常居所生活契合，气场和睦`;
  } else if (branchRelation === '六冲') {
    judgment = '日支逢冲，夫妻宫气场多变动，宜修心包容、晚婚稳健';
  } else if (branchRelation === '相刑' || branchRelation === '相害') {
    judgment = `日支见${branchRelation}，言语沟通宜多留余地，避繁去缛`;
  } else {
    judgment = `日柱天干${stemRelation}、地支${branchRelation}，中和自洽，平稳相守`;
  }

  return {
    person1DayGanZhi: p1.ganZhi,
    person2DayGanZhi: p2.ganZhi,
    stemRelation,
    branchRelation,
    isTianDeHe,
    isTianKeDiChong,
    judgment,
  };
}

/**
 * 统计盘面中出现某五行集合的频次
 */
function countElementOccurrences(chart: BaziChartResult, elements: string[]): number {
  if (!elements.length) return 0;
  const targetSet = new Set(elements);
  let count = 0;
  for (const p of Object.values(chart.pillars)) {
    const stemElem = getWuxing(p.gan);
    if (stemElem !== '未知' && targetSet.has(stemElem)) count++;
    const zhiElem = getWuxing(p.zhi);
    if (zhiElem !== '未知' && targetSet.has(zhiElem)) count++;
  }
  return count;
}

/**
 * 评估喜用神互补度
 */
export function evaluateUsefulGodComplementarity(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
): UsefulGodComplementarityResult {
  const p1Useful = chart1.analysis.usefulGod.favorableWuxing || [];
  const p2Useful = chart2.analysis.usefulGod.favorableWuxing || [];
  const p1Avoid = chart1.analysis.usefulGod.unfavorableWuxing || [];
  const p2Avoid = chart2.analysis.usefulGod.unfavorableWuxing || [];

  const c1 = countElementOccurrences(chart2, p1Useful); // chart2 提供给 chart1 的喜用
  const c2 = countElementOccurrences(chart1, p2Useful); // chart1 提供给 chart2 的喜用

  const avoid1 = countElementOccurrences(chart2, p1Avoid);
  const avoid2 = countElementOccurrences(chart1, p2Avoid);

  let level: UsefulGodComplementarityResult['level'];
  let judgment: string;

  if (c1 >= 2 && c2 >= 2) {
    level = '互为喜用';
    judgment = '双方八字互补喜用五行，所需皆由对方盘面承托，同舟共济，流通生生不息';
  } else if (c1 >= 2 || c2 >= 2) {
    level = '单向得益';
    judgment = '单方五行对另一方起到明显资助作用，互有依托，情深意笃';
  } else if (avoid1 >= 3 && avoid2 >= 3) {
    level = '互见忌神';
    judgment = '对方多见自身所忌五行，气场互有砥砺，需借大运流年与后天环境调停化解';
  } else {
    level = '中和相济';
    judgment = '双方五行分布平稳，互补不显偏激，日常相处循序渐进';
  }

  return {
    person1Useful: p1Useful,
    person2Useful: p2Useful,
    person1CoveredByPerson2Count: c1,
    person2CoveredByPerson1Count: c2,
    level,
    judgment,
  };
}

/**
 * 综合评估八字合婚古典理法
 */
export function evaluateBaziMarriageDeep(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
): BaziMarriageDeepEvaluation {
  const nayin = evaluateNayinCompatibility(chart1, chart2);
  const spousePalace = evaluateSpousePalaceDeepRelation(chart1, chart2);
  const usefulGodComplementarity = evaluateUsefulGodComplementarity(chart1, chart2);

  const summary = `八字合婚理法：年命纳音${nayin.person1Nayin}与${nayin.person2Nayin}${nayin.relation}，${nayin.judgment}；夫妻宫${spousePalace.judgment}；喜用互补呈${usefulGodComplementarity.level}，${usefulGodComplementarity.judgment}`;

  return {
    nayin,
    spousePalace,
    usefulGodComplementarity,
    summary,
  };
}
