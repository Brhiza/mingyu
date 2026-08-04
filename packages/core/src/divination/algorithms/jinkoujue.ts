/**
 * @file 金口诀（大六壬金口诀）起课算法
 * @description 以地分、将神、贵神、人元四位一体完成起课，并输出旺衰、生克、空亡与结构化证据。
 * @流派 大六壬金口诀
 * @古籍依据 《六壬神课金口诀古本》入式歌解、贵神起例、五子元遁、阴阳次第五用与五动三动
 * @核心算法
 * 1. 地分：时间起课取占时地支；数字起课 1-12 映射子至亥，大于 12 按 12 归一；随机起课在十二支中可复现抽取。
 * 2. 将神：按已交中气定月将，月将加占时顺布天盘，取地分上所临天盘地支。
 * 3. 贵神：按本门昼夜贵人起例，将贵神直接顺逆排至地分，贵神五行取十二贵神本属。
 * 4. 遁干：按日干五子元遁分别求地分人元、贵神神干与月将将干。
 * 5. 发用：依四位阴阳取用，再列五动、三动的实际触发条件，不预断现实吉凶。
 */
import type {
  JinkoujueData,
  JinkoujueDivinationMethod,
  JinkoujueFourPosition,
  JinkoujueMovement,
  JinkoujuePositionName,
  JinkoujueYinYang,
} from '../../types/divination';
import { getDivinationTime } from '../../calendar/timeManager';
import { getVoidBranches } from '../../calendar/lunar';
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  getBranchIndex,
  getBranchWuxing,
  getSeasonState,
  getStemWuxing,
  isKe,
  isSheng,
} from '../../ganzhi';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { assertOptionalRecord } from '../../shared/validation';
import type { RandomOptions, RandomTrace } from '../../shared/random';
import { createRandomContext, hasRandomOptions, randomInt } from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeJinkoujueEvidence } from '../jinkoujue-evidence';

const METHOD_LABELS: Record<JinkoujueDivinationMethod, string> = {
  time: '时间起课',
  number: '数字起课',
  random: '随机起课',
};

const MONTH_LEADER_BY_ZHONGQI: Record<string, string> = {
  雨水: '亥',
  春分: '戌',
  谷雨: '酉',
  小满: '申',
  夏至: '未',
  大暑: '午',
  处暑: '巳',
  秋分: '辰',
  霜降: '卯',
  小雪: '寅',
  冬至: '丑',
  大寒: '子',
};

const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);
const FORWARD_NOBLEMAN_BRANCHES = new Set(['亥', '子', '丑', '寅', '卯', '辰']);
const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);

/** 《六壬神课金口诀古本》“贵神起例”，不借用大六壬模块的贵人表。 */
const JINKOU_NOBLEMAN_BRANCH_BY_STEM: Record<string, { day: string; night: string }> = {
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

const JINKOU_GUI_SHEN_SEQUENCE = [
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
type JinkouGuiShenName = (typeof JINKOU_GUI_SHEN_SEQUENCE)[number];

/** 《六壬神课金口诀古本》“十二贵神所属”所列本属，不用月将支替代贵神支。 */
const JINKOU_GUI_SHEN_ATTRIBUTES: Record<
  JinkouGuiShenName,
  {
    stem: string;
    branch: string;
    element: string;
    yinYang: JinkoujueYinYang;
  }
> = {
  贵人: { stem: '己', branch: '丑', element: '土', yinYang: '阴' },
  螣蛇: { stem: '丁', branch: '巳', element: '火', yinYang: '阴' },
  朱雀: { stem: '丙', branch: '午', element: '火', yinYang: '阳' },
  六合: { stem: '乙', branch: '卯', element: '木', yinYang: '阴' },
  勾陈: { stem: '戊', branch: '辰', element: '土', yinYang: '阳' },
  青龙: { stem: '甲', branch: '寅', element: '木', yinYang: '阳' },
  天空: { stem: '戊', branch: '戌', element: '土', yinYang: '阳' },
  白虎: { stem: '庚', branch: '申', element: '金', yinYang: '阳' },
  太常: { stem: '己', branch: '未', element: '土', yinYang: '阴' },
  玄武: { stem: '壬', branch: '子', element: '水', yinYang: '阳' },
  太阴: { stem: '辛', branch: '酉', element: '金', yinYang: '阴' },
  天后: { stem: '癸', branch: '亥', element: '水', yinYang: '阴' },
};

/** 五子元遁：甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途 */
const WUZI_YUAN_STEM: Record<string, string> = {
  甲: '甲',
  己: '甲',
  乙: '丙',
  庚: '丙',
  丙: '戊',
  辛: '戊',
  丁: '庚',
  壬: '庚',
  戊: '壬',
  癸: '壬',
};

const POSITION_ROLES: Record<JinkoujuePositionName, string> = {
  地分: '四象中的田宅、子孙、奴仆、鞍马与六畜位',
  将神: '四象中的己身、妻财、亲戚与内位',
  贵神: '四象中的主、臣、父与官禄位',
  人元: '四象中的客、天、君、祖与外位',
};

function assertMethod(method: JinkoujueDivinationMethod): void {
  if (!Object.prototype.hasOwnProperty.call(METHOD_LABELS, method)) {
    throw new Error(`未知的金口诀起课方式: ${method}`);
  }
}

function getMonthLeaderByZhongqi(timeInfo: ReturnType<typeof getDivinationTime>['timeInfo']) {
  const currentTime = SolarTime.fromYmdHms(
    timeInfo.solar.year,
    timeInfo.solar.month,
    timeInfo.solar.day,
    timeInfo.solar.hour,
    timeInfo.solar.minute,
    0,
  );
  const currentJulianDay = currentTime.getJulianDay().getDay();
  const year = timeInfo.solar.year;
  let activeZhongqi = '冬至';
  let activeJulianDay = Number.NEGATIVE_INFINITY;

  for (const scanYear of [year - 1, year, year + 1]) {
    for (let termIndex = 0; termIndex < 24; termIndex += 2) {
      const term = SolarTerm.fromIndex(scanYear, termIndex);
      const termJulianDay = term.getJulianDay().getDay();
      if (termJulianDay <= currentJulianDay && termJulianDay > activeJulianDay) {
        activeJulianDay = termJulianDay;
        activeZhongqi = term.getName();
      }
    }
  }

  const monthLeader = MONTH_LEADER_BY_ZHONGQI[activeZhongqi];
  if (!monthLeader) {
    throw new Error(`找不到中气 "${activeZhongqi}" 对应的金口诀月将。`);
  }
  return monthLeader;
}

function getYuanStemOnBranch(dayStem: string, branch: string) {
  const startStem = WUZI_YUAN_STEM[dayStem];
  if (!startStem) {
    throw new Error(`无法识别日干 "${dayStem}" 的五子元遁起干。`);
  }
  const startStemIndex = HEAVENLY_STEMS.indexOf(startStem as (typeof HEAVENLY_STEMS)[number]);
  const branchIndex = getBranchIndex(branch);
  if (startStemIndex < 0 || branchIndex < 0) {
    throw new Error(`五子元遁计算失败：日干 ${dayStem}，地支 ${branch}`);
  }
  return HEAVENLY_STEMS[(startStemIndex + branchIndex) % HEAVENLY_STEMS.length];
}

function getJinkouNoblemanBranch(dayStem: string, dayNight: '昼占' | '夜占') {
  const pair = JINKOU_NOBLEMAN_BRANCH_BY_STEM[dayStem];
  if (!pair) {
    throw new Error(`无法识别日干“${dayStem}”的金口诀贵人起例。`);
  }
  return dayNight === '昼占' ? pair.day : pair.night;
}

function getStemYinYang(stem: string): JinkoujueYinYang {
  const index = HEAVENLY_STEMS.indexOf(stem as (typeof HEAVENLY_STEMS)[number]);
  if (index < 0) {
    throw new Error(`无法识别天干“${stem}”的阴阳。`);
  }
  return index % 2 === 0 ? '阳' : '阴';
}

function getBranchYinYang(branch: string): JinkoujueYinYang {
  const index = getBranchIndex(branch);
  if (index < 0) {
    throw new Error(`无法识别地支“${branch}”的阴阳。`);
  }
  return index % 2 === 0 ? '阳' : '阴';
}

function getJiangOnDiFen(monthLeader: string, hourBranch: string, diFenBranch: string) {
  const monthLeaderIndex = getBranchIndex(monthLeader);
  const hourBranchIndex = getBranchIndex(hourBranch);
  const diFenIndex = getBranchIndex(diFenBranch);
  if (monthLeaderIndex < 0 || hourBranchIndex < 0 || diFenIndex < 0) {
    throw new Error('金口诀月将加时参数包含无效地支。');
  }
  return EARTHLY_BRANCHES[
    (monthLeaderIndex + diFenIndex - hourBranchIndex + EARTHLY_BRANCHES.length) %
      EARTHLY_BRANCHES.length
  ];
}

function getGuiShenOnDiFen(noblemanBranch: string, diFenBranch: string) {
  const noblemanIndex = getBranchIndex(noblemanBranch);
  const diFenIndex = getBranchIndex(diFenBranch);
  if (noblemanIndex < 0 || diFenIndex < 0) {
    throw new Error('金口诀贵神起例参数包含无效地支。');
  }
  const isForward = FORWARD_NOBLEMAN_BRANCHES.has(noblemanBranch);
  const step = isForward
    ? (diFenIndex - noblemanIndex + EARTHLY_BRANCHES.length) % EARTHLY_BRANCHES.length
    : (noblemanIndex - diFenIndex + EARTHLY_BRANCHES.length) % EARTHLY_BRANCHES.length;
  const god = JINKOU_GUI_SHEN_SEQUENCE[step];
  const attributes = JINKOU_GUI_SHEN_ATTRIBUTES[god];
  if (!attributes) {
    throw new Error(`金口诀贵神“${god || '空'}”缺少本属数据。`);
  }
  return {
    god,
    direction: isForward ? ('顺布' as const) : ('逆布' as const),
    ...attributes,
  };
}

function describeElementRelation(sourceElement: string, targetElement: string) {
  if (!VALID_WUXING.has(sourceElement) || !VALID_WUXING.has(targetElement)) {
    throw new Error(`金口诀四位五行无效：${sourceElement || '空'} -> ${targetElement || '空'}。`);
  }
  if (sourceElement === targetElement) return '比和';
  if (isSheng(sourceElement, targetElement)) return '生';
  if (isSheng(targetElement, sourceElement)) return '被生';
  if (isKe(sourceElement, targetElement)) return '克';
  if (isKe(targetElement, sourceElement)) return '被克';
  return '无直接生克';
}

function buildPosition(params: {
  name: JinkoujuePositionName;
  branch: string;
  stem?: string;
  god?: string;
  element: string;
  elementBasis: JinkoujueFourPosition['elementBasis'];
  yinYang: JinkoujueYinYang;
  monthBranch: string;
  xunKong: string[];
}): JinkoujueFourPosition {
  if (!VALID_WUXING.has(params.element)) {
    throw new Error(
      `金口诀${params.name}五行数据缺失：${params.stem ? `天干${params.stem}` : `地支${params.branch}`}。`,
    );
  }
  const stemElement = params.stem ? getStemWuxing(params.stem) : undefined;
  const seasonState = getSeasonState(params.element, params.monthBranch);
  const isVoid = params.xunKong.includes(params.branch);
  const support: string[] = [];
  const constraints: string[] = [];

  if (seasonState === '旺' || seasonState === '相') support.push(`月令${seasonState}`);
  if (seasonState === '休' || seasonState === '囚' || seasonState === '死') {
    constraints.push(`月令${seasonState}`);
  }
  if (isVoid) constraints.push('落日旬空');
  return {
    name: params.name,
    role: POSITION_ROLES[params.name],
    branch: params.branch,
    stem: params.stem,
    stemElement,
    god: params.god,
    element: params.element,
    elementBasis: params.elementBasis,
    yinYang: params.yinYang,
    seasonState,
    isVoid,
    support,
    constraints,
    promptText: [
      `${params.name}${params.stem || ''}${params.branch}`,
      params.god ? `乘${params.god}` : '',
      `${params.yinYang}${params.element}（按${params.elementBasis}）`,
      stemElement && params.elementBasis !== '人元干' ? `遁干${params.stem}属${stemElement}` : '',
      `月令${seasonState}`,
      isVoid ? '旬空' : '不空',
    ]
      .filter(Boolean)
      .join('；'),
  };
}

function resolveYinYangUse(positions: Record<string, JinkoujueFourPosition>) {
  const all = Object.values(positions);
  const yinCount = all.filter((item) => item.yinYang === '阴').length;
  const yangCount = all.length - yinCount;
  let pattern: JinkoujueData['yinYangUse']['pattern'];
  let usePosition: JinkoujuePositionName;
  let rule: string;

  if (yinCount === 3) {
    pattern = '三阴一阳';
    usePosition = all.find((item) => item.yinYang === '阳')!.name;
    rule = '三阴一阳，以唯一阳位为用';
  } else if (yangCount === 3) {
    pattern = '三阳一阴';
    usePosition = all.find((item) => item.yinYang === '阴')!.name;
    rule = '三阳一阴，以唯一阴位为用';
  } else if (yinCount === 2) {
    pattern = '二阴二阳';
    usePosition = '将神';
    rule = '二阴二阳，以将神为用';
  } else if (yinCount === 4) {
    pattern = '纯阴';
    usePosition = '将神';
    rule = '纯阴反阳，以将神为用';
  } else {
    pattern = '纯阳';
    usePosition = '贵神';
    rule = '纯阳反阴，以贵神为用';
  }

  const use = all.find((item) => item.name === usePosition);
  if (!use) {
    throw new Error(`金口诀阴阳发用找不到${usePosition}。`);
  }
  return { pattern, yinCount, yangCount, usePosition, rule, isVoid: use.isVoid };
}

function buildMovements(positions: Record<string, JinkoujueFourPosition>) {
  const { renYuan, guiShen, jiangShen, diFen } = positions;
  const movements: JinkoujueMovement[] = [];
  const add = (
    category: JinkoujueMovement['category'],
    name: JinkoujueMovement['name'],
    from: JinkoujueFourPosition,
    to: JinkoujueFourPosition,
    relation: JinkoujueMovement['relation'],
  ) => {
    movements.push({
      category,
      name,
      from: from.name,
      to: to.name,
      relation,
      trigger: `${from.name}${from.element}${relation}${to.name}${to.element}`,
      source: `《六壬神课金口诀古本》“${category === '五动' ? '五动爻诵' : '三动'}”`,
    });
  };

  if (isKe(renYuan.element, diFen.element)) add('五动', '妻动', renYuan, diFen, '克');
  if (isKe(guiShen.element, renYuan.element)) add('五动', '官动', guiShen, renYuan, '克');
  if (isKe(guiShen.element, jiangShen.element)) add('五动', '贼动', guiShen, jiangShen, '克');
  if (isKe(jiangShen.element, guiShen.element)) add('五动', '财动', jiangShen, guiShen, '克');
  if (isKe(diFen.element, renYuan.element)) add('五动', '鬼动', diFen, renYuan, '克');

  if (isSheng(diFen.element, renYuan.element)) add('三动', '父母动', diFen, renYuan, '生');
  if (isSheng(renYuan.element, diFen.element)) add('三动', '子孙动', renYuan, diFen, '生');
  if (renYuan.element === diFen.element) add('三动', '兄弟动', renYuan, diFen, '比和');

  return movements;
}

function resolveDiFenBranch(params: {
  method: JinkoujueDivinationMethod;
  number?: number;
  hourBranch: string;
  random?: () => number;
}) {
  if (params.method === 'time') {
    return {
      branch: params.hourBranch,
      inputBase: getBranchIndex(params.hourBranch) + 1,
      inputBaseSource: '占时地支序数' as const,
      note: `时间起课以占时${params.hourBranch}为地分`,
    };
  }

  if (params.method === 'number') {
    const number = params.number;
    if (!Number.isInteger(number) || !number || number < 1) {
      throw new Error('金口诀数字起课必须提供不小于 1 的整数。');
    }
    const normalized = ((number - 1) % 12) + 1;
    const branch = EARTHLY_BRANCHES[normalized - 1];
    return {
      branch,
      inputBase: number,
      inputBaseSource: '用户数字' as const,
      note: `数字起课以${number}归一为${normalized}，对应地分${branch}`,
    };
  }

  if (!params.random) {
    throw new Error('金口诀随机起课缺少随机源。');
  }
  const value = randomInt(12, params.random) + 1;
  const branch = EARTHLY_BRANCHES[value - 1];
  return {
    branch,
    inputBase: value,
    inputBaseSource: '随机数' as const,
    note: `随机起课抽得${value}，对应地分${branch}`,
  };
}

/**
 * 生成金口诀完整课盘。
 */
export function generateJinkoujue(
  params?: {
    method?: JinkoujueDivinationMethod;
    number?: number;
    customDate?: Date;
  } & RandomOptions,
): JinkoujueData {
  assertOptionalRecord(params, '金口诀起课参数');
  const method = params?.method ?? 'time';
  assertMethod(method);
  if (method !== 'random' && hasRandomOptions(params)) {
    throw new Error('金口诀仅随机起课接受 seed、replay 或自定义随机源。');
  }

  let randomTrace: RandomTrace | undefined;

  const { ganzhi, timeInfo, timestamp } = getDivinationTime(params?.customDate);
  const dayStem = ganzhi.day.charAt(0);
  const monthBranch = ganzhi.month.charAt(1);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const monthLeader = getMonthLeaderByZhongqi(timeInfo);
  const noblemanBranch = getJinkouNoblemanBranch(dayStem, dayNight);
  const xunKong = getVoidBranches(ganzhi.day);

  let diFenResolved: {
    branch: string;
    inputBase: number;
    inputBaseSource: '占时地支序数' | '用户数字' | '随机数';
    note: string;
  };

  if (method === 'random') {
    const context = createRandomContext(params);
    diFenResolved = resolveDiFenBranch({
      method,
      hourBranch,
      random: context.random,
    });
    randomTrace = context.getTrace();
  } else {
    diFenResolved = resolveDiFenBranch({
      method,
      number: params?.number,
      hourBranch,
    });
  }

  const jiangBranch = getJiangOnDiFen(monthLeader, hourBranch, diFenResolved.branch);
  const guiShenResolved = getGuiShenOnDiFen(noblemanBranch, diFenResolved.branch);
  const renYuanStem = getYuanStemOnBranch(dayStem, diFenResolved.branch);
  const jiangStem = getYuanStemOnBranch(dayStem, jiangBranch);
  const guiShenStem = getYuanStemOnBranch(dayStem, guiShenResolved.branch);
  const diFen = buildPosition({
    name: '地分',
    branch: diFenResolved.branch,
    element: getBranchWuxing(diFenResolved.branch),
    elementBasis: '地分支',
    yinYang: getBranchYinYang(diFenResolved.branch),
    monthBranch,
    xunKong,
  });
  const jiangShen = buildPosition({
    name: '将神',
    branch: jiangBranch,
    stem: jiangStem,
    element: getBranchWuxing(jiangBranch),
    elementBasis: '月将支',
    yinYang: getBranchYinYang(jiangBranch),
    monthBranch,
    xunKong,
  });
  const guiShen = buildPosition({
    name: '贵神',
    branch: guiShenResolved.branch,
    stem: guiShenStem,
    god: guiShenResolved.god,
    element: guiShenResolved.element,
    elementBasis: '贵神本属',
    yinYang: guiShenResolved.yinYang,
    monthBranch,
    xunKong,
  });
  const renYuan = buildPosition({
    name: '人元',
    branch: diFenResolved.branch,
    stem: renYuanStem,
    element: getStemWuxing(renYuanStem),
    elementBasis: '人元干',
    yinYang: getStemYinYang(renYuanStem),
    monthBranch,
    xunKong,
  });

  const positions = { diFen, jiangShen, guiShen, renYuan };
  const yinYangUse = resolveYinYangUse(positions);
  const movements = buildMovements(positions);
  const relations = {
    guiToJiang: describeElementRelation(guiShen.element, jiangShen.element),
    guiToRen: describeElementRelation(guiShen.element, renYuan.element),
    jiangToDi: describeElementRelation(jiangShen.element, diFen.element),
    renToDi: describeElementRelation(renYuan.element, diFen.element),
    guiToDi: describeElementRelation(guiShen.element, diFen.element),
  };
  const usePosition = Object.values(positions).find(
    (position) => position.name === yinYangUse.usePosition,
  );
  if (!usePosition) {
    throw new Error(`金口诀找不到发用位${yinYangUse.usePosition}。`);
  }
  const movementSummary = movements.length
    ? movements.map((item) => `${item.name}（${item.trigger}）`).join('、')
    : '未触发五动或三动';
  const mainLine = [
    `阴阳发用：${yinYangUse.rule}，取${usePosition.promptText}为用`,
    `四位：人元${renYuan.stem}${renYuan.branch}、贵神${guiShen.stem}${guiShen.branch}乘${guiShen.god}、将神${jiangShen.stem}${jiangShen.branch}、地分${diFen.branch}`,
    `动爻：${movementSummary}`,
  ].join('；');

  const result: JinkoujueData = {
    method,
    methodLabel: METHOD_LABELS[method],
    ganzhi,
    timestamp,
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    xunKong,
    diFenBranch: diFen.branch,
    positions,
    relations,
    yinYangUse,
    movements,
    mainLine,
    calculation: {
      method,
      methodLabel: METHOD_LABELS[method],
      inputBase: diFenResolved.inputBase,
      inputBaseSource: diFenResolved.inputBaseSource,
      diFenNote: diFenResolved.note,
      monthLeaderRule: '按已交中气定月将',
      yuanDunRule: '五子元遁分别求人元、神干与将干',
      dayNightRule: '卯至申按昼占、酉至寅按夜占（未提供地点时采用固定时支口径）',
      noblemanRule: `${dayNight}贵人起${noblemanBranch}，从贵人起十二贵神排至地分${diFen.branch}`,
      noblemanDirection: guiShenResolved.direction,
      guiShenRule: `${guiShenResolved.direction}至地分得${guiShen.god}，贵神本属${guiShenResolved.stem}${guiShenResolved.branch}${guiShenResolved.element}`,
    },
    focusEvidence: Object.values(positions).map((position) => ({
      target: position.promptText,
      role: position.name === yinYangUse.usePosition ? '阴阳次第发用位' : position.role,
      level: position.name === yinYangUse.usePosition ? ('主证' as const) : ('辅证' as const),
      evidence:
        position.name === '贵神'
          ? [
              `${dayNight}贵人起${noblemanBranch}${guiShenResolved.direction}`,
              `排至地分${diFen.branch}得${guiShen.god}`,
              `贵神按本属${guiShenResolved.branch}${guiShenResolved.element}`,
            ]
          : position.name === '将神'
            ? [
                `月将${monthLeader}加占时${hourBranch}`,
                `地分${diFen.branch}上临${jiangShen.branch}`,
              ]
            : position.name === '人元'
              ? [`日干${dayStem}五子元遁`, `地分${diFen.branch}遁得${renYuan.stem}`]
              : [diFenResolved.note, `地分支五行${diFen.element}`],
      limitations: position.isVoid ? [`${position.name}支${position.branch}旬空`] : [],
    })),
    summary: [
      mainLine,
      `四位：地分${diFen.branch}、将神${jiangShen.stem}${jiangShen.branch}、贵神${guiShen.stem}${guiShen.branch}乘${guiShen.god}、人元${renYuan.stem}${renYuan.branch}`,
      `空亡：${xunKong.join('、') || '无'}`,
    ].join('。'),
    ...(randomTrace ? { randomTrace } : {}),
  };

  const resultWithMeta = attachResultMeta(result, {
    algorithm: 'jinkoujue',
    input: {
      method,
      number: params?.number ?? null,
      timestamp,
      diFenBranch: diFen.branch,
    },
    calculatedAt: timestamp,
    random: randomTrace,
  });
  return {
    ...resultWithMeta,
    evidenceAnalysis: analyzeJinkoujueEvidence(resultWithMeta),
  };
}

export { analyzeJinkoujueEvidence } from '../jinkoujue-evidence';
export type {
  JinkoujueEvidenceAnalysis,
  JinkoujuePositionFact,
  JinkoujueRelationFact,
} from '../jinkoujue-evidence';
