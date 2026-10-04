/**
 * @file 金口诀（大六壬金口诀）起课算法
 * @description 以地分、将神、贵神、人元四位一体完成起课，并输出旺衰、生克、空亡与结构化证据。
 * @流派 大六壬金口诀
 * @古籍依据 《六壬神课金口诀古本》入式歌解、贵神起例、五子元遁、阴阳次第五用与五动三动
 * @核心算法
 * 1. 地分：可直接指定方位地支；时间起课取占时地支；数字起课 1-12 映射子至亥，大于 12 按 12 归一；随机起课在十二支中可复现抽取。
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
import { assertOptionalRecord } from '../../shared/validation';
import type { RandomOptions, RandomTrace } from '../../shared/random';
import {
  assertReplaySamplesConsumed,
  createRandomContext,
  hasRandomOptions,
  randomInt,
} from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeJinkoujueEvidence } from '../jinkoujue-evidence';
import { getJinkoujueMonthLeader } from '../jinkoujue-month-leader';
import {
  JINKOU_POSITION_ROLES,
  formatJinkoujuePositionPromptText,
  getJinkoujueElementRelation,
  getGuiShenOnDiFen,
  getJinkouNoblemanBranch,
  getYuanStemOnBranch,
} from '../jinkoujue-utils';

const METHOD_LABELS: Record<JinkoujueDivinationMethod, string> = {
  time: '时间起课',
  branch: '指定地分',
  number: '数字起课',
  random: '随机起课',
};

const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);
const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);

function assertMethod(method: JinkoujueDivinationMethod): void {
  if (!Object.prototype.hasOwnProperty.call(METHOD_LABELS, method)) {
    throw new Error(`未知的金口诀起课方式: ${method}`);
  }
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

function describeElementRelation(sourceElement: string, targetElement: string) {
  return getJinkoujueElementRelation(sourceElement, targetElement);
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
  // 人元是地分上遁得的天干；地分旬空不等于人元干也落旬空。
  const isVoid = params.elementBasis !== '人元干' && params.xunKong.includes(params.branch);
  const support: string[] = [];
  const constraints: string[] = [];

  if (seasonState === '旺' || seasonState === '相') support.push(`月令${seasonState}`);
  if (seasonState === '休' || seasonState === '囚' || seasonState === '死') {
    constraints.push(`月令${seasonState}`);
  }
  if (isVoid) constraints.push('落日旬空');
  return {
    name: params.name,
    role: JINKOU_POSITION_ROLES[params.name],
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
    promptText: formatJinkoujuePositionPromptText({
      ...params,
      stemElement,
      seasonState,
      isVoid,
    }),
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

/**
 * 按四位实盘列出同五行的数量与位置。
 * 《六壬神课金口诀古本》卷上“入式歌解”对二木、二土、二金、二火、二水
 * 均结合神将、位次及生克举例，数量只作为比合条件。
 */
export function evaluateJinkoujueBihePoems(positions: {
  renYuan: JinkoujueFourPosition;
  guiShen: JinkoujueFourPosition;
  jiangShen: JinkoujueFourPosition;
  diFen: JinkoujueFourPosition;
}): string {
  const all = [positions.renYuan, positions.guiShen, positions.jiangShen, positions.diFen];
  const numerals = ['', '一', '二', '三', '四'];
  return ['木', '火', '土', '金', '水']
    .flatMap((element) => {
      const members = all.filter((position) => position.element === element);
      return members.length >= 2
        ? [
            `${element}见${numerals[members.length]}位（${members.map((position) => position.name).join('、')}）`,
          ]
        : [];
    })
    .join('；');
}

function resolveDiFenBranch(params: {
  method: JinkoujueDivinationMethod;
  branch?: string;
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

  if (params.method === 'branch') {
    const branch = params.branch?.trim();
    if (!branch || !(EARTHLY_BRANCHES as readonly string[]).includes(branch)) {
      throw new Error('金口诀指定地分必须是子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥之一。');
    }
    const branchIndex = getBranchIndex(branch);
    return {
      branch,
      inputBase: branchIndex + 1,
      inputBaseSource: '指定地分' as const,
      note: `按所测方位或来意指定地分${branch}`,
    };
  }

  if (params.method === 'number') {
    const number = params.number;
    if (!Number.isSafeInteger(number) || !number || number < 1) {
      throw new Error('金口诀数字起课必须提供不小于 1 的安全整数。');
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
    branch?: string;
    number?: number;
    customDate?: Date;
    termReferenceDate?: Date;
    timezoneOffsetMinutes?: number;
  } & RandomOptions,
): JinkoujueData {
  assertOptionalRecord(params, '金口诀起课参数');
  const method = params?.method ?? 'time';
  assertMethod(method);
  if (method !== 'random' && hasRandomOptions(params)) {
    throw new Error('金口诀仅随机起课接受 seed、replay 或自定义随机源。');
  }

  let randomTrace: RandomTrace | undefined;

  const { ganzhi, timestamp, timezoneOffsetMinutes } = getDivinationTime(
    params?.customDate,
    params?.timezoneOffsetMinutes,
    params?.termReferenceDate,
  );
  const dayStem = ganzhi.day.charAt(0);
  const monthBranch = ganzhi.month.charAt(1);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const monthLeader = getJinkoujueMonthLeader(params?.termReferenceDate?.getTime() ?? timestamp);
  const noblemanBranch = getJinkouNoblemanBranch(dayStem, dayNight);
  const xunKong = getVoidBranches(ganzhi.day);

  let diFenResolved: {
    branch: string;
    inputBase: number;
    inputBaseSource: '占时地支序数' | '指定地分' | '用户数字' | '随机数';
    note: string;
  };

  if (method === 'random') {
    const context = createRandomContext(params);
    diFenResolved = resolveDiFenBranch({
      method,
      branch: params?.branch,
      hourBranch,
      random: context.random,
    });
    randomTrace = context.getTrace();
    assertReplaySamplesConsumed(params, randomTrace);
  } else {
    diFenResolved = resolveDiFenBranch({
      method,
      branch: params?.branch,
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
    renToJiang: describeElementRelation(renYuan.element, jiangShen.element),
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
    ...(params?.termReferenceDate
      ? { termReferenceTimestamp: params.termReferenceDate.getTime() }
      : {}),
    method,
    methodLabel: METHOD_LABELS[method],
    ganzhi,
    timestamp,
    timezoneOffsetMinutes,
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
    bihePoem: evaluateJinkoujueBihePoems(positions),
    calculation: {
      method,
      methodLabel: METHOD_LABELS[method],
      inputBase: diFenResolved.inputBase,
      inputBaseSource: diFenResolved.inputBaseSource,
      diFenNote: diFenResolved.note,
      monthLeaderRule: '按已交中气定月将',
      yuanDunRule: '五子元遁分别求人元、神干与将干',
      dayNightRule:
        '本次按卯至申昼占、酉至寅夜占的固定时支约定起贵人；《六壬神课金口诀·贵神治旦暮》以星没为旦、星出为暮。',
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
      ...(method === 'branch' ? { branch: params?.branch ?? null } : {}),
      ...(method === 'number' ? { number: params?.number ?? null } : {}),
      timestamp,
      ...(params?.termReferenceDate
        ? { termReferenceTimestamp: params.termReferenceDate.getTime() }
        : {}),
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
export { getJinkoujueElementRelation } from '../jinkoujue-utils';
export type {
  JinkoujueEvidenceAnalysis,
  JinkoujuePositionFact,
  JinkoujueRelationFact,
} from '../jinkoujue-evidence';
