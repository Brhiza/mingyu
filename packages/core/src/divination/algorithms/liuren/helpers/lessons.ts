import type {
  LiurenLesson,
  LiurenOrdinaryTransmissionAdjudication,
  LiurenOrdinaryTransmissionCandidate,
  LiurenOrdinaryTransmissionStage,
  LiurenPlateItem,
} from '../../../../types/divination';
import { BASIC_MAPPINGS, HEAVENLY_STEMS } from '../../../../bazi/baziMappingsData';
import {
  BRANCH_WUXING,
  getBranchIndex,
  isKe,
  LIUCHONG_MAP,
  SANXING_MAP,
  getYiMa,
  TIAN_GAN_HE,
} from '../../../../ganzhi';
import {
  describeRelation,
  getGanZhiWuxing,
  getPlateItemByBranch,
  getUnderByUpper,
  getUpperByUnder,
  isBranchKe,
  isElementKe,
  DAY_STEM_RESIDENCE_MAP,
  DIZHI,
  TIANGAN,
  TIANJIANG,
} from './plate';
import { formatLiurenOrdinaryStage } from '../../../liuren-ordinary-adjudication';

const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);
const YANG_BRANCHES = new Set(['子', '寅', '辰', '午', '申', '戌']);
// 八专日：甲寅、庚申、丁未、己未、癸丑。《六壬大全》《六壬心镜》《六壬粹言》同列此五日。
const BAZHUAN_DAYS = new Set(['甲寅', '庚申', '丁未', '己未', '癸丑']);
const STEM_RESIDENCE_MAP = DAY_STEM_RESIDENCE_MAP;
// POST_HORSE_MAP / LIUCHONG_MAP / SANXING_MAP / STEM_HE_MAP 已复用公共干支数据
const MENG_BRANCHES = new Set(['寅', '巳', '申', '亥']);
const ZHONG_BRANCHES = new Set(['子', '卯', '午', '酉']);
const JI_BRANCHES = new Set(['辰', '戌', '丑', '未']);
const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);
const STEMS_BY_RESIDENCE: Record<string, string[]> = Object.entries(STEM_RESIDENCE_MAP).reduce<
  Record<string, string[]>
>((acc, [stem, branch]) => {
  acc[branch] = [...(acc[branch] || []), stem];
  return acc;
}, {});

export interface ResolveTransmissionContext {
  dayStem: string;
  dayBranch: string;
  dayStemResidence: string;
  hourStem?: string;
  hourBranch?: string;
  heavenlyPlate: LiurenPlateItem[];
}

export interface InitialTransmissionResult {
  initial: string;
  rule: string;
  tag: string;
  branches?: string[];
  ordinaryAdjudication?: LiurenOrdinaryTransmissionAdjudication;
}

interface KeCandidate {
  lesson: LiurenLesson;
  type: '下贼上' | '上克下';
  index?: number;
}

function isStem(value: string) {
  return TIANGAN.includes(value as (typeof TIANGAN)[number]);
}

function isBranch(value: string) {
  return DIZHI.includes(value as (typeof DIZHI)[number]);
}

function assertStem(value: string | undefined, label: string): asserts value is string {
  if (!value || !isStem(value)) {
    throw new Error(`${label}必须是有效天干。`);
  }
}

function assertBranch(value: string | undefined, label: string): asserts value is string {
  if (!value || !isBranch(value)) {
    throw new Error(`${label}必须是有效地支。`);
  }
}

function assertStemOrBranch(value: string | undefined, label: string): asserts value is string {
  if (!value || (!isStem(value) && !isBranch(value))) {
    throw new Error(`${label}必须是有效天干或地支。`);
  }
}

function assertValidHeavenlyPlate(plate: LiurenPlateItem[]): void {
  if (!Array.isArray(plate) || plate.length !== 12) {
    throw new Error('天盘必须包含完整 12 个地支。');
  }

  const upperSet = new Set<string>();
  const underSet = new Set<string>();
  plate.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`天盘第 ${index + 1} 项必须是对象。`);
    }
    assertBranch(item.branch, `天盘第 ${index + 1} 项上神`);
    assertBranch(item.under, `天盘第 ${index + 1} 项地盘`);
    if (!TIANJIANG.includes(item.god as (typeof TIANJIANG)[number])) {
      throw new Error(`天盘第 ${index + 1} 项天将必须是有效十二天将。`);
    }
    upperSet.add(item.branch);
    underSet.add(item.under);
  });

  if (upperSet.size !== 12 || underSet.size !== 12) {
    throw new Error('天盘上下地支必须各自完整且不重复。');
  }
}

function assertValidResolveTransmissionInput(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
): void {
  if (!Array.isArray(lessons) || lessons.length !== 4) {
    throw new Error('resolveInitialTransmission 调用时必须传入完整四课。');
  }
  if (!context || typeof context !== 'object') {
    throw new Error('resolveInitialTransmission 调用时缺少上下文。');
  }

  assertStem(context.dayStem, '日干');
  assertBranch(context.dayBranch, '日支');
  assertBranch(context.dayStemResidence, '日干寄宫');
  if (context.hourStem !== undefined) {
    assertStem(context.hourStem, '时干');
  }
  if (context.hourBranch !== undefined) {
    assertBranch(context.hourBranch, '时支');
  }
  assertValidHeavenlyPlate(context.heavenlyPlate);

  lessons.forEach((lesson, index) => {
    if (!lesson || typeof lesson !== 'object') {
      throw new Error(`第 ${index + 1} 课必须是对象。`);
    }
    assertBranch(lesson.upper, `第 ${index + 1} 课上神`);
    assertStemOrBranch(lesson.lower, `第 ${index + 1} 课下位`);
    if (!TIANJIANG.includes(lesson.god as (typeof TIANJIANG)[number])) {
      throw new Error(`第 ${index + 1} 课天将必须是有效十二天将。`);
    }
    if (typeof lesson.relation !== 'string' || !lesson.relation.trim()) {
      throw new Error(`第 ${index + 1} 课关系不能为空。`);
    }
  });
}

export function buildLessonNote(relation: string, xunKong: string[], upper: string, lower: string) {
  const voidFacts = [
    xunKong.includes(upper) ? `上神${upper}落日柱旬空` : '',
    xunKong.includes(lower) ? `下位${lower}落日柱旬空` : '',
  ].filter(Boolean);
  return [`上神${upper}与下位${lower}的五行关系为${relation}`, ...voidFacts].join('；') + '。';
}

export function buildFourLessons(args: {
  heavenlyPlate: LiurenPlateItem[];
  dayStem: string;
  dayBranch: string;
  dayStemResidence: string;
  xunKong: string[];
}) {
  const yiKeUpper = getUpperByUnder(args.heavenlyPlate, args.dayStemResidence);
  const erKeUpper = getUpperByUnder(args.heavenlyPlate, yiKeUpper);
  const sanKeUpper = getUpperByUnder(args.heavenlyPlate, args.dayBranch);
  const siKeUpper = getUpperByUnder(args.heavenlyPlate, sanKeUpper);
  const lessonNames: LiurenLesson['name'][] = ['一课', '二课', '三课', '四课'];
  const lessonPairs: Array<{ upper: string; lower: string }> = [
    { upper: yiKeUpper, lower: args.dayStem },
    { upper: erKeUpper, lower: yiKeUpper },
    { upper: sanKeUpper, lower: args.dayBranch },
    { upper: siKeUpper, lower: sanKeUpper },
  ];

  return lessonPairs.map((item, index) => {
    const relation = describeRelation(item.upper, item.lower);
    const god = getPlateItemByBranch(args.heavenlyPlate, item.upper).god;

    return {
      name: lessonNames[index],
      upper: item.upper,
      lower: item.lower,
      god,
      relation,
      note: buildLessonNote(relation, args.xunKong, item.upper, item.lower),
    };
  }) satisfies LiurenLesson[];
}

function isSameYinYangAsDayStem(branch: string, dayStem: string) {
  return YANG_BRANCHES.has(branch) === YANG_STEMS.has(dayStem);
}

function getStemWuxing(stem: string) {
  const stemIndex = HEAVENLY_STEMS.indexOf(stem as (typeof HEAVENLY_STEMS)[number]);
  if (stemIndex < 0) {
    throw new Error(`无法识别天干 "${stem}" 的五行属性。`);
  }
  const element = BASIC_MAPPINGS.STEM_WUXING[stemIndex];
  if (!VALID_WUXING.has(element)) {
    throw new Error(`天干 ${stem} 的五行数据缺失。`);
  }
  return element;
}

function uniqueCandidatesByUpper(candidates: KeCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.lesson.upper)) {
      return false;
    }
    seen.add(candidate.lesson.upper);
    return true;
  });
}

function getBranchAt(rawIndex: number) {
  const branches = Object.keys(BRANCH_WUXING);
  return branches[((rawIndex % branches.length) + branches.length) % branches.length];
}

function shiftBranch(branch: string, steps: number) {
  const index = getBranchIndex(branch);
  if (index < 0) {
    throw new Error(`无法移动非法地支 "${branch}"。`);
  }
  return getBranchAt(index + steps);
}

function walkBranches(start: string, end: string) {
  const startIndex = getBranchIndex(start);
  const endIndex = getBranchIndex(end);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`涉害深度计算收到非法地支：${start} -> ${end}。`);
  }

  const branches: string[] = [];
  // 涉害从所临地盘之后起数，归上神本家即止；起点与本家均不重复计入。
  for (let step = 1; step <= 12; step += 1) {
    const branch = getBranchAt(startIndex + step);
    if (branch === end) {
      break;
    }
    branches.push(branch);
  }

  return branches;
}

function getHarmAssessment(candidate: KeCandidate, context: ResolveTransmissionContext) {
  const upperElement = getGanZhiWuxing(candidate.lesson.upper);
  const startUnder = getUnderByUpper(context.heavenlyPlate, candidate.lesson.upper);
  const walkedBranches = walkBranches(startUnder, candidate.lesson.upper);

  const depth = walkedBranches.reduce((count, branch) => {
    const branchElement = BRANCH_WUXING[branch];
    if (!VALID_WUXING.has(branchElement)) {
      throw new Error(`地支 ${branch} 的五行数据缺失。`);
    }
    const housedStemElements = (STEMS_BY_RESIDENCE[branch] || [])
      .map(getStemWuxing)
      .filter(Boolean);

    if (candidate.type === '下贼上') {
      const branchHit = isKe(branchElement, upperElement) ? 1 : 0;
      const stemHits = housedStemElements.filter((element) => isKe(element, upperElement)).length;
      return count + branchHit + stemHits;
    }

    const branchHit = isKe(upperElement, branchElement) ? 1 : 0;
    const stemHits = housedStemElements.filter((element) => isKe(upperElement, element)).length;
    return count + branchHit + stemHits;
  }, 0);

  return { walkedBranches, depth };
}

function pickByHarmDepth(candidates: KeCandidate[], context: ResolveTransmissionContext) {
  const ranked = candidates.map((candidate, index) => ({
    candidate,
    index,
    depth: getHarmAssessment(candidate, context).depth,
  }));
  const preferredUpper = YANG_STEMS.has(context.dayStem)
    ? getUpperByUnder(context.heavenlyPlate, context.dayStemResidence)
    : getUpperByUnder(context.heavenlyPlate, context.dayBranch);

  if (ranked.length === 0) {
    throw new Error('涉害法没有可供比较的候选课。');
  }

  // 《六壬大全》卷四《涉害课》：“以涉害深者为用”。先取受克层数最多者，
  // 不能先按孟仲季淘汰深度较大的候选。
  const maxDepth = Math.max(...ranked.map((item) => item.depth));
  let tied = ranked.filter((item) => item.depth === maxDepth);

  // 涉害复等（《六壬大全》“缀瑕”）：阳日先见干上神，阴日先见支上神。
  // 这是深浅完全相等时的先见取法，应先于孟仲季的次级区分。
  const preferred = tied.find((item) => item.candidate.lesson.upper === preferredUpper);
  if (preferred) {
    return preferred.candidate;
  }

  // 深浅相同且无干支上神时，再看发用上神所居四孟、四仲、四季（见机、察微）。
  // 这里比较的是上神本身，而非它所临的地盘；“亥加丑”仍属四孟上神。
  for (const branchGroup of [MENG_BRANCHES, ZHONG_BRANCHES, JI_BRANCHES]) {
    const sameClass = tied.filter((item) => branchGroup.has(item.candidate.lesson.upper));
    if (sameClass.length > 0) {
      tied = sameClass;
      break;
    }
  }

  const picked = tied.sort((left, right) => left.index - right.index)[0];
  if (!picked) {
    throw new Error('涉害法没有可供比较的候选课。');
  }
  return picked.candidate;
}

function resolveMultipleCandidates(
  candidates: KeCandidate[],
  context: ResolveTransmissionContext,
  tagPrefix = '',
  directionTag?: string,
): InitialTransmissionResult {
  return resolveMultipleCandidatePlan(
    buildCandidateSelectionPlan(candidates, context),
    context,
    tagPrefix,
    directionTag,
  );
}

function resolveMultipleCandidatePlan(
  plan: ReturnType<typeof buildCandidateSelectionPlan>,
  context: ResolveTransmissionContext,
  tagPrefix = '',
  directionTag?: string,
): InitialTransmissionResult {
  const { uniqueCandidates, biYongCandidates } = plan;

  if (biYongCandidates.length === 1) {
    const picked = biYongCandidates[0];
    return {
      initial: picked.lesson.upper,
      rule: tagPrefix ? `${tagPrefix}比用法` : '比用法',
      tag: directionTag ?? (tagPrefix ? `${tagPrefix}比用` : '比用'),
    };
  }

  const picked = pickByHarmDepth(
    biYongCandidates.length > 1 ? biYongCandidates : uniqueCandidates,
    context,
  );

  return {
    initial: picked.lesson.upper,
    rule: tagPrefix ? `${tagPrefix}涉害法` : '涉害法',
    tag: directionTag ?? (tagPrefix ? `${tagPrefix}涉害` : '涉害'),
  };
}

function buildCandidateSelectionPlan(
  candidates: KeCandidate[],
  context: ResolveTransmissionContext,
) {
  const uniqueCandidates = uniqueCandidatesByUpper(candidates);
  const biYongCandidates = uniqueCandidates.filter((item) =>
    isSameYinYangAsDayStem(item.lesson.upper, context.dayStem),
  );
  return {
    uniqueCandidates,
    biYongCandidates,
    sheHaiCandidates: biYongCandidates.length > 1 ? biYongCandidates : uniqueCandidates,
    method: biYongCandidates.length === 1 ? ('biYong' as const) : ('sheHai' as const),
  };
}

function resolveKeCandidates(
  lowerKeUpper: KeCandidate[],
  upperKeLower: KeCandidate[],
  context: ResolveTransmissionContext,
  rulePrefix = '',
): InitialTransmissionResult | null {
  const uniqueLowerKeUpper = uniqueCandidatesByUpper(lowerKeUpper);
  const uniqueUpperKeLower = uniqueCandidatesByUpper(upperKeLower);

  if (uniqueLowerKeUpper.length === 1) {
    const picked = uniqueLowerKeUpper[0].lesson;
    return {
      initial: picked.upper,
      rule: rulePrefix ? `${rulePrefix}重审法` : '重审法',
      tag: rulePrefix ? `${rulePrefix}重审` : '重审',
    };
  }

  if (uniqueLowerKeUpper.length > 1) {
    return resolveMultipleCandidates(uniqueLowerKeUpper, context, rulePrefix);
  }

  if (uniqueUpperKeLower.length === 1) {
    const picked = uniqueUpperKeLower[0].lesson;
    return {
      initial: picked.upper,
      rule: rulePrefix ? `${rulePrefix}元首法` : '元首法',
      tag: rulePrefix ? `${rulePrefix}元首` : '元首',
    };
  }

  if (uniqueUpperKeLower.length > 1) {
    return resolveMultipleCandidates(uniqueUpperKeLower, context, rulePrefix);
  }

  return null;
}

function buildRemoteKeCandidates(lessons: LiurenLesson[], context: ResolveTransmissionContext) {
  const dayStemWuxing = getStemWuxing(context.dayStem);
  const remoteLessons = lessons.slice(1).map((lesson, index) => ({ lesson, index: index + 1 }));
  const upperKeDay = remoteLessons
    .filter(({ lesson }) => isElementKe(getGanZhiWuxing(lesson.upper), dayStemWuxing))
    .map(({ lesson, index }) => ({ lesson, type: '上克下', index }) satisfies KeCandidate);
  const dayKeUpper = remoteLessons
    .filter(({ lesson }) => isElementKe(dayStemWuxing, getGanZhiWuxing(lesson.upper)))
    .map(({ lesson, index }) => ({ lesson, type: '下贼上', index }) satisfies KeCandidate);

  return { upperKeDay, dayKeUpper };
}

function resolveRemoteKe(
  remoteCandidates: ReturnType<typeof buildRemoteKeCandidates>,
  context: ResolveTransmissionContext,
): {
  result: InitialTransmissionResult;
  selectionPlan: ReturnType<typeof buildCandidateSelectionPlan>;
} | null {
  if (BAZHUAN_DAYS.has(`${context.dayStem}${context.dayBranch}`)) {
    return null;
  }

  const { upperKeDay, dayKeUpper } = remoteCandidates;
  const upperPlan = buildCandidateSelectionPlan(upperKeDay, context);
  const lowerPlan = buildCandidateSelectionPlan(dayKeUpper, context);

  if (upperPlan.uniqueCandidates.length === 1) {
    return {
      result: {
        initial: upperPlan.uniqueCandidates[0].lesson.upper,
        rule: '遥克法',
        tag: '蒿矢',
      },
      selectionPlan: upperPlan,
    };
  }
  if (upperPlan.uniqueCandidates.length > 1) {
    return {
      result: resolveMultipleCandidatePlan(upperPlan, context, '遥克', '蒿矢'),
      selectionPlan: upperPlan,
    };
  }
  if (lowerPlan.uniqueCandidates.length === 1) {
    return {
      result: {
        initial: lowerPlan.uniqueCandidates[0].lesson.upper,
        rule: '遥克法',
        tag: '弹射',
      },
      selectionPlan: lowerPlan,
    };
  }
  if (lowerPlan.uniqueCandidates.length > 1) {
    return {
      result: resolveMultipleCandidatePlan(lowerPlan, context, '遥克', '弹射'),
      selectionPlan: lowerPlan,
    };
  }

  return null;
}

const ORDINARY_METHOD_SOURCE = '《大六壬大全》九宗门取传法';
const SHE_HAI_METHOD_SOURCE = '《六壬指南》涉害取法及《六壬大全》涉害课';
const ORDINARY_ADJUDICATION_LIMITATION =
  '普通宗门裁决只证明四课直接克、比用、涉害与遥克如何竞争形成初传；不包含特殊课内部裁决，也不单独证明现实吉凶或应期。';

type OrdinaryCandidateKind = LiurenOrdinaryTransmissionCandidate['kind'];
type OrdinaryCandidateFamily = LiurenOrdinaryTransmissionCandidate['family'];

function getOrdinaryCandidateKindId(kind: OrdinaryCandidateKind) {
  return (
    {
      下贼上: 'xia-zei-shang',
      上克下: 'shang-ke-xia',
      蒿矢: 'hao-shi',
      弹射: 'tan-she',
    } as const
  )[kind];
}

function groupOrdinaryCandidates(
  candidates: KeCandidate[],
  family: OrdinaryCandidateFamily,
  kind: OrdinaryCandidateKind,
  context: ResolveTransmissionContext,
): LiurenOrdinaryTransmissionCandidate[] {
  const grouped = new Map<string, KeCandidate[]>();
  for (const candidate of candidates) {
    const matches = grouped.get(candidate.lesson.upper) ?? [];
    matches.push(candidate);
    grouped.set(candidate.lesson.upper, matches);
  }

  return [...grouped.entries()].map(([upper, matches]) => ({
    key: `liuren:ordinary-transmission-candidate:${family}:${getOrdinaryCandidateKindId(kind)}:${upper}`,
    family,
    kind,
    upper,
    sourceLessons: matches.map((candidate) => ({
      position: (candidate.index ?? 0) + 1,
      name: candidate.lesson.name,
      lower: candidate.lesson.lower,
    })),
    sameYinYangAsDayStem: isSameYinYangAsDayStem(upper, context.dayStem),
    status: 'eligible',
    reasons: ['符合本宗门候选生成条件'],
  }));
}

function createOrdinaryStage(
  id: LiurenOrdinaryTransmissionStage['id'],
  order: number,
  status: LiurenOrdinaryTransmissionStage['status'],
  conditions: string[],
  candidateKeys: string[],
  reason: string,
  sources: string[],
  selectedCandidateKey?: string,
): LiurenOrdinaryTransmissionStage {
  return {
    id,
    order,
    status,
    conditions,
    candidateKeys,
    ...(selectedCandidateKey ? { selectedCandidateKey } : {}),
    reason,
    sources,
  };
}

function buildDeferredOrdinaryAdjudication(
  actualRule: string,
  reason: string,
): LiurenOrdinaryTransmissionAdjudication {
  const stages: LiurenOrdinaryTransmissionStage[] = [
    createOrdinaryStage('directKe', 1, 'notApplicable', [], [], reason, [ORDINARY_METHOD_SOURCE]),
    createOrdinaryStage('directBiYong', 2, 'notApplicable', [], [], reason, [
      ORDINARY_METHOD_SOURCE,
    ]),
    createOrdinaryStage('directSheHai', 3, 'notApplicable', [], [], reason, [
      SHE_HAI_METHOD_SOURCE,
    ]),
    createOrdinaryStage('remoteKe', 4, 'notApplicable', [], [], reason, [ORDINARY_METHOD_SOURCE]),
    createOrdinaryStage('remoteBiYong', 5, 'notApplicable', [], [], reason, [
      ORDINARY_METHOD_SOURCE,
    ]),
    createOrdinaryStage('remoteSheHai', 6, 'notApplicable', [], [], reason, [
      SHE_HAI_METHOD_SOURCE,
    ]),
  ];
  return {
    key: 'liuren:ordinary-transmission-adjudication',
    status: 'deferredToSpecial',
    selectedRule: null,
    selectedInitial: null,
    selectedCandidateKey: null,
    candidates: [],
    stages,
    summary: `${reason}；实际按${actualRule}取传。`,
    sources: [ORDINARY_METHOD_SOURCE, SHE_HAI_METHOD_SOURCE],
    limitation: ORDINARY_ADJUDICATION_LIMITATION,
  };
}

function buildOrdinaryTransmissionAdjudication(args: {
  context: ResolveTransmissionContext;
  result: InitialTransmissionResult;
  lowerKeUpper: KeCandidate[];
  upperKeLower: KeCandidate[];
  remoteCandidates: ReturnType<typeof buildRemoteKeCandidates>;
  selectedFamily: OrdinaryCandidateFamily | null;
  selectedPlan?: ReturnType<typeof buildCandidateSelectionPlan>;
}): LiurenOrdinaryTransmissionAdjudication {
  const directLower = groupOrdinaryCandidates(
    args.lowerKeUpper,
    'directKe',
    '下贼上',
    args.context,
  );
  const directUpper = groupOrdinaryCandidates(
    args.upperKeLower,
    'directKe',
    '上克下',
    args.context,
  );
  const remoteUpper = groupOrdinaryCandidates(
    args.remoteCandidates.upperKeDay,
    'remoteKe',
    '蒿矢',
    args.context,
  );
  const remoteLower = groupOrdinaryCandidates(
    args.remoteCandidates.dayKeUpper,
    'remoteKe',
    '弹射',
    args.context,
  );
  const candidates = [...directLower, ...directUpper, ...remoteUpper, ...remoteLower];
  const stages: LiurenOrdinaryTransmissionStage[] = [];
  const isBazhuanDay = BAZHUAN_DAYS.has(`${args.context.dayStem}${args.context.dayBranch}`);

  const setSuppressed = (values: LiurenOrdinaryTransmissionCandidate[], reason: string) => {
    for (const candidate of values) {
      candidate.status = 'suppressedByPrior';
      candidate.reasons.push(reason);
    }
  };
  const setSelectedPool = (values: LiurenOrdinaryTransmissionCandidate[], reason: string) => {
    for (const candidate of values) {
      if (candidate.upper === args.result.initial) {
        candidate.status = 'selected';
        candidate.reasons.push(reason);
      } else {
        candidate.status = 'excluded';
        candidate.reasons.push(`未通过最终${reason}`);
      }
    }
  };
  const attachHarmAssessments = (
    internalCandidates: KeCandidate[],
    values: LiurenOrdinaryTransmissionCandidate[],
  ) => {
    for (const candidate of uniqueCandidatesByUpper(internalCandidates)) {
      const output = values.find((item) => item.upper === candidate.lesson.upper);
      if (output) {
        output.harmAssessment = getHarmAssessment(candidate, args.context);
      }
    }
  };
  const recordSheHaiReasons = (
    internalCandidates: KeCandidate[],
    values: LiurenOrdinaryTransmissionCandidate[],
  ) => {
    const ranked = uniqueCandidatesByUpper(internalCandidates).map((candidate) => ({
      candidate,
      assessment: getHarmAssessment(candidate, args.context),
    }));
    const maxDepth = Math.max(...ranked.map((item) => item.assessment.depth));
    const tied = ranked.filter((item) => item.assessment.depth === maxDepth);
    const preferredUpper = YANG_STEMS.has(args.context.dayStem)
      ? getUpperByUnder(args.context.heavenlyPlate, args.context.dayStemResidence)
      : getUpperByUnder(args.context.heavenlyPlate, args.context.dayBranch);
    const preferred = tied.find((item) => item.candidate.lesson.upper === preferredUpper);
    let selectedClass: Set<string> | null = null;
    if (!preferred) {
      selectedClass =
        [MENG_BRANCHES, ZHONG_BRANCHES, JI_BRANCHES].find((branchGroup) =>
          tied.some((item) => branchGroup.has(item.candidate.lesson.upper)),
        ) ?? null;
    }
    const selectedClassCount = selectedClass
      ? tied.filter((item) => selectedClass.has(item.candidate.lesson.upper)).length
      : 0;

    for (const item of ranked) {
      const output = values.find((candidate) => candidate.upper === item.candidate.lesson.upper);
      if (!output) continue;
      const depth = item.assessment.depth;
      if (depth < maxDepth) {
        output.reasons.push(`涉害深度${depth}低于最大深度${maxDepth}`);
      } else if (preferred) {
        output.reasons.push(
          output.upper === preferredUpper
            ? `涉害深度同为${maxDepth}，复等先取${YANG_STEMS.has(args.context.dayStem) ? '干上神' : '支上神'}`
            : `涉害深度同为${maxDepth}，复等未先见${YANG_STEMS.has(args.context.dayStem) ? '干上神' : '支上神'}`,
        );
      } else if (selectedClass && !selectedClass.has(output.upper)) {
        output.reasons.push(`涉害深度同为${maxDepth}，按孟仲季次序未取`);
      } else if (output.upper === args.result.initial) {
        output.reasons.push(
          selectedClassCount > 1
            ? `涉害深度同为${maxDepth}，按孟仲季后再依原课序取定`
            : `涉害深度同为${maxDepth}，按孟仲季次序取定`,
        );
      } else {
        output.reasons.push(`涉害深度与孟仲季类别相同，按原课序未取`);
      }
    }
  };
  const markBiYongExclusions = (
    plan: ReturnType<typeof buildCandidateSelectionPlan>,
    values: LiurenOrdinaryTransmissionCandidate[],
  ) => {
    if (plan.method !== 'sheHai' || plan.biYongCandidates.length <= 1) return;
    const retainedUppers = new Set(
      plan.biYongCandidates.map((candidate) => candidate.lesson.upper),
    );
    for (const candidate of values) {
      if (candidate.status !== 'selected' && !retainedUppers.has(candidate.upper)) {
        candidate.reasons[candidate.reasons.length - 1] = '与日干阴阳不同，未进入后续涉害比较';
      }
    }
  };

  let selectedCandidateKey: string | null = null;
  if (args.selectedFamily === 'directKe') {
    const useLower = directLower.length > 0;
    const activeOutput = useLower ? directLower : directUpper;
    const inactiveOutput = useLower ? directUpper : [];
    const activeInternal = useLower ? args.lowerKeUpper : args.upperKeLower;
    const plan = buildCandidateSelectionPlan(activeInternal, args.context);
    const selected = activeOutput.find((candidate) => candidate.upper === args.result.initial);
    selectedCandidateKey = selected?.key ?? null;
    setSelectedPool(
      activeOutput,
      plan.uniqueCandidates.length === 1
        ? useLower
          ? '唯一的下贼上候选'
          : '无下贼上后唯一的上克下候选'
        : plan.method === 'biYong'
          ? '阴阳比用取舍'
          : '涉害深浅与复等取舍',
    );
    markBiYongExclusions(plan, activeOutput);
    if (inactiveOutput.length) {
      setSuppressed(inactiveOutput, '下贼上候选前置成立，上克下候选不再参与取舍');
    }
    setSuppressed([...remoteUpper, ...remoteLower], '四课直接上下克前置成立，遥克不得抢占');

    stages.push(
      createOrdinaryStage(
        'directKe',
        1,
        plan.uniqueCandidates.length === 1 ? 'selected' : 'matched',
        ['先查下贼上；没有下贼上时再查上克下'],
        [...directLower, ...directUpper].map((candidate) => candidate.key),
        useLower
          ? `发现${directLower.length}个不同上神的下贼上候选`
          : `无下贼上，发现${directUpper.length}个不同上神的上克下候选`,
        [ORDINARY_METHOD_SOURCE],
        plan.uniqueCandidates.length === 1 ? (selectedCandidateKey ?? undefined) : undefined,
      ),
    );
    if (plan.uniqueCandidates.length === 1) {
      stages.push(
        createOrdinaryStage(
          'directBiYong',
          2,
          'notApplicable',
          [],
          [],
          '直接克只有一个不同上神，无须比用',
          [ORDINARY_METHOD_SOURCE],
        ),
        createOrdinaryStage(
          'directSheHai',
          3,
          'notApplicable',
          [],
          [],
          '直接克只有一个不同上神，无须涉害',
          [SHE_HAI_METHOD_SOURCE],
        ),
      );
    } else if (plan.method === 'biYong') {
      stages.push(
        createOrdinaryStage(
          'directBiYong',
          2,
          'selected',
          ['直接克存在多个不同上神', '取与日干阴阳同类且唯一的上神'],
          plan.uniqueCandidates
            .map(
              (candidate) =>
                activeOutput.find((item) => item.upper === candidate.lesson.upper)?.key,
            )
            .filter((key): key is string => Boolean(key)),
          '阴阳同类候选唯一，按比用取初传',
          [ORDINARY_METHOD_SOURCE],
          selectedCandidateKey ?? undefined,
        ),
        createOrdinaryStage(
          'directSheHai',
          3,
          'notApplicable',
          [],
          [],
          '比用已唯一取定，无须涉害',
          [SHE_HAI_METHOD_SOURCE],
        ),
      );
    } else {
      attachHarmAssessments(plan.sheHaiCandidates, activeOutput);
      recordSheHaiReasons(plan.sheHaiCandidates, activeOutput);
      stages.push(
        createOrdinaryStage(
          'directBiYong',
          2,
          plan.biYongCandidates.length > 1 ? 'matched' : 'notMatched',
          ['直接克存在多个不同上神', '先取与日干阴阳同类的上神'],
          plan.uniqueCandidates
            .map(
              (candidate) =>
                activeOutput.find((item) => item.upper === candidate.lesson.upper)?.key,
            )
            .filter((key): key is string => Boolean(key)),
          plan.biYongCandidates.length > 1
            ? '阴阳同类候选仍不唯一，继续涉害'
            : '没有唯一的阴阳同类候选，全部直接克候选继续涉害',
          [ORDINARY_METHOD_SOURCE],
        ),
        createOrdinaryStage(
          'directSheHai',
          3,
          'selected',
          ['比较归本家途中涉害深浅', '深浅复等时按干支上神与孟仲季次序取舍'],
          plan.sheHaiCandidates
            .map(
              (candidate) =>
                activeOutput.find((item) => item.upper === candidate.lesson.upper)?.key,
            )
            .filter((key): key is string => Boolean(key)),
          '按涉害深浅及复等次序取定初传',
          [SHE_HAI_METHOD_SOURCE],
          selectedCandidateKey ?? undefined,
        ),
      );
    }
    stages.push(
      createOrdinaryStage(
        'remoteKe',
        4,
        'suppressedByPrior',
        ['四课无直接上下克时才可进入遥克'],
        [...remoteUpper, ...remoteLower].map((candidate) => candidate.key),
        '四课直接上下克已成立，遥克不参与最终取舍',
        [ORDINARY_METHOD_SOURCE],
      ),
      createOrdinaryStage('remoteBiYong', 5, 'notApplicable', [], [], '遥克已被前置宗门压制', [
        ORDINARY_METHOD_SOURCE,
      ]),
      createOrdinaryStage('remoteSheHai', 6, 'notApplicable', [], [], '遥克已被前置宗门压制', [
        SHE_HAI_METHOD_SOURCE,
      ]),
    );
  } else if (args.selectedFamily === 'remoteKe') {
    const useUpper = remoteUpper.length > 0;
    const activeOutput = useUpper ? remoteUpper : remoteLower;
    const inactiveOutput = useUpper ? remoteLower : [];
    const activeInternal = useUpper
      ? args.remoteCandidates.upperKeDay
      : args.remoteCandidates.dayKeUpper;
    const plan = args.selectedPlan ?? buildCandidateSelectionPlan(activeInternal, args.context);
    const selected = activeOutput.find((candidate) => candidate.upper === args.result.initial);
    selectedCandidateKey = selected?.key ?? null;
    setSelectedPool(
      activeOutput,
      plan.uniqueCandidates.length === 1
        ? useUpper
          ? '唯一的神克日干蒿矢候选'
          : '无神克日干后唯一的日干克神弹射候选'
        : plan.method === 'biYong'
          ? '遥克候选阴阳比用取舍'
          : '遥克候选涉害深浅与复等取舍',
    );
    markBiYongExclusions(plan, activeOutput);
    if (inactiveOutput.length) {
      setSuppressed(inactiveOutput, '神克日干的蒿矢候选前置成立，弹射候选不再参与取舍');
    }
    stages.push(
      createOrdinaryStage(
        'directKe',
        1,
        'notMatched',
        ['先查下贼上；没有下贼上时再查上克下'],
        [],
        '四课没有直接上下克，进入遥克',
        [ORDINARY_METHOD_SOURCE],
      ),
      createOrdinaryStage('directBiYong', 2, 'notApplicable', [], [], '没有直接克候选', [
        ORDINARY_METHOD_SOURCE,
      ]),
      createOrdinaryStage('directSheHai', 3, 'notApplicable', [], [], '没有直接克候选', [
        SHE_HAI_METHOD_SOURCE,
      ]),
      createOrdinaryStage(
        'remoteKe',
        4,
        plan.uniqueCandidates.length === 1 ? 'selected' : 'matched',
        ['四课无直接上下克', '先取二三四课上神克日干；没有时再取日干克上神'],
        [...remoteUpper, ...remoteLower].map((candidate) => candidate.key),
        useUpper
          ? `发现${remoteUpper.length}个不同上神的蒿矢候选`
          : `无蒿矢，发现${remoteLower.length}个不同上神的弹射候选`,
        [ORDINARY_METHOD_SOURCE],
        plan.uniqueCandidates.length === 1 ? (selectedCandidateKey ?? undefined) : undefined,
      ),
    );
    if (plan.uniqueCandidates.length === 1) {
      stages.push(
        createOrdinaryStage(
          'remoteBiYong',
          5,
          'notApplicable',
          [],
          [],
          '遥克只有一个不同上神，无须比用',
          [ORDINARY_METHOD_SOURCE],
        ),
        createOrdinaryStage(
          'remoteSheHai',
          6,
          'notApplicable',
          [],
          [],
          '遥克只有一个不同上神，无须涉害',
          [SHE_HAI_METHOD_SOURCE],
        ),
      );
    } else if (plan.method === 'biYong') {
      stages.push(
        createOrdinaryStage(
          'remoteBiYong',
          5,
          'selected',
          ['遥克存在多个不同上神', '取与日干阴阳同类且唯一的上神'],
          plan.uniqueCandidates
            .map(
              (candidate) =>
                activeOutput.find((item) => item.upper === candidate.lesson.upper)?.key,
            )
            .filter((key): key is string => Boolean(key)),
          '遥克阴阳同类候选唯一，按比用取初传',
          [ORDINARY_METHOD_SOURCE],
          selectedCandidateKey ?? undefined,
        ),
        createOrdinaryStage(
          'remoteSheHai',
          6,
          'notApplicable',
          [],
          [],
          '比用已唯一取定，无须涉害',
          [SHE_HAI_METHOD_SOURCE],
        ),
      );
    } else {
      attachHarmAssessments(plan.sheHaiCandidates, activeOutput);
      recordSheHaiReasons(plan.sheHaiCandidates, activeOutput);
      stages.push(
        createOrdinaryStage(
          'remoteBiYong',
          5,
          plan.biYongCandidates.length > 1 ? 'matched' : 'notMatched',
          ['遥克存在多个不同上神', '先取与日干阴阳同类的上神'],
          plan.uniqueCandidates
            .map(
              (candidate) =>
                activeOutput.find((item) => item.upper === candidate.lesson.upper)?.key,
            )
            .filter((key): key is string => Boolean(key)),
          plan.biYongCandidates.length > 1
            ? '遥克阴阳同类候选仍不唯一，继续涉害'
            : '没有唯一的遥克阴阳同类候选，全部遥克候选继续涉害',
          [ORDINARY_METHOD_SOURCE],
        ),
        createOrdinaryStage(
          'remoteSheHai',
          6,
          'selected',
          ['比较遥克候选归本家途中涉害深浅', '深浅复等时按干支上神与孟仲季次序取舍'],
          plan.sheHaiCandidates
            .map(
              (candidate) =>
                activeOutput.find((item) => item.upper === candidate.lesson.upper)?.key,
            )
            .filter((key): key is string => Boolean(key)),
          '按遥克候选涉害深浅及复等次序取定初传',
          [SHE_HAI_METHOD_SOURCE],
          selectedCandidateKey ?? undefined,
        ),
      );
    }
  } else {
    if (isBazhuanDay) {
      setSuppressed([...remoteUpper, ...remoteLower], '八专日普通遥克不适用，转入八专取传');
    }
    stages.push(
      createOrdinaryStage(
        'directKe',
        1,
        'notMatched',
        ['先查四课直接上下克'],
        [],
        '四课没有直接上下克',
        [ORDINARY_METHOD_SOURCE],
      ),
      createOrdinaryStage('directBiYong', 2, 'notApplicable', [], [], '没有直接克候选', [
        ORDINARY_METHOD_SOURCE,
      ]),
      createOrdinaryStage('directSheHai', 3, 'notApplicable', [], [], '没有直接克候选', [
        SHE_HAI_METHOD_SOURCE,
      ]),
      createOrdinaryStage(
        'remoteKe',
        4,
        isBazhuanDay ? 'notApplicable' : 'notMatched',
        ['四课无直接上下克时再查遥克'],
        [...remoteUpper, ...remoteLower].map((candidate) => candidate.key),
        isBazhuanDay ? '八专日不进入普通遥克，转入特殊课' : '二三四课没有遥克候选，转入特殊课',
        [ORDINARY_METHOD_SOURCE],
      ),
      createOrdinaryStage('remoteBiYong', 5, 'notApplicable', [], [], '没有可参与取舍的遥克候选', [
        ORDINARY_METHOD_SOURCE,
      ]),
      createOrdinaryStage('remoteSheHai', 6, 'notApplicable', [], [], '没有可参与取舍的遥克候选', [
        SHE_HAI_METHOD_SOURCE,
      ]),
    );
  }

  const status = args.selectedFamily ? 'selected' : 'deferredToSpecial';
  return {
    key: 'liuren:ordinary-transmission-adjudication',
    status,
    selectedRule: args.selectedFamily ? args.result.rule : null,
    selectedInitial: args.selectedFamily ? args.result.initial : null,
    selectedCandidateKey,
    candidates,
    stages,
    summary:
      status === 'selected'
        ? `${stages.map(formatLiurenOrdinaryStage).join(' → ')}；最终按${args.result.rule}取${args.result.initial}发用。`
        : `普通宗门未取定，转入${args.result.rule}。`,
    sources: [ORDINARY_METHOD_SOURCE, SHE_HAI_METHOD_SOURCE],
    limitation: ORDINARY_ADJUDICATION_LIMITATION,
  };
}

function isFuyinPlate(plate: LiurenPlateItem[]) {
  return plate.length === 12 && plate.every((item) => item.branch === item.under);
}

function isFanyinPlate(plate: LiurenPlateItem[]) {
  return plate.length === 12 && plate.every((item) => LIUCHONG_MAP[item.under] === item.branch);
}

function getLessonPairKey(lesson: LiurenLesson) {
  return `${lesson.upper}/${lesson.lower}`;
}

/**
 * 《六壬指南》把“不备”限定为四课首尾相同，或二、三课相同。
 * 只比较上神会把不同的课对误合并，进而把昴星误判为别责。
 */
function isThreeLessonPattern(lessons: LiurenLesson[]) {
  const first = getLessonPairKey(lessons[0]);
  const second = getLessonPairKey(lessons[1]);
  const third = getLessonPairKey(lessons[2]);
  const fourth = getLessonPairKey(lessons[3]);
  return first === fourth || second === third;
}

function getPunishment(branch: string) {
  const punishment = SANXING_MAP[branch];
  if (!punishment) {
    throw new Error(`地支 ${branch} 的三刑映射缺失。`);
  }
  return punishment;
}

function buildFuyinBranches(initial: string, yiKeUpper: string, sanKeUpper: string) {
  let middle = getPunishment(initial);

  // 初传自刑时，中传取日辰另一侧；这条规则同样适用于乙、癸日有克发用。
  if (middle === initial) {
    middle = initial === yiKeUpper ? sanKeUpper : yiKeUpper;
  }

  let final = getPunishment(middle);
  // 中传再次自刑，末传取冲神；否则按三刑推进。
  if (final === middle) {
    const opposite = LIUCHONG_MAP[middle];
    if (!opposite) {
      throw new Error(`地支 ${middle} 的六冲映射缺失。`);
    }
    final = opposite;
  }

  return [initial, middle, final];
}

function resolveFuyinTransmission(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
): InitialTransmissionResult {
  const yiKeUpper = lessons[0].upper;
  const sanKeUpper = lessons[2].upper;
  const isYangDay = YANG_STEMS.has(context.dayStem);
  // 伏吟先核验四课本身的上下克。古籍明确指出只有乙、癸日会在
  // 干上神形成直接克，不能把这两日一概按“阴日从支上”处理。
  const lowerKeUpper = lessons
    .filter((item) => isBranchKe(item.lower, item.upper))
    .map(
      (lesson) =>
        ({ lesson, type: '下贼上', index: lessons.indexOf(lesson) }) satisfies KeCandidate,
    );
  const upperKeLower = lessons
    .filter((item) => isBranchKe(item.upper, item.lower))
    .map(
      (lesson) =>
        ({ lesson, type: '上克下', index: lessons.indexOf(lesson) }) satisfies KeCandidate,
    );
  const keResult = resolveKeCandidates(lowerKeUpper, upperKeLower, context, '伏吟');
  if (keResult) {
    return {
      ...keResult,
      branches: buildFuyinBranches(keResult.initial, yiKeUpper, sanKeUpper),
    };
  }

  const useDayStemSide = isYangDay;
  const initial = useDayStemSide ? yiKeUpper : sanKeUpper;

  return {
    initial,
    branches: buildFuyinBranches(initial, yiKeUpper, sanKeUpper),
    rule: '伏吟法',
    tag: isYangDay ? '自任' : '自信',
  };
}

function resolveFanyinTransmission(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
): InitialTransmissionResult {
  const lowerKeUpper = lessons
    .filter((item) => isBranchKe(item.lower, item.upper))
    .map(
      (lesson) =>
        ({ lesson, type: '下贼上', index: lessons.indexOf(lesson) }) satisfies KeCandidate,
    );
  const upperKeLower = lessons
    .filter((item) => isBranchKe(item.upper, item.lower))
    .map(
      (lesson) =>
        ({ lesson, type: '上克下', index: lessons.indexOf(lesson) }) satisfies KeCandidate,
    );
  const keResult = resolveKeCandidates(lowerKeUpper, upperKeLower, context, '返吟');
  if (keResult) {
    return keResult;
  }

  const yiKeUpper = lessons[0].upper;
  const sanKeUpper = lessons[2].upper;
  const initial = getYiMa(context.dayBranch);
  if (!initial) {
    throw new Error(`日支 ${context.dayBranch} 的驿马映射缺失。`);
  }

  return {
    initial,
    branches: [initial, sanKeUpper, yiKeUpper],
    rule: '返吟法',
    tag: '无依',
  };
}

function resolveSpecialTransmission(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
): InitialTransmissionResult {
  const yiKeUpper = lessons[0].upper;
  const sanKeUpper = lessons[2].upper;
  const siKeUpper = lessons[3].upper;
  const isYangDay = YANG_STEMS.has(context.dayStem);
  const isBazhuanDay = BAZHUAN_DAYS.has(`${context.dayStem}${context.dayBranch}`);

  if (isBazhuanDay) {
    const initial = isYangDay ? shiftBranch(yiKeUpper, 2) : shiftBranch(siKeUpper, -2);
    return {
      initial,
      branches: [initial, yiKeUpper, yiKeUpper],
      rule: '八专法',
      tag: '八专',
    };
  }

  if (!isThreeLessonPattern(lessons)) {
    const initial = isYangDay
      ? getUpperByUnder(context.heavenlyPlate, '酉')
      : getUnderByUpper(context.heavenlyPlate, '酉');
    return {
      initial,
      branches: isYangDay ? [initial, sanKeUpper, yiKeUpper] : [initial, yiKeUpper, sanKeUpper],
      rule: '昴星法',
      tag: isYangDay ? '虎视' : '冬蛇掩目',
    };
  }

  if (isThreeLessonPattern(lessons)) {
    if (isYangDay) {
      const heStem = TIAN_GAN_HE[context.dayStem]?.partner;
      if (!heStem) {
        throw new Error(`日干 ${context.dayStem} 的天干五合映射缺失。`);
      }
      const heStemResidence = STEM_RESIDENCE_MAP[heStem];
      if (!heStemResidence) {
        throw new Error(`合干 ${heStem} 的寄宫映射缺失。`);
      }
      const initial = getUpperByUnder(context.heavenlyPlate, heStemResidence);
      return {
        initial,
        branches: [initial, yiKeUpper, yiKeUpper],
        rule: '别责法',
        tag: '别责',
      };
    }

    const initial = shiftBranch(context.dayBranch, 4);
    return {
      initial,
      branches: [initial, yiKeUpper, yiKeUpper],
      rule: '别责法',
      tag: '别责',
    };
  }

  return {
    initial: yiKeUpper,
    rule: '别责法',
    tag: '别责',
  };
}

export function resolveInitialTransmission(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
) {
  assertValidResolveTransmissionInput(lessons, context);

  if (isFuyinPlate(context.heavenlyPlate)) {
    const result = resolveFuyinTransmission(lessons, context);
    return {
      ...result,
      ordinaryAdjudication: buildDeferredOrdinaryAdjudication(
        result.rule,
        '天地盘为伏吟，先按伏吟特殊课取传',
      ),
    };
  }

  if (isFanyinPlate(context.heavenlyPlate)) {
    const result = resolveFanyinTransmission(lessons, context);
    return {
      ...result,
      ordinaryAdjudication: buildDeferredOrdinaryAdjudication(
        result.rule,
        '天地盘为返吟，先按返吟特殊课取传',
      ),
    };
  }

  const lowerKeUpper = lessons
    .filter((item) => isBranchKe(item.lower, item.upper))
    .map(
      (lesson) =>
        ({ lesson, type: '下贼上', index: lessons.indexOf(lesson) }) satisfies KeCandidate,
    );
  const upperKeLower = lessons
    .filter((item) => isBranchKe(item.upper, item.lower))
    .map(
      (lesson) =>
        ({ lesson, type: '上克下', index: lessons.indexOf(lesson) }) satisfies KeCandidate,
    );
  const remoteCandidates = buildRemoteKeCandidates(lessons, context);
  const keResult = resolveKeCandidates(lowerKeUpper, upperKeLower, context);
  if (keResult) {
    return {
      ...keResult,
      ordinaryAdjudication: buildOrdinaryTransmissionAdjudication({
        context,
        result: keResult,
        lowerKeUpper,
        upperKeLower,
        remoteCandidates,
        selectedFamily: 'directKe',
      }),
    };
  }

  const remoteKeResolution = resolveRemoteKe(remoteCandidates, context);
  if (remoteKeResolution) {
    const remoteKeResult = remoteKeResolution.result;
    return {
      ...remoteKeResult,
      ordinaryAdjudication: buildOrdinaryTransmissionAdjudication({
        context,
        result: remoteKeResult,
        lowerKeUpper,
        upperKeLower,
        remoteCandidates,
        selectedFamily: 'remoteKe',
        selectedPlan: remoteKeResolution.selectionPlan,
      }),
    };
  }

  const specialResult = resolveSpecialTransmission(lessons, context);
  return {
    ...specialResult,
    ordinaryAdjudication: buildOrdinaryTransmissionAdjudication({
      context,
      result: specialResult,
      lowerKeUpper,
      upperKeLower,
      remoteCandidates,
      selectedFamily: null,
    }),
  };
}
