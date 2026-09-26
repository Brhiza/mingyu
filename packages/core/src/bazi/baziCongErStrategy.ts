import { BASIC_MAPPINGS, HIDDEN_STEMS } from './baziDefinitions';
import { collectEstablishedBranchFormations } from './baziFormationUtils';
import { assessStemHarmonyTransform } from './harmonyTransform';
import { collectAdjudicatedRootFacts } from './baziRootAdjudication';
import { getRootTraditionalKind, isStructuralRoot, type RootPillarPosition } from './baziRootFacts';
import type { CongErPatternAdjudication, HiddenStems, Pillars, Wuxing } from './baziTypes';
import { getSeasonStatus, getWuxing } from './baziUtils';

type GetTenGodFn = (gan: string, dayMaster: string) => string;

export interface CongErPatternAssessment {
  structuralMatch: boolean;
  established: boolean;
  route?: CongErPatternAdjudication['route'];
  matchedConditions: string[];
  evidence: string[];
  blockers: string[];
  adjudication?: CongErPatternAdjudication;
  competingPattern?: FollowWealthPriorityAssessment;
}

export interface FollowWealthPriorityAssessment {
  established: true;
  pattern: '从财格';
  route: '四支本气皆财' | '食伤当令而财归日时';
  method: '《滴天髓阐微·从象》从财法';
  evidence: string[];
}

interface VisibleStemFact {
  position: RootPillarPosition;
  stem: string;
  tenGod: string;
}

const POSITIONS: RootPillarPosition[] = ['year', 'month', 'day', 'hour'];
const POSITION_LABELS: Record<RootPillarPosition, string> = {
  year: '年干',
  month: '月干',
  day: '日干',
  hour: '时干',
};
const PILLAR_LABELS: Record<RootPillarPosition, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function getGeneratedElement(element: Wuxing): Wuxing {
  return BASIC_MAPPINGS.WUXING_SHENG[element] as Wuxing;
}

function buildHiddenStems(pillars: Pillars): HiddenStems {
  return Object.fromEntries(
    POSITIONS.map((position) => [position, [...(HIDDEN_STEMS[pillars[position].zhi] || [])]]),
  ) as unknown as HiddenStems;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function areAdjacent(left: RootPillarPosition, right: RootPillarPosition): boolean {
  return Math.abs(POSITIONS.indexOf(left) - POSITIONS.indexOf(right)) === 1;
}

/**
 * 《滴天髓阐微·顺局》从儿章以食伤成气、食伤生财为主线，并明言不以日主强弱作为入口。
 * 本裁决只采用盘面可复核的成气路径，不以十神数量、比例或原始藏干出现代替实际作用。
 */
export function assessCongErPattern(
  pillars: Pillars,
  getTenGod: GetTenGodFn,
  monthCommander?: string,
): CongErPatternAssessment {
  const dayMaster = pillars.day.gan;
  const dayMasterElement = getWuxing(dayMaster);
  if (dayMasterElement === '未知') {
    return {
      structuralMatch: false,
      established: false,
      matchedConditions: [],
      evidence: [],
      blockers: [],
    };
  }

  const outputElement = getGeneratedElement(dayMasterElement);
  const wealthElement = getGeneratedElement(outputElement);
  const hiddenStems = buildHiddenStems(pillars);
  const collectStructuralRoots = (element: Wuxing) =>
    collectAdjudicatedRootFacts(pillars, hiddenStems, element, getWuxing).filter((root) =>
      isStructuralRoot(root),
    );
  const collectUsableRoots = (element: Wuxing) =>
    collectStructuralRoots(element).filter((root) => root.actionable);
  const structuralRootsByElement = new Map<Wuxing, ReturnType<typeof collectStructuralRoots>>();
  const rootsByElement = new Map<Wuxing, ReturnType<typeof collectUsableRoots>>();
  const structuralRootsFor = (element: Wuxing) => {
    const existing = structuralRootsByElement.get(element);
    if (existing) return existing;
    const roots = collectStructuralRoots(element);
    structuralRootsByElement.set(element, roots);
    return roots;
  };
  const rootsFor = (element: Wuxing) => {
    const existing = rootsByElement.get(element);
    if (existing) return existing;
    const roots = collectUsableRoots(element);
    rootsByElement.set(element, roots);
    return roots;
  };
  const visibleStems: VisibleStemFact[] = POSITIONS.filter((position) => position !== 'day').map(
    (position) => ({
      position,
      stem: pillars[position].gan,
      tenGod: getTenGod(pillars[position].gan, dayMaster),
    }),
  );
  const rootedVisible = (tenGods: string[]) =>
    visibleStems.filter((fact) => {
      if (!tenGods.includes(fact.tenGod)) return false;
      const element = getWuxing(fact.stem);
      return element !== '未知' && rootsFor(element).length > 0;
    });
  const visibleOutput = rootedVisible(['食神', '伤官']);
  const visibleWealth = visibleStems.filter((fact) => ['正财', '偏财'].includes(fact.tenGod));
  const establishedFormations = collectEstablishedBranchFormations(pillars);
  const outputFormation = establishedFormations.find(
    (formation) => formation.wuxing === outputElement,
  );
  const wealthFormation = establishedFormations.find(
    (formation) => formation.wuxing === wealthElement,
  );
  const monthPrincipalStem = hiddenStems.month[0];
  const monthPrincipalGod = monthPrincipalStem ? getTenGod(monthPrincipalStem, dayMaster) : '';
  const commanderGod = monthCommander ? getTenGod(monthCommander, dayMaster) : '';
  const dayBranchPrincipalStem = hiddenStems.day[0];
  const dayBranchPrincipalGod = dayBranchPrincipalStem
    ? getTenGod(dayBranchPrincipalStem, dayMaster)
    : '';
  const dayBranchIsOutput = ['食神', '伤官'].includes(dayBranchPrincipalGod);
  const principalGods = Object.fromEntries(
    POSITIONS.map((position) => {
      const stem = hiddenStems[position][0];
      return [position, stem ? getTenGod(stem, dayMaster) : ''];
    }),
  ) as Record<RootPillarPosition, string>;
  const visibleOutputFacts = visibleStems.filter((fact) => ['食神', '伤官'].includes(fact.tenGod));
  const seasonStatus = getSeasonStatus(pillars.month.zhi);
  const dayMasterRootFacts = rootsFor(dayMasterElement);
  const visibleSamePartyFacts = visibleStems.filter((fact) =>
    ['比肩', '劫财', '正印', '偏印'].includes(fact.tenGod),
  );
  const visibleCompanionFacts = visibleSamePartyFacts.filter((fact) =>
    ['比肩', '劫财'].includes(fact.tenGod),
  );
  const rootedVisibleCompanions = visibleCompanionFacts.filter(() => dayMasterRootFacts.length > 0);
  const activeVisibleResources = visibleSamePartyFacts.filter((fact) => {
    if (!['正印', '偏印'].includes(fact.tenGod)) return false;
    const element = getWuxing(fact.stem);
    if (element === '未知' || rootsFor(element).length === 0) return false;
    return seasonStatus[element] !== '死';
  });
  const strongDayMasterRoots = dayMasterRootFacts.filter((root) => {
    const kind = getRootTraditionalKind(root);
    return kind === '本气' || kind === '生禄';
  });
  const samePartyFormation = establishedFormations.find((formation) => {
    const representative = formation.wuxing;
    return (
      representative === dayMasterElement ||
      BASIC_MAPPINGS.WUXING_SHENG[representative] === dayMasterElement
    );
  });
  const allPrincipalWealthSupportBlockers = unique([
    ...rootedVisibleCompanions.map(
      (fact) =>
        `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}明透，并有日主同类根扶身`,
    ),
    ...activeVisibleResources.map((fact) => {
      const element = getWuxing(fact.stem);
      return `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}明透有根，且${element}在${pillars.month.zhi}月不为死地`;
    }),
    ...strongDayMasterRoots.map(
      (root) =>
        `${PILLAR_LABELS[root.position]}${root.branch}藏${root.stem}${getRootTraditionalKind(root)}扶身`,
    ),
    ...(samePartyFormation
      ? [
          `${samePartyFormation.branches.join('')}成${samePartyFormation.type}${samePartyFormation.wuxing}局扶助日主同党`,
        ]
      : []),
  ]);
  const samePartyEvidence = unique([
    ...(dayMasterRootFacts.length
      ? [
          `日主虽有结构根，${dayMasterElement}在${pillars.month.zhi}月为${seasonStatus[dayMasterElement]}`,
        ]
      : []),
    ...visibleSamePartyFacts.map((fact) => {
      const element = getWuxing(fact.stem);
      return `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}虽明透，${element}在${pillars.month.zhi}月为${element === '未知' ? '未知' : seasonStatus[element] || '未定'}`;
    }),
  ]);
  const allPrincipalWealth = POSITIONS.every((position) =>
    ['正财', '偏财'].includes(principalGods[position]),
  );
  const allPrincipalWealthPriority: FollowWealthPriorityAssessment | undefined =
    allPrincipalWealth &&
    visibleOutputFacts.length > 0 &&
    ['囚', '死'].includes(seasonStatus[dayMasterElement] || '') &&
    allPrincipalWealthSupportBlockers.length === 0
      ? {
          established: true,
          pattern: '从财格',
          route: '四支本气皆财',
          method: '《滴天髓阐微·从象》从财法',
          evidence: [
            `四支本气均为财星，月令${pillars.month.zhi}财星当权`,
            `${visibleOutputFacts.map((fact) => `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}`).join('、')}明透，引通日主生财`,
            `${samePartyEvidence.length ? samePartyEvidence.join('；') : `日主${dayMasterElement}在${pillars.month.zhi}月为${seasonStatus[dayMasterElement]}`}，未改四支本气财势的归宿`,
          ],
        }
      : undefined;

  let route: CongErPatternAdjudication['route'] | undefined;
  if (outputFormation) {
    route = outputFormation.type === '三合' ? '三合食伤成气' : '三会食伤成气';
  } else if (['食神', '伤官'].includes(monthPrincipalGod)) {
    route = '月建食伤当权';
  } else if (dayBranchIsOutput && visibleOutput.length >= 2) {
    // “并透”取原典同神并透或食神伤官并见，不以全局数量、比例代替成气事实。
    route = '食伤并透坐支同气';
  }

  if (!route) {
    return {
      structuralMatch: false,
      established: false,
      matchedConditions: [],
      evidence: allPrincipalWealthPriority?.evidence || [],
      blockers: [],
      competingPattern: allPrincipalWealthPriority,
    };
  }

  const outputRoots = rootsFor(outputElement);
  const wealthRoots = structuralRootsFor(wealthElement);
  const actionableWealthRoots = rootsFor(wealthElement);
  const wealthFlowSatisfied = Boolean(
    visibleWealth.length || wealthFormation || actionableWealthRoots.length,
  );
  const rootedResources = rootedVisible(['正印', '偏印']);
  const rootedOfficers = rootedVisible(['正官', '七杀']);
  const formationPositions = outputFormation
    ? POSITIONS.filter((position) => outputFormation.branches.includes(pillars[position].zhi))
    : [];
  const principalOutputPositions = POSITIONS.filter((position) => {
    const principal = hiddenStems[position][0];
    return principal && ['食神', '伤官'].includes(getTenGod(principal, dayMaster));
  });
  const functionalResolutions: string[] = [];
  const resourceConstraintNotes = new Map<string, string>();
  const harmonyPillars = POSITIONS.map((position) => ({
    label: PILLAR_LABELS[position],
    gan: pillars[position].gan,
    zhi: pillars[position].zhi,
  }));
  const findWealthRescue = (resourcePosition: RootPillarPosition, resourceStem: string) => {
    if (actionableWealthRoots.length === 0) return undefined;
    for (const wealth of visibleWealth) {
      if (wealth.position !== resourcePosition && !areAdjacent(resourcePosition, wealth.position)) {
        continue;
      }
      if (BASIC_MAPPINGS.WUXING_KE[wealthElement] !== getWuxing(resourceStem)) continue;
      // 支藏印星不是该柱明透天干，不能作为天干五合参与者。
      if (
        pillars[resourcePosition].gan !== resourceStem ||
        BASIC_MAPPINGS.TIAN_GAN_WU_HE[wealth.stem] !== resourceStem
      ) {
        return { wealth, harmonyNote: '' };
      }
      const harmony = assessStemHarmonyTransform(
        wealth.stem,
        PILLAR_LABELS[wealth.position],
        resourceStem,
        PILLAR_LABELS[resourcePosition],
        pillars.month.zhi,
        harmonyPillars,
      );
      if (harmony.direction === '破合' || harmony.direction === '不合') {
        return {
          wealth,
          harmonyNote: `${wealth.stem}${resourceStem}五合${harmony.level}，保留原干作用；`,
        };
      }
      resourceConstraintNotes.set(
        `${resourcePosition}:${resourceStem}`,
        `${POSITION_LABELS[wealth.position]}${wealth.stem}与${POSITION_LABELS[resourcePosition]}${resourceStem}${harmony.level}，当前只记相合牵制，未据此认定财制印有救`,
      );
    }
    return undefined;
  };
  const recordWealthRescue = (
    resourcePosition: RootPillarPosition,
    resourceStem: string,
    resourceGod: string,
  ) => {
    const rescue = findWealthRescue(resourcePosition, resourceStem);
    if (!rescue) return false;
    const resourceLabel =
      pillars[resourcePosition].gan === resourceStem
        ? POSITION_LABELS[resourcePosition]
        : `${PILLAR_LABELS[resourcePosition]}${pillars[resourcePosition].zhi}藏`;
    const constraintAction = pillars[resourcePosition].gan === resourceStem ? '紧贴制' : '制';
    functionalResolutions.push(
      `${rescue.harmonyNote}${POSITION_LABELS[rescue.wealth.position]}${rescue.wealth.stem}财星有可用根，${constraintAction}${resourceLabel}${resourceStem}${resourceGod}，印夺食有救`,
    );
    return true;
  };
  const resolvedStemFacts = new Set<string>();
  for (let index = 0; index < POSITIONS.length - 1; index += 1) {
    const leftPosition = POSITIONS[index];
    const rightPosition = POSITIONS[index + 1];
    const left = pillars[leftPosition].gan;
    const right = pillars[rightPosition].gan;
    // 原典例只足以证明丁壬在木气得月建或成局支持时顺化为食伤，不外推其余四组合化。
    const isDingRen = (left === '丁' && right === '壬') || (left === '壬' && right === '丁');
    if (!isDingRen || outputElement !== '木') continue;
    const harmonyContested = POSITIONS.some((position) => {
      if (position === leftPosition || position === rightPosition) return false;
      return pillars[position].gan === left || pillars[position].gan === right;
    });
    if (harmonyContested) continue;
    const harmonySupported =
      establishedFormations.some((formation) => formation.wuxing === outputElement) ||
      getWuxing(pillars.month.zhi) === outputElement;
    if (!harmonySupported) continue;
    resolvedStemFacts.add(`${leftPosition}:${left}`);
    resolvedStemFacts.add(`${rightPosition}:${right}`);
    functionalResolutions.push(
      `${POSITION_LABELS[leftPosition]}${left}与${POSITION_LABELS[rightPosition]}${right}紧贴合木，且木气得月建或成局支持，按从儿原例记为食伤同向`,
    );
  }
  const monthPrincipalResource = ['正印', '偏印'].includes(monthPrincipalGod)
    ? `${pillars.month.zhi}月本气${monthPrincipalStem}${monthPrincipalGod}当权`
    : '';
  const monthPrincipalOfficer = ['正官', '七杀'].includes(monthPrincipalGod)
    ? `${pillars.month.zhi}月本气${monthPrincipalStem}${monthPrincipalGod}当权`
    : '';
  const activeResources = rootedResources.filter((resource) => {
    if (resolvedStemFacts.has(`${resource.position}:${resource.stem}`)) return false;
    const actsOnOutput =
      visibleOutput.some((output) => areAdjacent(resource.position, output.position)) ||
      route === '月建食伤当权' ||
      formationPositions.some(
        (position) => position === resource.position || areAdjacent(resource.position, position),
      );
    if (!actsOnOutput) return false;
    return !recordWealthRescue(resource.position, resource.stem, resource.tenGod);
  });
  const activeOfficers = rootedOfficers.filter(
    (officer) => !resolvedStemFacts.has(`${officer.position}:${officer.stem}`),
  );
  const hiddenResourceClashes = POSITIONS.flatMap((position) => {
    const principalStem = hiddenStems[position][0];
    if (!principalStem) return [];
    const tenGod = getTenGod(principalStem, dayMaster);
    if (!['正印', '偏印'].includes(tenGod)) return [];
    const clashTarget = principalOutputPositions.find(
      (targetPosition) =>
        targetPosition !== position &&
        BASIC_MAPPINGS.DI_ZHI_CHONG[pillars[position].zhi] === pillars[targetPosition].zhi,
    );
    if (!clashTarget) return [];
    if (recordWealthRescue(position, principalStem, tenGod)) return [];
    return [
      `${position === 'year' ? '年' : position === 'month' ? '月' : position === 'day' ? '日' : '时'}支${pillars[position].zhi}本气${principalStem}${tenGod}，直接冲${clashTarget === 'year' ? '年' : clashTarget === 'month' ? '月' : clashTarget === 'day' ? '日' : '时'}支${pillars[clashTarget].zhi}食伤`,
    ];
  });

  const monthPrincipalResourceResolved =
    Boolean(monthPrincipalResource) &&
    recordWealthRescue('month', monthPrincipalStem, monthPrincipalGod);
  const resolvedFunctions = unique(functionalResolutions);
  const matchedConditions = [
    route === '三合食伤成气' || route === '三会食伤成气'
      ? `${outputFormation!.branches.join('')}成${outputFormation!.type}${outputElement}局，食伤得令且无局外冲破`
      : route === '月建食伤当权'
        ? `月支${pillars.month.zhi}本气${monthPrincipalStem}为${monthPrincipalGod}，食伤在月建当权${monthCommander ? `；分日司权${monthCommander}为${commanderGod}仅作当日月气事实` : ''}`
        : `${visibleOutput.map((fact) => `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}`).join('、')}并透有结构根，且日支${pillars.day.zhi}本气${dayBranchPrincipalStem}为${dayBranchPrincipalGod}`,
    wealthFlowSatisfied
      ? visibleWealth.length
        ? `${unique(visibleWealth.map((fact) => fact.stem)).join('、')}财星明透，承接食伤所生`
        : wealthFormation
          ? `${wealthFormation.branches.join('')}成${wealthFormation.type}${wealthElement}局，承接食伤所生`
          : `${unique(actionableWealthRoots.map((root) => `${root.position === 'year' ? '年' : root.position === 'month' ? '月' : root.position === 'day' ? '日' : '时'}支${root.branch}藏${root.stem}${getRootTraditionalKind(root)}`)).join('、')}为可用结构财气，承接食伤所生`
      : '',
    ...resolvedFunctions,
  ].filter(Boolean);
  const structuralBlockers = unique([
    ...(!wealthFlowSatisfied
      ? [
          wealthRoots.length
            ? '结构藏财根气受冲待核，未见可用财气承接食伤'
            : '未见财星明透、财局或结构藏财承接食伤',
        ]
      : []),
    ...activeResources.map(
      (fact) =>
        `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}明透有根，对食伤成气形成实际制约${resourceConstraintNotes.has(`${fact.position}:${fact.stem}`) ? `；${resourceConstraintNotes.get(`${fact.position}:${fact.stem}`)}` : ''}`,
    ),
    ...(monthPrincipalResource && !monthPrincipalResourceResolved
      ? [monthPrincipalResource + '，直接生身并制食伤']
      : []),
    ...hiddenResourceClashes,
    ...activeOfficers.map(
      (fact) =>
        `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}明透有根，财星顺生转向官杀并与食伤交战`,
    ),
    ...(monthPrincipalOfficer ? [monthPrincipalOfficer + '，财气转向官杀并与食伤交战'] : []),
  ]);
  const wealthSettlesInDayAndHour =
    ['正财', '偏财'].includes(principalGods.day) && ['正财', '偏财'].includes(principalGods.hour);
  const followWealthByEndpoint: FollowWealthPriorityAssessment | undefined =
    structuralBlockers.length === 0 &&
    route === '月建食伤当权' &&
    wealthSettlesInDayAndHour &&
    visibleWealth.length > 0 &&
    actionableWealthRoots.length > 0 &&
    dayMasterRootFacts.length === 0 &&
    visibleCompanionFacts.length === 0
      ? {
          established: true,
          pattern: '从财格',
          route: '食伤当令而财归日时',
          method: '《滴天髓阐微·从象》从财法',
          evidence: [
            `月支${pillars.month.zhi}本气${monthPrincipalStem}${monthPrincipalGod}当令，食伤引通日主之气`,
            `${unique(visibleWealth.map((fact) => `${POSITION_LABELS[fact.position]}${fact.stem}${fact.tenGod}`)).join('、')}明透有可用根，日支${pillars.day.zhi}、时支${pillars.hour.zhi}本气均归财星`,
            `日主同党未形成实际扶身：日主未见可用结构根，明透印官已按根气与制化核验；财为食伤顺生的最终归宿`,
          ],
        }
      : undefined;
  const competingPattern = allPrincipalWealthPriority || followWealthByEndpoint;
  const blockers = unique([
    ...structuralBlockers,
    ...(followWealthByEndpoint
      ? ['食伤虽在月建当权，但财星明透有根并落实日时本气，顺生归宿在财，应先按从财裁决']
      : []),
  ]);
  const retainedHiddenFacts = POSITIONS.flatMap((position) =>
    hiddenStems[position]
      .filter((stem) => ['正印', '偏印', '正官', '七杀'].includes(getTenGod(stem, dayMaster)))
      .map(
        (stem) =>
          `${position === 'year' ? '年' : position === 'month' ? '月' : position === 'day' ? '日' : '时'}支${pillars[position].zhi}藏${stem}${getTenGod(stem, dayMaster)}`,
      ),
  );
  const established = blockers.length === 0;
  const method = '《滴天髓阐微·顺局》从儿法';
  const adjudication: CongErPatternAdjudication = {
    kind: '从儿格',
    status: established ? '成立' : '不成立',
    route,
    method,
    satisfied: matchedConditions,
    blockers,
    outputElement,
    wealthElement,
    visibleOutputStems: unique(visibleOutput.map((fact) => fact.stem)),
    visibleWealthStems: unique(visibleWealth.map((fact) => fact.stem)),
    outputRootFacts: unique(
      outputRoots.map(
        (root) =>
          `${root.position === 'year' ? '年' : root.position === 'month' ? '月' : root.position === 'day' ? '日' : '时'}支${root.branch}藏${root.stem}${getRootTraditionalKind(root)}${root.actionable ? '' : '（受冲待核）'}`,
      ),
    ),
    wealthRootFacts: unique(
      wealthRoots.map(
        (root) =>
          `${root.position === 'year' ? '年' : root.position === 'month' ? '月' : root.position === 'day' ? '日' : '时'}支${root.branch}藏${root.stem}${getRootTraditionalKind(root)}${root.actionable ? '' : '（受冲待核）'}`,
      ),
    ),
    functionalResolutions: resolvedFunctions,
    retainedHiddenFacts: unique(retainedHiddenFacts),
  };

  return {
    structuralMatch: true,
    established,
    route,
    matchedConditions,
    evidence: [
      `日主${dayMaster}${dayMasterElement}所生${outputElement}为食伤，食伤所生${wealthElement}为财`,
      ...matchedConditions,
    ],
    blockers,
    adjudication,
    competingPattern,
  };
}

export function buildFollowWealthPriorityBasis(assessment: FollowWealthPriorityAssessment): string {
  return `${assessment.method}成立：${assessment.route}；${assessment.evidence.join('；')}`;
}

export function buildCongErPatternBasis(assessment: CongErPatternAssessment): string {
  if (!assessment.route || !assessment.adjudication) return '';
  const main = `${assessment.adjudication.method}${assessment.adjudication.status}：${assessment.route}`;
  const satisfied = assessment.matchedConditions.length
    ? `；${assessment.matchedConditions.join('；')}`
    : '';
  const blockers = assessment.blockers.length ? `；反证：${assessment.blockers.join('；')}` : '';
  return `${main}${satisfied}${blockers}`;
}
