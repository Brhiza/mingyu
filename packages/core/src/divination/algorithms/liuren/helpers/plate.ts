import type { LiurenPlateItem } from '../../../../types/divination';
import {
  BASIC_MAPPINGS,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
} from '../../../../bazi/baziMappingsData';
import { BRANCH_WUXING, getBranchIndex, isKe, isSheng } from '../../../../ganzhi';
import { MONTH_GENERAL_BY_ZHONGQI } from '../../../../calendar/month-general';

export const DIZHI = EARTHLY_BRANCHES;
export const TIANGAN = HEAVENLY_STEMS;
const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);

/**
 * 月将采用《六壬粹言》《六壬指南》及《六壬指南注解》所载十二中气换将口径。
 * 《大六壬大全》当前电子底本功曹条作“大雪后”，与前三书“小雪后”异文，
 * 此处以三书可互证的“小雪后寅将”为主版本，不静默混入另一底本。
 */
export const LIUREN_MONTH_LEADER_BY_ZHONGQI = MONTH_GENERAL_BY_ZHONGQI;

/** 《六壬粹言》：卯至申用昼贵，酉至寅用夜贵。 */
export const LIUREN_DAYTIME_BRANCHES: ReadonlySet<string> = new Set([
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
]);
export const LIUREN_NIGHTTIME_BRANCHES: ReadonlySet<string> = new Set([
  '酉',
  '戌',
  '亥',
  '子',
  '丑',
  '寅',
]);

/**
 * 十二天将（《大六壬大全》天将体系）：
 * 贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、玄武、太阴、天后。
 * 十二天将分属各干支，以下只保留可由《天将总论》《十二将释》直接核验的属性。
 */
export const TIANJIANG = [
  '贵人',
  '螣蛇',
  '朱雀',
  '六合',
  '勾陈',
  '青龙',
  '天空',
  '白虎',
  '太常',
  '玄武',
  '太阴',
  '天后',
] as const;

export type TianJiangName = (typeof TIANJIANG)[number];

/**
 * 十二天将配干支基础表。
 * 配干支由《六壬神定经》下卷“释天官第二十九”、《六壬大全》卷二、
 * 《六壬神将释》与《六壬粹言》卷一互证；
 * 五行、阴阳只按所配干支复算。未闭合适用条件的现实类象不保存在基础表中。
 */
export const TIANJIANG_ATTRIBUTES: Record<
  TianJiangName,
  {
    stem: string; // 天将所配天干
    branch: string; // 天将所配地支
    wuxing: string; // 天将五行
    yinYang: '阳' | '阴';
  }
> = {
  贵人: {
    stem: '己',
    branch: '丑',
    wuxing: '土',
    yinYang: '阴',
  },
  螣蛇: {
    stem: '丁',
    branch: '巳',
    wuxing: '火',
    yinYang: '阴',
  },
  朱雀: {
    stem: '丙',
    branch: '午',
    wuxing: '火',
    yinYang: '阳',
  },
  六合: {
    stem: '乙',
    branch: '卯',
    wuxing: '木',
    yinYang: '阴',
  },
  勾陈: {
    stem: '戊',
    branch: '辰',
    wuxing: '土',
    yinYang: '阳',
  },
  青龙: {
    stem: '甲',
    branch: '寅',
    wuxing: '木',
    yinYang: '阳',
  },
  天空: {
    stem: '戊',
    branch: '戌',
    wuxing: '土',
    yinYang: '阳',
  },
  白虎: {
    stem: '庚',
    branch: '申',
    wuxing: '金',
    yinYang: '阳',
  },
  太常: {
    stem: '己',
    branch: '未',
    wuxing: '土',
    yinYang: '阴',
  },
  玄武: {
    stem: '癸',
    branch: '亥',
    wuxing: '水',
    yinYang: '阴',
  },
  太阴: {
    stem: '辛',
    branch: '酉',
    wuxing: '金',
    yinYang: '阴',
  },
  天后: {
    stem: '壬',
    branch: '子',
    wuxing: '水',
    yinYang: '阳',
  },
};

/** 《六壬神定经》下卷“释天乙第二十八”与后世通行昼夜贵人表互证。 */
export const GUIREN_BRANCH_BY_STEM: Record<string, { day: string; night: string }> = {
  甲: { day: '丑', night: '未' },
  戊: { day: '丑', night: '未' },
  庚: { day: '丑', night: '未' },
  乙: { day: '子', night: '申' },
  己: { day: '子', night: '申' },
  丙: { day: '亥', night: '酉' },
  丁: { day: '亥', night: '酉' },
  壬: { day: '巳', night: '卯' },
  癸: { day: '巳', night: '卯' },
  辛: { day: '午', night: '寅' },
};
/** 《六壬粹言》：贵人临亥至辰顺布，临巳至戌逆布十二天将。 */
export const FORWARD_GENERAL_GROUND_BRANCHES: ReadonlySet<string> = new Set([
  '亥',
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
]);
export const REVERSE_GENERAL_GROUND_BRANCHES: ReadonlySet<string> = new Set([
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
]);
export const DAY_STEM_RESIDENCE_MAP: Record<string, string> = {
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

function assertBranch(value: string, label: string): void {
  if (!DIZHI.includes(value as (typeof DIZHI)[number])) {
    throw new Error(`${label}必须是有效地支。`);
  }
}

function assertStem(value: string, label: string): void {
  if (!TIANGAN.includes(value as (typeof TIANGAN)[number])) {
    throw new Error(`${label}必须是有效天干。`);
  }
}

function assertDayNight(value: string): asserts value is '昼占' | '夜占' {
  if (value !== '昼占' && value !== '夜占') {
    throw new Error('昼夜占必须是“昼占”或“夜占”。');
  }
}

export function describeRelation(sourceBranch: string, targetBranch: string) {
  const sourceElement = getGanZhiWuxing(sourceBranch);
  const targetElement = getGanZhiWuxing(targetBranch);
  if (sourceElement === targetElement) {
    return '比和';
  }
  if (isSheng(sourceElement, targetElement)) {
    return `${sourceElement}生${targetElement}`;
  }
  if (isSheng(targetElement, sourceElement)) {
    return `${targetElement}生${sourceElement}`;
  }
  if (isKe(sourceElement, targetElement)) {
    return `${sourceElement}克${targetElement}`;
  }
  if (isKe(targetElement, sourceElement)) {
    return `${targetElement}克${sourceElement}`;
  }

  return `${sourceElement}与${targetElement}杂见`;
}

export function getGanZhiWuxing(value: string) {
  const stemIndex = TIANGAN.indexOf(value as (typeof TIANGAN)[number]);
  if (stemIndex >= 0) {
    const element = BASIC_MAPPINGS.STEM_WUXING[stemIndex];
    if (!VALID_WUXING.has(element)) {
      throw new Error(`天干 ${value} 的五行数据缺失。`);
    }
    return element;
  }
  const element = BRANCH_WUXING[value];
  if (!VALID_WUXING.has(element)) {
    throw new Error(`无法识别干支 "${value}" 的五行属性。`);
  }
  return element;
}

export function isBranchKe(sourceBranch: string, targetBranch: string) {
  const sourceElement = getGanZhiWuxing(sourceBranch);
  const targetElement = getGanZhiWuxing(targetBranch);
  return isKe(sourceElement, targetElement);
}

export function isElementKe(sourceElement: string, targetElement: string) {
  if (!VALID_WUXING.has(sourceElement) || !VALID_WUXING.has(targetElement)) {
    throw new Error(
      `大六壬五行比较参数无效：${sourceElement || '空'} -> ${targetElement || '空'}。`,
    );
  }

  return isKe(sourceElement, targetElement);
}

export function getNoblemanBranch(dayStem: string, dayNight: '昼占' | '夜占') {
  assertStem(dayStem, '日干');
  assertDayNight(dayNight);
  const pair = GUIREN_BRANCH_BY_STEM[dayStem];
  return dayNight === '昼占' ? pair.day : pair.night;
}

export function getUpperByUnder(plate: LiurenPlateItem[], under: string) {
  assertBranch(under, '地盘地支');
  const item = plate.find((entry) => entry.under === under);
  if (!item) {
    throw new Error(`天盘中找不到地盘地支 "${under}"。`);
  }
  return item.branch;
}

export function getUnderByUpper(plate: LiurenPlateItem[], upper: string) {
  assertBranch(upper, '天盘地支');
  const item = plate.find((entry) => entry.branch === upper);
  if (!item) {
    throw new Error(`天盘中找不到上神地支 "${upper}"。`);
  }
  return item.under;
}

export function buildHeavenlyPlate(args: {
  monthLeader: string;
  divinationBranch: string;
  noblemanBranch: string;
  dayNight: '昼占' | '夜占';
}) {
  assertBranch(args.monthLeader, '月将');
  assertBranch(args.divinationBranch, '占时地支');
  assertBranch(args.noblemanBranch, '贵人地支');
  assertDayNight(args.dayNight);
  const monthLeaderIndex = getBranchIndex(args.monthLeader);
  const divinationBranchIndex = getBranchIndex(args.divinationBranch);
  const offset = (divinationBranchIndex - monthLeaderIndex + DIZHI.length) % DIZHI.length;
  const basePlate = DIZHI.map((under, underIndex) => ({
    branch: DIZHI[(underIndex - offset + DIZHI.length) % DIZHI.length],
    under,
    god: '',
  })) satisfies LiurenPlateItem[];

  const byUpperGod = new Map<string, string>();
  const noblemanGroundBranch = getUnderByUpper(basePlate, args.noblemanBranch);
  const isReverseGeneral = REVERSE_GENERAL_GROUND_BRANCHES.has(noblemanGroundBranch);
  const noblemanBranchIndex = getBranchIndex(args.noblemanBranch);

  for (let step = 0; step < DIZHI.length; step += 1) {
    const branchIndex = (noblemanBranchIndex + step + DIZHI.length) % DIZHI.length;
    const godIndex = isReverseGeneral ? (DIZHI.length - step) % DIZHI.length : step;
    byUpperGod.set(DIZHI[branchIndex], TIANJIANG[godIndex]);
  }

  return basePlate.map((item) => {
    const god = byUpperGod.get(item.branch);
    if (!god || !TIANJIANG.includes(god as TianJiangName)) {
      throw new Error(`上神 ${item.branch} 的十二天将映射缺失。`);
    }
    return { ...item, god };
  });
}

export function getPlateItemByBranch(plate: LiurenPlateItem[], branch: string) {
  assertBranch(branch, '天盘地支');
  const item = plate.find((entry) => entry.branch === branch);
  if (!item) {
    throw new Error(`天盘中找不到上神地支 "${branch}"。`);
  }
  return item;
}

export function getDayStemResidence(dayStem: string) {
  assertStem(dayStem, '日干');
  const residence = DAY_STEM_RESIDENCE_MAP[dayStem];
  if (!residence) {
    throw new Error(`日干寄宫数据缺失：${dayStem}`);
  }
  return residence;
}
