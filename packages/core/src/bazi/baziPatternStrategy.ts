import { HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
  getRepresentativeStemByWuxing,
  type CompleteBranchFormation,
} from './baziFormationUtils';
import { canUseExternalPattern } from './baziExternalPatternEligibility';
import { analyzeOfficerPatternStructure } from './baziOfficerPattern';
import { analyzeFoodPatternStructure } from './baziFoodPattern';
import { analyzeResourcePatternStructure } from './baziResourcePattern';
import { getStemWuxing, getWuxingTenGodCategory } from './baziRuleMatcher/helpers';
import type { PatternAnalysis, Pillars, Wuxing } from './baziTypes';
import { assertHeavenlyStem, assertPillars } from './baziUtils';
import { analyzeWealthPatternStructure } from './baziWealthPattern';
import { LIUCHONG_MAP, isLiuchong, isLiuhai, isLiupo, isSanxing } from '../ganzhi/relations';

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

  const structure = analyzeOfficerPatternStructure(pillars, patternName, formations, getTenGod);
  const wealthFacts = structure.wealthStems;
  const resourceFacts = structure.resourceStems;
  const hurtFacts = structure.hurtStems;
  const killerFacts = structure.killerStems;
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

  if (wealthFacts.length > 0 && resourceFacts.length > 0) {
    const combinedPairs = structure.wealthResourceCombinedPairs;
    const controllingPairs = structure.wealthResourceControllingPairs;

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

  const hurtFormations = structure.hurtFormations;
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

  if (killerFacts.length > 0) {
    const combinedKillerFacts = structure.killerCombinations;

    if (structure.unresolvedKillerStems.length === 0) {
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

/**
 * 复算《子平真诠》“论财”中可以由四柱闭合的明透、根气、食官印杀与取清组件。
 * 根深、财旺、身强、印强弱和劫刃太重仍保留待复核，不以数量替代全局判断。
 */
function collectWealthPatternNotes(
  pillars: Pillars,
  patternName: string,
  formations: CompleteBranchFormation[],
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeWealthPatternStructure(pillars, patternName, formations, getTenGod);
  const notes: string[] = [];
  const isExact = (year: string, month: string, day: string, hour: string) =>
    pillars.year.ganZhi === year &&
    pillars.month.ganZhi === month &&
    pillars.day.ganZhi === day &&
    pillars.hour.ganZhi === hour;
  const formatStems = (facts: typeof structure.exposedStems) =>
    facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');
  const formatFormations = (items: CompleteBranchFormation[], tenGod: string) =>
    items
      .map(
        (formation) =>
          `${formation.branches.join('')}完整${formation.type}${formation.wuxing}局成${tenGod}结构`,
      )
      .join('、');

  // 下列原例因月令多藏干无透或兼透，现有取格会保留待综合或其他格名；只保存精确关系。
  if (isExact('壬寅', '壬寅', '庚辰', '辛巳')) {
    notes.push(
      '原典杨待郎精确例型壬寅、壬寅、庚辰、辛巳，寅中甲财为月令财根，壬食两透而辛劫一位；只记录财用食生及略带一位比劫的局部结构，不覆盖多藏干无透时的格名边界',
    );
  }
  if (isExact('壬辰', '乙巳', '癸巳', '辛酉')) {
    notes.push(
      '原典平江伯精确例型壬辰、乙巳、癸巳、辛酉，巳中丙财与戊暗官同在月令，乙食与辛印明透；只记录印制食以护暗官的局部候选，不据此强改现有待综合格名',
    );
  }
  if (isExact('甲子', '辛未', '辛酉', '壬辰')) {
    notes.push(
      '原典汪学士精确例型甲子、辛未、辛酉、壬辰，未中乙财有甲财明透，辛劫与壬伤同见；只记录财轻逢劫时伤官化劫生财的原例结构，财轻与比强仍须另审',
    );
  }
  if (isExact('乙酉', '庚辰', '甲午', '戊辰')) {
    notes.push(
      '原典毛状元精确例型乙酉、庚辰、甲午、戊辰，辰中戊财明透，庚杀与乙劫相邻五合；只记录合杀存财的局部取清候选，不证明已经合化或最终成格',
    );
  }
  if (isExact('丙辰', '丙申', '丙午', '壬辰')) {
    notes.push(
      '原典尚书精确例型丙辰、丙申、丙午、壬辰，申中庚财当令，丙比肩两透、午为阳刃且壬杀明透；只闭合弃财就杀例型的组成事实，不以两处比肩和一处阳刃直接判定劫刃太重',
    );
  }

  const nonMonthRootedSingleWealth =
    structure.wealthStems.length === 1 &&
    structure.monthHiddenWealthStems.length > 0 &&
    !structure.monthHiddenStems.includes(structure.wealthStems[0].stem);
  if (nonMonthRootedSingleWealth) {
    const wealth = structure.wealthStems[0];
    notes.push(
      `月支${pillars.month.zhi}藏${structure.monthHiddenWealthStems.join('、')}财根，${wealth.label}${wealth.stem}${wealth.tenGod}虽非月令藏干同字但只明透一位；对应原典“寅透乙、卯透甲”类一位不为太露的边界，只记录同五行根气与明透数量，不改变既有格名`,
    );
  }

  if (
    structure.monthHiddenWealthStems.length > 0 &&
    structure.killerStems.length > 0 &&
    structure.peerStems.length > 0 &&
    structure.hasBladeBranch
  ) {
    notes.push(
      `月令含${structure.monthHiddenWealthStems.join('、')}财根，同时${formatStems(structure.peerStems)}明透、${formatStems(structure.killerStems)}明透并见日主阳刃支${structure.bladeBranch}；只列“弃财就杀”的条件候选，是否劫刃太重不能由明透数量或单支阳刃硬判，且须与财逢杀时阳刃可作救应的另一候选并存复核`,
    );
  }

  if (!structure.isWealthPattern) return notes;

  if (structure.wealthRootFacts.length > 0) {
    notes.push(
      `财五行在${structure.wealthRootFacts
        .map(
          (fact) =>
            `${fact.label}${fact.branch}藏${fact.hiddenWealthStems.join('、')}（${fact.hiddenWealthStems
              .map((stem) => getTenGod(stem, pillars.day.gan))
              .join('、')}）`,
        )
        .join('、')}见根气；这里只证明有财根，不把支数、藏干层级或同类数量直接换算为“根深、财旺”`,
    );
  }

  if (structure.wealthStems.length === 1) {
    notes.push(
      `${formatStems(structure.wealthStems)}仅一位财星明透，列为原典“透一位以清用”的数量候选；清用仍须结合月令取用、根气、合冲与全局复核`,
    );
  } else if (structure.wealthStems.length > 1) {
    if (structure.officerStems.length > 0) {
      notes.push(
        `${formatStems(structure.wealthStems)}共${structure.wealthStems.length}位财星明透，同时${formatStems(structure.officerStems)}明透；原典称财旺生官时多露可有例外，但财旺、身强及官能护财均未由数量闭合，不能直接判多露无碍`,
      );
    } else {
      notes.push(
        `${formatStems(structure.wealthStems)}共${structure.wealthStems.length}位财星明透，列为“不宜太露”的数量带忌候选；根深、财旺及是否另有官护仍须全局复核`,
      );
    }
  }

  if (
    structure.officerStems.length > 0 &&
    structure.hurtStems.length === 0 &&
    structure.killerStems.length === 0
  ) {
    notes.push(
      `财格又见${formatStems(structure.officerStems)}明透，且未见伤官或七杀明透，具“财旺生官”的客观部分；财旺、身强及官星清纯仍须另审，不据此直接判定成败`,
    );
  }

  const foodSources = [
    ...(structure.foodStems.length > 0 ? [formatStems(structure.foodStems)] : []),
    ...(structure.foodFormations.length > 0
      ? [formatFormations(structure.foodFormations, '食神')]
      : []),
  ];
  const hasFood = foodSources.length > 0;
  if (hasFood) {
    if (structure.officerStems.length === 0) {
      const peerBoundary =
        structure.peerStems.length === 1
          ? `，另${formatStems(structure.peerStems)}恰一位明透，对应“略带一位比劫”候选`
          : structure.peerStems.length > 1
            ? `，另有${structure.peerStems.length}位比劫明透，不等同原典“略带一位”`
            : '，未见比劫明透';
      notes.push(
        `财格见${foodSources.join('、')}且未见正官明透，具“财用食生”的局部结构${peerBoundary}；身强与财食轻重仍须全局复核`,
      );
    } else {
      notes.push(
        `财用食生结构又见${formatStems(structure.officerStems)}明透；原典只有“透官”与“身弱”同时成立时才列带忌，当前只记录官露事实，不把官星单独判为格坏`,
      );
    }
  }

  if (structure.resourceStems.length > 0) {
    const impededPairs = [
      ...structure.wealthResourceCombinedPairs.map(
        ({ left, right }) =>
          `${left.label}${left.stem}${left.tenGod}与${right.label}${right.stem}${right.tenGod}相邻五合`,
      ),
      ...structure.wealthResourceControllingPairs.map(
        ({ left, right }) =>
          `${left.label}${left.stem}${left.tenGod}与${right.label}${right.stem}${right.tenGod}相邻且财克印`,
      ),
    ];
    if (impededPairs.length > 0) {
      notes.push(
        `财格见${formatStems(structure.resourceStems)}明透，但${impededPairs.join('、')}，列为财格佩印时财印相碍的局部事实；是否另有隔位财印或帮身作用仍须复核`,
      );
    } else {
      notes.push(
        `财格见${formatStems(structure.resourceStems)}明透，未见外干财印相邻五合或财直接克印，列为“财格佩印、财印不相碍”的位置候选；身强弱与印是否实际得用仍须另审`,
      );
    }
  }

  if (structure.foodStems.length > 0 && structure.resourceStems.length > 0) {
    if (
      structure.foodResourceCloserPairs.length === 0 &&
      structure.foodResourceTwoSeparatorPairs.length > 0
    ) {
      notes.push(
        `${formatStems(structure.foodStems)}与${formatStems(structure.resourceStems)}分居年、时干，中隔月干与日干两柱，列为原典“食与印两不相碍”的精确位置候选`,
      );
    } else if (structure.foodResourceCloserPairs.length > 0) {
      const closerPairs = structure.foodResourceCloserPairs
        .map(
          ({ left, right }) =>
            `${left.label}${left.stem}${left.tenGod}与${right.label}${right.stem}${right.tenGod}`,
        )
        .join('、');
      if (structure.monthHiddenOfficerStems.length > 0) {
        notes.push(
          `${closerPairs}未达到年、时两干隔开的距离，同时月令藏${structure.monthHiddenOfficerStems.join('、')}正官；列为食印相克而印去食护暗官的局部候选，不把暗官存在直接等同取用成功`,
        );
      } else {
        notes.push(
          `${closerPairs}未达到年、时两干隔开的距离，列为财用食印时食印相克的位置冲突；没有暗官护用等条件时仍须复核，不直接推导结果`,
        );
      }
    }
  } else if (structure.foodFormations.length > 0 && structure.resourceStems.length > 0) {
    notes.push(
      `${formatFormations(structure.foodFormations, '食神')}与${formatStems(structure.resourceStems)}同见；会局食神不能套用外干年时隔位，食印是否相碍及能否护官须另行复核`,
    );
  }

  if (structure.hurtStems.length > 0) {
    if (structure.peerStems.length > 0) {
      notes.push(
        `财格见${formatStems(structure.hurtStems)}与${formatStems(structure.peerStems)}同时明透，具伤官化劫生财的局部候选；财轻、比强与“一位伤官”是否满足仍不能由数量直接定案`,
      );
    } else {
      notes.push(
        `财格见${formatStems(structure.hurtStems)}明透而未见比劫明透；原典的带忌例还要求财旺无劫，当前财旺未闭合，只列财带伤官的条件待复核`,
      );
    }
  }

  if (structure.killerStems.length > 0) {
    if (structure.killerCombinations.length > 0) {
      notes.push(
        `${structure.killerCombinations
          .map(
            ({ killer, partner }) =>
              `${killer.label}${killer.stem}七杀与${partner.label}${partner.stem}${partner.tenGod}相邻五合`,
          )
          .join('、')}，列为财带七杀时“合杀存财”的局部取清候选；五合不等于已经合化或最终取清`,
      );
    }
    if (hasFood) {
      notes.push(
        `${foodSources.join('、')}与${formatStems(structure.killerStems)}同见，列为财带七杀时“制杀生财”的局部取清候选；食神是否有力与财杀强弱仍须另审`,
      );
    }
    if (structure.killerCombinations.length === 0 && !hasFood) {
      notes.push(
        `财格见${formatStems(structure.killerStems)}明透，但未见相邻五合或食神明透、成局的取清组件，保留财带七杀待复核`,
      );
    }
  }

  if (structure.killerStems.length > 0 && structure.resourceStems.length > 0) {
    if (structure.wealthStems.length === 0) {
      notes.push(
        `财格见${formatStems(structure.killerStems)}与${formatStems(structure.resourceStems)}明透而未见财星明透，具“财用杀印、印化杀”的局部候选；印强弱、调候与是否另有财杂印仍须复核`,
      );
    } else {
      notes.push(
        `财、杀、印同时明透，其中财可克印又生杀，列为财用杀印时的局部冲突；印的强弱与根气未闭合，不据明透数量直接判定结果`,
      );
    }
  }

  const singleExposedMonthWealth =
    structure.wealthStems.length === 1 &&
    structure.exposedMonthHiddenStems.length === 1 &&
    ['正财', '偏财'].includes(getTenGod(structure.exposedMonthHiddenStems[0], pillars.day.gan));
  if (
    singleExposedMonthWealth &&
    structure.officerStems.length === 0 &&
    structure.killerStems.length === 0 &&
    ((pillars.day.gan === '壬' && pillars.month.zhi === '午') ||
      (pillars.day.gan === '癸' && pillars.month.zhi === '巳'))
  ) {
    notes.push(
      `${pillars.day.gan}日生${pillars.month.zhi}月，仅月令财星${structure.exposedMonthHiddenStems[0]}明透，月令另藏${structure.monthHiddenOfficerStems.join('、')}正官未透；闭合原典“单透财而月令有暗官”的结构事实，不推导最终成败`,
    );
  }
  if (
    singleExposedMonthWealth &&
    pillars.day.gan === '壬' &&
    pillars.month.zhi === '巳' &&
    structure.killerStems.length === 0
  ) {
    notes.push(
      `壬日巳月仅丙财明透而巳中戊杀未透，列为原典“弃杀就财”的局部取舍候选；是否真正存财弃杀仍须结合全局复核`,
    );
  }

  return notes;
}

/**
 * 复算《子平真诠》“论印”中能够由四柱闭合的官、杀、食伤、财根、五合取清与劫财救应。
 * 身印财的轻重、根深、合化及最终成败均不以明透数量或单一关系代替。
 */
function collectResourcePatternNotes(
  pillars: Pillars,
  patternName: string,
  formations: CompleteBranchFormation[],
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeResourcePatternStructure(pillars, patternName, formations, getTenGod);
  const notes: string[] = [];
  const isExact = (year: string, month: string, day: string, hour: string) =>
    pillars.year.ganZhi === year &&
    pillars.month.ganZhi === month &&
    pillars.day.ganZhi === day &&
    pillars.hour.ganZhi === hour;
  const formatStems = (facts: typeof structure.exposedStems) =>
    facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');
  const formatFormations = (items: CompleteBranchFormation[]) =>
    items
      .map((formation) => {
        const tenGod = getTenGod(getRepresentativeStemByWuxing(formation.wuxing), pillars.day.gan);
        return `${formation.branches.join('')}完整${formation.type}${formation.wuxing}局成${tenGod}结构`;
      })
      .join('、');
  const outputSources = [
    ...(structure.outputStems.length > 0 ? [formatStems(structure.outputStems)] : []),
    ...(structure.outputFormations.length > 0
      ? [formatFormations(structure.outputFormations)]
      : []),
  ];
  const hasOutput = outputSources.length > 0;
  const foodSources = [
    ...(structure.foodStems.length > 0 ? [formatStems(structure.foodStems)] : []),
    ...(structure.foodFormations.length > 0 ? [formatFormations(structure.foodFormations)] : []),
  ];
  const hasFood = foodSources.length > 0;
  const isExactDistantKillerCombination = isExact('辛亥', '庚子', '甲辰', '乙亥');

  // 原例有些会按透会并用或月令藏干未透保留其他格名；这里只保存章内精确关系。
  const exactExamples: Array<{
    pillars: [string, string, string, string];
    note: string;
  }> = [
    {
      pillars: ['丙寅', '戊戌', '辛酉', '戊子'],
      note: '原典张参政精确例型丙寅、戊戌、辛酉、戊子，丙官与戊印明透；只保存印用官的组成事实，官清纯及身印强弱仍须另审',
    },
    {
      pillars: ['丙戌', '戊戌', '辛未', '壬辰'],
      note: '原典朱尚书精确例型丙戌、戊戌、辛未、壬辰，丙官、戊印与壬伤官同透；只保存印制伤官以护官的局部结构',
    },
    {
      pillars: ['乙亥', '己卯', '丁酉', '壬寅'],
      note: '原典临淮侯精确例型乙亥、己卯、丁酉、壬寅，乙印、己食神与壬官同透；只保存印用食神及官食印并见的组成事实，不据此判强弱成败',
    },
    {
      pillars: ['戊戌', '乙卯', '丙午', '乙亥'],
      note: '原典李状元精确例型戊戌、乙卯、丙午、乙亥，乙印两透并见戊食神；原文丙日配乙亥时不合五鼠遁，只保存文献所载印用食神关系，不以印星数量判印旺身强',
    },
    {
      pillars: ['己巳', '癸酉', '癸未', '庚申'],
      note: '原典茅状元精确例型己巳、癸酉、癸未、庚申，己杀与庚印明透；只保存印用七杀结构，身印轻重仍须另审',
    },
    {
      pillars: ['壬寅', '戊申', '壬辰', '壬寅'],
      note: '原典马参政精确例型壬寅、戊申、壬辰、壬寅，申月印星当令并透戊杀；只保存印用七杀结构，不以比肩数量直接判断身印并重',
    },
    {
      pillars: ['辛酉', '丙申', '壬申', '辛亥'],
      note: '原典汪侍郎精确例型辛酉、丙申、壬申、辛亥，辛印两透并见丙财，申中庚印当令；只保存印多用财的组成与财根事实，不按数量断印重财轻',
    },
    {
      pillars: ['庚寅', '乙酉', '癸亥', '丙辰'],
      note: '原典牛监簿精确例型庚寅、乙酉、癸亥、丙辰，庚印与乙食神相邻五合而丙财另存；只保存食合印存财的取清候选，五合不等于已经合化',
    },
    {
      pillars: ['己未', '甲戌', '辛未', '癸巳'],
      note: '原典合财存食精确例型己未、甲戌、辛未、癸巳，己印与甲财相邻五合而癸食神另存；只保存财合印存食的局部取清候选，五合不等于已经合化',
    },
    {
      pillars: ['辛亥', '庚子', '甲辰', '乙亥'],
      note: '原典合杀留官精确例型辛亥、庚子、甲辰、乙亥，辛官、庚杀同透；庚杀与时干乙劫财虽隔日干，原文仍取乙庚合，只保存这一精确合杀留官候选，不泛化为远隔天干皆可合，也不认定已经合化或最终取清',
    },
    {
      pillars: ['壬子', '癸卯', '丙子', '己亥'],
      note: '原典官杀有制精确例型壬子、癸卯、丙子、己亥，壬杀、癸官与己伤官同透；只保存食伤制官杀的局部取清候选，不直接认定官杀已经尽制',
    },
    {
      pillars: ['丙午', '庚寅', '丙午', '癸巳'],
      note: '原典化印为劫精确例型丙午、庚寅、丙午、癸巳，只记录寅午半合与比财官明透的组成边界；半合不作为完整三合火局运行，也不据此认定印已化劫或弃印就财官',
    },
    {
      pillars: ['庚戌', '戊子', '甲戌', '乙亥'],
      note: '原典劫财存杀印精确例型庚戌、戊子、甲戌、乙亥，庚杀、戊财与乙劫财同透；只保存劫财制财以存杀印的局部救应候选',
    },
  ];
  exactExamples.forEach((example) => {
    if (isExact(...example.pillars)) notes.push(example.note);
  });

  if (!structure.isResourcePattern) return notes;

  if (structure.officerStems.length > 0) {
    if (structure.killerStems.length === 0) {
      notes.push(
        `印格见${formatStems(structure.officerStems)}明透且未见七杀明透，具“印用官”的官清纯客观部分；身旺、印强、官清及三者实际轻重仍须全局复核`,
      );
    } else {
      notes.push(
        `印格见${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}同时明透，形成官杀竞透结构，须继续核对合杀、食伤制官杀等取清组件`,
      );
    }
  }

  if (structure.officerStems.length > 0 && hasOutput) {
    notes.push(
      `印格见${formatStems(structure.officerStems)}与${outputSources.join('、')}同见；月令印星对食伤有固定五行制约，构成印制食伤以护官的局部结构，印能否实际制食伤仍须结合强弱根气复核`,
    );
  }

  if (hasOutput) {
    notes.push(
      `印格见${outputSources.join('、')}，具“印用食伤”以泄秀的局部结构；身强印旺方可用、印浅身轻则不利，当前不以明透或藏干数量硬判这一强弱分叉`,
    );
  }

  if (structure.killerStems.length > 0) {
    notes.push(
      `印格见${formatStems(structure.killerStems)}明透，具“印用七杀”的局部结构；身重印轻、身轻印重或身印并重的分叉不能由十神数量直接判定`,
    );
    if (hasOutput) {
      notes.push(
        `${formatStems(structure.killerStems)}与${outputSources.join('、')}同见，形成杀有食伤制、印生身而食伤泄身的局部制泄结构；各方是否有力仍须全局复核`,
      );
    }
  }

  if (structure.wealthStems.length > 0) {
    const wealthRoots =
      structure.wealthRootFacts.length > 0
        ? `财五行在${structure.wealthRootFacts
            .map(
              (fact) =>
                `${fact.label}${fact.branch}藏${fact.hiddenWealthStems.join('、')}（${fact.hiddenWealthStems
                  .map((stem) => getTenGod(stem, pillars.day.gan))
                  .join('、')}）`,
            )
            .join('、')}见根气；这里只证明有财根，不把支数或藏干层级换算为“根深”`
        : '四支藏干未见正偏财根；这里只记录当前无财根事实，不据此单独定成败';
    const robberyBoundary =
      structure.robberyStems.length > 0
        ? `；另见${formatStems(structure.robberyStems)}明透，可列印轻财重时劫财制财的救应候选`
        : '；未见劫财明透，印轻财重时是否另有救应仍须复核';
    notes.push(
      `印格见${formatStems(structure.wealthStems)}明透，列为“印多用财”的条件结构；${wealthRoots}${robberyBoundary}；印重身强、印轻财重与财根深浅均不由数量直接定案`,
    );
  }

  if (structure.wealthStems.length > 0 && hasFood) {
    if (structure.resourceFoodCombinedPairs.length > 0) {
      notes.push(
        `${structure.resourceFoodCombinedPairs
          .map(
            ({ left, right }) =>
              `${right.label}${right.stem}${right.tenGod}与${left.label}${left.stem}${left.tenGod}相邻五合`,
          )
          .join(
            '、',
          )}，同时${formatStems(structure.wealthStems)}另存，列为“食合印存财”的局部取清候选；五合事实不证明已经合化`,
      );
    }
    if (structure.resourceWealthCombinedPairs.length > 0) {
      notes.push(
        `${structure.resourceWealthCombinedPairs
          .map(
            ({ left, right }) =>
              `${right.label}${right.stem}${right.tenGod}与${left.label}${left.stem}${left.tenGod}相邻五合`,
          )
          .join(
            '、',
          )}，同时${foodSources.join('、')}另存，列为“财合印存食”的局部取清候选；五合事实不证明已经合化`,
      );
    }
    if (
      structure.resourceFoodCombinedPairs.length === 0 &&
      structure.resourceWealthCombinedPairs.length === 0
    ) {
      notes.push(
        '印、财、食神同见，但外干未见食神合印或财合印的相邻五合，保留三者混合结构待复核，不抢先选定存财或存食',
      );
    }
  }

  if (structure.officerStems.length > 0 && structure.killerStems.length > 0) {
    if (structure.killerCombinations.length > 0) {
      notes.push(
        `${structure.killerCombinations
          .map(
            ({ killer, partner }) =>
              `${killer.label}${killer.stem}七杀与${partner.label}${partner.stem}${partner.tenGod}相邻五合`,
          )
          .join('、')}，列为官杀竞透时“合杀留官”的局部取清候选；五合不等于已经合化或最终取清`,
      );
    }
    if (hasOutput) {
      notes.push(
        `${outputSources.join('、')}与官杀同见，列为食伤制官杀的局部取清候选；是否尽制及最终留官留杀仍须复核`,
      );
    }
    if (
      structure.killerCombinations.length === 0 &&
      !hasOutput &&
      !isExactDistantKillerCombination
    ) {
      notes.push('官杀竞透而未见相邻五合或食伤明透、成局的取清组件，保留官杀混杂待复核');
    }
  }

  if (
    structure.wealthStems.length > 0 &&
    structure.killerStems.length > 0 &&
    structure.robberyStems.length > 0
  ) {
    notes.push(
      `${formatStems(structure.wealthStems)}、${formatStems(structure.killerStems)}与${formatStems(structure.robberyStems)}同时明透，具劫财制财以存杀印的局部救应候选；财劫杀印强弱与最终取舍仍须全局复核`,
    );
  }

  return notes;
}

/**
 * 复算《子平真诠》“论食神”中能够由四柱闭合的财根、明透、气候类别、位置与取清组件。
 * 身强、食旺、火炎木焦、食神有气及最终成败均不以十神数量或单一关系代替。
 */
function collectFoodPatternNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeFoodPatternStructure(pillars, patternName, getTenGod);
  const notes: string[] = [];
  const isExact = (year: string, month: string, day: string, hour: string) =>
    pillars.year.ganZhi === year &&
    pillars.month.ganZhi === month &&
    pillars.day.ganZhi === day &&
    pillars.hour.ganZhi === hour;
  const formatStems = (facts: typeof structure.exposedStems) =>
    facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');

  const exactExamples: Array<{
    pillars: [string, string, string, string];
    note: string;
  }> = [
    {
      pillars: ['丁未', '癸卯', '癸亥', '癸丑'],
      note: '原典梁丞相精确例型丁未、癸卯、癸亥、癸丑，卯中乙食神当令而丁偏财明透且在未中有根；只保存食神生财与财根事实，不据此判断身强食旺或富贵',
    },
    {
      pillars: ['己未', '壬申', '戊子', '庚申'],
      note: '原典谢阁老精确例型己未、壬申、戊子、庚申，申中庚食神与壬偏财兼透；只保存食神、财星并用事实，不覆盖兼透则兼用的格名边界',
    },
    {
      pillars: ['丁亥', '癸卯', '癸卯', '甲寅'],
      note: '原典沈路分精确例型丁亥、癸卯、癸卯、甲寅，卯中乙食神藏而甲伤官露；只保存藏食露伤结构，不推导性情',
    },
    {
      pillars: ['甲午', '丁卯', '癸丑', '丙辰'],
      note: '原典龚知县精确例型甲午、丁卯、癸丑、丙辰，卯中乙食神藏而甲伤官露，丙正财、丁偏财同透；只保存藏食露伤与正偏财叠出事实，不推导富贵等级',
    },
    {
      pillars: ['己未', '己巳', '甲寅', '丙寅'],
      note: '原典黄都督精确例型己未、己巳、甲寅、丙寅，原文月柱“已巳”按干支语义校作己巳；只保存夏木食神用财结构，火炎土燥与武职结论不由此硬判',
    },
    {
      pillars: ['辛卯', '辛卯', '癸酉', '己未'],
      note: '原典常国公精确例型辛卯、辛卯、癸酉、己未，辛偏印两透、己七杀明透而无财星明透；只保存食神就杀印的组成事实，不据此推导威权富贵',
    },
    {
      pillars: ['戊戌', '壬戌', '丙子', '戊戌'],
      note: '原典胡会元精确例型戊戌、壬戌、丙子、戊戌，壬七杀单露、无印财明透而戊食神明透；只保存无印单露七杀且无财透的结构，不推导贵格结论',
    },
    {
      pillars: ['丁亥', '壬子', '辛巳', '丁酉'],
      note: '原典舒尚书精确例型丁亥、壬子、辛巳、丁酉，辛金生子月而丁七杀两透；只保存金水食神用杀的气候类别与明透事实，不推导贵秀',
    },
    {
      pillars: ['丙午', '癸巳', '甲子', '丙寅'],
      note: '原典钱参政精确例型丙午、癸巳、甲子、丙寅，夏木食神格透癸正印；只保存夏木透印的调候候选，火炎木焦是否成立仍须复核',
    },
    {
      pillars: ['癸酉', '辛酉', '己卯', '乙亥'],
      note: '原典刘提台精确例型癸酉、辛酉、己卯、乙亥，癸偏财在年、辛食神在月、乙七杀在时；只保存财先、食间、杀后的精确位置关系，不推导富贵',
    },
  ];
  exactExamples.forEach((example) => {
    if (isExact(...example.pillars)) notes.push(example.note);
  });

  if (!structure.isFoodPattern) return notes;

  if (structure.wealthStems.length > 0) {
    const rootDetail =
      structure.wealthRootFacts.length > 0
        ? `财五行在${structure.wealthRootFacts
            .map(
              (fact) =>
                `${fact.label}${fact.branch}藏${fact.hiddenWealthStems.join('、')}（${fact.hiddenWealthStems
                  .map((stem) => getTenGod(stem, pillars.day.gan))
                  .join('、')}）`,
            )
            .join('、')}见根气；这里只证明有财根，不把支数或藏干层级换算为根深财旺`
        : '四支藏干未见正偏财根；这里只记录财透而当前无财根，不据此单独定成败';
    const polarityBoundary =
      structure.directWealthStems.length > 0 && structure.indirectWealthStems.length > 0
        ? `；${formatStems(structure.directWealthStems)}与${formatStems(structure.indirectWealthStems)}同见，形成正偏财叠出结构，但不推导富贵等级`
        : '；当前只见一类正偏财明透，原典已明言食神生财不必正偏叠出，不以未叠出视作不足';
    notes.push(
      `食神格见${formatStems(structure.wealthStems)}明透，具“食神生财”的局部结构；${rootDetail}${polarityBoundary}；身强、食旺与财的实际轻重仍须全局复核`,
    );
  }

  if (structure.monthHiddenFoodStems.length > 0 && structure.hurtStems.length > 0) {
    notes.push(
      `月令藏${structure.monthHiddenFoodStems.join('、')}食神而外干见${formatStems(structure.hurtStems)}，形成“藏食露伤”的客观结构；只记录食伤并见，不据此推导性情`,
    );
  }

  if (structure.isSummerWoodFood && structure.wealthStems.length > 0) {
    notes.push(
      `木日主生${pillars.month.zhi}月而见${formatStems(structure.wealthStems)}明透，列为“夏木用财”的气候候选；火炎土燥是否成立仍须结合全局复核，不推导武职或贵贱`,
    );
  }

  if (
    structure.killerStems.length > 0 &&
    structure.resourceStems.length > 0 &&
    structure.wealthStems.length === 0
  ) {
    notes.push(
      `食神格见${formatStems(structure.killerStems)}与${formatStems(structure.resourceStems)}明透而无财星明透，具“不用财而就杀印”的局部结构；杀印食与身的强弱及最终取舍仍须复核`,
    );
  }

  if (
    structure.killerStems.length === 1 &&
    structure.officerStems.length === 0 &&
    structure.resourceStems.length === 0 &&
    structure.wealthStems.length === 0
  ) {
    notes.push(
      `食神格${formatStems(structure.killerStems)}单露，未见正官、印星或财星明透，闭合“无印而单露偏官、无财透”的客观条件；只列食神用杀候选，不据此认定贵格`,
    );
  }

  if (structure.isMetalWaterFood && structure.killerStems.length > 0) {
    notes.push(
      `金日主以月令水食神取格，又见${formatStems(structure.killerStems)}明透，列为“金水食神用杀”的气候类别候选；寒暖燥湿、制杀力度与最终成败仍须另审`,
    );
  }

  if (structure.isSummerWoodFood && structure.resourceStems.length > 0) {
    notes.push(
      `夏月木日主食神格见${formatStems(structure.resourceStems)}明透，列为“夏火太炎、透印不碍”的调候候选；火炎木焦不能由月份或印星数量单独闭合`,
    );
  }

  if (structure.isMetalWaterFood && structure.officerStems.length > 0) {
    notes.push(
      `金日主以月令水食神取格，又见${formatStems(structure.officerStems)}明透，列为“金水食神见官不忌”的气候例外候选；财印辅助、寒暖与官食强弱仍须复核`,
    );
  }

  if (structure.resourceStems.length > 0 && structure.wealthStems.length > 0) {
    notes.push(
      `食神格见${formatStems(structure.resourceStems)}与${formatStems(structure.wealthStems)}同时明透，具“印来夺食、透财以解”的局部救应候选；财能否实际制印护食仍须结合根气强弱复核`,
    );
  }

  if (structure.officerStems.length > 0 && structure.killerStems.length > 0) {
    notes.push(
      `食神格见${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}同时明透，形成官杀竞出结构；原典只说明亦可成局，当前不抢先认定已经取清或最终成败`,
    );
  }

  if (structure.killerCombinations.length > 0 && structure.wealthRootFacts.length > 0) {
    notes.push(
      `${structure.killerCombinations
        .map(
          ({ killer, partner }) =>
            `${killer.label}${killer.stem}七杀与${partner.label}${partner.stem}${partner.tenGod}相邻五合`,
        )
        .join('、')}，同时财五行在${structure.wealthRootFacts
        .map((fact) => `${fact.label}${fact.branch}`)
        .join('、')}有根，列为食神格“合杀存财”的局部取清候选；五合不等于已经合化或最终取清`,
    );
  }

  if (structure.killerStems.length > 0 && structure.wealthStems.length > 0) {
    if (structure.wealthFoodKillerOrderFacts.length > 0) {
      notes.push(
        `${structure.wealthFoodKillerOrderFacts
          .map(
            ({ wealth, food, killer }) =>
              `${wealth.label}${wealth.stem}${wealth.tenGod}在先、${food.label}${food.stem}食神居中、${killer.label}${killer.stem}七杀在后`,
          )
          .join(
            '、',
          )}，闭合“财先杀后、食以间之”的精确位置候选；只记录财不直接越食党杀的排列，不据此推导贵贱`,
      );
    } else {
      notes.push(
        `食神格见${formatStems(structure.killerStems)}与${formatStems(structure.wealthStems)}同透，但未形成外干财先、食间、杀后的排列；保留财生杀而妨碍食神制杀的局部带忌，其他取清救应仍须复核`,
      );
    }
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

  const wealthPatternNotes = collectWealthPatternNotes(
    pillars,
    patternName,
    completeBranchFormations,
    getTenGod,
  );
  if (wealthPatternNotes.length > 0) {
    basis += `；财格成败边界：${wealthPatternNotes.join('；')}；以上只记录《子平真诠》“论财”中能够由当前四柱闭合的根气、明透、位置、暗官及取清组件，不改变既有格名；根深、财旺、身强、印强弱、劫刃太重与最终取舍仍须全局复核，也不推导财富、婚姻、才能、迁动、富贵贫贱、分数或概率`;
  }

  const resourcePatternNotes = collectResourcePatternNotes(
    pillars,
    patternName,
    completeBranchFormations,
    getTenGod,
  );
  if (resourcePatternNotes.length > 0) {
    basis += `；印格成败边界：${resourcePatternNotes.join('；')}；以上只记录《子平真诠》“论印”中能够由当前四柱闭合的明透、财根、完整会局、固定制约与取清组件，不改变既有格名；身旺身弱、身印财轻重、财根深浅、五合或半合成化及最终取舍仍须全局复核，也不推导富贵贫贱、官职、灾祸、现实财富婚姻、分数或概率`;
  }

  const foodPatternNotes = collectFoodPatternNotes(pillars, patternName, getTenGod);
  if (foodPatternNotes.length > 0) {
    basis += `；食神格成败边界：${foodPatternNotes.join('；')}；以上只记录《子平真诠》“论食神”中能够由当前四柱闭合的财根、明透、气候类别、位置与取清组件，不改变既有格名；身强身弱、食旺食轻、火炎木焦、食神有气、财官杀印强弱及最终取舍仍须全局复核，也不推导性情、职业、富贵贫贱、现实财富、分数或概率`;
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
