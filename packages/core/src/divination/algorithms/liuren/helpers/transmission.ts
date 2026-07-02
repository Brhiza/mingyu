import type {
  LiurenClassicalRule,
  LiurenData,
  LiurenTransmission,
} from '../../../../types/divination';

const LIUCHONG_MAP: Record<string, string> = {
  子: '午',
  丑: '未',
  寅: '申',
  卯: '酉',
  辰: '戌',
  巳: '亥',
  午: '子',
  未: '丑',
  申: '寅',
  酉: '卯',
  戌: '辰',
  亥: '巳',
};

export function buildTransmissionNote(stage: LiurenTransmission['stage'], relation: string) {
  const stagePrefixMap: Record<LiurenTransmission['stage'], string> = {
    初传: '事情起点',
    中传: '过程阶段',
    末传: '结果落点',
  };

  if (relation === '比和') {
    return `${stagePrefixMap[stage]}偏平稳，可按既定节奏推进。`;
  }
  if (relation.includes('生')) {
    return `${stagePrefixMap[stage]}有承接与转机，适合顺势发力。`;
  }
  if (relation.includes('克')) {
    return `${stagePrefixMap[stage]}阻力更明显，宜先拆解卡点。`;
  }

  return `${stagePrefixMap[stage]}变化较杂，需要边走边校正。`;
}

export function getTransmissionPattern(
  chu: string,
  zhong: string,
  mo: string,
): LiurenData['transmissionPattern'] {
  if (chu === zhong && zhong === mo) {
    return '伏吟';
  }
  if (LIUCHONG_MAP[chu] === mo) {
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
  classicalRule?: LiurenClassicalRule,
) {
  const initialTransmission = transmissions[0];
  if (!initialTransmission) {
    throw new Error('buildTransmissionDetail 需要至少包含初传信息。');
  }
  const sourceText = classicalRule
    ? `；古籍依据按${classicalRule.source}之${classicalRule.rule}，${classicalRule.summary}`
    : '';
  return `取传采用${rule}，以${initialTransmission.stage}${initialTransmission.branch}为初传发用${sourceText}。`;
}
