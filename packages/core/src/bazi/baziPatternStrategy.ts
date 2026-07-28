import { HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectEstablishedBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import type { PatternAnalysis, Pillars } from './baziTypes';
import { assertHeavenlyStem, assertPillars } from './baziUtils';

type GetTenGodFn = (gan: string, dayMaster: string) => string;
type PillarPosition = 'year' | 'month' | 'hour';
type HiddenStemPosition = keyof Pillars;

interface SpecialPatternForceSummary {
  samePartyDirectCount: number;
  oppositePartyDirectCount: number;
  samePartyResidualPositions: Set<HiddenStemPosition>;
  oppositePartyResidualPositions: Set<HiddenStemPosition>;
  hasSamePartyFormation: boolean;
  hasOppositePartyFormation: boolean;
}

const SAME_PARTY_GODS = ['比肩', '劫财', '正印', '偏印'];

function isSamePartyGod(tenGod: string) {
  return SAME_PARTY_GODS.includes(tenGod);
}

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
  let samePartyDirectCount = 0;
  let oppositePartyDirectCount = 0;
  const samePartyResidualPositions = new Set<HiddenStemPosition>();
  const oppositePartyResidualPositions = new Set<HiddenStemPosition>();

  const addEvidence = (stem: string, position?: HiddenStemPosition, isResidual = false) => {
    const tenGod = getTenGod(stem, dayMaster);
    if (isSamePartyTenGod(tenGod)) {
      if (isResidual && position) {
        samePartyResidualPositions.add(position);
      } else {
        samePartyDirectCount += 1;
      }
      return;
    }

    if (isResidual && position) {
      oppositePartyResidualPositions.add(position);
    } else {
      oppositePartyDirectCount += 1;
    }
  };

  (
    [
      ['year', pillars.year],
      ['month', pillars.month],
      ['hour', pillars.hour],
    ] as const
  ).forEach(([position, pillar]) => {
    addEvidence(pillar.gan);
    const hiddenStems = HIDDEN_STEMS[pillar.zhi] || [];
    hiddenStems.forEach((stem, index) => {
      if (index === 0) {
        addEvidence(stem);
        return;
      }

      addEvidence(stem, position, true);
    });
  });

  const dayHiddenStems = HIDDEN_STEMS[pillars.day.zhi] || [];
  dayHiddenStems.forEach((stem, index) => {
    if (index === 0) {
      addEvidence(stem);
      return;
    }

    addEvidence(stem, 'day', true);
  });

  const formationSummary = collectEstablishedBranchFormations(pillars).reduce(
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
    samePartyDirectCount,
    oppositePartyDirectCount,
    samePartyResidualPositions,
    oppositePartyResidualPositions,
    hasSamePartyFormation: formationSummary.hasSamePartyFormation,
    hasOppositePartyFormation: formationSummary.hasOppositePartyFormation,
  };
}

function resolveExposedStemPriority(
  monthStems: string[],
  pillars: Pillars,
  dayMaster: string,
  getTenGod: GetTenGodFn,
): string | null {
  const exposedStemByPosition: Array<{ position: PillarPosition; stem: string }> = [
    { position: 'year', stem: pillars.year.gan },
    { position: 'month', stem: pillars.month.gan },
    { position: 'hour', stem: pillars.hour.gan },
  ];
  const positionRank: Record<PillarPosition, number> = {
    month: 0,
    hour: 1,
    year: 2,
  };

  const candidates = monthStems
    .filter((stem) => {
      const tenGod = getTenGod(stem, dayMaster);
      return !isSamePartyGod(tenGod) && exposedStemByPosition.some((item) => item.stem === stem);
    })
    .map((stem, stemIndex) => {
      const exposures = exposedStemByPosition.filter((item) => item.stem === stem);
      const bestPositionRank = Math.min(...exposures.map((item) => positionRank[item.position]));

      return {
        stem,
        stemIndex,
        exposureCount: exposures.length,
        bestPositionRank,
      };
    });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    // 本气/中气/余气层次优先（《子平真诠》本气透干优先取格）
    if (left.stemIndex !== right.stemIndex) {
      return left.stemIndex - right.stemIndex;
    }
    // 层次相同时透干次数多者优先
    if (left.exposureCount !== right.exposureCount) {
      return right.exposureCount - left.exposureCount;
    }
    // 再按透干柱位（月干 > 时干 > 年干）
    return left.bestPositionRank - right.bestPositionRank;
  });

  return candidates[0].stem;
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
    (specialPatternForce.oppositePartyDirectCount === 0 ||
      (specialPatternForce.hasSamePartyFormation &&
        specialPatternForce.oppositePartyDirectCount <= 1)) &&
    (specialPatternForce.oppositePartyResidualPositions.size <= 1 ||
      specialPatternForce.hasSamePartyFormation);
  const canTreatAsSpecialWeak =
    (specialPatternForce.samePartyDirectCount === 0 ||
      (specialPatternForce.hasOppositePartyFormation &&
        specialPatternForce.samePartyDirectCount <= 1)) &&
    (specialPatternForce.samePartyResidualPositions.size <= 1 ||
      specialPatternForce.hasOppositePartyFormation);

  if (
    strengthStatus === '极强' &&
    commanderSupportsSameParty &&
    (isPureSameParty || canTreatAsSpecialStrong)
  ) {
    const basis = specialPatternForce.hasSamePartyFormation
      ? '主气与会局同党成势，副气未至破格，且日主极强，按专旺格处理'
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
      ? `主气与会局异党成势，同党余气未至破格，且日主极弱，按${subPattern}处理`
      : `全局财官食伤成势，且日主极弱，按${subPattern}处理`;
    return { pattern: subPattern, isSpecial: true, basis };
  }

  const monthPrincipalStem = monthStems[0];
  const monthPrincipalGod = getTenGod(monthPrincipalStem, dayMaster);
  const activeMonthStem = monthCommander || monthStems[0];
  const monthMainGod = getTenGod(activeMonthStem, dayMaster);
  let basis: string;

  if (LU_BRANCH_MAP[dayMaster] === monthBranch) {
    patternName = '建禄格';
    basis = `月令${monthBranch}为日主${dayMaster}之禄位，按建禄格处理`;
  } else if (REN_BRANCH_MAP[dayMaster] === monthBranch) {
    patternName = '月刃格';
    basis = `月令${monthBranch}为日主${dayMaster}之羊刃位，按月刃格处理`;
  } else if (monthPrincipalGod === '劫财') {
    if (REN_BRANCH_MAP[dayMaster]) {
      patternName = '劫财格';
      basis = `月令本气为${monthPrincipalStem}，对应劫财，但月支${monthBranch}非${dayMaster}刃位（刃在${REN_BRANCH_MAP[dayMaster]}），按劫财格处理`;
    } else {
      patternName = '劫财格';
      basis = `月令本气为${monthPrincipalStem}，对应劫财，日主${dayMaster}为阴干无真刃，按劫财格处理`;
    }
  } else if (monthCommander && exposedStems.includes(monthCommander)) {
    patternName = getPatternNameByTenGod(monthMainGod, dayMaster, monthBranch);
    basis = `月令司权为${monthCommander}，且已透干，按司令十神取格`;
  } else if (monthMainGod === '比肩') {
    // 月令主气虽为比肩，但月支非禄位（如杂气中比肩透出），按普通比肩格处理
    patternName = '比肩格';
    basis = `月令主气为${activeMonthStem}，对应比肩，但月支${monthBranch}非${dayMaster}禄位，按比肩格处理`;
  } else if (monthMainGod === '劫财') {
    // 阳干但月支非刃位，或阴干，一律按劫财格处理
    patternName = '劫财格';
    if (REN_BRANCH_MAP[dayMaster] && REN_BRANCH_MAP[dayMaster] !== monthBranch) {
      basis = `月令主气为${activeMonthStem}，对应劫财，但月支${monthBranch}非${dayMaster}刃位（刃在${REN_BRANCH_MAP[dayMaster]}），按劫财格处理`;
    } else {
      basis = `月令主气为${activeMonthStem}，对应劫财，日主${dayMaster}为阴干无真刃，按劫财格处理`;
    }
  } else {
    const prioritizedStem = resolveExposedStemPriority(monthStems, pillars, dayMaster, getTenGod);

    if (prioritizedStem) {
      const tenGod = getTenGod(prioritizedStem, dayMaster);
      const prefix = monthCommander && prioritizedStem !== activeMonthStem ? '杂气' : '';
      patternName = `${prefix}${tenGod}格`;
      const exposedPosition =
        pillars.month.gan === prioritizedStem
          ? '月干'
          : pillars.hour.gan === prioritizedStem
            ? '时干'
            : '年干';
      basis = `${prioritizedStem}为月令藏干，透于${exposedPosition}，按透干优先取格`;
    } else {
      patternName = getPatternNameByTenGod(monthMainGod, dayMaster, monthBranch);
      basis = `月令主气为${activeMonthStem}，未见更优透干，按月令本气取格`;
    }
  }

  return {
    pattern: patternName || '杂气格',
    isSpecial: false,
    basis,
    // 魁罡日（庚辰/壬辰/戊戌/庚戌）为重要外格，日柱判定后即标出，供 AI 参照《三命通会》
    isKuiGang: ['庚辰', '壬辰', '戊戌', '庚戌'].includes(pillars.day.gan + pillars.day.zhi),
  };
}
