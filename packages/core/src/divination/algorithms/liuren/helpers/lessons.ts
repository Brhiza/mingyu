import type { LiurenLesson, LiurenPlateItem } from '../../../../types/divination';
import { BASIC_MAPPINGS, HEAVENLY_STEMS } from '../../../../bazi/baziMappingsData';
import {
  BRANCH_WUXING,
  getBranchIndex,
  isKe,
  LIUCHONG_MAP,
  SANXING_MAP,
  getYiMa,
  TIAN_GAN_HE,
} from '../../_shared';
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

const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);
const YANG_BRANCHES = new Set(['子', '寅', '辰', '午', '申', '戌']);
const BAZHUAN_DAYS = new Set(['甲寅', '庚申', '丁未', '己未']);
const STEM_RESIDENCE_MAP = DAY_STEM_RESIDENCE_MAP;
// POST_HORSE_MAP / LIUCHONG_MAP / SANXING_MAP / STEM_HE_MAP 已复用 _shared 数据
const MENG_BRANCHES = new Set(['寅', '巳', '申', '亥']);
const ZHONG_BRANCHES = new Set(['子', '卯', '午', '酉']);
const JI_BRANCHES = new Set(['辰', '戌', '丑', '未']);
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
  const xunKongTip =
    xunKong.includes(upper) || xunKong.includes(lower) ? '本课触及旬空，落地会有延后。' : '';

  if (relation === '比和') {
    return ['内外同气，推进阻力相对可控。', xunKongTip].filter(Boolean).join('');
  }
  if (relation.includes('生')) {
    return ['有承接与助推，但也要看后续是否跟得上。', xunKongTip].filter(Boolean).join('');
  }
  if (relation.includes('克')) {
    return ['现实牵制较强，先处理冲突点更稳。', xunKongTip].filter(Boolean).join('');
  }

  return ['需结合全课继续判断。', xunKongTip].filter(Boolean).join('');
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
  return stemIndex >= 0 ? BASIC_MAPPINGS.STEM_WUXING[stemIndex] : '';
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

function hasSameDayAndHourElement(context: ResolveTransmissionContext) {
  const dayStemElement = getGanZhiWuxing(context.dayStem);
  const dayBranchElement = getGanZhiWuxing(context.dayBranch);
  const hourStemElement = getGanZhiWuxing(context.hourStem || '');
  const hourBranchElement = getGanZhiWuxing(context.hourBranch || '');

  return (
    Boolean(dayStemElement && hourStemElement) &&
    dayStemElement === dayBranchElement &&
    hourStemElement === hourBranchElement
  );
}

function getBranchAt(rawIndex: number) {
  const branches = Object.keys(BRANCH_WUXING);
  return branches[((rawIndex % branches.length) + branches.length) % branches.length];
}

function shiftBranch(branch: string, steps: number) {
  const index = getBranchIndex(branch);
  if (index < 0) {
    return branch;
  }
  return getBranchAt(index + steps);
}

function walkBranches(start: string, end: string) {
  const startIndex = getBranchIndex(start);
  const endIndex = getBranchIndex(end);
  if (startIndex < 0 || endIndex < 0) {
    return [];
  }

  const branches: string[] = [];
  for (let step = 0; step < 12; step += 1) {
    const branch = getBranchAt(startIndex + step);
    if (branch === end && step > 0) {
      break;
    }
    branches.push(branch);
  }

  return branches;
}

function getHarmDepth(candidate: KeCandidate, context: ResolveTransmissionContext) {
  const upperElement = getGanZhiWuxing(candidate.lesson.upper);
  const startUnder = getUnderByUpper(context.heavenlyPlate, candidate.lesson.upper);
  const walkedBranches = walkBranches(startUnder, candidate.lesson.upper);

  return walkedBranches.reduce((count, branch) => {
    const branchElement = BRANCH_WUXING[branch] || '';
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
}

function pickByHarmDepth(candidates: KeCandidate[], context: ResolveTransmissionContext) {
  const ranked = candidates.map((candidate, index) => ({
    candidate,
    index,
    depth: getHarmDepth(candidate, context),
    under: getUnderByUpper(context.heavenlyPlate, candidate.lesson.upper),
  }));
  const meng = ranked
    .filter((item) => MENG_BRANCHES.has(item.under))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)[0];
  if (meng) {
    return meng.candidate;
  }

  const zhong = ranked
    .filter((item) => ZHONG_BRANCHES.has(item.under))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)[0];
  if (zhong) {
    return zhong.candidate;
  }

  const ji = ranked
    .filter((item) => JI_BRANCHES.has(item.under))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)[0];
  if (ji) {
    return ji.candidate;
  }

  const tied = ranked.sort((a, b) => b.depth - a.depth || a.index - b.index);
  const preferredUpper = YANG_STEMS.has(context.dayStem)
    ? context.dayStemResidence
    : context.dayBranch;
  return (
    tied.find((item) => item.candidate.lesson.upper === preferredUpper)?.candidate ||
    tied[0].candidate
  );
}

function resolveMultipleCandidates(
  candidates: KeCandidate[],
  context: ResolveTransmissionContext,
  lessons: LiurenLesson[],
  tagPrefix = '',
): InitialTransmissionResult {
  const uniqueCandidates = uniqueCandidatesByUpper(candidates);
  const biYongCandidates = uniqueCandidates.filter((item) =>
    isSameYinYangAsDayStem(item.lesson.upper, context.dayStem),
  );

  if (biYongCandidates.length === 1) {
    const zhiYiVariant = pickZhiYiVariant(uniqueCandidates, biYongCandidates[0], context, lessons);
    if (zhiYiVariant) {
      return {
        initial: zhiYiVariant.upper,
        rule: tagPrefix ? `${tagPrefix}比用法` : '比用法',
        tag: tagPrefix ? `${tagPrefix}知一` : '知一',
      };
    }

    const picked = biYongCandidates[0];
    return {
      initial: picked.lesson.upper,
      rule: tagPrefix ? `${tagPrefix}比用法` : '比用法',
      tag: tagPrefix ? `${tagPrefix}比用` : '比用',
    };
  }

  const picked = pickByHarmDepth(
    biYongCandidates.length > 1 ? biYongCandidates : uniqueCandidates,
    context,
  );

  return {
    initial: picked.lesson.upper,
    rule: tagPrefix ? `${tagPrefix}涉害法` : '涉害法',
    tag: tagPrefix ? `${tagPrefix}涉害` : '涉害',
  };
}

function pickZhiYiVariant(
  uniqueCandidates: KeCandidate[],
  sameYinYangCandidate: KeCandidate,
  context: ResolveTransmissionContext,
  lessons: LiurenLesson[],
) {
  if (
    uniqueCandidates.length !== 2 ||
    uniqueCandidates.some((candidate) => candidate.type !== '下贼上') ||
    sameYinYangCandidate.index !== 0 ||
    !hasSameDayAndHourElement(context)
  ) {
    return null;
  }

  return lessons[1] || null;
}

function resolveKeCandidates(
  lowerKeUpper: KeCandidate[],
  upperKeLower: KeCandidate[],
  context: ResolveTransmissionContext,
  lessons: LiurenLesson[],
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
    return resolveMultipleCandidates(uniqueLowerKeUpper, context, lessons, rulePrefix);
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
    return resolveMultipleCandidates(uniqueUpperKeLower, context, lessons, rulePrefix);
  }

  return null;
}

function resolveRemoteKe(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
): InitialTransmissionResult | null {
  if (BAZHUAN_DAYS.has(`${context.dayStem}${context.dayBranch}`)) {
    return null;
  }

  const dayStemWuxing = getStemWuxing(context.dayStem);
  const remoteLessons = lessons.slice(1);
  const upperKeDay = remoteLessons
    .filter((lesson) => isElementKe(getGanZhiWuxing(lesson.upper), dayStemWuxing))
    .map((lesson, index) => ({ lesson, type: '上克下', index: index + 1 }) satisfies KeCandidate);
  const dayKeUpper = remoteLessons
    .filter((lesson) => isElementKe(dayStemWuxing, getGanZhiWuxing(lesson.upper)))
    .map((lesson, index) => ({ lesson, type: '下贼上', index: index + 1 }) satisfies KeCandidate);

  if (upperKeDay.length === 1) {
    return { initial: upperKeDay[0].lesson.upper, rule: '遥克法', tag: '蒿矢' };
  }
  if (upperKeDay.length > 1) {
    return resolveMultipleCandidates(upperKeDay, context, lessons, '遥克');
  }
  if (dayKeUpper.length === 1) {
    return { initial: dayKeUpper[0].lesson.upper, rule: '遥克法', tag: '弹射' };
  }
  if (dayKeUpper.length > 1) {
    return resolveMultipleCandidates(dayKeUpper, context, lessons, '遥克');
  }

  return null;
}

function isFuyinPlate(plate: LiurenPlateItem[]) {
  return plate.length === 12 && plate.every((item) => item.branch === item.under);
}

function isFanyinPlate(plate: LiurenPlateItem[]) {
  return plate.length === 12 && plate.every((item) => LIUCHONG_MAP[item.under] === item.branch);
}

function getUniqueLessonPairCount(lessons: LiurenLesson[]) {
  return new Set(lessons.map((lesson) => lesson.upper)).size;
}

function getPunishment(branch: string) {
  return SANXING_MAP[branch] || branch;
}

function resolveFuyinTransmission(
  lessons: LiurenLesson[],
  context: ResolveTransmissionContext,
): InitialTransmissionResult {
  const yiKeUpper = lessons[0]?.upper || context.dayStemResidence;
  const sanKeUpper = lessons[2]?.upper || context.dayBranch;
  const isSelfResponsibility =
    YANG_STEMS.has(context.dayStem) || context.dayStem === '乙' || context.dayStem === '癸';
  const useDayStemSide = isSelfResponsibility;
  const initial = useDayStemSide ? yiKeUpper : sanKeUpper;
  let middle = getPunishment(initial);

  if (middle === initial) {
    middle = useDayStemSide ? sanKeUpper : yiKeUpper;
  }

  let final = getPunishment(middle);
  if (final === middle || getPunishment(middle) === initial) {
    final = LIUCHONG_MAP[middle] || middle;
  }

  return {
    initial,
    branches: [initial, middle, final],
    rule: '伏吟法',
    tag: isSelfResponsibility ? '自任' : '自信',
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
  const keResult = resolveKeCandidates(lowerKeUpper, upperKeLower, context, lessons, '返吟');
  if (keResult) {
    return keResult;
  }

  const yiKeUpper = lessons[0]?.upper || context.dayStemResidence;
  const sanKeUpper = lessons[2]?.upper || context.dayBranch;
  const initial = getYiMa(context.dayBranch) || getUpperByUnder(context.heavenlyPlate, '寅');

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
  const yiKeUpper = lessons[0]?.upper || context.dayStemResidence;
  const sanKeUpper = lessons[2]?.upper || context.dayBranch;
  const siKeUpper = lessons[3]?.upper || sanKeUpper;
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

  if (getUniqueLessonPairCount(lessons) === 4) {
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

  if (getUniqueLessonPairCount(lessons) === 3) {
    if (isYangDay) {
      const heStem = TIAN_GAN_HE[context.dayStem]?.partner || context.dayStem;
      const heStemResidence = STEM_RESIDENCE_MAP[heStem] || context.dayStemResidence;
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
    return resolveFuyinTransmission(lessons, context);
  }

  if (isFanyinPlate(context.heavenlyPlate)) {
    return resolveFanyinTransmission(lessons, context);
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
  const keResult = resolveKeCandidates(lowerKeUpper, upperKeLower, context, lessons);
  if (keResult) {
    return keResult;
  }

  const remoteKeResult = resolveRemoteKe(lessons, context);
  if (remoteKeResult) {
    return remoteKeResult;
  }

  return resolveSpecialTransmission(lessons, context);
}
