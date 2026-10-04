import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import {
  buildRandomTraceFact,
  createRandomContext,
  randomInt,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { JinkoujueData, JinkoujueFourPosition, JinkoujueMovement } from '../types/divination';
import { MingyuCoreError } from '../shared/result';
import { getVoidBranches } from '../calendar/lunar';
import { getDivinationTime } from '../calendar/timeManager';
import { getJinkoujueMonthLeader } from './jinkoujue-month-leader';
import {
  EARTHLY_BRANCHES,
  getBranchWuxing,
  getSeasonState,
  getStemWuxing,
  getStemYinYang,
  isKe,
  isSheng,
} from '../ganzhi';
import {
  getJinkouPositionRole,
  formatJinkoujuePositionPromptText,
  getJinkoujueElementRelation,
  getGuiShenOnDiFen,
  getJinkouNoblemanBranch,
  getYuanStemOnBranch,
} from './jinkoujue-utils';

export interface JinkoujuePositionFact {
  key: string;
  status: '已计算';
  position: JinkoujueFourPosition['name'];
  role: string;
  branch: string;
  stem?: string;
  stemElement?: string;
  god?: string;
  element: string;
  elementBasis: JinkoujueFourPosition['elementBasis'];
  yinYang: JinkoujueFourPosition['yinYang'];
  seasonState: string;
  isVoid: boolean;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '四位事实只记录地分、将神、贵神、人元的落点、五行、月令与空亡；不得直接写成现实吉凶、人物身份或事件保证';
}

export interface JinkoujueMovementFact extends JinkoujueMovement {
  key: string;
  status: '已触发';
  promptText: string;
  sources: string[];
  limitation: '动爻只记录四位之间满足的五行触发条件；具体人事须结合所问事项与主客用位，不得按动名直接断定现实结果';
}

export interface JinkoujueRelationFact {
  key: string;
  status: '支持' | '限制' | '中性';
  from: string;
  to: string;
  relation: string;
  promptText: string;
  sources: string[];
  limitation: '四位生克关系只说明盘内作用方向；不得把生克直接写成现实必然顺利、受阻、成功或失败';
}

export interface JinkoujueFocusFact {
  key: string;
  target: string;
  role: string;
  level: '主证' | '辅证';
  evidence: string[];
  limitations: string[];
  promptText: string;
  sources: string[];
  limitation: '焦点事实只记录阴阳次第选出的发用位与其依据；不得把固定贵神或将神另立为用';
}

export interface JinkoujueCounterEvidenceFact {
  key: string;
  ownerKey: string;
  type: '旬空' | '月令限制' | '受克' | '主证受限';
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '反证只表示当前四位存在空亡、休囚死或受克条件；不得把单项反证直接写成现实失败或灾祸';
}

export interface JinkoujueEvidenceSummaryFact {
  key: 'jinkoujue:evidence-summary';
  status: '证据链完整' | '主线受限';
  positionCount: number;
  relationCount: number;
  focusCount: number;
  counterCount: number;
  promptText: string;
  sources: string[];
  limitation: '证据汇总只统计四位、关系、焦点与反证覆盖，不得按数量生成吉凶总分或成功率';
}

export interface JinkoujueEvidenceAnalysis {
  key: 'jinkoujue:evidence';
  status: '已计算';
  mainLine: string;
  calculationFact: {
    key: 'jinkoujue:calculation';
    status: '完整';
    method: string;
    methodLabel: string;
    inputBase: number;
    inputBaseSource: string;
    diFenNote: string;
    monthLeaderRule: string;
    yuanDunRule: string;
    dayNightRule: string;
    noblemanRule: string;
    noblemanDirection: string;
    guiShenRule: string;
    yinYangUseRule: string;
    promptText: string;
    sources: string[];
    limitation: '计算事实只证明地分、月将、贵神、遁干与发用如何形成当前课体；不证明现实结论';
  };
  positions: JinkoujuePositionFact[];
  relations: JinkoujueRelationFact[];
  movementFacts: JinkoujueMovementFact[];
  focusFacts: JinkoujueFocusFact[];
  counterEvidenceFacts: JinkoujueCounterEvidenceFact[];
  summaryFact: JinkoujueEvidenceSummaryFact;
  randomTraceFact: RandomTraceFact;
  randomFacts: string[];
  promptText: string;
  evidence: PromptEvidenceBundle;
}

const POSITION_LIMITATION =
  '四位事实只记录地分、将神、贵神、人元的落点、五行、月令与空亡；不得直接写成现实吉凶、人物身份或事件保证' as const;
const RELATION_LIMITATION =
  '四位生克关系只说明盘内作用方向；不得把生克直接写成现实必然顺利、受阻、成功或失败' as const;
const FOCUS_LIMITATION =
  '焦点事实只记录阴阳次第选出的发用位与其依据；不得把固定贵神或将神另立为用' as const;
const COUNTER_LIMITATION =
  '反证只表示当前四位存在空亡、休囚死或受克条件；不得把单项反证直接写成现实失败或灾祸' as const;
const MOVEMENT_LIMITATION =
  '动爻只记录四位之间满足的五行触发条件；具体人事须结合所问事项与主客用位，不得按动名直接断定现实结果' as const;

function buildPositionFact(position: JinkoujueFourPosition): JinkoujuePositionFact {
  return {
    key: `jinkoujue:position:${position.name}`,
    status: '已计算',
    position: position.name,
    role: position.role,
    branch: position.branch,
    stem: position.stem,
    stemElement: position.stemElement,
    god: position.god,
    element: position.element,
    elementBasis: position.elementBasis,
    yinYang: position.yinYang,
    seasonState: position.seasonState,
    isVoid: position.isVoid,
    support: [...position.support],
    constraints: [...position.constraints],
    promptText: position.promptText,
    sources: [
      '《六壬神课金口诀古本》“入式歌解”',
      '《六壬神课金口诀古本》“十二贵神所属”',
      '《六壬神课金口诀古本》“五子元遁起例”',
      '日旬空亡与月令旺衰',
    ],
    limitation: POSITION_LIMITATION,
  };
}

function buildRelationFact(
  key: string,
  from: string,
  to: string,
  relation: string,
): JinkoujueRelationFact {
  return {
    key,
    status: '中性',
    from,
    to,
    relation,
    promptText: `${from}对${to}为${relation}`,
    sources: ['《六壬神课金口诀古本》“干类、神类、将类、方类”'],
    limitation: RELATION_LIMITATION,
  };
}

function expectedRelation(from: string, to: string) {
  return getJinkoujueElementRelation(from, to);
}

export function analyzeJinkoujueEvidence(data: JinkoujueData): JinkoujueEvidenceAnalysis {
  if (data.meta && Date.parse(data.meta.calculatedAt) !== data.timestamp) {
    throw new Error('金口诀起课时间戳与结果元数据不一致，无法生成证据。');
  }
  if (data.timezoneOffsetMinutes !== undefined) {
    if (
      !Number.isInteger(data.timezoneOffsetMinutes) ||
      data.timezoneOffsetMinutes < -720 ||
      data.timezoneOffsetMinutes > 840
    ) {
      throw new Error('金口诀四柱时区偏移无效，无法生成证据。');
    }
    const expectedGanzhi = getDivinationTime(
      new Date(data.timestamp),
      data.timezoneOffsetMinutes,
      data.termReferenceTimestamp === undefined ? undefined : new Date(data.termReferenceTimestamp),
    ).ganzhi;
    if (
      data.ganzhi.year !== expectedGanzhi.year ||
      data.ganzhi.month !== expectedGanzhi.month ||
      data.ganzhi.day !== expectedGanzhi.day ||
      data.ganzhi.hour !== expectedGanzhi.hour
    ) {
      throw new Error('金口诀起课时刻与四柱不一致，无法生成证据。');
    }
  }
  const { diFen, jiangShen, guiShen, renYuan } = data.positions;
  if (
    diFen.branch !== data.diFenBranch ||
    renYuan.branch !== diFen.branch ||
    data.divinationBranch !== data.ganzhi.hour.charAt(1)
  ) {
    throw new Error(
      data.method === 'random'
        ? '金口诀随机轨迹与起课数字或地分不一致，无法生成证据。'
        : '金口诀地分与四位不一致，无法生成证据。',
    );
  }
  const allPositions = [diFen, jiangShen, guiShen, renYuan];
  const expectedNames = ['地分', '将神', '贵神', '人元'] as const;
  if (
    allPositions.some(
      (position, index) =>
        position.name !== expectedNames[index] ||
        position.role !== getJinkouPositionRole(expectedNames[index]),
    )
  ) {
    throw new Error('金口诀四位名称或所属与课位不一致，无法生成证据。');
  }
  const dayStem = data.ganzhi.day.charAt(0);
  const hourBranch = data.ganzhi.hour.charAt(1);
  const expectedDayNight = ['卯', '辰', '巳', '午', '未', '申'].includes(hourBranch)
    ? '昼占'
    : '夜占';
  const expectedNoblemanBranch = getJinkouNoblemanBranch(dayStem, expectedDayNight);
  const expectedGuiShen = getGuiShenOnDiFen(expectedNoblemanBranch, diFen.branch);
  if (
    data.dayNight !== expectedDayNight ||
    data.noblemanBranch !== expectedNoblemanBranch ||
    guiShen.god !== expectedGuiShen.god ||
    guiShen.branch !== expectedGuiShen.branch ||
    guiShen.element !== expectedGuiShen.element ||
    guiShen.yinYang !== expectedGuiShen.yinYang ||
    guiShen.elementBasis !== '贵神本属' ||
    guiShen.stem !== getYuanStemOnBranch(dayStem, expectedGuiShen.branch)
  ) {
    throw new Error('金口诀贵人贵神与日干、昼夜和地分不一致，无法生成证据。');
  }
  if (
    diFen.elementBasis !== '地分支' ||
    diFen.element !== getBranchWuxing(diFen.branch) ||
    diFen.yinYang !==
      (EARTHLY_BRANCHES.indexOf(diFen.branch as (typeof EARTHLY_BRANCHES)[number]) % 2 === 0
        ? '阳'
        : '阴') ||
    diFen.stem !== undefined ||
    diFen.god !== undefined ||
    jiangShen.elementBasis !== '月将支' ||
    jiangShen.element !== getBranchWuxing(jiangShen.branch) ||
    jiangShen.yinYang !==
      (EARTHLY_BRANCHES.indexOf(jiangShen.branch as (typeof EARTHLY_BRANCHES)[number]) % 2 === 0
        ? '阳'
        : '阴') ||
    jiangShen.stem !== getYuanStemOnBranch(dayStem, jiangShen.branch) ||
    jiangShen.god !== undefined ||
    renYuan.god !== undefined
  ) {
    throw new Error('金口诀四位本属与地支、遁干不一致，无法生成证据。');
  }
  const expectedHumanStem = getYuanStemOnBranch(dayStem, diFen.branch);
  const expectedHumanElement = getStemWuxing(expectedHumanStem);
  if (
    renYuan.elementBasis !== '人元干' ||
    renYuan.stem !== expectedHumanStem ||
    renYuan.stemElement !== expectedHumanElement ||
    renYuan.element !== expectedHumanElement ||
    renYuan.yinYang !== getStemYinYang(expectedHumanStem)
  ) {
    throw new Error('金口诀人元五子元遁与四位不一致，无法生成证据。');
  }
  if (
    allPositions.some((position) =>
      position.stem
        ? position.stemElement !== getStemWuxing(position.stem)
        : position.stemElement !== undefined,
    )
  ) {
    throw new Error('金口诀四位遁干五行与结构化字段不一致，无法生成证据。');
  }
  const expectedMonthLeader = getJinkoujueMonthLeader(
    data.termReferenceTimestamp ?? data.timestamp,
  );
  if (data.monthLeader !== expectedMonthLeader) {
    throw new Error('金口诀月将与实际占时已交中气不一致，无法生成证据。');
  }
  const monthLeaderIndex = EARTHLY_BRANCHES.indexOf(
    data.monthLeader as (typeof EARTHLY_BRANCHES)[number],
  );
  const hourBranchIndex = EARTHLY_BRANCHES.indexOf(
    data.divinationBranch as (typeof EARTHLY_BRANCHES)[number],
  );
  const diFenIndex = EARTHLY_BRANCHES.indexOf(diFen.branch as (typeof EARTHLY_BRANCHES)[number]);
  if (
    monthLeaderIndex < 0 ||
    hourBranchIndex < 0 ||
    diFenIndex < 0 ||
    jiangShen.branch !==
      EARTHLY_BRANCHES[(monthLeaderIndex + diFenIndex - hourBranchIndex + 12) % 12]
  ) {
    throw new Error('金口诀将神与月将加时不一致，无法生成证据。');
  }
  const relationPairs = [
    [guiShen, jiangShen, data.relations.guiToJiang],
    [guiShen, renYuan, data.relations.guiToRen],
    [
      renYuan,
      jiangShen,
      data.relations.renToJiang ?? expectedRelation(renYuan.element, jiangShen.element),
    ],
    [jiangShen, diFen, data.relations.jiangToDi],
    [renYuan, diFen, data.relations.renToDi],
    [guiShen, diFen, data.relations.guiToDi],
  ] as const;
  if (
    relationPairs.some(
      ([from, to, relation]) => relation !== expectedRelation(from.element, to.element),
    )
  ) {
    throw new Error('金口诀四位关系与五行不一致，无法生成证据。');
  }
  const expectedXunKong = getVoidBranches(data.ganzhi.day);
  const monthBranch = data.ganzhi.month.charAt(1);
  if (
    !Array.isArray(data.xunKong) ||
    data.xunKong.length !== expectedXunKong.length ||
    expectedXunKong.some((branch) => !data.xunKong.includes(branch)) ||
    allPositions.some(
      (position) =>
        position.isVoid !==
          (position.elementBasis !== '人元干' && expectedXunKong.includes(position.branch)) ||
        position.seasonState !== getSeasonState(position.element, monthBranch),
    )
  ) {
    throw new Error('金口诀旬空或月令旺衰与日月柱及四位不一致，无法生成证据。');
  }
  for (const position of allPositions) {
    const expectedSupport = ['旺', '相'].includes(position.seasonState)
      ? [`月令${position.seasonState}`]
      : [];
    const expectedConstraints = ['休', '囚', '死'].includes(position.seasonState)
      ? [`月令${position.seasonState}`]
      : [];
    if (position.isVoid) expectedConstraints.push('落日旬空');
    if (
      JSON.stringify(position.support) !== JSON.stringify(expectedSupport) ||
      JSON.stringify(position.constraints) !== JSON.stringify(expectedConstraints)
    ) {
      throw new Error('金口诀四位助力或限制与月令旬空不一致，无法生成证据。');
    }
  }
  const yinPositions = allPositions.filter((position) => position.yinYang === '阴');
  const yangPositions = allPositions.filter((position) => position.yinYang === '阳');
  const expectedUse =
    yinPositions.length === 3
      ? { pattern: '三阴一阳', position: yangPositions[0] }
      : yangPositions.length === 3
        ? { pattern: '三阳一阴', position: yinPositions[0] }
        : yinPositions.length === 2 || yinPositions.length === 4
          ? { pattern: yinPositions.length === 2 ? '二阴二阳' : '纯阴', position: jiangShen }
          : { pattern: '纯阳', position: guiShen };
  const expectedUseRule = {
    三阴一阳: '三阴一阳，以唯一阳位为用',
    三阳一阴: '三阳一阴，以唯一阴位为用',
    二阴二阳: '二阴二阳，以将神为用',
    纯阴: '纯阴反阳，以将神为用',
    纯阳: '纯阳反阴，以贵神为用',
  }[expectedUse.pattern];
  if (
    yinPositions.length + yangPositions.length !== 4 ||
    !expectedUse.position ||
    data.yinYangUse.pattern !== expectedUse.pattern ||
    data.yinYangUse.usePosition !== expectedUse.position.name ||
    data.yinYangUse.rule !== expectedUseRule ||
    data.yinYangUse.yinCount !== yinPositions.length ||
    data.yinYangUse.yangCount !== yangPositions.length ||
    data.yinYangUse.isVoid !== expectedUse.position.isVoid
  ) {
    throw new Error('金口诀阴阳发用与四位不一致，无法生成证据。');
  }
  const movementRules = [
    {
      category: '五动',
      name: '妻动',
      from: renYuan,
      to: diFen,
      relation: '克',
      matched: isKe(renYuan.element, diFen.element),
    },
    {
      category: '五动',
      name: '官动',
      from: guiShen,
      to: renYuan,
      relation: '克',
      matched: isKe(guiShen.element, renYuan.element),
    },
    {
      category: '五动',
      name: '贼动',
      from: guiShen,
      to: jiangShen,
      relation: '克',
      matched: isKe(guiShen.element, jiangShen.element),
    },
    {
      category: '五动',
      name: '财动',
      from: jiangShen,
      to: guiShen,
      relation: '克',
      matched: isKe(jiangShen.element, guiShen.element),
    },
    {
      category: '五动',
      name: '鬼动',
      from: diFen,
      to: renYuan,
      relation: '克',
      matched: isKe(diFen.element, renYuan.element),
    },
    {
      category: '三动',
      name: '父母动',
      from: diFen,
      to: renYuan,
      relation: '生',
      matched: isSheng(diFen.element, renYuan.element),
    },
    {
      category: '三动',
      name: '子孙动',
      from: renYuan,
      to: diFen,
      relation: '生',
      matched: isSheng(renYuan.element, diFen.element),
    },
    {
      category: '三动',
      name: '兄弟动',
      from: renYuan,
      to: diFen,
      relation: '比和',
      matched: renYuan.element === diFen.element,
    },
  ].filter((rule) => rule.matched);
  if (
    movementRules.length !== data.movements.length ||
    data.movements.some((item, index) => {
      const expected = movementRules[index];
      return (
        item.category !== expected.category ||
        item.name !== expected.name ||
        item.from !== expected.from.name ||
        item.to !== expected.to.name ||
        item.relation !== expected.relation ||
        item.trigger !==
          `${expected.from.name}${expected.from.element}${expected.relation}${expected.to.name}${expected.to.element}` ||
        item.source !==
          `《六壬神课金口诀古本》“${expected.category === '五动' ? '五动爻诵' : '三动'}”`
      );
    })
  ) {
    throw new Error('金口诀动爻与四位五行不一致，无法生成证据。');
  }
  const methodLabels = {
    time: '时间起课',
    branch: '指定地分',
    number: '数字起课',
    random: '随机起课',
  } as const;
  const methodLabel = methodLabels[data.method];
  const diFenOrdinal =
    EARTHLY_BRANCHES.indexOf(diFen.branch as (typeof EARTHLY_BRANCHES)[number]) + 1;
  const inputBase = data.calculation.inputBase;
  const expectedInput =
    data.method === 'number'
      ? {
          source: '用户数字',
          valid:
            Number.isSafeInteger(inputBase) &&
            inputBase > 0 &&
            ((inputBase - 1) % 12) + 1 === diFenOrdinal,
          note: `数字起课以${inputBase}归一为${diFenOrdinal}，对应地分${diFen.branch}`,
        }
      : data.method === 'random'
        ? {
            source: '随机数',
            valid: inputBase === diFenOrdinal,
            note: `随机起课抽得${inputBase}，对应地分${diFen.branch}`,
          }
        : data.method === 'branch'
          ? {
              source: '指定地分',
              valid: inputBase === diFenOrdinal,
              note: `按所测方位或来意指定地分${diFen.branch}`,
            }
          : {
              source: '占时地支序数',
              valid: inputBase === diFenOrdinal && diFen.branch === hourBranch,
              note: `时间起课以占时${hourBranch}为地分`,
            };
  if (
    !methodLabel ||
    data.methodLabel !== methodLabel ||
    data.calculation.method !== data.method ||
    data.calculation.methodLabel !== methodLabel ||
    !expectedInput.valid ||
    data.calculation.inputBaseSource !== expectedInput.source ||
    data.calculation.diFenNote !== expectedInput.note ||
    data.calculation.monthLeaderRule !== '按已交中气定月将' ||
    data.calculation.yuanDunRule !== '五子元遁分别求人元、神干与将干' ||
    data.calculation.dayNightRule !==
      '本次按卯至申昼占、酉至寅夜占的固定时支约定起贵人；《六壬神课金口诀·贵神治旦暮》以星没为旦、星出为暮。' ||
    data.calculation.noblemanRule !==
      `${expectedDayNight}贵人起${expectedNoblemanBranch}，从贵人起十二贵神排至地分${diFen.branch}` ||
    data.calculation.noblemanDirection !== expectedGuiShen.direction ||
    data.calculation.guiShenRule !==
      `${expectedGuiShen.direction}至地分得${expectedGuiShen.god}，贵神本属${expectedGuiShen.stem}${expectedGuiShen.branch}${expectedGuiShen.element}`
  ) {
    throw new Error('金口诀起课计算说明与四位课值不一致，无法生成证据。');
  }
  const expectedUsePosition = allPositions.find(
    (position) => position.name === data.yinYangUse.usePosition,
  )!;
  const movementSummary = data.movements.length
    ? data.movements.map((item) => `${item.name}（${item.trigger}）`).join('、')
    : '未触发五动或三动';
  const expectedMainLine = [
    `阴阳发用：${data.yinYangUse.rule}，取${expectedUsePosition.promptText}为用`,
    `四位：人元${renYuan.stem}${renYuan.branch}、贵神${guiShen.stem}${guiShen.branch}乘${guiShen.god}、将神${jiangShen.stem}${jiangShen.branch}、地分${diFen.branch}`,
    `动爻：${movementSummary}`,
  ].join('；');
  const expectedFocus = allPositions.map((position) => ({
    target: position.promptText,
    role: position.name === data.yinYangUse.usePosition ? '阴阳次第发用位' : position.role,
    level: position.name === data.yinYangUse.usePosition ? '主证' : '辅证',
    evidence:
      position.name === '贵神'
        ? [
            `${expectedDayNight}贵人起${expectedNoblemanBranch}${expectedGuiShen.direction}`,
            `排至地分${diFen.branch}得${expectedGuiShen.god}`,
            `贵神按本属${expectedGuiShen.branch}${expectedGuiShen.element}`,
          ]
        : position.name === '将神'
          ? [
              `月将${data.monthLeader}加占时${hourBranch}`,
              `地分${diFen.branch}上临${jiangShen.branch}`,
            ]
          : position.name === '人元'
            ? [`日干${dayStem}五子元遁`, `地分${diFen.branch}遁得${renYuan.stem}`]
            : [expectedInput.note, `地分支五行${diFen.element}`],
    limitations: position.isVoid ? [`${position.name}支${position.branch}旬空`] : [],
  }));
  if (
    data.mainLine !== expectedMainLine ||
    !Array.isArray(data.focusEvidence) ||
    data.focusEvidence?.length !== expectedFocus.length ||
    expectedFocus.some((expected, index) => {
      const item = data.focusEvidence?.[index];
      return (
        !item ||
        item.target !== expected.target ||
        item.role !== expected.role ||
        item.level !== expected.level ||
        JSON.stringify(item.evidence) !== JSON.stringify(expected.evidence) ||
        JSON.stringify(item.limitations) !== JSON.stringify(expected.limitations)
      );
    })
  ) {
    throw new Error('金口诀主线或焦点依据与四位课值不一致，无法生成证据。');
  }
  if (
    allPositions.some(
      (position) => position.promptText !== formatJinkoujuePositionPromptText(position),
    )
  ) {
    throw new Error('金口诀四位结构化字段与提示文本不一致，无法生成证据。');
  }
  const positions = [
    data.positions.diFen,
    data.positions.jiangShen,
    data.positions.guiShen,
    data.positions.renYuan,
  ].map(buildPositionFact);

  const relations = [
    buildRelationFact(
      'jinkoujue:relation:gui-jiang',
      `贵神${data.positions.guiShen.god || ''}${data.positions.guiShen.branch}`,
      `将神${data.positions.jiangShen.stem || ''}${data.positions.jiangShen.branch}`,
      data.relations.guiToJiang,
    ),
    buildRelationFact(
      'jinkoujue:relation:gui-ren',
      `贵神${data.positions.guiShen.god || ''}${data.positions.guiShen.branch}`,
      `人元${data.positions.renYuan.stem || ''}${data.positions.renYuan.branch}`,
      data.relations.guiToRen,
    ),
    buildRelationFact(
      'jinkoujue:relation:ren-jiang',
      `人元${data.positions.renYuan.stem || ''}${data.positions.renYuan.branch}`,
      `将神${data.positions.jiangShen.stem || ''}${data.positions.jiangShen.branch}`,
      data.relations.renToJiang ??
        expectedRelation(data.positions.renYuan.element, data.positions.jiangShen.element),
    ),
    buildRelationFact(
      'jinkoujue:relation:jiang-di',
      `将神${data.positions.jiangShen.stem || ''}${data.positions.jiangShen.branch}`,
      `地分${data.positions.diFen.branch}`,
      data.relations.jiangToDi,
    ),
    buildRelationFact(
      'jinkoujue:relation:ren-di',
      `人元${data.positions.renYuan.stem || ''}${data.positions.renYuan.branch}`,
      `地分${data.positions.diFen.branch}`,
      data.relations.renToDi,
    ),
    buildRelationFact(
      'jinkoujue:relation:gui-di',
      `贵神${data.positions.guiShen.god || ''}${data.positions.guiShen.branch}`,
      `地分${data.positions.diFen.branch}`,
      data.relations.guiToDi,
    ),
  ];

  const movementFacts: JinkoujueMovementFact[] = data.movements.map((item, index) => ({
    ...item,
    key: `jinkoujue:movement:${item.category}:${index + 1}:${item.name}`,
    status: '已触发',
    promptText: `${item.name}：${item.trigger}`,
    sources: [item.source],
    limitation: MOVEMENT_LIMITATION,
  }));

  const focusFacts: JinkoujueFocusFact[] = (data.focusEvidence ?? []).map((item, index) => ({
    key: `jinkoujue:focus:${index + 1}:${item.target}`,
    target: item.target,
    role: item.role,
    level: item.level,
    evidence: [...item.evidence],
    limitations: [...item.limitations],
    promptText: `${item.target}${item.role}：依据${item.evidence.join('、') || '未列'}；限制${item.limitations.join('、') || '未见'}`,
    sources: ['《六壬神课金口诀古本》“阴阳次第五用”', '《六壬神课金口诀古本》“四象所属图”'],
    limitation: FOCUS_LIMITATION,
  }));

  const counterEvidenceFacts: JinkoujueCounterEvidenceFact[] = [];
  for (const position of positions) {
    if (position.isVoid) {
      counterEvidenceFacts.push({
        key: `jinkoujue:counter:void:${position.position}`,
        ownerKey: position.key,
        type: '旬空',
        status: '已触发',
        detail: `${position.position}${position.branch}落日旬空`,
        promptText: `${position.position}${position.branch}落日旬空`,
        sources: ['日柱旬空'],
        limitation: COUNTER_LIMITATION,
      });
    }
    if (position.constraints.some((item) => item.startsWith('月令'))) {
      counterEvidenceFacts.push({
        key: `jinkoujue:counter:season:${position.position}`,
        ownerKey: position.key,
        type: '月令限制',
        status: '已触发',
        detail: `${position.position}月令${position.seasonState}`,
        promptText: `${position.position}处月令${position.seasonState}，力量条件偏弱`,
        sources: ['月令旺衰'],
        limitation: COUNTER_LIMITATION,
      });
    }
  }
  // “克”与“被克”统一成施克者 -> 受克者，供主证约束和提示词反证使用。
  // 关系事实本身仍保持中性；这里只标明盘内的受克方向，不推断现实结果。
  for (const [from, to, relation] of relationPairs) {
    const source = relation === '克' ? from : relation === '被克' ? to : undefined;
    const target = relation === '克' ? to : relation === '被克' ? from : undefined;
    if (!source || !target) continue;
    counterEvidenceFacts.push({
      key: `jinkoujue:counter:ke:${target.name}:${source.name}`,
      ownerKey: `jinkoujue:position:${target.name}`,
      type: '受克',
      status: '已触发',
      detail: `${target.name}受${source.name}克`,
      promptText: `${target.name}受${source.name}克`,
      sources: ['《六壬神课金口诀古本》“干类、神类、将类、方类”'],
      limitation: COUNTER_LIMITATION,
    });
  }
  const usePosition = positions.find(
    (position) => position.position === data.yinYangUse.usePosition,
  );
  const mainPositionConstrained =
    Boolean(usePosition?.constraints.length) ||
    counterEvidenceFacts.some((fact) => fact.type === '受克' && fact.ownerKey === usePosition?.key);
  const summaryFact: JinkoujueEvidenceSummaryFact = {
    key: 'jinkoujue:evidence-summary',
    status: mainPositionConstrained ? '主线受限' : '证据链完整',
    positionCount: positions.length,
    relationCount: relations.length,
    focusCount: focusFacts.length,
    counterCount: counterEvidenceFacts.length,
    promptText: `金口诀证据：四位${positions.length}项、关系${relations.length}项、焦点${focusFacts.length}项、反证${counterEvidenceFacts.length}项；主线${data.mainLine}`,
    sources: ['阴阳次第五用', '五动三动', '四位生克与空亡月令核验'],
    limitation: '证据汇总只统计四位、关系、焦点与反证覆盖，不得按数量生成吉凶总分或成功率',
  };

  const calculationFact = {
    key: 'jinkoujue:calculation' as const,
    status: '完整' as const,
    method: data.calculation.method,
    methodLabel: data.calculation.methodLabel,
    inputBase: data.calculation.inputBase,
    inputBaseSource: data.calculation.inputBaseSource,
    diFenNote: data.calculation.diFenNote,
    monthLeaderRule: data.calculation.monthLeaderRule,
    yuanDunRule: data.calculation.yuanDunRule,
    dayNightRule: data.calculation.dayNightRule,
    noblemanRule: data.calculation.noblemanRule,
    noblemanDirection: data.calculation.noblemanDirection,
    guiShenRule: data.calculation.guiShenRule,
    yinYangUseRule: `${data.yinYangUse.pattern}：${data.yinYangUse.rule}`,
    promptText: [
      `起课方式${data.calculation.methodLabel}`,
      data.calculation.diFenNote,
      data.calculation.monthLeaderRule,
      data.calculation.dayNightRule,
      data.calculation.noblemanRule,
      data.calculation.guiShenRule,
      data.calculation.yuanDunRule,
      `${data.yinYangUse.pattern}，${data.yinYangUse.rule}`,
    ].join('；'),
    sources: [
      '《六壬神课金口诀古本》“入式歌解”',
      '《六壬神课金口诀古本》“贵神治旦暮”',
      '《六壬神课金口诀古本》“贵神起例”',
      '《六壬神课金口诀古本》“五子元遁起例”',
      '《六壬神课金口诀古本》“阴阳次第五用”',
    ],
    limitation:
      '计算事实只证明地分、月将、贵神、遁干与发用如何形成当前课体；不证明现实结论' as const,
  };

  const randomTraceFact = buildRandomTraceFact({
    key: 'jinkoujue:random-trace',
    applicable: data.method === 'random',
    trace: data.randomTrace,
    processLabel: '金口诀随机起课',
    sources: ['随机起课抽样过程'],
  });
  if (data.method === 'random' && randomTraceFact.status === '可重放') {
    const replay = createRandomContext({ replay: randomTraceFact.samples });
    const value = randomInt(12, replay.random) + 1;
    if (
      replay.getTrace().samples.length !== randomTraceFact.samples.length ||
      value !== data.calculation.inputBase ||
      EARTHLY_BRANCHES[value - 1] !== data.positions.diFen.branch ||
      EARTHLY_BRANCHES[value - 1] !== data.diFenBranch
    ) {
      throw new MingyuCoreError({
        code: 'JINKOUJUE_RANDOM_TRACE_MISMATCH',
        category: 'validation',
        message: '金口诀随机轨迹与起课数字或地分不一致，或包含多余样本。',
        field: 'randomTrace.samples',
      });
    }
  }

  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '金口诀阴阳发用主线',
      detail: `${data.mainLine}；边界：${FOCUS_LIMITATION}`,
      source: '《六壬神课金口诀古本》“阴阳次第五用”“四象所属图”',
      tags: ['阴阳发用', '四位一体'],
    },
    {
      level: '主证',
      title: '起课计算',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起课', data.method, calculationFact.status],
    },
    ...positions.map((item): PromptEvidenceItem => ({
      level: item.position === data.yinYangUse.usePosition ? '主证' : '辅证',
      title: `${item.position}位`,
      detail: `${item.promptText}；角色${item.role}；支持${item.support.join('、') || '无'}；限制${item.constraints.join('、') || '无'}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.position, item.element, item.seasonState],
    })),
    ...relations.map((item): PromptEvidenceItem => ({
      level: item.status === '限制' ? '反证' : item.status === '支持' ? '主证' : '辅证',
      title: '四位关系',
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['生克', item.relation],
    })),
    ...movementFacts.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: `${item.category}：${item.name}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.category, item.name, item.relation],
    })),
    ...focusFacts.map((item): PromptEvidenceItem => ({
      level: item.level,
      title: `焦点：${item.target}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['焦点', item.role],
    })),
    ...(data.method === 'random'
      ? [
          {
            level: randomTraceFact.status === '可重放' ? ('辅证' as const) : ('反证' as const),
            title: randomTraceFact.status === '可重放' ? '随机起课重放记录' : '随机轨迹缺失',
            detail: `${randomTraceFact.promptText}；边界：${randomTraceFact.limitation}`,
            source: randomTraceFact.sources.join('、'),
            tags: ['随机起课', randomTraceFact.status],
          },
        ]
      : []),
    ...counterEvidenceFacts.map((item): PromptEvidenceItem => ({
      level: '反证',
      title: item.type,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['反证', item.type],
    })),
    {
      level: '辅证',
      title: `金口诀证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '金口诀解释边界',
      detail:
        '不得输出吉凶总分或成功率；先按阴阳次第确认发用位，再结合五动三动与四位关系；生克和动名须结合具体所问，不得直接判成现实吉凶。',
      source: '《六壬神课金口诀古本》“阴阳次第五用”“五动爻诵”“三动”',
      tags: ['解释边界'],
    },
  ];

  const evidence: PromptEvidenceBundle = {
    title: '金口诀阴阳发用与四位一体结构化证据',
    items,
  };

  const promptText = [
    '【金口诀阴阳发用结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `主线：${data.mainLine}。`,
    `计算：${calculationFact.promptText}。`,
    `四位：${positions.map((item) => item.promptText).join('；')}。`,
    `关系：${relations.map((item) => item.promptText).join('；')}。`,
    `动爻：${movementFacts.map((item) => item.promptText).join('；') || '未触发五动或三动'}。`,
    `反证：${counterEvidenceFacts.map((item) => item.promptText).join('；') || '未见明确空亡、休囚死或受克限制'}。`,
    `证据汇总：${summaryFact.promptText}。`,
  ].join('\n');

  return {
    key: 'jinkoujue:evidence',
    status: '已计算',
    mainLine: data.mainLine,
    calculationFact,
    positions,
    relations,
    movementFacts,
    focusFacts,
    counterEvidenceFacts,
    summaryFact,
    randomTraceFact,
    randomFacts: formatLegacyRandomFacts(randomTraceFact),
    promptText,
    evidence,
  };
}
