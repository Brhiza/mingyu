import { HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
  getRepresentativeStemByWuxing,
  type CompleteBranchFormation,
} from './baziFormationUtils';
import { canUseExternalPattern } from './baziExternalPatternEligibility';
import { getStemWuxing, getWuxingTenGodCategory } from './baziRuleMatcher/helpers';
import type { PatternAnalysis, Pillars, Wuxing } from './baziTypes';
import { assertHeavenlyStem, assertPillars } from './baziUtils';
import {
  LIUCHONG_MAP,
  isKe,
  isLiuchong,
  isLiuhai,
  isLiupo,
  isSanxing,
  isTianGanHe,
} from '../ganzhi/relations';

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

const LU_REN_RELATED_EXPOSED_GODS = new Set([
  '正财',
  '偏财',
  '正官',
  '七杀',
  '食神',
  '伤官',
  '正印',
  '偏印',
]);

function buildLuRenFormationBasis(
  pillars: Pillars,
  dayMaster: string,
  monthBranch: string,
  patternName: '建禄格' | '月刃格',
  formations: CompleteBranchFormation[],
  getTenGod: GetTenGodFn,
  commanderFact: string,
): string {
  const positionLabels = {
    year: '年干',
    month: '月干',
    hour: '时干',
  } as const;
  const exposedUseFacts = (['year', 'month', 'hour'] as const).flatMap((position) => {
    const stem = pillars[position].gan;
    const tenGod = getTenGod(stem, dayMaster);
    return LU_REN_RELATED_EXPOSED_GODS.has(tenGod)
      ? [`${positionLabels[position]}${stem}（${tenGod}）`]
      : [];
  });
  const formationUses = formations.map(
    (formation) =>
      `月支${monthBranch}参与地支${formation.branches.join('')}完整${formation.type}${formation.wuxing}结构（${getFormationUseLabel(formation.wuxing, dayMaster)}）`,
  );
  const exposedFact = exposedUseFacts.length
    ? `；另见${exposedUseFacts.join('、')}明透，均作为格外取用相关事实`
    : '';
  const ruleBoundary =
    patternName === '建禄格'
      ? '《子平真诠》称建禄月劫须从四柱财官煞食“透干会支，另取用神”'
      : '《子平真诠》称阳刃喜官杀制伏，并须合看财印、伤食配合';
  const changeBoundary = patternName === '建禄格' ? '化劫' : '化刃';

  return `月令${monthBranch}为日主${dayMaster}之${patternName === '建禄格' ? '禄位' : '羊刃位'}，月令底格仍按${patternName}处理；${formationUses.join('；')}${exposedFact}；${ruleBoundary}，故不能只报固定格名而漏掉格外取用；当前只记录完整会支及相关明透，不据三支齐全直接宣称已经合化、${changeBoundary}、成格或破格${commanderFact}`;
}

/**
 * 只复算《子平真诠》“杂气如何取用”逐条明举的透干、会支关系。
 * 这里记录局部有情、无情及转化，不把单层生克泛化成通用成败规则。
 */
function collectExplicitUseRelationshipNotes(
  pillars: Pillars,
  formations: CompleteBranchFormation[],
): string[] {
  const dayMaster = pillars.day.gan;
  const monthBranch = pillars.month.zhi;
  const visibleStems = new Set([pillars.year.gan, pillars.month.gan, pillars.hour.gan]);
  const branches = new Set(Object.values(pillars).map((pillar) => pillar.zhi));
  const hasVisibleStems = (...stems: string[]) => stems.every((stem) => visibleStems.has(stem));
  const hasFormation = (wuxing: Wuxing) =>
    formations.some((formation) => formation.wuxing === wuxing);
  const notes: string[] = [];

  if (dayMaster === '丙' && monthBranch === '辰' && hasVisibleStems('癸', '乙')) {
    notes.push('丙日辰月癸官与乙印同透，官印相生且乙制辰中戊土，原典列为“合而有情”');
  }

  if (
    dayMaster === '甲' &&
    monthBranch === '丑' &&
    visibleStems.has('己') &&
    (visibleStems.has('辛') || hasFormation('金'))
  ) {
    notes.push(
      visibleStems.has('辛')
        ? '甲日丑月己财与辛官同透，财能生官，原典列为“合而有情”'
        : '甲日丑月己财透出且巳酉丑会金官，财能生官，原典列为“合而有情”',
    );
  }

  if (dayMaster === '壬' && monthBranch === '未' && visibleStems.has('己') && hasFormation('木')) {
    notes.push('壬日未月己官透出而亥卯未会木伤官，官与伤官相背，原典列为“合而无情”');
  }

  if (dayMaster === '甲' && monthBranch === '辰' && hasVisibleStems('戊', '癸')) {
    notes.push('甲日辰月戊财与癸印同透，戊癸相合使财印两失，原典列为“合而无情”');
  }

  if (dayMaster === '甲' && monthBranch === '辰' && hasVisibleStems('戊', '壬')) {
    notes.push('甲日辰月戊财与壬印同透，财印相克而贪财坏印，原典列为“合而无情”');
  }

  if (dayMaster === '甲' && monthBranch === '辰' && hasVisibleStems('壬', '丙')) {
    notes.push(
      hasFormation('水')
        ? '甲日辰月壬印与丙食同透且申子辰会水扶印，原典说明丙食不再碍印，局部关系仍有情'
        : '甲日辰月壬印与丙食同透而未会申子水局，丙火反生辰中戊土使印格不清，原典列为“有情而卒成无情”',
    );
  }

  if (
    dayMaster === '甲' &&
    monthBranch === '辰' &&
    visibleStems.has('壬') &&
    !visibleStems.has('丙') &&
    branches.has('戌')
  ) {
    notes.push(
      '甲日辰月壬印透出、不露丙而又见戌冲辰，月令土动使壬印难通月令，原典列为“有情而卒成无情”',
    );
  }

  if (dayMaster === '癸' && monthBranch === '辰' && visibleStems.has('戊') && hasFormation('水')) {
    notes.push('癸日辰月戊官透出而申子辰会水劫，官制月劫正合所用，原典列为“无情而终为有情”');
  }

  if (dayMaster === '丙' && monthBranch === '辰' && hasVisibleStems('戊', '壬')) {
    notes.push('丙日辰月戊食与壬杀同透，食神制杀各得其用，原典列为“无情而终为有情”');
  }

  return notes;
}

/**
 * 只复算《子平真诠》“论墓库刑冲之说”逐条明举的四墓相冲关系。
 * 刑冲只作为局部事实，不据此宣称开库、出库、自动成格或直接判定最终成败。
 */
function collectTombClashNotes(pillars: Pillars): string[] {
  const dayMaster = pillars.day.gan;
  const monthBranch = pillars.month.zhi;
  const oppositeBranch = LIUCHONG_MAP[monthBranch];
  const branches = new Set(Object.values(pillars).map((pillar) => pillar.zhi));
  const visibleStems = new Set([pillars.year.gan, pillars.month.gan, pillars.hour.gan]);

  if (!['辰', '戌', '丑', '未'].includes(monthBranch) || !branches.has(oppositeBranch)) {
    return [];
  }

  const notes = [
    `月令${monthBranch}与${oppositeBranch}相冲；《子平真诠》称“四墓不忌刑冲，刑冲未必成格”，当前只记录墓支冲动，不据此宣称开库、出库或自动成格，仍以透干、会支取清用`,
  ];

  if (dayMaster === '甲' && monthBranch === '辰') {
    if (visibleStems.has('戊')) {
      notes.push('甲日辰月戊财已透为干头清用，辰戌冲不是取财的必要条件');
    } else {
      notes.push('甲日辰月戊财未透，仅见辰戌冲仍不能据此取为清财格');
    }
    if (visibleStems.has('壬')) {
      notes.push('甲日辰月壬印透出又遇辰戌冲，原典称冲动月令土而累印，不得解释为冲开印库');
    }
  }

  if (dayMaster === '壬' && monthBranch === '丑' && visibleStems.has('己')) {
    notes.push('壬日丑月己官已透为干头清用，丑未冲不是取官的必要条件');
  }

  if (dayMaster === '己' && monthBranch === '辰' && visibleStems.has('壬')) {
    notes.push('己日辰月壬财透出又遇戌冲，戌中土劫随冲而动，对水财无益');
  }

  if (dayMaster === '丁' && monthBranch === '辰' && visibleStems.has('壬')) {
    notes.push('丁日辰月壬官透出又遇戌冲，戌中戊土伤官随冲而动，对壬官有害');
  }

  if (dayMaster === '癸' && monthBranch === '辰' && visibleStems.has('戊')) {
    notes.push('癸日辰月戊官已透，辰戌冲只作四墓冲动，不据此单独判定破格');
  }

  return notes;
}

type ExposedStemPosition = 'year' | 'month' | 'hour';

interface ExposedStemFact {
  position: ExposedStemPosition;
  columnIndex: number;
  label: string;
  stem: string;
  tenGod: string;
}

const EXPOSED_STEM_POSITIONS: Array<{
  position: ExposedStemPosition;
  columnIndex: number;
  label: string;
}> = [
  { position: 'year', columnIndex: 0, label: '年干' },
  { position: 'month', columnIndex: 1, label: '月干' },
  { position: 'hour', columnIndex: 3, label: '时干' },
];

function collectExposedStemFacts(pillars: Pillars, getTenGod: GetTenGodFn): ExposedStemFact[] {
  const dayMaster = pillars.day.gan;
  return EXPOSED_STEM_POSITIONS.map(({ position, columnIndex, label }) => {
    const stem = pillars[position].gan;
    return {
      position,
      columnIndex,
      label,
      stem,
      tenGod: getTenGod(stem, dayMaster),
    };
  });
}

function areAdjacentStemColumns(left: ExposedStemFact, right: ExposedStemFact): boolean {
  return Math.abs(left.columnIndex - right.columnIndex) === 1;
}

/**
 * 只复算《子平真诠》“论正官”中可以由四柱客观闭合的刑冲破害、财印位置、
 * 遇伤佩印、官杀取清与财印伤官救应。这里只记录局部结构，不据此改格或判贵。
 */
function collectOfficerPatternNotes(
  pillars: Pillars,
  patternName: string,
  formations: CompleteBranchFormation[],
  getTenGod: GetTenGodFn,
): string[] {
  const exactFanTaifuExample =
    pillars.year.ganZhi === '丁丑' &&
    pillars.month.ganZhi === '壬寅' &&
    pillars.day.ganZhi === '己巳' &&
    pillars.hour.ganZhi === '丙寅';
  const exactXuanCanguoExample =
    pillars.year.ganZhi === '己卯' &&
    pillars.month.ganZhi === '辛未' &&
    pillars.day.ganZhi === '壬寅' &&
    pillars.hour.ganZhi === '辛亥';
  const notes: string[] = [];

  // 两个原例会因“透而又会”或“一透则一用”保留其他格名，仍须保存正官章的精确关系。
  if (exactXuanCanguoExample) {
    notes.push(
      '原典宣参国精确例型己卯、辛未、壬寅、辛亥，未中己官透干且亥卯未完整三合木局成伤官结构，两辛印明透制伤；只记录“遇伤佩印”的局部救应，不覆盖透干会支并用的格名边界',
    );
  }

  if (exactFanTaifuExample) {
    notes.push(
      '原典范太傅精确例型丁丑、壬寅、己巳、丙寅，巳丑拱金为伤官结构而丙丁双印明透；丁壬五合与另一丙印制伤分工并存，只作为财、印、伤同见时的特殊救应，不泛化为官格逢财皆有救',
    );
  }

  if (!isNamedPattern(patternName, ['正官'])) return notes;

  const dayMaster = pillars.day.gan;
  const exposedFacts = collectExposedStemFacts(pillars, getTenGod);
  const positionLabels = { year: '年支', day: '日支', hour: '时支' } as const;
  const branchRelations: string[] = [];

  (['year', 'day', 'hour'] as const).forEach((position) => {
    const branch = pillars[position].zhi;
    const relations = [
      ...(isSanxing(pillars.month.zhi, branch) ? ['相刑'] : []),
      ...(isLiuchong(pillars.month.zhi, branch) ? ['相冲'] : []),
      ...(isLiupo(pillars.month.zhi, branch) ? ['相破'] : []),
      ...(isLiuhai(pillars.month.zhi, branch) ? ['相害'] : []),
    ];
    if (relations.length > 0) {
      branchRelations.push(
        `${positionLabels[position]}${branch}与月令${pillars.month.zhi}${relations.join('、')}`,
      );
    }
  });
  if (branchRelations.length > 0) {
    notes.push(
      `${branchRelations.join('；')}；原典以正官月令受刑冲破害为局部带忌，但单项关系不直接等同于破格`,
    );
  }

  const wealthFacts = exposedFacts.filter((fact) => ['正财', '偏财'].includes(fact.tenGod));
  const resourceFacts = exposedFacts.filter((fact) => ['正印', '偏印'].includes(fact.tenGod));
  if (wealthFacts.length > 0 && resourceFacts.length > 0) {
    const pairs = wealthFacts.flatMap((wealth) =>
      resourceFacts.map((resource) => ({ wealth, resource })),
    );
    const combinedPairs = pairs.filter(
      ({ wealth, resource }) =>
        areAdjacentStemColumns(wealth, resource) && isTianGanHe(wealth.stem, resource.stem),
    );
    const controllingPairs = pairs.filter(
      ({ wealth, resource }) =>
        areAdjacentStemColumns(wealth, resource) &&
        !isTianGanHe(wealth.stem, resource.stem) &&
        isKe(getStemWuxing(wealth.stem), getStemWuxing(resource.stem)),
    );

    if (combinedPairs.length > 0) {
      notes.push(
        `财印并透，其中${combinedPairs
          .map(
            ({ wealth, resource }) =>
              `${wealth.label}${wealth.stem}（${wealth.tenGod}）与${resource.label}${resource.stem}（${resource.tenGod}）相邻五合`,
          )
          .join('、')}；属于财印直接相合的相碍事实，不能仍按财印互不相碍解释`,
      );
    }
    if (controllingPairs.length > 0) {
      notes.push(
        `财印并透，其中${controllingPairs
          .map(
            ({ wealth, resource }) =>
              `${wealth.label}${wealth.stem}（${wealth.tenGod}）与${resource.label}${resource.stem}（${resource.tenGod}）相邻，财五行直接克印五行`,
          )
          .join('、')}；属于财印直接相碍的局部冲突`,
      );
    }
    if (combinedPairs.length === 0 && controllingPairs.length === 0) {
      notes.push(
        `财印并透，但${wealthFacts.map((fact) => `${fact.label}${fact.stem}（${fact.tenGod}）`).join('、')}与${resourceFacts.map((fact) => `${fact.label}${fact.stem}（${fact.tenGod}）`).join('、')}均有其他柱干隔开，未见相邻五合或财直接克印；只记录原典“财印不相碍”的柱位候选`,
      );
    }
  }

  const hurtFacts = exposedFacts.filter((fact) => fact.tenGod === '伤官');
  const hurtFormations = formations.filter(
    (formation) => getTenGod(getRepresentativeStemByWuxing(formation.wuxing), dayMaster) === '伤官',
  );
  if ((hurtFacts.length > 0 || hurtFormations.length > 0) && resourceFacts.length > 0) {
    const hurtSources = [
      ...hurtFacts.map((fact) => `${fact.label}${fact.stem}伤官明透`),
      ...hurtFormations.map(
        (formation) =>
          `${formation.branches.join('')}完整${formation.type}${formation.wuxing}局成伤官结构`,
      ),
    ];
    notes.push(
      `${hurtSources.join('、')}，同时${resourceFacts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、')}明透；印克伤官五行，构成“遇伤佩印”的局部救应候选`,
    );
  }

  const killerFacts = exposedFacts.filter((fact) => fact.tenGod === '七杀');
  if (killerFacts.length > 0) {
    const combinedKillerFacts = killerFacts.flatMap((killer) => {
      const partner = exposedFacts.find(
        (fact) =>
          fact.position !== killer.position &&
          areAdjacentStemColumns(killer, fact) &&
          isTianGanHe(killer.stem, fact.stem),
      );
      return partner ? [{ killer, partner }] : [];
    });

    if (combinedKillerFacts.length === killerFacts.length) {
      notes.push(
        `正官格又见${combinedKillerFacts
          .map(
            ({ killer, partner }) =>
              `${killer.label}${killer.stem}七杀与${partner.label}${partner.stem}（${partner.tenGod}）相邻五合`,
          )
          .join('、')}；构成“合杀留官”的局部取清候选，五合事实本身不证明已经合化或最终取清`,
      );
    } else {
      const combinedBoundary = combinedKillerFacts.length
        ? `；虽有${combinedKillerFacts.map(({ killer }) => `${killer.label}${killer.stem}`).join('、')}见相邻五合，仍有其他七杀未合`
        : '';
      notes.push(`正官格又见七杀明透，形成官杀混杂待复核${combinedBoundary}`);
    }
  }

  if (hurtFacts.length > 0 && resourceFacts.length > 0 && wealthFacts.length > 0) {
    notes.push(
      '正官格见伤官、印星、财星同时明透；原典以财去印而护伤为一般带忌条件，须另查合财与是否尚有另一印星制伤，不能仅凭见印视为救应已经闭合',
    );
  }

  return notes;
}

function isNamedPattern(patternName: string, names: string[]): boolean {
  return names.some(
    (name) =>
      patternName === `${name}格` || patternName === `杂气${name}格` || patternName === name,
  );
}

type ExposedGodOrder = 'left-before-right' | 'right-before-left' | 'interleaved';

function getExposedGodOrder(
  pillars: Pillars,
  getTenGod: GetTenGodFn,
  leftGods: string[],
  rightGods: string[],
): ExposedGodOrder | undefined {
  const dayMaster = pillars.day.gan;
  const positions = ['year', 'month', 'hour'] as const;
  const leftPositions = positions.flatMap((position, index) =>
    leftGods.includes(getTenGod(pillars[position].gan, dayMaster)) ? [index] : [],
  );
  const rightPositions = positions.flatMap((position, index) =>
    rightGods.includes(getTenGod(pillars[position].gan, dayMaster)) ? [index] : [],
  );

  if (leftPositions.length === 0 || rightPositions.length === 0) return undefined;
  if (Math.max(...leftPositions) < Math.min(...rightPositions)) return 'left-before-right';
  if (Math.max(...rightPositions) < Math.min(...leftPositions)) return 'right-before-left';
  return 'interleaved';
}

/**
 * 只复算《子平真诠》“论生克先后分吉凶”明举的外干先后与三个精确隔位例型。
 * 同类重复而位置交错时不强定先后；原文的富贵、寿夭、子嗣等强断不进入算法。
 */
function collectGenerationOrderNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const notes: string[] = [];

  if (isNamedPattern(patternName, ['正官'])) {
    const order = getExposedGodOrder(pillars, getTenGod, ['伤官'], ['正财', '偏财']);
    if (order === 'left-before-right') {
      notes.push('正官格所见伤官全部先于财星明透，后财可作解伤护官的局部制化');
    } else if (order === 'right-before-left') {
      notes.push('正官格所见财星全部先于伤官明透，后伤仍构成损官的局部因素');
    }
  }

  if (isNamedPattern(patternName, ['正印', '偏印', '印'])) {
    const order = getExposedGodOrder(pillars, getTenGod, ['正财', '偏财'], ['正印', '偏印']);
    if (order === 'left-before-right') {
      notes.push('印格所见财星全部先于印星明透，后印承接月令用神，财印冲突须按此先后复核');
    } else if (order === 'right-before-left') {
      notes.push('印格所见印星全部先于财星明透，后财构成坏印的局部因素');
    }
  }

  if (isNamedPattern(patternName, ['食神'])) {
    const order = getExposedGodOrder(pillars, getTenGod, ['偏印'], ['正财', '偏财']);
    if (order === 'left-before-right') {
      notes.push('食神格所见偏印全部先于财星明透，后财可作制枭护食的局部制化');
    } else if (order === 'right-before-left') {
      notes.push('食神格所见财星全部先于偏印明透，后枭仍构成夺食的局部因素');
    }
  }

  if (isNamedPattern(patternName, ['七杀'])) {
    const order = getExposedGodOrder(pillars, getTenGod, ['正财', '偏财'], ['食神']);
    if (order === 'left-before-right') {
      notes.push('七杀格所见财星全部先于食神明透，后食可作制杀的局部制化');
    } else if (order === 'right-before-left') {
      notes.push('七杀格所见食神全部先于财星明透，后财仍有泄食生杀的局部影响');
    }
  }

  if (
    pillars.day.gan === '丙' &&
    pillars.month.ganZhi === '甲寅' &&
    pillars.year.gan === '癸' &&
    pillars.hour.gan === '戊'
  ) {
    notes.push('丙日甲寅月年癸时戊，月干甲隔于癸官、戊食之间，只记录戊不越甲合癸的原典隔位关系');
  }

  if (
    pillars.day.gan === '丙' &&
    pillars.month.ganZhi === '辛酉' &&
    pillars.year.gan === '癸' &&
    pillars.hour.gan === '己'
  ) {
    notes.push('丙日辛酉月年癸时己，月干辛财隔于癸官、己伤之间，只记录财间伤官的原典隔位关系');
  }

  if (
    pillars.day.gan === '辛' &&
    pillars.month.zhi === '申' &&
    pillars.year.gan === '壬' &&
    pillars.month.gan === '戊' &&
    pillars.hour.gan === '丙'
  ) {
    notes.push('辛日申月年壬月戊时丙，月干戊印隔于壬伤、丙官之间，只记录印隔伤官的原典隔位关系');
  }

  return notes;
}

/**
 * 只复算《子平真诠》“论四吉神能破格”中月令用神已经明确、冲突十神又明透的关系。
 * 这里只记录原典所称带忌或破格因素，强弱、位置、先后与救应仍须另行复核。
 */
function collectAuspiciousBreakingNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const dayMaster = pillars.day.gan;
  const visibleGods = new Set(
    [pillars.year.gan, pillars.month.gan, pillars.hour.gan].map((stem) =>
      getTenGod(stem, dayMaster),
    ),
  );
  const visibleAmong = (...gods: string[]) => gods.filter((god) => visibleGods.has(god));
  const usesOfficer = isNamedPattern(patternName, ['正官']);
  const usesWealth = isNamedPattern(patternName, ['正财', '偏财', '财']);
  const usesResource = isNamedPattern(patternName, ['正印', '偏印', '印']);
  const usesFood = isNamedPattern(patternName, ['食神']);
  const usesKiller = isNamedPattern(patternName, ['七杀']);
  const notes: string[] = [];

  const visibleOutputs = visibleAmong('食神', '伤官');
  if (usesOfficer && visibleOutputs.length > 0) {
    notes.push(
      `正官为当前月令所用，又见${visibleOutputs.join('、')}明透；原典提醒“官忌食伤”，须继续核对财印、合伤等救应`,
    );
  }

  const visiblePeers = visibleAmong('比肩', '劫财');
  if (usesWealth && visiblePeers.length > 0) {
    notes.push(
      `财星为当前月令所用，又见${visiblePeers.join('、')}明透；原典提醒“财畏比劫”，须继续核对财之轻重及食官等救应`,
    );
  }

  const visibleWealth = visibleAmong('正财', '偏财');
  if (usesResource && visibleWealth.length > 0) {
    notes.push(
      `印星为当前月令所用，又见${visibleWealth.join('、')}明透；原典提醒“印惧财破”，须继续核对印之轻重、财根与透干位置`,
    );
  }

  const visibleResources = visibleAmong('正印', '偏印');
  if (usesFood && visibleResources.length > 0) {
    notes.push(
      `食神为当前月令所用，又见${visibleResources.join('、')}明透；原典提醒“食畏印夺”，须继续核对制化与护食救应`,
    );
  }

  if (usesFood && visibleGods.has('七杀') && visibleWealth.length > 0) {
    notes.push(
      `食神为当前月令所用，七杀与${visibleWealth.join('、')}同见明透；财能生杀而妨碍食神制杀，原典列为“财能破格”的带忌条件`,
    );
  }

  if (usesKiller && visibleGods.has('食神') && visibleResources.length > 0) {
    notes.push(
      `七杀为当前月令所用，食神与${visibleResources.join('、')}同见明透；印来护杀并妨碍食神制杀，原典列为“印能破格”的带忌条件`,
    );
  }

  if (usesWealth && visibleGods.has('正官') && visibleGods.has('食神')) {
    notes.push(
      '财星为当前月令所用，正官与食神同见明透；财能生官而又露食使结构混杂，原典列为“食能破格”的带忌条件',
    );
  }

  return notes;
}

/**
 * 只复算《子平真诠》“论四凶神能成格”中月令用神明确、且客观条件可以闭合的关系。
 * “印绶根轻”没有无争议的二元门槛，故不在这里按根数或自定义分值硬判。
 */
function collectInauspiciousFormingNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const dayMaster = pillars.day.gan;
  const visibleGods = new Set(
    [pillars.year.gan, pillars.month.gan, pillars.hour.gan].map((stem) =>
      getTenGod(stem, dayMaster),
    ),
  );
  const allGods = [
    ...visibleGods,
    ...Object.values(pillars).flatMap((pillar) =>
      (HIDDEN_STEMS[pillar.zhi] || []).map((stem) => getTenGod(stem, dayMaster)),
    ),
  ];
  const visibleAmong = (...gods: string[]) => gods.filter((god) => visibleGods.has(god));
  const usesWealth = isNamedPattern(patternName, ['正财', '偏财', '财']);
  const usesFood = isNamedPattern(patternName, ['食神']);
  const notes: string[] = [];

  const visiblePeers = visibleAmong('比肩', '劫财');
  if (usesWealth && visiblePeers.length > 0 && visibleGods.has('伤官')) {
    notes.push(
      `财星为当前月令所用，${visiblePeers.join('、')}与伤官同见明透；伤官可化劫生财，原典列为“财逢比劫”的局部救应`,
    );
  }

  const hasWealthAnywhere = allGods.some((god) => god === '正财' || god === '偏财');
  if (usesFood && visibleGods.has('七杀') && visibleGods.has('偏印') && !hasWealthAnywhere) {
    notes.push(
      '食神为当前月令所用，七杀与偏印同见明透，且年、月、时干及四支藏干均无正偏财；闭合原典“食带煞而无财，弃食就煞而透印”条件，枭可作为局部救应',
    );
  }

  const bladeBranch = REN_BRANCH_MAP[dayMaster];
  if (
    usesWealth &&
    visibleGods.has('七杀') &&
    bladeBranch &&
    Object.values(pillars).some((pillar) => pillar.zhi === bladeBranch)
  ) {
    notes.push(
      `财星为当前月令所用，又见七杀明透及日主阳刃支${bladeBranch}；原典列“财逢七煞，刃可解厄”，只记录阳刃的局部救应`,
    );
  }

  return notes;
}

const FORMATION_PATTERN_NAME_BY_TEN_GOD_CATEGORY: Record<string, string> = {
  比劫: '比劫格',
  食伤: '食伤格',
  财星: '财格',
  官杀: '官杀格',
  印星: '印格',
};

function getFormationPatternName(wuxing: Wuxing, dayMaster: string): string {
  const tenGodCategory = getWuxingTenGodCategory(dayMaster, wuxing);
  return FORMATION_PATTERN_NAME_BY_TEN_GOD_CATEGORY[tenGodCategory] || '待综合判断';
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
  const completeBranchFormations = collectCompleteBranchFormations(pillars);
  const monthBranchFormations = completeBranchFormations.filter(
    (formation) => formation.includesMonthBranch,
  );
  const explicitRelationshipNotes = collectExplicitUseRelationshipNotes(
    pillars,
    monthBranchFormations,
  );
  const tombClashNotes = collectTombClashNotes(pillars);
  const commanderIsMonthStem = Boolean(monthCommander && monthStems.includes(monthCommander));
  const commanderIsExposed = Boolean(monthCommander && exposedStems.includes(monthCommander));
  let basis: string;

  if (LU_BRANCH_MAP[dayMaster] === monthBranch) {
    patternName = '建禄格';
    const commanderFact = monthCommander
      ? !commanderIsMonthStem
        ? `；${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实`
        : `；当前${monthCommander}司权另作得时事实`
      : '';
    basis = monthBranchFormations.length
      ? buildLuRenFormationBasis(
          pillars,
          dayMaster,
          monthBranch,
          '建禄格',
          monthBranchFormations,
          getTenGod,
          commanderFact,
        )
      : `月令${monthBranch}为日主${dayMaster}之禄位，按建禄格处理`;
  } else if (REN_BRANCH_MAP[dayMaster] === monthBranch) {
    patternName = '月刃格';
    const commanderFact = monthCommander
      ? !commanderIsMonthStem
        ? `；${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实`
        : `；当前${monthCommander}司权另作得时事实`
      : '';
    basis = monthBranchFormations.length
      ? buildLuRenFormationBasis(
          pillars,
          dayMaster,
          monthBranch,
          '月刃格',
          monthBranchFormations,
          getTenGod,
          commanderFact,
        )
      : `月令${monthBranch}为日主${dayMaster}之羊刃位，按月刃格处理`;
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
  } else if (monthBranchFormations.length > 0) {
    const formationUses = monthBranchFormations.map(
      (formation) =>
        `月支${monthBranch}参与地支${formation.branches.join('')}完整${formation.type}${formation.wuxing}结构（${getFormationUseLabel(formation.wuxing, dayMaster)}）`,
    );
    const formationPatterns = [
      ...new Set(
        monthBranchFormations.map((formation) =>
          getFormationPatternName(formation.wuxing, dayMaster),
        ),
      ),
    ];
    const commanderFact = monthCommander
      ? !commanderIsMonthStem
        ? `；${monthCommander}为交节过渡气${commanderIsExposed ? '且已透干' : ''}，只作司权${commanderIsExposed ? '与透干' : ''}事实，不覆盖会支取用`
        : `；当前${monthCommander}司权另作得时事实，不覆盖会支取用`
      : '';

    const soleMonthStem = monthStems.length === 1 ? monthStems[0] : undefined;
    const formationMatchesSoleMonthStem = Boolean(
      soleMonthStem &&
      monthBranchFormations.every((formation) => formation.wuxing === getStemWuxing(soleMonthStem)),
    );

    if (formationMatchesSoleMonthStem && soleMonthStem) {
      patternName = getPatternNameByTenGod(
        getTenGod(soleMonthStem, dayMaster),
        dayMaster,
        monthBranch,
      );
      basis = `月令只有${soleMonthStem}一项藏干且未透出，同时${formationUses.join('；')}；唯一藏干与会局五行一致，《子平真诠》所述会支取用没有引入第二类别，故仍按${soleMonthStem}记录为${patternName}，并把完整会支列入依据，格局成败仍须结合全局复核${commanderFact}`;
    } else if (formationPatterns.length === 1 && formationPatterns[0] !== '待综合判断') {
      patternName = formationPatterns[0];
      basis = `月令藏干均未透出，但${formationUses.join('；')}；《子平真诠》称“何谓会支”，并以完整会局直接取用，故按会支的宽口径十神类别记录为${patternName}，不凭会局五行补造正偏极性，格局成败仍须结合全局复核${commanderFact}`;
    } else {
      patternName = '待综合判断';
      basis = `月令藏干均未透出，但${formationUses.join('；')}；会支取用出现多个类别或十神类别未闭合，不能强定单一格局${commanderFact}`;
    }
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

  if (explicitRelationshipNotes.length > 0) {
    basis += `；古籍同型关系：${explicitRelationshipNotes.join('；')}；以上只闭合原典明举的局部有情、无情或转化关系，其他兼透、刑冲、合化、清浊与救应仍可能改变整体结果，不据此直接判定最终成败`;
  }

  if (tombClashNotes.length > 0) {
    basis += `；墓库刑冲边界：${tombClashNotes.join('；')}；以上只闭合原典明举的四墓刑冲关系，不改变既有格名，也不据此直接判定最终成败`;
  }

  const auspiciousBreakingNotes = collectAuspiciousBreakingNotes(pillars, patternName, getTenGod);
  if (auspiciousBreakingNotes.length > 0) {
    basis += `；四吉神能破格边界：${auspiciousBreakingNotes.join('；')}；以上只记录月令用神明确且冲突十神明透时的原典带忌或破格因素，其他强弱、根气、生克先后、位置、会合与救应仍可能改变整体结果，不改变既有格名，也不据此直接判定最终成败`;
  }

  const inauspiciousFormingNotes = collectInauspiciousFormingNotes(pillars, patternName, getTenGod);
  if (inauspiciousFormingNotes.length > 0) {
    basis += `；四凶神能成格边界：${inauspiciousFormingNotes.join('；')}；以上只记录月令用神明确且原典条件可闭合时的局部成格或救应因素，其他强弱、根气、生克先后、位置、会合与其他救应仍可能改变整体结果，不改变既有格名，也不据此直接判定最终成败`;
  }

  const generationOrderNotes = collectGenerationOrderNotes(pillars, patternName, getTenGod);
  if (generationOrderNotes.length > 0) {
    basis += `；生克先后边界：${generationOrderNotes.join('；')}；以上只记录原典明确的外干先后与精确隔位关系；同类重复而交错时不强定先后，强弱、根气、地支、合化及其他救应仍须综合，不改变既有格名，也不据此推导富贵、寿夭、子嗣或最终成败`;
  }

  const officerPatternNotes = collectOfficerPatternNotes(
    pillars,
    patternName,
    completeBranchFormations,
    getTenGod,
  );
  if (officerPatternNotes.length > 0) {
    basis += `；正官格成败边界：${officerPatternNotes.join('；')}；以上只记录《子平真诠》“论正官”中能够由当前四柱闭合的局部带忌、相碍与救应条件，不改变既有格名，不把刑冲破害、财印位置、佩印或合杀单独当作最终成败，也不推导富贵、官职、品级、分数或概率`;
  }

  return {
    pattern: patternName || '杂气格',
    isSpecial: false,
    basis,
    // 魁罡属于外格名目；月令已有用神或干头已有财官七杀时，不进入正式格局字段。
    isKuiGang:
      canUseExternalPattern(pillars, getTenGod) &&
      ['庚辰', '壬辰', '戊戌', '庚戌'].includes(pillars.day.gan + pillars.day.zhi),
  };
}
