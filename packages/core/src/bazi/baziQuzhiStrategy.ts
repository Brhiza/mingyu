import { BASIC_MAPPINGS, HIDDEN_STEMS } from './baziDefinitions';
import { collectCompleteBranchFormations } from './baziFormationUtils';
import type { Pillars, SpecialPatternAdjudication } from './baziTypes';

type PillarPosition = keyof Pillars;

export type QuzhiRoute = '亥卯未木局' | '寅卯辰东方';

export interface QuzhiPatternAssessment {
  structuralMatch: boolean;
  established: boolean;
  route?: QuzhiRoute;
  method?: string;
  matchedConditions: string[];
  evidence: string[];
  blockers: string[];
  adjudication?: SpecialPatternAdjudication;
}

const PILLAR_LABELS: Record<PillarPosition, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const METAL_STEMS = new Set(['庚', '辛']);

/**
 * 曲直采用两条具名古法，不借通用旺衰标签或自定义计数阈值代替原文条件：
 * - 《三命通会》卷六：甲乙日，亥卯未局全，并以亥印为入格关键；
 * - 《渊海子平·神趣八法·类象》：甲乙日春生，寅卯辰全而无间断破坏。
 *
 * 金破采用《神峰通考》所引《格解》“无半分庚辛之气”的严格口径，所以庚辛无论透藏
 * 均记为金制反证；支冲只采用张楠按语明确举出的申酉冲破东方秀气，并落实为局外支
 * 对木局成员的直接六冲。该页所引“更怕刑冲”没有定义何种刑足以破格，邻接示例又见
 * 子卯，因此本规则不把所有相刑机械升级为破格。成员支原藏干完整保留；火为泄秀、土为
 * 财星，只记录透干事实，不能仅因出现便当作破格或自称作用已满足。
 */
export function assessQuzhiPattern(pillars: Pillars): QuzhiPatternAssessment {
  const dayStem = pillars.day.gan;
  if (!['甲', '乙'].includes(dayStem)) {
    return {
      structuralMatch: false,
      established: false,
      matchedConditions: [],
      evidence: [],
      blockers: [],
    };
  }

  const completeWoodFormations = collectCompleteBranchFormations(pillars).filter(
    (formation) => formation.wuxing === '木',
  );
  const sanhe = completeWoodFormations.find(
    (formation) => formation.type === '三合' && formation.branches.join('') === '亥卯未',
  );
  const eastern = completeWoodFormations.find(
    (formation) => formation.type === '三会' && formation.branches.join('') === '寅卯辰',
  );
  const route: QuzhiRoute | undefined = sanhe
    ? '亥卯未木局'
    : eastern && ['寅', '卯', '辰'].includes(pillars.month.zhi)
      ? '寅卯辰东方'
      : undefined;

  if (!route) {
    return {
      structuralMatch: false,
      established: false,
      matchedConditions: [],
      evidence: [],
      blockers: [],
    };
  }

  const formationBranches = route === '亥卯未木局' ? ['亥', '卯', '未'] : ['寅', '卯', '辰'];
  const method =
    route === '亥卯未木局'
      ? '《三命通会》卷六亥卯未曲直法'
      : '《渊海子平·神趣八法·类象》春生寅卯辰法';
  const matchedConditions =
    route === '亥卯未木局'
      ? [`日干${dayStem}属木`, '亥卯未三支齐全', '局中见亥印']
      : [`日干${dayStem}属木`, `月支${pillars.month.zhi}属春令`, '寅卯辰三支齐全'];
  const entries = Object.entries(pillars) as Array<[PillarPosition, Pillars[PillarPosition]]>;
  const visibleMetal = entries
    .filter(([, pillar]) => METAL_STEMS.has(pillar.gan))
    .map(([position, pillar]) => `${PILLAR_LABELS[position]}透${pillar.gan}`);
  const hiddenMetal = entries.flatMap(([position, pillar]) =>
    (HIDDEN_STEMS[pillar.zhi] || [])
      .filter((stem) => METAL_STEMS.has(stem))
      .map((stem) => `${PILLAR_LABELS[position]}${pillar.zhi}藏${stem}`),
  );
  const externalClashes = entries.flatMap(([position, pillar]) => {
    if (formationBranches.includes(pillar.zhi)) return [];
    const clashedMembers = formationBranches.filter(
      (member) => BASIC_MAPPINGS.DI_ZHI_CHONG[member] === pillar.zhi,
    );
    return clashedMembers.length
      ? [`${PILLAR_LABELS[position]}${pillar.zhi}冲${clashedMembers.join('、')}`]
      : [];
  });
  const blockers = [
    ...(visibleMetal.length ? [`庚辛透干：${visibleMetal.join('、')}`] : []),
    ...(hiddenMetal.length ? [`庚辛藏支：${hiddenMetal.join('、')}`] : []),
    ...(externalClashes.length ? [`局外支冲：${externalClashes.join('、')}`] : []),
  ];
  const memberHiddenFacts = formationBranches.map(
    (branch) => `${branch}藏${(HIDDEN_STEMS[branch] || []).join('、')}`,
  );
  const observedStems = entries.flatMap(([, pillar]) => [
    pillar.gan,
    ...(HIDDEN_STEMS[pillar.zhi] || []),
  ]);
  const hasFire = observedStems.some((stem) => ['丙', '丁'].includes(stem));
  const hasEarth = observedStems.some((stem) => ['戊', '己'].includes(stem));
  const visibleOutputStems = entries
    .filter(([position, pillar]) => position !== 'day' && ['丙', '丁'].includes(pillar.gan))
    .map(([, pillar]) => pillar.gan);
  const visibleWealthStems = entries
    .filter(([position, pillar]) => position !== 'day' && ['戊', '己'].includes(pillar.gan))
    .map(([, pillar]) => pillar.gan);
  const evidence = [
    `${method}：${matchedConditions.join('、')}`,
    `木局成员藏干如实保留：${memberHiddenFacts.join('；')}`,
    ...(hasFire ? ['局中火按木所生的泄秀事实另论，不作金制破格'] : []),
    ...(hasEarth ? ['局中土按木所克的财星事实另论，不作金制破格'] : []),
    ...(visibleOutputStems.length ? [`曲直局见食伤明透：${visibleOutputStems.join('、')}`] : []),
    ...(visibleWealthStems.length ? [`曲直局见财星明透：${visibleWealthStems.join('、')}`] : []),
  ];
  const adjudication: SpecialPatternAdjudication = {
    kind: '曲直格',
    status: blockers.length ? '不成立' : '成立',
    route,
    method,
    satisfied: [...matchedConditions],
    blockers: [...blockers],
    memberHiddenStems: memberHiddenFacts,
    visibleOutputStems,
    visibleWealthStems,
  };

  return {
    structuralMatch: true,
    established: blockers.length === 0,
    route,
    method,
    matchedConditions,
    evidence,
    blockers,
    adjudication,
  };
}

export function buildQuzhiPatternBasis(assessment: QuzhiPatternAssessment): string {
  const method = assessment.method || '曲直古法';
  return `${method}条件成立；${assessment.evidence.slice(1).join('；')}；以《神峰通考》所引《格解》“无半分庚辛之气”核金破，并按张楠按语核局外支直接冲破，本局均未见，正式立曲直格`;
}
