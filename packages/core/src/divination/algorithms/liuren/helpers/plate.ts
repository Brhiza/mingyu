import type { LiurenPlateItem } from '../../../../types/divination';
import {
  BASIC_MAPPINGS,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
} from '../../../../bazi/baziMappingsData';
import { BRANCH_WUXING, getBranchIndex, isKe, isSheng } from '../../../../ganzhi';

export const DIZHI = EARTHLY_BRANCHES;
export const TIANGAN = HEAVENLY_STEMS;
const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);

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
 * 十二天将基础属性（《大六壬大全》卷二《天将总论》《十二将释》）：
 *
 * 五行、阴阳由各将所配天干地支确定，类象取自十二将释。
 * 五味、主数、身体等属于十二月将/地支神类象，不能移植到十二天将。
 *
 * 各将属性来源：
 * - 贵人：己丑土，《大全》"贵人己丑旺，主官爵印信，紫衣"
 * - 螣蛇：丁巳火，《大全》"螣蛇丁巳主惊疑，凶将赤色"
 * - 朱雀：丙午火，《大全》"朱雀丙午主文书口舌"
 * - 六合：乙卯木，《大全》"六合乙卯主和合婚姻"
 * - 勾陈：戊辰土，《大全》"勾陈戊辰主勾连争斗"
 * - 青龙：甲寅木，《大全》"青龙甲寅主财帛庆贺"
 * - 天空：戊戌土，《大全》"天空戊戌主虚诈孤独"
 * - 白虎：庚申金，《大全》"白虎庚申主疾病凶丧"
 * - 太常：己未土，《大全》"太常己未主筵宴印绶"
 * - 玄武：癸亥水，《大全》"玄武癸亥主盗贼阴私"
 * - 太阴：辛酉金，《大全》"太阴辛酉主阴私妇女"
 * - 天后：壬子水，《大全》"天后壬子主恩泽婚姻"
 */
export const TIANJIANG_ATTRIBUTES: Record<
  TianJiangName,
  {
    wuxing: string; // 天将五行
    yinYang: '阳' | '阴';
    category: string; // 人事分类
    description: string; // 传统类象摘要
  }
> = {
  贵人: {
    wuxing: '土',
    yinYang: '阴',
    category: '贵人/官长',
    description: '神将之主，传统类神为贵人、官长',
  },
  螣蛇: {
    wuxing: '火',
    yinYang: '阴',
    category: '惊恐/怪异',
    description: '传统类象为惊恐、怪异',
  },
  朱雀: {
    wuxing: '火',
    yinYang: '阳',
    category: '文书/口舌',
    description: '传统类象为文书、信息、口舌',
  },
  六合: {
    wuxing: '木',
    yinYang: '阴',
    category: '和合/婚姻',
    description: '传统类象为婚姻、喜庆、交易、媒妁',
  },
  勾陈: {
    wuxing: '土',
    yinYang: '阳',
    category: '斗讼/勾留',
    description: '传统类象为斗讼、勾连、迟滞',
  },
  青龙: {
    wuxing: '木',
    yinYang: '阳',
    category: '财帛/喜庆',
    description: '传统类象为财帛、文字、官府、升迁、喜庆',
  },
  天空: {
    wuxing: '土',
    yinYang: '阳',
    category: '虚空/欺诈',
    description: '传统类象为虚空、欺诈',
  },
  白虎: {
    wuxing: '金',
    yinYang: '阳',
    category: '疾病/道路',
    description: '传统类象为疾病、孝服、道路、刑伤',
  },
  太常: {
    wuxing: '土',
    yinYang: '阴',
    category: '宴乐/印绶',
    description: '传统类象为文章、印绶、衣服、酒食、宴乐',
  },
  玄武: {
    wuxing: '水',
    yinYang: '阴',
    category: '盗贼/遗亡',
    description: '传统类象为盗贼、遗亡、隐秘',
  },
  太阴: {
    wuxing: '金',
    yinYang: '阴',
    category: '阴私/暗助',
    description: '传统类象为阴私、暗中相助',
  },
  天后: {
    wuxing: '水',
    yinYang: '阳',
    category: '妇人/恩泽',
    description: '传统类象为宫廷、妇人、婚姻、恩泽',
  },
};

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
const REVERSE_GENERAL_GROUND_BRANCHES = new Set(['巳', '午', '未', '申', '酉', '戌']);
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
