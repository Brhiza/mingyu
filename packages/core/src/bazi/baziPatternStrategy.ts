import { HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  getRepresentativeStemByWuxing,
} from './baziFormationUtils';
import type { PatternAnalysis, Pillars } from './baziTypes';
import { assertHeavenlyStem, assertPillars } from './baziUtils';

type GetTenGodFn = (gan: string, dayMaster: string) => string;
type PillarPosition = 'year' | 'month' | 'hour';
type HiddenStemPosition = keyof Pillars;

interface SpecialPatternForceSummary {
  samePartyForce: number;
  oppositePartyForce: number;
  samePartyResidualPositions: Set<HiddenStemPosition>;
  oppositePartyResidualPositions: Set<HiddenStemPosition>;
  hasSamePartyFormation: boolean;
  hasOppositePartyFormation: boolean;
}

const SAME_PARTY_GODS = ['比肩', '劫财', '正印', '偏印'];

function isSamePartyGod(tenGod: string) {
  return SAME_PARTY_GODS.includes(tenGod);
}

function getPatternNameByTenGod(tenGod: string, dayMaster?: string, monthBranch?: string) {
  // 建禄格/月刃格需要精确校验月支是否为禄/刃位
  if (tenGod === '比肩' && dayMaster && monthBranch) {
    if (LU_BRANCH_MAP[dayMaster] === monthBranch) {
      return '建禄格';
    }
    return '比肩格';
  }
  if (tenGod === '劫财' && dayMaster && monthBranch) {
    if (REN_BRANCH_MAP[dayMaster] === monthBranch) {
      return '月刃格';
    }
    return '劫财格';
  }
  // 降级：无月支信息时保留原逻辑
  const specialPatternMap: Record<string, string> = {
    比肩: '建禄格',
    劫财: '月刃格',
  };

  return specialPatternMap[tenGod] || `${tenGod}格`;
}

function isSamePartyTenGod(tenGod: string): boolean {
  return SAME_PARTY_GODS.includes(tenGod);
}

function collectSpecialPatternForce(
  pillars: Pillars,
  dayMaster: string,
  getTenGod: GetTenGodFn,
): SpecialPatternForceSummary {
  let samePartyForce = 0;
  let oppositePartyForce = 0;
  const samePartyResidualPositions = new Set<HiddenStemPosition>();
  const oppositePartyResidualPositions = new Set<HiddenStemPosition>();

  const addForce = (
    stem: string,
    force: number,
    position?: HiddenStemPosition,
    isResidual = false,
  ) => {
    const tenGod = getTenGod(stem, dayMaster);
    if (isSamePartyTenGod(tenGod)) {
      samePartyForce += force;
      if (isResidual && position) {
        samePartyResidualPositions.add(position);
      }
      return;
    }

    oppositePartyForce += force;
    if (isResidual && position) {
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
    addForce(pillar.gan, position === 'month' ? 2.2 : 1.8);
    const hiddenStems = HIDDEN_STEMS[pillar.zhi] || [];
    hiddenStems.forEach((stem, index) => {
      if (index === 0) {
        addForce(stem, position === 'month' ? 2.6 : 2.1);
        return;
      }

      addForce(stem, 0.6, position, true);
    });
  });

  const dayHiddenStems = HIDDEN_STEMS[pillars.day.zhi] || [];
  dayHiddenStems.forEach((stem, index) => {
    if (index === 0) {
      addForce(stem, 2.4);
      return;
    }

    addForce(stem, 0.6, 'day', true);
  });

  const formationForce = collectCompleteBranchFormations(pillars).reduce(
    (summary, formation) => {
      const representativeStem = getRepresentativeStemByWuxing(formation.wuxing);
      const tenGod = getTenGod(representativeStem, dayMaster);
      if (isSamePartyTenGod(tenGod)) {
        return {
          ...summary,
          samePartyForce: summary.samePartyForce + 3.2,
          hasSamePartyFormation: true,
        };
      }

      return {
        ...summary,
        oppositePartyForce: summary.oppositePartyForce + 3.2,
        hasOppositePartyFormation: true,
      };
    },
    {
      samePartyForce,
      oppositePartyForce,
      hasSamePartyFormation: false,
      hasOppositePartyFormation: false,
    },
  );

  return {
    samePartyForce: Number(formationForce.samePartyForce.toFixed(1)),
    oppositePartyForce: Number(formationForce.oppositePartyForce.toFixed(1)),
    samePartyResidualPositions,
    oppositePartyResidualPositions,
    hasSamePartyFormation: formationForce.hasSamePartyFormation,
    hasOppositePartyFormation: formationForce.hasOppositePartyFormation,
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
 * 从格细分：根据异党（对立面）中力量最强的十神类别判断从财/从杀/从儿
 * - 财星（正财/偏财）最旺 → 从财格
 * - 官杀（正官/七杀）最旺 → 从杀格
 * - 食伤（食神/伤官）最旺 → 从儿格
 * - 多种势均力敌 → 从势格
 */
function resolveSubPattern(pillars: Pillars, dayMaster: string, getTenGod: GetTenGodFn): string {
  const categoryForce: Record<string, number> = { wealth: 0, officer: 0, output: 0 };

  const addOppositeForce = (stem: string, force: number) => {
    const tenGod = getTenGod(stem, dayMaster);
    const category = TEN_GOD_TO_SUB_PATTERN[tenGod];
    if (category) {
      categoryForce[category] += force;
    }
  };

  // 统计四柱天干和地支藏干中异党力量
  (['year', 'month', 'hour'] as const).forEach((position) => {
    const pillar = pillars[position];
    const stemForce = position === 'month' ? 2.2 : 1.8;
    addOppositeForce(pillar.gan, stemForce);
    const hiddenStems = HIDDEN_STEMS[pillar.zhi] || [];
    hiddenStems.forEach((stem, index) => {
      addOppositeForce(stem, index === 0 ? (position === 'month' ? 2.6 : 2.1) : 0.6);
    });
  });

  // 日支藏干
  const dayHiddenStems = HIDDEN_STEMS[pillars.day.zhi] || [];
  dayHiddenStems.forEach((stem, index) => {
    addOppositeForce(stem, index === 0 ? 2.4 : 0.6);
  });

  // 三合三会局加成
  const formations = collectCompleteBranchFormations(pillars);
  formations.forEach((formation) => {
    const representativeStem = getRepresentativeStemByWuxing(formation.wuxing);
    const tenGod = getTenGod(representativeStem, dayMaster);
    const category = TEN_GOD_TO_SUB_PATTERN[tenGod];
    if (category) {
      categoryForce[category] += 3.2;
    }
  });

  // 判断哪种力量最强
  const maxForce = Math.max(categoryForce.wealth, categoryForce.officer, categoryForce.output);
  if (maxForce === 0) return '从势格';

  // 如果多种力量接近（差距不超过30%），归为从势格
  const threshold = maxForce * 0.7;
  const dominantCategories: string[] = [];
  if (categoryForce.wealth >= threshold) dominantCategories.push('财');
  if (categoryForce.officer >= threshold) dominantCategories.push('杀');
  if (categoryForce.output >= threshold) dominantCategories.push('儿');

  if (dominantCategories.length > 1) {
    return '从势格';
  }

  // 返回力量最强的类别对应的从格名称
  for (const [category, force] of Object.entries(categoryForce)) {
    if (force === maxForce && SUB_PATTERN_CATEGORY_TO_LABEL[category]) {
      return SUB_PATTERN_CATEGORY_TO_LABEL[category];
    }
  }

  return '从势格';
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
    specialPatternForce.samePartyForce >= 10 &&
    specialPatternForce.samePartyForce >= specialPatternForce.oppositePartyForce * 2 &&
    (specialPatternForce.oppositePartyResidualPositions.size <= 1 ||
      specialPatternForce.hasSamePartyFormation);
  const canTreatAsSpecialWeak =
    specialPatternForce.oppositePartyForce >= 10 &&
    specialPatternForce.oppositePartyForce >= specialPatternForce.samePartyForce * 2 &&
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
    // 从格细分：根据异党中最强势的十神类别判断从财/从杀/从儿
    const subPattern = resolveSubPattern(pillars, dayMaster, getTenGod);
    const basis = specialPatternForce.hasOppositePartyFormation
      ? `主气与会局异党成势，同党余气未至破格，且日主极弱，按${subPattern}处理`
      : `全局财官食伤成势，且日主极弱，按${subPattern}处理`;
    return { pattern: subPattern, isSpecial: true, basis };
  }

  const activeMonthStem =
    monthCommander && monthStems.includes(monthCommander) ? monthCommander : monthStems[0];
  const monthMainGod = getTenGod(activeMonthStem, dayMaster);
  let basis: string;

  if (monthCommander && exposedStems.includes(monthCommander)) {
    patternName = getPatternNameByTenGod(monthMainGod, dayMaster, monthBranch);
    basis = `月令司权为${monthCommander}，且已透干，按司令十神取格`;
  } else if (monthMainGod === '比肩' && LU_BRANCH_MAP[dayMaster] === monthBranch) {
    // 建禄格：月支必须确实是日干的临官禄位
    patternName = '建禄格';
    basis = `月令${monthBranch}为日主${dayMaster}之禄位，按建禄格处理`;
  } else if (monthMainGod === '比肩') {
    // 月令主气虽为比肩，但月支非禄位（如杂气中比肩透出），按普通比肩格处理
    patternName = '比肩格';
    basis = `月令主气为${activeMonthStem}，对应比肩，但月支${monthBranch}非${dayMaster}禄位，按比肩格处理`;
  } else if (monthMainGod === '劫财' && REN_BRANCH_MAP[dayMaster] === monthBranch) {
    // 月刃格：月支必须确实是阳干的帝旺羊刃位
    patternName = '月刃格';
    basis = `月令${monthBranch}为日主${dayMaster}之羊刃位，按月刃格处理`;
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
