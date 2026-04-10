import type { LiurenData, LiurenLesson, LiurenPlateItem, LiurenTransmission } from '../../../types';
import { getDivinationTime } from '../../../utils/timeManager.ts';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const TIANJIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'] as const;
const WUXING_MAP: Record<string, string> = {
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};
const MONTH_LEADER_MAP: Record<string, string> = {
  寅: '亥',
  卯: '戌',
  辰: '酉',
  巳: '申',
  午: '未',
  未: '午',
  申: '巳',
  酉: '辰',
  戌: '卯',
  亥: '寅',
  子: '丑',
  丑: '子',
};
const DAY_STEM_RESIDENCE_MAP: Record<string, string> = {
  甲: '寅',
  乙: '辰',
  丙: '巳',
  丁: '未',
  戊: '巳',
  己: '未',
  庚: '申',
  辛: '戌',
  壬: '亥',
  癸: '丑',
};
const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);
const GUIREN_BRANCH_BY_STEM: Record<string, { day: string; night: string }> = {
  甲: { day: '丑', night: '未' },
  戊: { day: '丑', night: '未' },
  庚: { day: '丑', night: '未' },
  乙: { day: '子', night: '申' },
  己: { day: '子', night: '申' },
  丙: { day: '亥', night: '酉' },
  丁: { day: '亥', night: '酉' },
  壬: { day: '卯', night: '巳' },
  癸: { day: '卯', night: '巳' },
  辛: { day: '午', night: '寅' },
};
const LIUCHONG_MAP: Record<string, string> = {
  子: '午',
  丑: '未',
  寅: '申',
  卯: '酉',
  辰: '戌',
  巳: '亥',
  午: '子',
  未: '丑',
  申: '寅',
  酉: '卯',
  戌: '辰',
  亥: '巳',
};
const JIAZI = Array.from({ length: 60 }, (_, index) => (
  `${TIANGAN[index % TIANGAN.length]}${DIZHI[index % DIZHI.length]}`
));

function getBranchIndex(branch: string) {
  return DIZHI.indexOf(branch as (typeof DIZHI)[number]);
}

function isSheng(source: string, target: string) {
  const shengMap: Record<string, string> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
  };

  return shengMap[source] === target;
}

function isKeElement(source: string, target: string) {
  const keMap: Record<string, string> = {
    木: '土',
    土: '水',
    水: '火',
    火: '金',
    金: '木',
  };

  return keMap[source] === target;
}

function describeRelation(sourceBranch: string, targetBranch: string) {
  const sourceElement = WUXING_MAP[sourceBranch] || '';
  const targetElement = WUXING_MAP[targetBranch] || '';

  if (!sourceElement || !targetElement) {
    return '关系待定';
  }
  if (sourceElement === targetElement) {
    return '比和';
  }
  if (isSheng(sourceElement, targetElement)) {
    return `${sourceElement}生${targetElement}`;
  }
  if (isSheng(targetElement, sourceElement)) {
    return `${targetElement}生${sourceElement}`;
  }
  if (isKeElement(sourceElement, targetElement)) {
    return `${sourceElement}克${targetElement}`;
  }
  if (isKeElement(targetElement, sourceElement)) {
    return `${targetElement}克${sourceElement}`;
  }

  return `${sourceElement}与${targetElement}杂见`;
}

function buildLessonNote(relation: string, xunKong: string[], upper: string, lower: string) {
  const xunKongTip = xunKong.includes(upper) || xunKong.includes(lower)
    ? '本课触及旬空，落地会有延后。'
    : '';

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

function buildTransmissionNote(stage: LiurenTransmission['stage'], relation: string) {
  const stagePrefixMap: Record<LiurenTransmission['stage'], string> = {
    初传: '事情起点',
    中传: '过程阶段',
    末传: '结果落点',
  };

  if (relation === '比和') {
    return `${stagePrefixMap[stage]}偏平稳，可按既定节奏推进。`;
  }
  if (relation.includes('生')) {
    return `${stagePrefixMap[stage]}有承接与转机，适合顺势发力。`;
  }
  if (relation.includes('克')) {
    return `${stagePrefixMap[stage]}阻力更明显，宜先拆解卡点。`;
  }

  return `${stagePrefixMap[stage]}变化较杂，需要边走边校正。`;
}

function getNoblemanBranch(dayStem: string, dayNight: '昼占' | '夜占') {
  const pair = GUIREN_BRANCH_BY_STEM[dayStem];
  if (!pair) {
    return dayNight === '昼占' ? '丑' : '未';
  }

  return dayNight === '昼占' ? pair.day : pair.night;
}

function getXunKong(dayGanzhi: string): string[] {
  const index = JIAZI.indexOf(dayGanzhi);
  if (index < 0) {
    return [];
  }

  const xunStart = Math.floor(index / 10) * 10;
  const startBranch = JIAZI[xunStart].charAt(1);
  const startIndex = getBranchIndex(startBranch);
  if (startIndex < 0) {
    return [];
  }

  return [
    DIZHI[(startIndex + DIZHI.length - 2) % DIZHI.length],
    DIZHI[(startIndex + DIZHI.length - 1) % DIZHI.length],
  ];
}

function getUpperByUnder(plate: LiurenPlateItem[], under: string) {
  return plate.find((item) => item.under === under)?.branch || under;
}

function buildHeavenlyPlate(args: {
  monthLeader: string;
  divinationBranch: string;
  noblemanBranch: string;
  dayNight: '昼占' | '夜占';
}) {
  const monthLeaderIndex = getBranchIndex(args.monthLeader);
  const divinationBranchIndex = getBranchIndex(args.divinationBranch);
  const offset = (divinationBranchIndex - monthLeaderIndex + DIZHI.length) % DIZHI.length;
  const basePlate = DIZHI.map((under, underIndex) => ({
    branch: DIZHI[(underIndex - offset + DIZHI.length) % DIZHI.length],
    under,
    god: '',
  })) satisfies LiurenPlateItem[];

  const byUnderGod = new Map<string, string>();
  const noblemanUnderIndex = getBranchIndex(args.noblemanBranch);
  const direction = args.dayNight === '昼占' ? 1 : -1;

  for (let step = 0; step < DIZHI.length; step += 1) {
    const underIndex = (noblemanUnderIndex + direction * step + DIZHI.length * 2) % DIZHI.length;
    byUnderGod.set(DIZHI[underIndex], TIANJIANG[step]);
  }

  return basePlate.map((item) => ({
    ...item,
    god: byUnderGod.get(item.under) || '贵人',
  }));
}

function getPlateItemByBranch(plate: LiurenPlateItem[], branch: string) {
  return plate.find((item) => item.branch === branch) || plate[0];
}

function isBranchKe(sourceBranch: string, targetBranch: string) {
  const sourceElement = WUXING_MAP[sourceBranch] || '';
  const targetElement = WUXING_MAP[targetBranch] || '';
  if (!sourceElement || !targetElement) {
    return false;
  }

  return isKeElement(sourceElement, targetElement);
}

function getCandidateScore(item: LiurenLesson, lessons: LiurenLesson[], xunKong: string[]) {
  let score = 0;

  if (!xunKong.includes(item.upper)) {
    score += 3;
  }
  if (!xunKong.includes(item.lower)) {
    score += 2;
  }
  if (item.god === '贵人' || item.god === '青龙' || item.god === '六合') {
    score += 1;
  }
  if (item.relation === '比和') {
    score += 1;
  }

  const sameUpperDamageCount = lessons.filter(
    (lesson) => lesson.upper === item.upper && (isBranchKe(lesson.lower, lesson.upper) || isBranchKe(lesson.upper, lesson.lower)),
  ).length;
  score += sameUpperDamageCount;

  return score;
}

function pickBestCandidate(candidates: LiurenLesson[], lessons: LiurenLesson[], xunKong: string[]) {
  return candidates
    .map((item, index) => ({
      item,
      index,
      score: getCandidateScore(item, lessons, xunKong),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].item;
}

function resolveInitialTransmission(lessons: LiurenLesson[], xunKong: string[]) {
  const lowerKeUpper = lessons.filter((item) => isBranchKe(item.lower, item.upper));
  if (lowerKeUpper.length > 0) {
    const picked = pickBestCandidate(lowerKeUpper, lessons, xunKong);
    return {
      initial: picked.upper,
      rule: '贼克法',
      tag: '贼克取用',
    };
  }

  const upperKeLower = lessons.filter((item) => isBranchKe(item.upper, item.lower));
  if (upperKeLower.length > 0) {
    const picked = pickBestCandidate(upperKeLower, lessons, xunKong);
    return {
      initial: picked.upper,
      rule: '克法',
      tag: '上克下',
    };
  }

  const biHe = lessons.filter((item) => item.relation === '比和');
  if (biHe.length > 0) {
    const picked = pickBestCandidate(biHe, lessons, xunKong);
    return {
      initial: picked.upper,
      rule: '比用法',
      tag: '比用',
    };
  }

  const sheHaiCandidates = lessons.filter((item) => item.relation.includes('克'));
  if (sheHaiCandidates.length > 0) {
    const picked = pickBestCandidate(sheHaiCandidates, lessons, xunKong);
    return {
      initial: picked.upper,
      rule: '涉害法',
      tag: '涉害',
    };
  }

  const safeLesson = lessons.find((item) => !xunKong.includes(item.upper));
  if (safeLesson) {
    return {
      initial: safeLesson.upper,
      rule: '别责法',
      tag: '别责',
    };
  }

  return {
    initial: lessons[0].upper,
    rule: '八专法',
    tag: '八专',
  };
}

function getTransmissionPattern(chu: string, zhong: string, mo: string): LiurenData['transmissionPattern'] {
  if (chu === zhong && zhong === mo) {
    return '伏吟';
  }
  if (LIUCHONG_MAP[chu] === mo) {
    return '反吟';
  }
  if (chu === mo) {
    return '回环';
  }

  return '递传';
}

function getPatternTag(pattern: LiurenData['transmissionPattern']) {
  if (pattern === '伏吟') {
    return '伏吟';
  }
  if (pattern === '反吟') {
    return '反吟';
  }
  if (pattern === '回环') {
    return '回环';
  }

  return '递传';
}

function buildTransmissionDetail(
  rule: string,
  pattern: LiurenData['transmissionPattern'],
  transmissions: LiurenTransmission[],
) {
  const stageText = transmissions.map((item) => `${item.stage}${item.branch}`).join(' → ');
  return `取传采用${rule}，传态为${pattern}，链路为${stageText}。`;
}

function buildDivinationTemplateHint(
  transmissions: LiurenTransmission[],
  pattern: LiurenData['transmissionPattern'],
) {
  return `断课模板：先看${transmissions[0].stage}(${transmissions[0].branch})定起因，再看${transmissions[1].stage}(${transmissions[1].branch})看过程，最后看${transmissions[2].stage}(${transmissions[2].branch})定结果；传态为${pattern}。`;
}

export function generateLiuren(customDate?: Date): LiurenData {
  const { ganzhi, timeInfo, timestamp } = getDivinationTime(customDate);
  const monthBranch = ganzhi.month.charAt(1);
  const dayStem = ganzhi.day.charAt(0);
  const dayBranch = ganzhi.day.charAt(1);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const monthLeader = MONTH_LEADER_MAP[monthBranch] || '亥';
  const noblemanBranch = getNoblemanBranch(dayStem, dayNight);
  const xunKong = getXunKong(ganzhi.day);
  const dayOfficer = '贵人';
  const heavenlyPlate = buildHeavenlyPlate({
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    dayNight,
  });

  const dayStemResidence = DAY_STEM_RESIDENCE_MAP[dayStem] || dayBranch;
  const yiKeUpper = getUpperByUnder(heavenlyPlate, dayStemResidence);
  const erKeUpper = getUpperByUnder(heavenlyPlate, yiKeUpper);
  const sanKeUpper = getUpperByUnder(heavenlyPlate, dayBranch);
  const siKeUpper = getUpperByUnder(heavenlyPlate, sanKeUpper);
  const lessonNames: LiurenLesson['name'][] = ['一课', '二课', '三课', '四课'];
  const lessonPairs: Array<{ upper: string; lower: string }> = [
    { upper: yiKeUpper, lower: dayStemResidence },
    { upper: erKeUpper, lower: yiKeUpper },
    { upper: sanKeUpper, lower: dayBranch },
    { upper: siKeUpper, lower: sanKeUpper },
  ];

  const fourLessons = lessonPairs.map((item, index) => {
    const relation = describeRelation(item.upper, item.lower);
    const god = getPlateItemByBranch(heavenlyPlate, item.upper).god;

    return {
      name: lessonNames[index],
      upper: item.upper,
      lower: item.lower,
      god,
      relation,
      note: buildLessonNote(relation, xunKong, item.upper, item.lower),
    };
  }) satisfies LiurenLesson[];

  const initialResult = resolveInitialTransmission(fourLessons, xunKong);
  const chu = initialResult.initial;
  const zhong = getUpperByUnder(heavenlyPlate, chu);
  const mo = getUpperByUnder(heavenlyPlate, zhong);
  const transmissionPattern = getTransmissionPattern(chu, zhong, mo);
  const transmissionBranches = [chu, zhong, mo];
  const transmissionStages: LiurenTransmission['stage'][] = ['初传', '中传', '末传'];
  const threeTransmissions = transmissionBranches.map((branch, index) => {
    const plateItem = getPlateItemByBranch(heavenlyPlate, branch);
    const previousBranch = index === 0 ? fourLessons[0].lower : transmissionBranches[index - 1];
    const relation = describeRelation(branch, previousBranch);

    return {
      stage: transmissionStages[index],
      branch,
      god: plateItem.god,
      relation,
      note: buildTransmissionNote(transmissionStages[index], relation),
    };
  }) satisfies LiurenTransmission[];

  const transmissionDetail = buildTransmissionDetail(initialResult.rule, transmissionPattern, threeTransmissions);

  const patternTags = [
    `${threeTransmissions[0].god}发用`,
    initialResult.tag,
    threeTransmissions.some((item) => xunKong.includes(item.branch)) ? '空亡入传' : '传不逢空',
    getPatternTag(transmissionPattern),
  ];

  const lessonSummary = `四课源于日干寄宫${dayStemResidence}与日支${dayBranch}，关系呈${fourLessons
    .map((item) => item.relation)
    .join('、')}，重点先看${initialResult.tag}落点。`;
  const transmissionSummary = `${transmissionDetail}${buildDivinationTemplateHint(threeTransmissions, transmissionPattern)}`;

  return {
    ganzhi,
    timestamp,
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    dayOfficer,
    noblemanBranch,
    xunKong,
    transmissionRule: initialResult.rule,
    transmissionPattern,
    transmissionDetail,
    heavenlyPlate,
    fourLessons,
    threeTransmissions,
    patternTags,
    lessonSummary: `${lessonSummary} 当前节气为${timeInfo.jieQi}。`,
    transmissionSummary,
  };
}
