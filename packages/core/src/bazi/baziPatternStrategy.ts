import { HIDDEN_STEMS, LU_BRANCH_MAP, REN_BRANCH_MAP } from './baziDefinitions';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
  getRepresentativeStemByWuxing,
  type CompleteBranchFormation,
} from './baziFormationUtils';
import { canUseExternalPattern } from './baziExternalPatternEligibility';
import { analyzeBladePatternStructure } from './baziBladePattern';
import { analyzeLuPatternStructure } from './baziLuPattern';
import { analyzeHurtPatternStructure } from './baziHurtPattern';
import { analyzeKillerPatternStructure } from './baziKillerPattern';
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

/**
 * 复算《子平真诠》“论伤官”中能够由四柱闭合的生财、佩印、财印隔位、
 * 杀印无财、气候类别、固定会合关系与官杀取清组件。
 * 强弱、旺衰、根深、合化结果及贵贱均不由十神数量或单一关系代替。
 */
function collectHurtPatternNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeHurtPatternStructure(pillars, patternName, getTenGod);
  const notes: string[] = [];
  const isExact = (year: string, month: string, day: string, hour: string) =>
    pillars.year.ganZhi === year &&
    pillars.month.ganZhi === month &&
    pillars.day.ganZhi === day &&
    pillars.hour.ganZhi === hour;
  const formatStems = (facts: typeof structure.exposedStems) =>
    facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');
  const formatHiddenFacts = (facts: typeof structure.resourceHiddenFacts, label: string) =>
    facts
      .map((fact) => `${fact.label}${fact.branch}藏${fact.hiddenStems.join('、')}${label}`)
      .join('、');

  const exactExamples: Array<{
    pillars: [string, string, string, string];
    note: string;
  }> = [
    {
      pillars: ['壬午', '己酉', '戊午', '庚申'],
      note: '原典史春芳精确例型壬午、己酉、戊午、庚申，酉中辛伤官当令而壬偏财、庚食神明透；只保存伤官生财的组成事实，身强有根与贵格结论均须另审',
    },
    {
      pillars: ['甲子', '乙亥', '辛未', '戊子'],
      note: '原典罗状元精确例型甲子、乙亥、辛未、戊子，亥中壬伤官与甲财同藏，亥未为三合拱木固定关系；只列化伤为财候选，不因拱局直接认定已经化木或推导功名',
    },
    {
      pillars: ['己卯', '丁丑', '丙寅', '庚寅'],
      note: '原典秦龙图精确例型己卯、丁丑、丙寅、庚寅，己伤官与庚偏财明透，丑月藏己伤官及辛正财；只保存财伤同根月令的类别事实，不据此推导贵秀',
    },
    {
      pillars: ['壬申', '丙午', '甲午', '壬申'],
      note: '原典孛罗平章精确例型壬申、丙午、甲午、壬申，午中丁伤官当令而壬偏印两透并在申中有根；只保存夏木伤官佩印结构，不以印的数量判根深、身弱或富贵',
    },
    {
      pillars: ['丁酉', '己酉', '戊子', '壬子'],
      note: '原典都统制精确例型丁酉、己酉、戊子、壬子，丁正印在年、壬偏财在时，中隔己与戊而不相邻；只保存财印隔位两清与秋金水寒见火的条件事实，不判财太重或调候成败',
    },
    {
      pillars: ['壬戌', '己酉', '戊午', '丁巳'],
      note: '原典丞相精确例型壬戌、己酉、戊午、丁巳，壬偏财在年、丁正印在时，中隔己与戊而不相邻；只保存财印隔位两清事实，不判印太重或贵格',
    },
    {
      pillars: ['己未', '丙子', '庚子', '丙子'],
      note: '原典蔡贵妃精确例型己未、丙子、庚子、丙子，子中癸伤官当令、丙七杀两透，未中藏己正印并同时藏乙正财；只保存杀生印、印制伤的条件组件，并明确本例不能闭合全局无财',
    },
    {
      pillars: ['戊申', '甲子', '庚午', '丁丑'],
      note: '原典金水伤官用官精确例型戊申、甲子、庚午、丁丑，子中癸伤官藏而不透，丁正官、甲偏财、戊偏印明透；只保存财印辅官且官伤不并透的客观条件，不推导官禄贵格',
    },
    {
      pillars: ['丙申', '己亥', '辛未', '己亥'],
      note: '原典郑丞相精确例型丙申、己亥、辛未、己亥，冬金亥月藏壬伤官，丙正官明透且亥未为三合拱木固定关系；只保存用官兼化伤为财候选，不认定拱局已经化木或推导富贵',
    },
    {
      pillars: ['甲子', '壬申', '己亥', '辛未'],
      note: '原典章丞相精确例型甲子、壬申、己亥、辛未，非金日主申月藏庚伤官，申子半合水为财星固定关系且甲正官明透；只保存化伤为财若成立后转按财生官复核的条件，不直接排除伤官见官或推导贵格',
    },
  ];
  exactExamples.forEach((example) => {
    if (isExact(...example.pillars)) notes.push(example.note);
  });

  if (!structure.isHurtPattern) return notes;

  notes.push(
    '伤官格变化较多，气候、强弱、喜忌与纯杂均须全局审查；当前只记录能够客观闭合的条件事实，不以任一单项关系执定成败',
  );

  if (structure.wealthStems.length > 0) {
    notes.push(
      `伤官格见${formatStems(structure.wealthStems)}明透，具“伤官生财”的局部结构；身强且有根、伤财实际强弱与最终取舍仍须全局复核`,
    );
  }

  if (structure.wealthTransformationFacts.length > 0) {
    notes.push(
      `${structure.wealthTransformationFacts
        .map(
          (fact) =>
            `月支${pillars.month.zhi}参与${fact.branches.join('')}${fact.type}${fact.wuxing}（财星五行）固定关系`,
        )
        .join(
          '、',
        )}，列“化伤为财”的关系候选；三合、三会、半合、拱局或六合事实均不等于已经合化，财旺与生官结果亦须另审`,
    );
  }

  if (structure.hurtWealthShareMonth) {
    notes.push(
      `月令${pillars.month.zhi}同时藏${structure.monthHiddenHurtStems.join('、')}伤官与${structure.monthHiddenWealthStems.join('、')}财星，外干又见${formatStems(structure.hurtStems)}及${formatStems(structure.wealthStems)}，闭合“财伤同根月令”的类别事实；不以藏干层级或数量推导秀气与贵贱`,
    );
  }

  const exposedResourceSources =
    structure.resourceStems.length > 0 ? [formatStems(structure.resourceStems)] : [];
  const resourceSources = [
    ...exposedResourceSources,
    ...(structure.resourceHiddenFacts.length > 0
      ? [formatHiddenFacts(structure.resourceHiddenFacts, '印星')]
      : []),
  ];
  if (exposedResourceSources.length > 0) {
    notes.push(
      `伤官格见${exposedResourceSources.join('、')}，列“伤官佩印”的局部结构；伤旺、身稍弱、印旺根深及制伤力度均须全局复核，不按印星数量直接定成败`,
    );
  }

  if (structure.hasMixedResources) {
    notes.push(
      `${formatStems(structure.directResourceStems)}与${formatStems(structure.indirectResourceStems)}同见，形成偏正印叠出结构；原典所说“不秀”仍以印旺极深、伤轻身重等强弱条件为前提，当前不由叠出数量直接判定`,
    );
  }

  if (structure.wealthResourcePairs.length > 0) {
    if (structure.hasSeparatedWealthResources) {
      notes.push(
        `${structure.wealthResourcePairs
          .map(
            ({ wealth, resource }) =>
              `${wealth.label}${wealth.stem}${wealth.tenGod}与${resource.label}${resource.stem}${resource.tenGod}外干隔位`,
          )
          .join(
            '、',
          )}，闭合伤官兼用财印的“干头两清而不相碍”客观位置条件；财太旺而带印或印太重而带财均不能由数量代判`,
      );
    } else if (structure.hasAdjacentWealthResourceConflict) {
      notes.push(
        `${structure.wealthResourcePairs
          .filter((pair) => pair.isAdjacent)
          .map(
            ({ wealth, resource }) =>
              `${wealth.label}${wealth.stem}${wealth.tenGod}与${resource.label}${resource.stem}${resource.tenGod}相邻`,
          )
          .join(
            '、',
          )}，财克印在干头直接相碍，当前不能闭合“两清不相碍”；其他隔位组合与强弱调停仍须另审`,
      );
    }
  }

  if (structure.killerStems.length > 0 && resourceSources.length > 0) {
    const hasNoWealth =
      structure.wealthStems.length === 0 && structure.wealthHiddenFacts.length === 0;
    const wealthBoundary = hasNoWealth
      ? '；四柱明透及藏干均未见财星，闭合“无财”的客观边界'
      : `；另见${[
          ...(structure.wealthStems.length > 0 ? [formatStems(structure.wealthStems)] : []),
          ...(structure.wealthHiddenFacts.length > 0
            ? [formatHiddenFacts(structure.wealthHiddenFacts, '财星')]
            : []),
        ].join('、')}，未闭合“无财”边界`;
    notes.push(
      `伤官格见${formatStems(structure.killerStems)}与${resourceSources.join('、')}，具“伤官用杀印”的组成候选${wealthBoundary}；伤多身弱、杀生印与印帮身制伤的实际力度仍须复核`,
    );
  }

  if (structure.isSummerWoodHurt && exposedResourceSources.length > 0) {
    notes.push(
      `夏月木日主以火伤官取格，又见${exposedResourceSources.join('、')}水印，列“夏木见水”的调候类别候选；火炎木燥、身弱印深及调候成败均不能由月份或印数单独闭合`,
    );
  }

  if (structure.isMetalWaterHurt && structure.officerStems.length > 0) {
    const helperBoundary =
      structure.wealthStems.length > 0 && structure.resourceStems.length > 0
        ? `，同时${formatStems(structure.wealthStems)}与${formatStems(structure.resourceStems)}明透为财印辅助`
        : '，但财印是否俱备的辅助条件尚未闭合';
    const hurtBoundary =
      structure.hurtStems.length === 0
        ? '，且伤官藏而未透，闭合官伤不并透条件'
        : `，另见${formatStems(structure.hurtStems)}伤官明透，未闭合官伤不并透条件`;
    notes.push(
      `金日主以月令水伤官取格而见${formatStems(structure.officerStems)}明透，列“金水伤官用官”的气候类别候选${helperBoundary}${hurtBoundary}；不据此直接认定清格或贵格`,
    );
  }

  if (
    structure.isMetalWaterHurt &&
    structure.officerStems.length > 0 &&
    structure.wealthTransformationFacts.length > 0
  ) {
    notes.push(
      '冬金用官同时见化伤为财的固定关系候选；合化、财旺与官星得用均须分别复核，不因会合关系直接定成败',
    );
  }

  if (
    !structure.isMetalWaterHurt &&
    structure.officerStems.length > 0 &&
    structure.wealthTransformationFacts.length > 0
  ) {
    notes.push(
      '非金水伤官见官而同时具化伤为财的固定关系候选；只有合化另经全局成立后，方可转按财旺生官复核，当前不直接排除伤官见官冲突',
    );
  }

  if (structure.hasOfficerKillerMixture) {
    if (structure.clearingComponents.length > 0) {
      notes.push(
        `${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}并透，另见${structure.clearingComponents
          .map(({ method, target, partner }) =>
            method === '伤官制官'
              ? `${partner.label}${partner.stem}伤官制${target.label}${target.stem}正官`
              : `${target.label}${target.stem}${target.tenGod}与${partner.label}${partner.stem}${partner.tenGod}相邻五合`,
          )
          .join('、')}作为干头取清组件候选；制、合事实均不等于官杀已经取清`,
      );
    } else {
      notes.push(
        `${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}并透，但外干未见伤官制官或相邻五合取清组件；金水伤官亦不能仅凭官杀同见宣称已经取清`,
      );
    }
  }

  return notes;
}

/**
 * 复算《子平真诠》“论建禄月劫”中能够由四柱闭合的财官杀食取用、
 * 财印相随、固定会合、制伏与取清组件。
 * 根多、轻重、合化、去留、制伏力度及贵贱均不由数量或单项关系代替。
 */
function collectLuPatternNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeLuPatternStructure(pillars, patternName, getTenGod);
  const notes: string[] = [];
  const dayMaster = pillars.day.gan;
  const isExact = (year: string, month: string, day: string, hour: string) =>
    pillars.year.ganZhi === year &&
    pillars.month.ganZhi === month &&
    pillars.day.ganZhi === day &&
    pillars.hour.ganZhi === hour;
  const formatStems = (facts: typeof structure.exposedStems) =>
    facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');
  const formatHiddenFacts = (facts: typeof structure.wealthHiddenFacts) =>
    facts
      .map(
        (fact) =>
          `${fact.label}${fact.branch}藏${fact.hiddenStems
            .map((stem) => `${stem}${getTenGod(stem, dayMaster)}`)
            .join('、')}`,
      )
      .join('、');
  const formatFormations = (facts: typeof structure.wealthFormationFacts) =>
    facts.map((fact) => `${fact.branches.join('')}${fact.type}${fact.wuxing}固定关系`).join('、');
  const exactExamples: Array<{
    pillars: [string, string, string, string];
    note: string;
  }> = [
    {
      pillars: ['庚戌', '戊子', '癸酉', '癸亥'],
      note: '原典建禄用官印护精确例型庚戌、戊子、癸酉、癸亥，癸日子月真禄，戊正官与庚正印明透；只保存官印相随的组成事实，不据同见直接判印已护官或贵格成立',
    },
    {
      pillars: ['丁酉', '丙午', '丁巳', '壬寅'],
      note: '原典建禄用官财助精确例型丁酉、丙午、丁巳、壬寅，丁日午月真禄，壬正官明透且酉藏辛偏财；只保存官透与财根相随事实，不据藏根数量判财旺、官旺或贵格成立',
    },
    {
      pillars: ['庚午', '戊子', '癸卯', '丁巳'],
      note: '原典建禄官隔财印精确例型庚午、戊子、癸卯、丁巳，癸日子月真禄，年干庚印、月干戊官、时干丁财依次明透且官居财印之间；只保存外干实际隔位关系，不据排列直接判财印两不相碍或格局成立',
    },
    {
      pillars: ['甲子', '丙子', '癸丑', '壬子'],
      note: '原典建禄用财带伤食精确例型甲子、丙子、癸丑、壬子，癸日子月真禄，丙正财与甲伤官明透；当前《子平真诠评注》底本文字作壬辰，但癸日辰时依法应为丙辰，《神峰通考》同一张都统命两处均作合法的壬子，故按壬子校勘；只保存食伤转劫生财的组成候选，不据同见直接判转关成功',
    },
    {
      pillars: ['己未', '己巳', '丁未', '辛丑'],
      note: '原典建禄化劫为财精确例型己未、己巳、丁未、辛丑，丁日巳月本气丙为劫财，属于月劫而非禄位，巳丑构成拱金固定关系且辛偏财明透；只保存化劫为财候选，不认定拱局已经合化',
    },
    {
      pillars: ['庚子', '甲申', '庚子', '甲申'],
      note: '原典建禄化劫为生精确例型庚子、甲申、庚子、甲申，庚日申月真禄，申子半合水食神并见甲偏财明透；只保存化劫为生及食神生财候选，不认定半合已经合化',
    },
    {
      pillars: ['丁巳', '壬子', '癸卯', '己未'],
      note: '原典建禄用杀制伏精确例型丁巳、壬子、癸卯、己未，癸日子月真禄，己七杀明透、卯未半合木食伤且丁财与壬劫财五合；只保存制杀与财被合的固定组件，不认定半合或五合已经成化',
    },
    {
      pillars: ['戊辰', '癸亥', '壬午', '丙午'],
      note: '原典建禄合杀存财精确例型戊辰、癸亥、壬午、丙午，壬日亥月真禄，戊七杀与丙偏财明透且戊癸五合；只保存财党杀冲突与合杀存财候选，不认定七杀已合去或财星已留',
    },
    {
      pillars: ['甲子', '丙寅', '甲子', '丙寅'],
      note: '原典春木建禄用食神精确例型甲子、丙寅、甲子、丙寅，甲日寅月真禄，丙食神两透而无财官杀明透；只保存春木用食神的气候类别，不据明透次数判食神有力或贵格成立',
    },
    {
      pillars: ['癸卯', '庚申', '庚子', '庚辰'],
      note: '原典秋金建禄用伤官精确例型癸卯、庚申、庚子、庚辰，庚日申月真禄，癸伤官明透而无财官杀明透；只保存秋金用伤官的气候类别，不据申子辰三合直接认定合化或格局成立',
    },
    {
      pillars: ['辛丑', '庚寅', '甲辰', '乙亥'],
      note: '原典建禄合杀留官精确例型辛丑、庚寅、甲辰、乙亥，甲日寅月真禄，辛正官、庚七杀并透且乙劫财与庚七杀五合；只保存合杀留官候选，不认定七杀已合去、官杀已清或贵格成立',
    },
    {
      pillars: ['辛亥', '庚寅', '甲申', '丙寅'],
      note: '原典建禄制杀留官精确例型辛亥、庚寅、甲申、丙寅，甲日寅月真禄，辛正官、庚七杀与丙食神并透；只保存食神制杀留官候选，不据同见直接判制伏适度或官杀已清',
    },
    {
      pillars: ['己酉', '乙亥', '壬戌', '庚子'],
      note: '原典建禄合伤存官精确例型己酉、乙亥、壬戌、庚子，壬日亥月真禄，己正官、乙伤官、庚偏印并透且乙庚五合；只保存官伤冲突与合伤存官候选，不认定伤官已合去或官星已存',
    },
  ];
  exactExamples.forEach((example) => {
    if (isExact(...example.pillars)) notes.push(example.note);
  });

  if (!structure.isLuMonthRobPattern) return notes;

  notes.push(
    structure.isLuPattern
      ? `日主${dayMaster}月支${pillars.month.zhi}确为禄位，建禄本身不直接充当用神；当前只从财官杀食的明透、会支及固定制合关系列取用候选，不把建禄本身或单项关系直接判成凶吉、贵贱和现实事件`
      : `日主${dayMaster}月支${pillars.month.zhi}本气为劫财，确属月劫而非阳刃；月劫本身不直接充当用神，当前只从财官杀食的明透、会支及固定制合关系列取用候选，不把月劫本身或单项关系直接判成凶吉、贵贱和现实事件`,
  );

  if (structure.officerStems.length > 0) {
    const resourceAssist =
      structure.resourceStems.length > 0 || structure.resourceHiddenFacts.length > 0;
    const wealthAssist = structure.wealthStems.length > 0 || structure.wealthHiddenFacts.length > 0;
    const assistFacts = [
      structure.resourceStems.length > 0 ? formatStems(structure.resourceStems) : '',
      structure.resourceHiddenFacts.length > 0
        ? formatHiddenFacts(structure.resourceHiddenFacts)
        : '',
      structure.wealthStems.length > 0 ? formatStems(structure.wealthStems) : '',
      structure.wealthHiddenFacts.length > 0 ? formatHiddenFacts(structure.wealthHiddenFacts) : '',
    ].filter(Boolean);
    if (resourceAssist || wealthAssist) {
      const methods = [resourceAssist ? '印护官' : '', wealthAssist ? '财助官' : ''].filter(
        Boolean,
      );
      notes.push(
        `禄劫用官候选见${formatStems(structure.officerStems)}明透，并见${assistFacts.join('、')}，列${methods.join('、')}的“财印相随”组件；藏根只证明同类存在，能否护官、生官及实际轻重仍须全局复核`,
      );
    } else {
      notes.push(
        `禄劫用官候选见${formatStems(structure.officerStems)}明透，但外干及四支均未见财印同类事实，列“孤官无辅”的缺项候选；不据当前缺项直接判定破格或贫贱`,
      );
    }

    if (structure.officerSeparationFacts.length > 0) {
      notes.push(
        `${structure.officerSeparationFacts
          .map(
            ({ wealth, officer, resource }) =>
              `${officer.label}${officer.stem}正官位于${wealth.label}${wealth.stem}${wealth.tenGod}与${resource.label}${resource.stem}${resource.tenGod}之间`,
          )
          .join('、')}，闭合原典“官隔财印”的外干位置事实；隔位不等于财印必然两不相碍或格局已经成立`,
      );
    }

    if (structure.hurtStems.length > 0) {
      const combinationFacts = structure.resourceHurtCombinationFacts;
      notes.push(
        `禄劫用官候选同时见${formatStems(structure.hurtStems)}明透，列官伤冲突${
          combinationFacts.length > 0
            ? `；另见${combinationFacts
                .map(
                  ({ target, partner }) =>
                    `${target.label}${target.stem}伤官与${partner.label}${partner.stem}${partner.tenGod}五合`,
                )
                .join('、')}，作为“合伤存官”的固定救应候选`
            : '，且未见印星五合伤官的固定救应组件'
        }；不据五合直接认定伤官已去、官星已存或全局破格`,
      );
    }
  }

  const completeMonthWealthFormations = structure.wealthFormationFacts.filter(
    (fact) => fact.includesMonthBranch && (fact.type === '三合' || fact.type === '三会'),
  );
  const hasWealthUse = structure.wealthStems.length > 0 || completeMonthWealthFormations.length > 0;
  if (hasWealthUse) {
    const wealthUseFacts = [
      structure.wealthStems.length > 0 ? formatStems(structure.wealthStems) : '',
      completeMonthWealthFormations.length > 0
        ? formatFormations(completeMonthWealthFormations)
        : '',
    ].filter(Boolean);
    const outputFacts = [
      structure.outputStems.length > 0 ? formatStems(structure.outputStems) : '',
      structure.outputFormationFacts.length > 0
        ? formatFormations(structure.outputFormationFacts)
        : '',
    ].filter(Boolean);
    if (outputFacts.length > 0) {
      notes.push(
        `禄劫用财候选见${wealthUseFacts.join('、')}，并见${outputFacts.join('、')}，列食伤转劫生财的组成候选；食伤轻重、会合成化与转关是否有效仍须全局复核`,
      );
    } else {
      notes.push(
        `禄劫用财候选见${wealthUseFacts.join('、')}，但未见食伤明透或固定会合关系，列“用财无食伤”的转关缺项；不据缺项直接判定破格或贫贱`,
      );
    }
  }

  if (structure.monthWealthTransformationFacts.length > 0) {
    notes.push(
      `${structure.isLuPattern ? '月支禄位' : '月劫月支'}参与${formatFormations(structure.monthWealthTransformationFacts)}，列“化劫为财”的固定结构候选；半合、拱局或三支齐全都不等于已经合化、财格成立或最终取用完成`,
    );
  }
  if (structure.monthOutputTransformationFacts.length > 0) {
    notes.push(
      `${structure.isLuPattern ? '月支禄位' : '月劫月支'}参与${formatFormations(structure.monthOutputTransformationFacts)}，列“化劫为生”的固定结构候选；半合、拱局或三支齐全都不等于已经合化、食伤有力或最终取用完成`,
    );
  }

  if (structure.killerStems.length > 0) {
    const controlFacts = [
      structure.outputStems.length > 0 ? formatStems(structure.outputStems) : '',
      structure.outputFormationFacts.length > 0
        ? formatFormations(structure.outputFormationFacts)
        : '',
    ].filter(Boolean);
    if (controlFacts.length > 0) {
      notes.push(
        `禄劫用杀候选见${formatStems(structure.killerStems)}明透，并见${controlFacts.join('、')}，列食伤制伏七杀的组成候选；制杀力度、杀食轻重与制伏是否适度仍须全局复核`,
      );
    } else {
      notes.push(
        `禄劫用杀候选见${formatStems(structure.killerStems)}明透，但未见食伤明透或固定会合关系，列“用杀无制伏”的冲突候选；不据当前缺项直接判定七杀重、身危或全局破格`,
      );
    }

    if (structure.wealthStems.length > 0) {
      notes.push(
        `${formatStems(structure.killerStems)}与${formatStems(structure.wealthStems)}同透，列“财党杀”的冲突候选；财杀轻重及是否转为相生有情不能由同见直接认定`,
      );
      if (structure.killerCombinationFacts.length > 0) {
        notes.push(
          `${structure.killerCombinationFacts
            .map(
              ({ target, partner }) =>
                `${target.label}${target.stem}七杀与${partner.label}${partner.stem}${partner.tenGod}五合`,
            )
            .join(
              '、',
            )}，并见财星明透，列“合杀存财”的固定取清候选；五合不等于七杀已去、财星已存或格局已经取清`,
        );
      }
    }
  }

  const hasControlUse = structure.officerStems.length > 0 || structure.killerStems.length > 0;
  if (!hasWealthUse && !hasControlUse && structure.outputStems.length > 0) {
    const climateFacts = [
      structure.isSpringWood && structure.foodStems.length > 0 ? '春木用食神' : '',
      structure.isAutumnMetal && structure.hurtStems.length > 0 ? '秋金用伤官' : '',
    ].filter(Boolean);
    notes.push(
      `外干未见财官杀且月支未参与财类完整会局，另见${formatStems(structure.outputStems)}明透，列“无财官而用伤食”的候选${climateFacts.length > 0 ? `，并闭合${climateFacts.join('、')}气候类别` : ''}；气候类别不等于食伤有力、调候完成或贵格成立`,
    );
  }

  if (structure.hasOfficerKillerMixture) {
    const clearingFacts = [
      structure.killerCombinationFacts.length > 0 ? '五合七杀，候选合杀留官' : '',
      structure.outputStems.length > 0 ? '食伤明透，候选制杀留官' : '',
    ].filter(Boolean);
    notes.push(
      `${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}并透，${
        clearingFacts.length > 0
          ? `另见${clearingFacts.join('、')}的取清组件`
          : '但未见五合七杀或食伤明透的取清组件，官杀混杂待复核'
      }；制合事实不等于已经取清，留官留杀与最终成败仍须全局复核`,
    );
  }

  if (structure.officerStems.length >= 2) {
    notes.push(
      `${formatStems(structure.officerStems)}两处以上正官竞出，${
        structure.hurtStems.length > 0
          ? `另见${formatStems(structure.hurtStems)}明透，列伤官制伏竞官的组成候选`
          : '未见伤官明透，列“两官竞出无伤制伏”的冲突候选'
      }；不据官星数量或单一伤官直接判定官重、制伏适度或最终成败`,
    );
  }

  const controlStems = [...structure.officerStems, ...structure.killerStems];
  if (
    controlStems.length >= 2 &&
    structure.outputStems.length === 0 &&
    structure.outputFormationFacts.length === 0
  ) {
    notes.push(
      `${formatStems(controlStems)}同见而未见食伤制伏组件；只记录“官杀多见且无制伏”的客观边界，不据数量直接称官杀重、日主弱、身危、破格或贫贱`,
    );
  }

  return notes;
}

/**
 * 复算《子平真诠》“论阳刃”中能够由四柱闭合的真刃、官杀制刃、透刃五合、
 * 财印伤食配合、化刃为印固定结构与用财转生组件。
 * 根深、轻重、合化、制刃力度、贪合忘克及贵贱均不由数量或单项关系代替。
 */
function collectBladePatternNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeBladePatternStructure(pillars, patternName, getTenGod);
  const notes: string[] = [];
  const dayMaster = pillars.day.gan;
  const isExact = (year: string, month: string, day: string, hour: string) =>
    pillars.year.ganZhi === year &&
    pillars.month.ganZhi === month &&
    pillars.day.ganZhi === day &&
    pillars.hour.ganZhi === hour;
  const formatStems = (facts: typeof structure.exposedStems) =>
    facts.map((fact) => `${fact.label}${fact.stem}${fact.tenGod}`).join('、');
  const formatHiddenFacts = (facts: typeof structure.officerKillerHiddenFacts) =>
    facts
      .map(
        (fact) =>
          `${fact.label}${fact.branch}藏${fact.hiddenStems
            .map((stem) => `${stem}${getTenGod(stem, dayMaster)}`)
            .join('、')}`,
      )
      .join('、');
  const formatFormations = (facts: typeof structure.fireFormationFacts) =>
    facts.map((fact) => `${fact.branches.join('')}${fact.type}${fact.wuxing}固定结构`).join('、');

  const exactExamples: Array<{
    pillars: [string, string, string, string];
    note: string;
  }> = [
    {
      pillars: ['己酉', '丙子', '壬寅', '丙午'],
      note: '原典阳刃用官精确例型己酉、丙子、壬寅、丙午，壬日子月真刃，己正官与丙偏财明透并见午中丁财；只保存官透、财助及官杀根气待审的组成事实，不以财数或支数判官根深、贵格大小',
    },
    {
      pillars: ['辛酉', '甲午', '丙申', '壬辰'],
      note: '原典阳刃露杀精确例型辛酉、甲午、丙申、壬辰，丙日午月真刃，壬七杀、辛正财与甲偏印明透，申中藏壬七杀而辰中藏癸正官；只保存杀透、财印相随及官杀藏根事实，不以藏根支数、层级或明透数量判根浅与贵格',
    },
    {
      pillars: ['甲午', '癸酉', '庚寅', '戊寅'],
      note: '原典穆同知精确例型甲午、癸酉、庚寅、戊寅，庚日酉月真刃，癸伤官明透而午藏丁官，戊偏印与癸伤官五合；只保存伤食见官与印护固定组件，不认定五合已经成化、官星已获保护或贵格成立',
    },
    {
      pillars: ['甲寅', '庚午', '戊申', '甲寅'],
      note: '原典贾平章精确例型甲寅、庚午、戊申、甲寅，戊日午月真刃，甲七杀两透并在寅中有根、庚食神明透；只保存食神制杀的裁损组件，杀太重、根太重与制杀适度均须全局复核',
    },
    {
      pillars: ['丙戌', '丁酉', '庚申', '壬午'],
      note: '原典阳刃官杀取清精确例型丙戌、丁酉、庚申、壬午，庚日酉月真刃，丙七杀、丁正官、壬食神并透，壬与丁五合；只保存合官留杀的固定取清组件，五合不等于已经合化、官杀已清或贵格成立',
    },
  ];
  exactExamples.forEach((example) => {
    if (isExact(...example.pillars)) notes.push(example.note);
  });

  if (!structure.isBladePattern) return notes;

  notes.push(
    `日主${dayMaster}为五阳干，月支${pillars.month.zhi}确为其真阳刃位${structure.bladeStem ? `且藏${structure.bladeStem}劫财` : ''}；当前只核验官杀伏制、财印伤食配合与固定取清组件，不把阳刃本身直接判成凶吉、贵贱或现实事件`,
  );

  const controlStems = [...structure.officerStems, ...structure.killerStems].sort(
    (left, right) => left.columnIndex - right.columnIndex,
  );
  if (controlStems.length > 0) {
    const rootBoundary = structure.officerKillerHiddenFacts.length
      ? `；四支另见${formatHiddenFacts(structure.officerKillerHiddenFacts)}，只证明存在官杀同类藏根，不按根数或藏干层级判“根深”`
      : '；四支未见官杀同类藏干，但“根浅”及制刃力度仍不能仅由当前缺项直接定案';
    notes.push(
      `月刃格见${formatStems(controlStems)}明透，列官杀制刃的组成候选${rootBoundary}；官杀有力、藏露高低及最终成败仍须全局复核`,
    );
  } else if (structure.officerKillerHiddenFacts.length > 0) {
    notes.push(
      `外干未见官杀，四支见${formatHiddenFacts(structure.officerKillerHiddenFacts)}，只闭合“官杀藏而不露”的客观类别；不据藏干数量判根深、贵格高低或已经制刃`,
    );
  }

  if (
    controlStems.length > 0 &&
    (structure.wealthStems.length > 0 || structure.resourceStems.length > 0)
  ) {
    const accompanying = [...structure.wealthStems, ...structure.resourceStems].sort(
      (left, right) => left.columnIndex - right.columnIndex,
    );
    notes.push(
      `官杀制刃候选同时见${formatStems(accompanying)}明透，列“财印相随”的客观配合；财能否生官杀、印能否护制及实际轻重不得由同见直接闭合`,
    );
  }

  if (structure.officerStems.length > 0 && structure.bladeStems.length > 0) {
    notes.push(
      `阳刃用官候选另见${formatStems(structure.bladeStems)}透出；对应原典“透刃不虑”的局部边界，但官星根气、受合受制与全局配合仍须另审`,
    );
  }

  if (structure.bladeKillerCombinationFacts.length > 0) {
    notes.push(
      `${structure.bladeKillerCombinationFacts
        .map(
          ({ left, right }) =>
            `${left.label}${left.stem}刃星与${right.label}${right.stem}七杀构成天干五合固定关系`,
        )
        .join(
          '、',
        )}；列阳刃露杀又透刃时“贪合忘克”的冲突候选，五合事实不等于已经合化、七杀必然失去制刃作用或格局无成`,
    );
  }

  if (controlStems.length > 0 && structure.outputStems.length > 0) {
    notes.push(
      `官杀制刃候选同时见${formatStems(structure.outputStems)}明透，形成制刃带伤食结构；只在印护、官杀太重需裁损或官杀轻需取清等条件另经全局成立时复核，不据伤食同见直接定成败`,
    );
    if (structure.resourceStems.length > 0) {
      const combinationBoundary = structure.resourceOutputCombinationFacts.length
        ? `，其中${structure.resourceOutputCombinationFacts
            .map(
              ({ left, right }) =>
                `${left.label}${left.stem}${left.tenGod}与${right.label}${right.stem}${right.tenGod}有天干五合固定关系`,
            )
            .join('、')}`
        : '';
      notes.push(
        `${formatStems(structure.resourceStems)}与伤食同见${combinationBoundary}，列“印护”候选；五合、制伤或护官杀结果均不得由同见直接认定`,
      );
    }
    if (structure.killerStems.length > 0) {
      notes.push(
        `${formatStems(structure.killerStems)}与${formatStems(structure.outputStems)}同透，只在七杀太重另经全局成立时列伤食裁损候选；不以七杀透出次数、藏根支数或单一食伤判杀重与制伏适度`,
      );
    }
  }

  if (structure.hasOfficerKillerMixture) {
    if (structure.clearingComponents.length > 0) {
      notes.push(
        `${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}并透，另见${structure.clearingComponents
          .map(({ method, officer, output }) =>
            method === '伤官制官'
              ? `${output.label}${output.stem}伤官制${officer.label}${officer.stem}正官`
              : `${output.label}${output.stem}${output.tenGod}与${officer.label}${officer.stem}正官五合`,
          )
          .join('、')}，列阳刃格利留杀的取清组件候选；制合事实不等于官星已去、七杀已留或清格完成`,
      );
    } else {
      notes.push(
        `${formatStems(structure.officerStems)}与${formatStems(structure.killerStems)}并透，但外干未见伤官制官或食伤五合正官的实际取清组件；保持官杀混杂，不因月刃喜杀直接宣称已经留杀取清`,
      );
    }
  }

  if (
    structure.isBingWuBlade &&
    (controlStems.length > 0 || structure.officerKillerHiddenFacts.length > 0)
  ) {
    const supportFacts = [...structure.wealthStems, ...structure.resourceStems].sort(
      (left, right) => left.columnIndex - right.columnIndex,
    );
    const supportBoundary =
      supportFacts.length > 0
        ? `；另见${formatStems(supportFacts)}，保存带财佩印的配合事实`
        : '；外干财印配合尚未出现';
    notes.push(
      `丙日生午月，月令午内藏己伤官，对水官杀存在局部制约${supportBoundary}；水火轻重、己土是否实际克水及财印能否救应均须全局复核`,
    );
  }

  if (structure.hasWuFireTransformationCandidate) {
    notes.push(
      `戊日生午月，外干透丙偏印且月支参与${formatFormations(structure.fireFormationFacts)}，列“化刃为印”的固定结构候选；三支齐全与丙印明透均不等于已经合化或刃已转印`,
    );
    if (controlStems.length > 0) {
      notes.push(
        `化刃为印候选同时见${formatStems(controlStems)}明透，列“去刃存印”的进一步复核方向；官杀强弱、会局成化与清格结果仍不得提前闭合`,
      );
    }
    if (structure.wealthStems.length > 0 && structure.killerStems.length > 0) {
      notes.push(
        `化刃为印候选又见${formatStems(structure.wealthStems)}与${formatStems(structure.killerStems)}财杀并露，保存财坏印、财生杀与杀制刃之间的冲突；不得直接套作“生杀制刃”或输出富贵两空结论`,
      );
    }
  }

  const wealthUseSources = [
    ...(structure.wealthStems.length > 0 ? [formatStems(structure.wealthStems)] : []),
    ...(structure.wealthFormationFacts.length > 0
      ? [formatFormations(structure.wealthFormationFacts)]
      : []),
  ];
  if (wealthUseSources.length > 0) {
    const wealthRootBoundary =
      structure.wealthHiddenFacts.length > 0
        ? `；四支见${formatHiddenFacts(structure.wealthHiddenFacts)}，只证明存在财根，不按支数或藏干层级判“财根深”`
        : '；四支未见财星藏干，原典“财根深”前提尚未闭合';
    const outputUseSources = [
      ...(structure.outputStems.length > 0 ? [formatStems(structure.outputStems)] : []),
      ...(structure.outputFormationFacts.length > 0
        ? [formatFormations(structure.outputFormationFacts)]
        : []),
    ];
    if (outputUseSources.length > 0) {
      notes.push(
        `月刃格见${wealthUseSources.join('、')}财星取用事实${wealthRootBoundary}；另见${outputUseSources.join('、')}伤食来源，列“转刃生财”的组成候选，不据此直接认定财根深、已经转生、取贵或就富`,
      );
    } else {
      notes.push(
        `月刃格见${wealthUseSources.join('、')}财星取用事实${wealthRootBoundary}，但未见伤食明透或完整会局作为转关组件；保存刃财相搏的局部冲突，不据单项直接宣称不成局`,
      );
    }
  }

  return notes;
}

/**
 * 复算《子平真诠》“论七杀”中能够由四柱闭合的食伤制杀、杀印、财印食取清、
 * 杂气无财透与官杀去留组件。强弱、合化、取清结果及贵贱均不由单项结构代替。
 */
function collectKillerPatternNotes(
  pillars: Pillars,
  patternName: string,
  getTenGod: GetTenGodFn,
): string[] {
  const structure = analyzeKillerPatternStructure(pillars, patternName, getTenGod);
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
      pillars: ['乙亥', '乙酉', '乙卯', '丁丑'],
      note: '原典七杀食制精确例型乙亥、乙酉、乙卯、丁丑，酉中辛七杀当令而丁食神明透；只保存杀用食制的组成事实，杀旺、食强、身健及贵格结论均须另审',
    },
    {
      pillars: ['壬辰', '甲辰', '丙戌', '戊戌'],
      note: '原典脱丞相精确例型壬辰、甲辰、丙戌、戊戌，原文称辰中暗杀而年干壬七杀透出，戊食神透时且甲偏印在月；只保存印先食后及印制食的局部关系，不把壬列作标准辰支藏干，也不以戊土数量判食太重',
    },
    {
      pillars: ['丙寅', '戊戌', '壬戌', '辛丑'],
      note: '原典何参政精确例型丙寅、戊戌、壬戌、辛丑，戌中戊七杀与辛正印分别透于月、时，同通月令；只保存杀印有情的局部结构，不据此判断贵格',
    },
    {
      pillars: ['戊戌', '甲子', '丁未', '庚戌'],
      note: '原典周丞相精确例型戊戌、甲子、丁未、庚戌，戊伤官、甲正印与庚正财同透；只保存财去印存食伤的取清候选，伤官在本例作为制杀输出，不由此判杀食轻重或大贵',
    },
    {
      pillars: ['甲申', '乙亥', '丙戌', '庚寅'],
      note: '原典刘运使精确例型甲申、乙亥、丙戌、庚寅，甲乙印星与庚偏财明透且寅亥六合；只保存身重杀轻、杀化印若成立时借财清格的条件候选，寅亥六合不等于已经化木',
    },
    {
      pillars: ['癸卯', '丁巳', '庚寅', '庚辰'],
      note: '原典岳统制精确例型癸卯、丁巳、庚寅、庚辰，巳中丙七杀当令、丁正官与癸伤官明透；只保存伤官去官留杀的取清候选，不宣称已经取清',
    },
    {
      pillars: ['丙子', '甲午', '辛亥', '辛卯'],
      note: '原典沈郎中精确例型丙子、甲午、辛亥、辛卯，午中丁七杀当令、丙正官明透且子午相冲，子中癸食神克杀；只保存去杀留官的取清候选，不以一冲直接判定取清完成',
    },
    {
      pillars: ['戊辰', '甲寅', '戊寅', '戊午'],
      note: '原典赵员外精确例型戊辰、甲寅、戊寅、戊午，甲七杀明透而外干无食伤，寅午均藏丙偏印；只保存无食制而用印的组成事实，印是否用当仍须全局复核',
    },
  ];
  exactExamples.forEach((example) => {
    if (isExact(...example.pillars)) notes.push(example.note);
  });

  if (!structure.isKillerPattern) return notes;

  if (structure.outputStems.length > 0) {
    const hurtBoundary =
      structure.hurtStems.length > 0
        ? '；其中伤官只按周丞相原例保留为食伤输出，不把伤官与食神机械视为完全相同'
        : '';
    notes.push(
      `七杀格见${formatStems(structure.outputStems)}明透，列“杀用食制”的局部结构${hurtBoundary}；杀旺、食强、身健与制杀力度均须全局复核`,
    );
  }

  if (structure.outputStems.length > 0 && structure.wealthStems.length > 0) {
    notes.push(
      `${formatStems(structure.outputStems)}与${formatStems(structure.wealthStems)}同见，保留财泄食伤、生杀而妨碍制杀的一般冲突`,
    );
    if (structure.wealthOutputOrder === 'left-before-right') {
      notes.push(
        `所见财星全部先于食伤明透，后食伤仍可制杀，列“财先食后”的先后候选；该候选与财生杀的一般冲突并存`,
      );
    } else if (structure.wealthOutputOrder === 'right-before-left') {
      notes.push('所见食伤全部先于财星明透，后财仍有泄食伤、生杀的局部影响');
    } else if (structure.wealthOutputOrder === 'interleaved') {
      notes.push('财星与食伤外干位置交错，不强定“财先食后”或“食先财后”');
    }
  }

  if (structure.outputStems.length > 0 && structure.resourceStems.length > 0) {
    notes.push(
      `${formatStems(structure.outputStems)}与${formatStems(structure.resourceStems)}同见，保留印制食伤、护杀而妨碍制杀的一般冲突`,
    );
    if (structure.resourceOutputOrder === 'left-before-right') {
      notes.push(
        '所见印星全部先于食伤明透；仅在食伤太旺另经全局成立时，后食与先印可列“印损太过”的条件例外，不据此直接成格',
      );
    } else if (structure.resourceOutputOrder === 'right-before-left') {
      notes.push('所见食伤全部先于印星明透，后印仍有制食伤、护杀的局部影响');
    } else if (structure.resourceOutputOrder === 'interleaved') {
      notes.push('印星与食伤外干位置交错，不强定“印先食后”或“食先印后”');
    }
  }

  if (structure.killerStems.length > 0 && structure.resourceStems.length > 0) {
    if (structure.killerResourceShareMonth) {
      notes.push(
        `${formatStems(structure.killerStemsFromMonth)}与${formatStems(structure.resourceStemsFromMonth)}均由月令藏干透出，构成“杀印同通月令”的局部有情结构`,
      );
    } else {
      notes.push(
        `${formatStems(structure.killerStems)}与${formatStems(structure.resourceStems)}明透，但未闭合杀印同通月令；仅在杀重身轻另经全局成立时，保留转而就印的条件候选`,
      );
    }
  }

  if (
    structure.outputStems.length > 0 &&
    structure.resourceStems.length > 0 &&
    structure.wealthStems.length > 0
  ) {
    notes.push(
      '食伤、印星与财星同时明透；在印制食伤的一般冲突之外，另列财去印、保存食伤制杀的救应候选，财印食杀实际强弱仍须复核',
    );
  }

  if (
    structure.outputStems.length === 0 &&
    structure.resourceStems.length > 0 &&
    structure.wealthStems.length > 0
  ) {
    const combinationBoundary =
      structure.branchCombinationFacts.length > 0
        ? `；地支另见${structure.branchCombinationFacts
            .map(
              (fact) =>
                `${fact.leftLabel}${fact.leftBranch}与${fact.rightLabel}${fact.rightBranch}六合`,
            )
            .join('、')}，六合只记对应关系，不认定已经成化`
        : '；当前没有固定事实足以闭合“杀化印”';
    notes.push(
      `${formatStems(structure.resourceStems)}与${formatStems(structure.wealthStems)}明透而无食伤明透，列身重杀轻、杀化印若成立时借财清格的待复核方向${combinationBoundary}`,
    );
  }

  if (structure.isMixedKillerPattern && structure.wealthStems.length === 0) {
    notes.push(
      '杂气七杀格外干未见正偏财，只记录“干头不透财”的客观条件；原典虽列可取贵，本算法不据此判清格或富贵',
    );
  }

  if (structure.hasOfficerKillerMixture) {
    notes.push(
      `${formatStems(structure.officerStems)}与月令七杀或外干七杀并见，形成官杀混杂待复核，不因官杀同见就宣称已经取清`,
    );
    if (structure.hurtStems.length > 0) {
      notes.push(
        `${formatStems(structure.hurtStems)}与正官明透，列伤官去官留杀的局部取清候选；是否真正去官仍须全局复核`,
      );
    }
    if (structure.clashingOutputFacts.length > 0) {
      notes.push(
        `${structure.clashingOutputFacts
          .map(
            (fact) =>
              `${fact.label}${fact.branch}冲月令${pillars.month.zhi}且藏${fact.hiddenStems.join('、')}食伤`,
          )
          .join('、')}，列冲杀而去杀留官的局部候选；六冲事实不等于取清已经完成`,
      );
    }
  }

  if (
    structure.outputStems.length === 0 &&
    (structure.resourceStems.length > 0 || structure.resourceHiddenFacts.length > 0)
  ) {
    const resourceSources = [
      ...(structure.resourceStems.length > 0 ? [formatStems(structure.resourceStems)] : []),
      ...structure.resourceHiddenFacts.map(
        (fact) => `${fact.label}${fact.branch}藏${fact.hiddenStems.join('、')}印星`,
      ),
    ];
    notes.push(
      `七杀格外干无食伤明透而见${resourceSources.join('、')}，列“无食制而用印”的局部候选；印是否用当及杀身轻重仍须全局复核`,
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

  const hurtPatternNotes = collectHurtPatternNotes(pillars, patternName, getTenGod);
  if (hurtPatternNotes.length > 0) {
    basis += `；伤官格成败边界：${hurtPatternNotes.join('；')}；以上只记录《子平真诠》“论伤官”中能够由当前四柱闭合的明透、月令同根、财印隔位、气候类别、固定会合关系与取清组件，不改变既有格名；伤身财印官杀强弱、根深、财旺、印重、合化结果及最终取舍仍须全局复核，也不推导才学、职业、富贵贫贱、官职品级、现实事件、分数或概率`;
  }

  const luPatternNotes = collectLuPatternNotes(pillars, patternName, getTenGod);
  if (luPatternNotes.length > 0) {
    basis += `；建禄月劫成败边界：${luPatternNotes.join('；')}；以上只记录《子平真诠》“论建禄月劫”中能够由当前四柱闭合的真禄、财官杀食明透、财印藏根、半合拱局、完整会支、天干五合与取清组件，不改变既有格名；财官杀食印轻重、根多根少、制伏力度、合化去留及最终取舍仍须全局复核，也不推导性情、职业、富贵贫贱、官职品级、现实事件、分数或概率`;
  }

  const bladePatternNotes = collectBladePatternNotes(pillars, patternName, getTenGod);
  if (bladePatternNotes.length > 0) {
    basis += `；阳刃格成败边界：${bladePatternNotes.join('；')}；以上只记录《子平真诠》“论阳刃”中能够由当前四柱闭合的真刃、官杀藏透、财印伤食、天干五合、完整会局与取清组件，不改变既有格名；官杀财印伤食轻重、根深根浅、制刃力度、贪合忘克、会合成化及最终取舍仍须全局复核，也不推导性情、职业、富贵贫贱、官职品级、现实事件、分数或概率`;
  }

  const killerPatternNotes = collectKillerPatternNotes(pillars, patternName, getTenGod);
  if (killerPatternNotes.length > 0) {
    basis += `；七杀格成败边界：${killerPatternNotes.join('；')}；以上只记录《子平真诠》“论七杀”中能够由当前四柱闭合的明透、月令藏干、外干先后、地支固定关系与取清组件，不改变既有格名；杀食身印财强弱、制杀太过、五合六合成化及最终取舍仍须全局复核，也不推导富贵贫贱、官职品级、现实事件、分数或概率`;
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
