import type {
  LiurenClassicalRule,
  LiurenData,
  LiurenTransmission,
} from '../../../../types/divination';

export function buildTransmissionNote(stage: LiurenTransmission['stage'], relation: string) {
  const comparedPosition: Record<LiurenTransmission['stage'], string> = {
    初传: '一课下位',
    中传: '初传',
    末传: '中传',
  };
  return `${stage}与${comparedPosition[stage]}的五行关系为${relation}。`;
}

export function getTransmissionPattern(
  chu: string,
  _zhong: string,
  mo: string,
  transmissionRule = '',
): LiurenData['transmissionPattern'] {
  if (transmissionRule.includes('伏吟')) {
    return '伏吟';
  }
  if (transmissionRule.includes('返吟')) {
    return '反吟';
  }
  if (chu === mo) {
    return '回环';
  }

  return '递传';
}

export function getPatternTag(pattern: LiurenData['transmissionPattern']) {
  if (pattern === '伏吟') {
    return '伏吟';
  }
  if (pattern === '反吟') {
    return '反吟';
  }
  if (pattern === '回环') {
    return '回环';
  }

  return '递传';
}

const TRANSMISSION_BRANCH_CLASS_GUA_TI: Array<{
  name: string;
  branches: string[];
}> = [
  { name: '三交卦', branches: ['子', '午', '卯', '酉'] },
  { name: '玄胎卦', branches: ['寅', '申', '巳', '亥'] },
  { name: '稼穑卦', branches: ['辰', '戌', '丑', '未'] },
];

const TRANSMISSION_SANHE_GUA_TI: Array<{
  name: string;
  branches: string[];
}> = [
  { name: '曲直卦', branches: ['亥', '卯', '未'] },
  { name: '从革卦', branches: ['巳', '酉', '丑'] },
  { name: '炎上卦', branches: ['寅', '午', '戌'] },
  { name: '润下卦', branches: ['申', '子', '辰'] },
];

function hasSameBranchSet(actualBranches: string[], expectedBranches: string[]) {
  return (
    actualBranches.length === expectedBranches.length &&
    expectedBranches.every((branch) => actualBranches.includes(branch))
  );
}

/**
 * 识别三传成局课体。
 * 《六壬指南》列三交、玄胎、稼穑及曲直、从革、炎上、润下等三传课体；
 * 这里仅按三传地支结构打标签，吉凶仍交由后续断课结合用神、天将与旺衰判断。
 */
export function getLiurenTransmissionGuaTi(branches: string[]) {
  const uniqueBranches = Array.from(new Set(branches));
  if (uniqueBranches.length !== 3) {
    return [];
  }

  const guaTi: string[] = [];

  for (const item of TRANSMISSION_BRANCH_CLASS_GUA_TI) {
    if (uniqueBranches.every((branch) => item.branches.includes(branch))) {
      guaTi.push(item.name);
    }
  }

  for (const item of TRANSMISSION_SANHE_GUA_TI) {
    if (hasSameBranchSet(uniqueBranches, item.branches)) {
      guaTi.push(item.name);
    }
  }

  return guaTi;
}

export function buildTransmissionDetail(
  rule: string,
  _pattern: LiurenData['transmissionPattern'],
  transmissions: LiurenTransmission[],
  classicalRules: LiurenClassicalRule[] = [],
) {
  const initialTransmission = transmissions[0];
  if (!initialTransmission) {
    throw new Error('buildTransmissionDetail 需要至少包含初传信息。');
  }
  const sourceText = classicalRules.length
    ? `；古籍依据依次为：${classicalRules
        .map((item) => `${item.source}之${item.rule}（${item.summary}）`)
        .join('；')}`
    : '';
  return `取传采用${rule}，以${initialTransmission.stage}${initialTransmission.branch}为初传发用${sourceText}。`;
}
