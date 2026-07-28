import { HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import { getWuxingTenGodCategory } from './baziRuleMatcher/helpers';
import type { PatternAnalysis, Pillars, Wuxing } from './baziTypes';
import { assertHeavenlyStem, assertPillars } from './baziUtils';

type GetTenGodFn = (gan: string, dayMaster: string) => string;
type HiddenStemPosition = keyof Pillars;

interface SpecialPatternForceSummary {
  samePartyExposedCount: number;
  oppositePartyExposedCount: number;
  samePartyPrincipalInsideFormationCount: number;
  oppositePartyPrincipalInsideFormationCount: number;
  samePartyPrincipalOutsideFormationCount: number;
  oppositePartyPrincipalOutsideFormationCount: number;
  samePartyResidualPositions: Set<HiddenStemPosition>;
  oppositePartyResidualPositions: Set<HiddenStemPosition>;
  hasSamePartyFormation: boolean;
  hasOppositePartyFormation: boolean;
}

const SAME_PARTY_GODS = ['比肩', '劫财', '正印', '偏印'];

function getPatternNameByTenGod(tenGod: string, dayMaster: string, monthBranch: string) {
  // 建禄格/月刃格需要精确校验月支是否为禄/刃位
  if (tenGod === '比肩') {
    if (LU_BRANCH_MAP[dayMaster] === monthBranch) {
      return '建禄格';
    }
    return '比肩格';
  }
  if (tenGod === '劫财') {
    if (REN_BRANCH_MAP[dayMaster] === monthBranch) {
      return '月刃格';
    }
    return '劫财格';
  }
  return `${tenGod}格`;
}

function isSamePartyTenGod(tenGod: string): boolean {
  return SAME_PARTY_GODS.includes(tenGod);
}

function collectSpecialPatternForce(
  pillars: Pillars,
  dayMaster: string,
  getTenGod: GetTenGodFn,
): SpecialPatternForceSummary {
  let samePartyExposedCount = 0;
  let oppositePartyExposedCount = 0;
  let samePartyPrincipalInsideFormationCount = 0;
  let oppositePartyPrincipalInsideFormationCount = 0;
  let samePartyPrincipalOutsideFormationCount = 0;
  let oppositePartyPrincipalOutsideFormationCount = 0;
  const samePartyResidualPositions = new Set<HiddenStemPosition>();
  const oppositePartyResidualPositions = new Set<HiddenStemPosition>();

  const establishedFormations = collectEstablishedBranchFormations(pillars);
  const samePartyFormationBranches = new Set<string>();
  const oppositePartyFormationBranches = new Set<string>();
  // 会局只解释组成支自身本气与化神之间的表面冲突；明透和局外本气仍是直接反证。
  establishedFormations.forEach((formation) => {
    const representativeStem = getRepresentativeStemByWuxing(formation.wuxing);
    const branches = isSamePartyTenGod(getTenGod(representativeStem, dayMaster))
      ? samePartyFormationBranches
      : oppositePartyFormationBranches;
    formation.branches.forEach((branch) => branches.add(branch));
  });

  const addPrincipalEvidence = (stem: string, branch: string) => {
    if (isSamePartyTenGod(getTenGod(stem, dayMaster))) {
      if (oppositePartyFormationBranches.has(branch)) {
        samePartyPrincipalInsideFormationCount += 1;
      } else {
        samePartyPrincipalOutsideFormationCount += 1;
      }
      return;
    }

    if (samePartyFormationBranches.has(branch)) {
      oppositePartyPrincipalInsideFormationCount += 1;
    } else {
      oppositePartyPrincipalOutsideFormationCount += 1;
    }
  };

  const addResidualEvidence = (stem: string, position: HiddenStemPosition) => {
    if (isSamePartyTenGod(getTenGod(stem, dayMaster))) {
      samePartyResidualPositions.add(position);
    } else {
      oppositePartyResidualPositions.add(position);
    }
  };

  (
    [
      ['year', pillars.year],
      ['month', pillars.month],
      ['hour', pillars.hour],
    ] as const
  ).forEach(([position, pillar]) => {
    if (isSamePartyTenGod(getTenGod(pillar.gan, dayMaster))) {
      samePartyExposedCount += 1;
    } else {
      oppositePartyExposedCount += 1;
    }

    const hiddenStems = HIDDEN_STEMS[pillar.zhi] || [];
    hiddenStems.forEach((stem, index) => {
      if (index === 0) {
        addPrincipalEvidence(stem, pillar.zhi);
        return;
      }

      addResidualEvidence(stem, position);
    });
  });

  const dayHiddenStems = HIDDEN_STEMS[pillars.day.zhi] || [];
  dayHiddenStems.forEach((stem, index) => {
    if (index === 0) {
      addPrincipalEvidence(stem, pillars.day.zhi);
      return;
    }

    addResidualEvidence(stem, 'day');
  });

  const formationSummary = establishedFormations.reduce(
    (summary, formation) => {
      const representativeStem = getRepresentativeStemByWuxing(formation.wuxing);
      const tenGod = getTenGod(representativeStem, dayMaster);
      if (isSamePartyTenGod(tenGod)) {
        return {
          ...summary,
          hasSamePartyFormation: true,
        };
      }

      return {
        ...summary,
        hasOppositePartyFormation: true,
      };
    },
    {
      hasSamePartyFormation: false,
      hasOppositePartyFormation: false,
    },
  );

  return {
    samePartyExposedCount,
    oppositePartyExposedCount,
    samePartyPrincipalInsideFormationCount,
    oppositePartyPrincipalInsideFormationCount,
    samePartyPrincipalOutsideFormationCount,
    oppositePartyPrincipalOutsideFormationCount,
    samePartyResidualPositions,
    oppositePartyResidualPositions,
    hasSamePartyFormation: formationSummary.hasSamePartyFormation,
    hasOppositePartyFormation: formationSummary.hasOppositePartyFormation,
  };
}

function collectExposedMonthStems(monthStems: string[], pillars: Pillars): string[] {
  const exposedStems = new Set([pillars.year.gan, pillars.month.gan, pillars.hour.gan]);
  return monthStems.filter((stem) => exposedStems.has(stem));
}

function getFormationUseLabel(wuxing: Wuxing, dayMaster: string): string {
  const tenGodGroup = getWuxingTenGodCategory(dayMaster, wuxing) || '十神待核';
  return `${wuxing}${tenGodGroup}`;
}

const TEN_GOD_TO_SUB_PATTERN: Record<string, 'wealth' | 'officer' | 'output'> = {
  正财: 'wealth',
  偏财: 'wealth',
  正官: 'officer',
  七杀: 'officer',
  食神: 'output',
  伤官: 'output',
};

const SUB_PATTERN_CATEGORY_TO_LABEL: Record<string, string> = {
  wealth: '从财格',
  officer: '从杀格',
  output: '从儿格',
};

/**
 * 从格细分：根据明透、本气与已成立会合局的类别是否纯一，判断从财/从杀/从儿。
 * 类别混杂时保守返回从势格，不按自定义分数或比例选出单一类别。
 */
function resolveSubPattern(pillars: Pillars, dayMaster: string, getTenGod: GetTenGodFn): string {
  const directCategories = new Set<string>();

  const addOppositeCategory = (stem: string) => {
    const tenGod = getTenGod(stem, dayMaster);
    const category = TEN_GOD_TO_SUB_PATTERN[tenGod];
    if (category) {
      directCategories.add(category);
    }
  };

  // 从格细分只看明透、本气与已成局的类别是否纯一；中余气不换算比例争夺主导权。
  (['year', 'month', 'hour'] as const).forEach((position) => {
    const pillar = pillars[position];
    addOppositeCategory(pillar.gan);
    const hiddenStems = HIDDEN_STEMS[pillar.zhi] || [];
    if (hiddenStems[0]) addOppositeCategory(hiddenStems[0]);
  });

  const dayHiddenStems = HIDDEN_STEMS[pillars.day.zhi] || [];
  if (dayHiddenStems[0]) addOppositeCategory(dayHiddenStems[0]);

  collectEstablishedBranchFormations(pillars).forEach((formation) => {
    const representativeStem = getRepresentativeStemByWuxing(formation.wuxing);
    const tenGod = getTenGod(representativeStem, dayMaster);
    const category = TEN_GOD_TO_SUB_PATTERN[tenGod];
    if (category) {
      directCategories.add(category);
    }
  });

  if (directCategories.size !== 1) return '从势格';
  const [category] = directCategories;
  return SUB_PATTERN_CATEGORY_TO_LABEL[category] || '从势格';
}

export function determinePattern(
  pillars: Pillars,
  strengthStatus: string,
  getTenGod: GetTenGodFn,
  monthCommander?: string,
): PatternAnalysis {
  assertPillars(pillars);
  if (monthCommander) {
    assertHeavenlyStem(monthCommander, '月令司权天干');
  }
  const monthBranch = pillars.month.zhi;
  const dayMaster = pillars.day.gan;
  const monthStems = HIDDEN_STEMS[monthBranch] || [];
  const exposedStems = [pillars.year.gan, pillars.month.gan, pillars.hour.gan];

  let patternName: string;

  const samePartyGods = new Set(['比肩', '劫财', '正印', '偏印']);
  const allHiddenStems = Object.values(pillars).flatMap((pillar) => HIDDEN_STEMS[pillar.zhi] || []);
  const observedGods = [
    pillars.year.gan,
    pillars.month.gan,
    pillars.hour.gan,
    ...allHiddenStems,
  ].map((stem) => getTenGod(stem, dayMaster));

  const samePartyCount = observedGods.filter((god) => samePartyGods.has(god)).length;
  const oppositePartyCount = observedGods.length - samePartyCount;
  const isPureSameParty = observedGods.length > 0 && oppositePartyCount === 0;
  const isPureOppositeParty = observedGods.length > 0 && samePartyCount === 0;
  const commanderGod = monthCommander ? getTenGod(monthCommander, dayMaster) : '';
  const commanderSupportsSameParty = !monthCommander || isSamePartyTenGod(commanderGod);
  const commanderSupportsOppositeParty = !monthCommander || !isSamePartyTenGod(commanderGod);
  const specialPatternForce = collectSpecialPatternForce(pillars, dayMaster, getTenGod);
  const canTreatAsSpecialStrong =
    specialPatternForce.oppositePartyExposedCount === 0 &&
    specialPatternForce.oppositePartyPrincipalInsideFormationCount <= 1 &&
    specialPatternForce.oppositePartyPrincipalOutsideFormationCount === 0 &&
    (specialPatternForce.oppositePartyResidualPositions.size <= 1 ||
      specialPatternForce.hasSamePartyFormation);
  const canTreatAsSpecialWeak =
    specialPatternForce.samePartyExposedCount === 0 &&
    specialPatternForce.samePartyPrincipalInsideFormationCount <= 1 &&
    specialPatternForce.samePartyPrincipalOutsideFormationCount === 0 &&
    (specialPatternForce.samePartyResidualPositions.size <= 1 ||
      specialPatternForce.hasOppositePartyFormation);

  if (
    strengthStatus === '极强' &&
    commanderSupportsSameParty &&
    (isPureSameParty || canTreatAsSpecialStrong)
  ) {
    const basis = specialPatternForce.hasSamePartyFormation
      ? '会局同党成势，局外未见明透或本气破格，且日主极强，按专旺格处理'
      : '全局印比成势，且日主极强，按专旺格处理';
    return { pattern: '专旺格', isSpecial: true, basis };
  }
  if (
    strengthStatus === '极弱' &&
    commanderSupportsOppositeParty &&
    (isPureOppositeParty || canTreatAsSpecialWeak)
  ) {
    // 从格细分只读主气类别是否纯一，不比较自定义力量分数。
    const subPattern = resolveSubPattern(pillars, dayMaster, getTenGod);
    const basis = specialPatternForce.hasOppositePartyFormation
      ? `会局异党成势，局外未见明透或本气扶身，且日主极弱，按${subPattern}处理`
      : `全局财官食伤成势，且日主极弱，按${subPattern}处理`;
    return { pattern: subPattern, isSpecial: true, basis };
  }

  const monthPrincipalStem = monthStems[0];
  const monthPrincipalGod = getTenGod(monthPrincipalStem, dayMaster);
  const exposedMonthStems = collectExposedMonthStems(monthStems, pillars);
  const monthBranchFormations = collectCompleteBranchFormations(pillars).filter(
    (formation) => formation.includesMonthBranch,
  );
  const commanderIsMonthStem = Boolean(monthCommander && monthStems.includes(monthCommander));
  const commanderIsExposed = Boolean(monthCommander && exposedStems.includes(monthCommander));
  let basis: string;

  if (LU_BRANCH_MAP[dayMaster] === monthBranch) {
    patternName = '建禄格';
    basis = `月令${monthBranch}为日主${dayMaster}之禄位，按建禄格处理`;
  } else if (REN_BRANCH_MAP[dayMaster] === monthBranch) {
    patternName = '月刃格';
    basis = `月令${monthBranch}为日主${dayMaster}之羊刃位，按月刃格处理`;
  } else if (exposedMonthStems.length > 0 && monthBranchFormations.length > 0) {
    const exposedUses = exposedMonthStems.map((stem) => `${stem}（${getTenGod(stem, dayMaster)}）`);
    const formationUses = monthBranchFormations.map(
      (formation) =>
        `月支${monthBranch}参与地支${formation.branches.join('')}完整${formation.type}${formation.wuxing}结构（${getFormationUseLabel(formation.wuxing, dayMaster)}）`,
    );
    const commanderFact = monthCommander
      ? !commanderIsMonthStem
        ? `；${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实`
        : `；当前${monthCommander}司权另作得时事实`
      : '';
    patternName = '待综合判断';
    basis = `月令藏干${exposedUses.join('、')}透出；${formationUses.join('；')}；《子平真诠》称“透而又会，则透与会并用”，故不能只按透干强定单一格局，须再结合透干与会支的生克、刑冲及有情无情判断成败${commanderFact}`;
  } else if (exposedMonthStems.length > 1) {
    const exposedUses = exposedMonthStems.map((stem) => `${stem}（${getTenGod(stem, dayMaster)}）`);
    patternName = '待综合判断';
    basis = `月令藏干${exposedUses.join('、')}同时透出；《子平真诠》称“一透则一用，兼透则兼用”，须再结合各用神相互关系判断成败，不按藏干次序、重复透出次数或年、月、时柱位强定单一格局`;
  } else if (monthPrincipalGod === '劫财') {
    if (REN_BRANCH_MAP[dayMaster]) {
      patternName = '劫财格';
      basis = `月令本气为${monthPrincipalStem}，对应劫财，但月支${monthBranch}非${dayMaster}刃位（刃在${REN_BRANCH_MAP[dayMaster]}），按劫财格处理`;
    } else {
      patternName = '劫财格';
      basis = `月令本气为${monthPrincipalStem}，对应劫财，日主${dayMaster}为阴干无真刃，按劫财格处理`;
    }
  } else if (exposedMonthStems.length === 1) {
    const exposedPatternStem = exposedMonthStems[0];
    const tenGod = getTenGod(exposedPatternStem, dayMaster);
    const prefix = commanderIsMonthStem && exposedPatternStem !== monthCommander ? '杂气' : '';
    patternName = `${prefix}${tenGod}格`;
    const exposedPosition =
      pillars.month.gan === exposedPatternStem
        ? '月干'
        : pillars.hour.gan === exposedPatternStem
          ? '时干'
          : '年干';
    const commanderBoundary =
      monthCommander && !commanderIsMonthStem
        ? `；${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实，不替换当前月支藏干格名`
        : monthCommander && monthCommander !== exposedPatternStem
          ? `；${monthCommander}司权另作月令得时事实，不覆盖已透藏干的格局名称`
          : monthCommander === exposedPatternStem
            ? '，且与当前司权一致'
            : '';
    basis = `${exposedPatternStem}为月令藏干，单独透于${exposedPosition}，按“一透则一用”取格${commanderBoundary}`;
  } else if (monthStems.length === 1) {
    const soleMonthStem = monthStems[0];
    const soleMonthGod = getTenGod(soleMonthStem, dayMaster);
    patternName = getPatternNameByTenGod(soleMonthGod, dayMaster, monthBranch);
    const commanderBoundary =
      monthCommander && !commanderIsMonthStem
        ? `；${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实，不替换本月唯一藏干`
        : monthCommander && monthCommander !== soleMonthStem
          ? `；当前${monthCommander}司权另作月令得时事实，不替换本月唯一藏干`
          : '';
    basis = `月令只有${soleMonthStem}一项藏干，虽未透干，但不存在多项月内人元取舍，按${soleMonthStem}（${soleMonthGod}）记录格名${commanderBoundary}`;
  } else {
    const hiddenUses = monthStems.map((stem) => `${stem}（${getTenGod(stem, dayMaster)}）`);
    const commanderFact = monthCommander
      ? commanderIsMonthStem
        ? `，当前${monthCommander}司权只作得时事实`
        : `，${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实，不替换当前月支藏干取格边界`
      : '';
    patternName = '待综合判断';
    basis = `月令藏干${hiddenUses.join('、')}均未透出${commanderFact}；《千里命稿》要求比较月内人元轻重、有力程度及克合后取舍，当前条件未闭合，不只凭司令阶段或藏干数组本气强定单一格局`;
  }

  return {
    pattern: patternName || '杂气格',
    isSpecial: false,
    basis,
    // 魁罡日（庚辰/壬辰/戊戌/庚戌）为重要外格，日柱判定后即标出，供 AI 参照《三命通会》
    isKuiGang: ['庚辰', '壬辰', '戊戌', '庚戌'].includes(pillars.day.gan + pillars.day.zhi),
  };
}
