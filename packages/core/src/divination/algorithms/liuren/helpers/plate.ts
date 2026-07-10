import type { LiurenPlateItem } from '../../../../types/divination';
import {
  BASIC_MAPPINGS,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
} from '../../../../bazi/baziMappingsData';
import { BRANCH_WUXING, getBranchIndex, isKe, isSheng } from '../../../../ganzhi';

export const DIZHI = EARTHLY_BRANCHES;
export const TIANGAN = HEAVENLY_STEMS;

/**
 * 十二天将（《大六壬大全》天将体系）：
 * 贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、玄武、太阴、天后。
 * 十二天将分属各支，各有五行、分野、人事、颜色等属性。
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
 * 十二天将完整属性（《大六壬大全》卷六《天将总论》及《大六壬指南》首卷天将章）：
 *
 * 十二天将各配五行、阴阳、颜色、五味、主数、人事分类、分野地形及身体部位。
 * 大六壬断课中，天将入传或临干支，按其属性与五行生克综合断事。
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
    color: string; // 传统服色
    flavor: string; // 五味
    number: number; // 主数
    category: string; // 人事分类
    terrain: string; // 分野地形
    description: string; // 性格/事象描述
    direction: string; // 方向倾向
    bodyPart: string; // 身体部位
  }
> = {
  贵人: {
    wuxing: '土',
    yinYang: '阳',
    color: '紫',
    flavor: '甘',
    number: 8,
    category: '尊贵/助力',
    terrain: '朝廷/官府',
    description: '至尊之神，主贵气、助力、提携、官禄',
    direction: '中',
    bodyPart: '心',
  },
  螣蛇: {
    wuxing: '火',
    yinYang: '阴',
    color: '赤',
    flavor: '苦',
    number: 4,
    category: '虚惊/怪异',
    terrain: '道路/旷野',
    description: '虚惊怪异之神，主惊疑、梦魇、缠绕、变幻',
    direction: '南',
    bodyPart: '血脉',
  },
  朱雀: {
    wuxing: '火',
    yinYang: '阳',
    color: '赤黑',
    flavor: '苦',
    number: 9,
    category: '文书/口舌',
    terrain: '衙门/炉冶',
    description: '文书口舌之神，主消息、书信、言语、考试',
    direction: '南',
    bodyPart: '口舌',
  },
  六合: {
    wuxing: '木',
    yinYang: '阳',
    color: '青',
    flavor: '酸',
    number: 6,
    category: '和合/婚姻',
    terrain: '关津/林木',
    description: '和合之神，主婚姻、合作、合同、中介、子息',
    direction: '东',
    bodyPart: '手足',
  },
  勾陈: {
    wuxing: '土',
    yinYang: '阳',
    color: '青黄',
    flavor: '甘',
    number: 5,
    category: '纠纷/争斗',
    terrain: '田土/牢狱',
    description: '争斗纠纷之神，主官非、土地、契约、争执',
    direction: '中',
    bodyPart: '脾',
  },
  青龙: {
    wuxing: '木',
    yinYang: '阳',
    color: '青绿',
    flavor: '酸',
    number: 7,
    category: '财帛/喜庆',
    terrain: '山林/官府',
    description: '财喜之神，主升迁、钱财、喜事、贵人、仁德',
    direction: '东',
    bodyPart: '肝胆',
  },
  天空: {
    wuxing: '土',
    yinYang: '阳',
    color: '黄灰',
    flavor: '甘',
    number: 3,
    category: '虚诈/孤独',
    terrain: '市井/空旷',
    description: '虚诈孤独之神，主空亡、欺骗、孤寡、无成',
    direction: '中',
    bodyPart: '脾胃',
  },
  白虎: {
    wuxing: '金',
    yinYang: '阳',
    color: '白',
    flavor: '辛',
    number: 7,
    category: '凶丧/疾病',
    terrain: '道路/兵戈',
    description: '凶丧之神，主疾病、死丧、血光、刀兵、破财',
    direction: '西',
    bodyPart: '肺',
  },
  太常: {
    wuxing: '土',
    yinYang: '阴',
    color: '黄',
    flavor: '甘',
    number: 5,
    category: '宴乐/印绶',
    terrain: '祠庙/筵席',
    description: '宴乐印绶之神，主喜宴、赏赐、印信、孝服',
    direction: '中',
    bodyPart: '肉',
  },
  玄武: {
    wuxing: '水',
    yinYang: '阴',
    color: '黑',
    flavor: '咸',
    number: 6,
    category: '盗贼/隐秘',
    terrain: '江河/井池',
    description: '盗贼隐秘之神，主失窃、欺骗、隐私、阴私',
    direction: '北',
    bodyPart: '肾',
  },
  太阴: {
    wuxing: '金',
    yinYang: '阴',
    color: '灰白',
    flavor: '辛',
    number: 6,
    category: '阴私/暗助',
    terrain: '宫室/内室',
    description: '阴私之神，主暗中相助、儿媳、阴人、内事',
    direction: '西',
    bodyPart: '肺',
  },
  天后: {
    wuxing: '水',
    yinYang: '阴',
    color: '蓝黑',
    flavor: '咸',
    number: 8,
    category: '恩泽/婚姻',
    terrain: '江湖/宫廷',
    description: '恩泽之神，主婚姻、恩宠、庇护、女性、长辈',
    direction: '北',
    bodyPart: '肾',
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
    return BASIC_MAPPINGS.STEM_WUXING[stemIndex] || '';
  }

  return BRANCH_WUXING[value] || '';
}

export function isBranchKe(sourceBranch: string, targetBranch: string) {
  const sourceElement = getGanZhiWuxing(sourceBranch);
  const targetElement = getGanZhiWuxing(targetBranch);
  if (!sourceElement || !targetElement) {
    return false;
  }

  return isKe(sourceElement, targetElement);
}

export function isElementKe(sourceElement: string, targetElement: string) {
  if (!sourceElement || !targetElement) {
    return false;
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

  return basePlate.map((item) => ({
    ...item,
    god: byUpperGod.get(item.branch) || '贵人',
  }));
}

export function getPlateItemByBranch(plate: LiurenPlateItem[], branch: string) {
  assertBranch(branch, '天盘地支');
  const item = plate.find((entry) => entry.branch === branch);
  if (!item) {
    throw new Error(`天盘中找不到上神地支 "${branch}"。`);
  }
  return item;
}

export function getDayStemResidence(dayStem: string, fallbackBranch: string) {
  assertStem(dayStem, '日干');
  return DAY_STEM_RESIDENCE_MAP[dayStem] || fallbackBranch;
}
