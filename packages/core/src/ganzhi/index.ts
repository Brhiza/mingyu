/**
 * @file 干支基础模块（地基层）
 * @description 把散落在各系统中的干支/五行基础逻辑收敛为对外导出的公共能力。
 *
 * 设计取向（深度整合 tyme4ts）：
 *   - 纳音、干支五行、地支合/冲/害、天干五合、十神 —— 直接委托 tyme4ts
 *     （按《钦定协纪辨方书》等实现的权威历法库），保证与经典一致且单一真相源。
 *   - 十二长生统一「土长生在寅」流派（火土同宫，与八字/奇门所用 tyme4ts 一致）：
 *     委托 tyme4ts HeavenStem.getTerrain(branch) 取得权威长生状态；本地表仅作异常回退。
 *   - 刑、破、三合、三会、驿马、桃花、旬空 —— tyme4ts 未提供，由公共 relations 模块实现。
 *
 * 对外函数签名与返回形状保持不变，已接入 API/MCP 的模块无需改动。
 */
import { SolarTime, SixtyCycle, HeavenStem, EarthBranch } from 'tyme4ts';
import {
  BRANCH_ORDER,
  BRANCH_WUXING,
  STEM_ORDER,
  TIAN_GAN_HE,
  TIAN_GAN_CHONG,
  LIUHE_MAP,
  LIUHE_WUXING,
  LIUCHONG_MAP,
  LIUPO_MAP,
  LIUHAI_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  BRANCH_SANHE,
  BRANCH_SANXING,
  ANHE_MAP,
  BRANCH_HIDDEN_STEMS,
  getHiddenMainStem,
  getHiddenMediumStem,
  getHiddenResidualStem,
  getSeasonState,
  isSheng,
  isKe,
  isLiupo,
  isSanxing,
  getSanxingType,
  isCompleteSanhe,
  isCompleteSanhui,
  getTianGanHeWuxing,
  getYiMa,
  getTaoHua,
  getWuxingChangSheng,
  SanxingType,
  SANXING_MAP,
} from './relations';
import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  SIX_XUN_HEADS,
  STEM_WUXING,
  STEM_YINYANG,
  BRANCH_YINYANG,
  NAYIN_MAP,
  CHANGSHENG_ORDER,
  WUXING_CHANGSHENG_START,
  type HeavenlyStem,
  type EarthlyBranch,
  type ChangShengState,
} from './data';
import {
  assertEarthlyBranch,
  assertHeavenlyStem,
  assertValidGanZhi,
  assertWuxing,
  isValidGanZhi,
} from './validation';

export * from './data';
export * from './validation';

export {
  BRANCH_ORDER,
  BRANCH_WUXING,
  STEM_ORDER,
  TIAN_GAN_HE,
  TIAN_GAN_CHONG,
  LIUHE_MAP,
  LIUHE_WUXING,
  LIUCHONG_MAP,
  LIUPO_MAP,
  LIUHAI_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  BRANCH_SANHE,
  BRANCH_SANXING,
  ANHE_MAP,
  SANXING_MAP,
  BRANCH_HIDDEN_STEMS,
  getHiddenMainStem,
  getHiddenMediumStem,
  getHiddenResidualStem,
  getSeasonState,
  isSheng,
  isKe,
  isLiupo,
  isSanxing,
  getSanxingType,
  isCompleteSanhe,
  isCompleteSanhui,
  getTianGanHeWuxing,
  getYiMa,
  getTaoHua,
  getWuxingChangSheng,
  SanxingType,
};

export interface StemRelationProfile {
  name: string;
  index: number;
  wuxing: string;
  yinYang: '阳' | '阴';
  combine: string;
  combineWuxing: string;
  clash?: string;
}

export interface BranchRelationProfile {
  name: string;
  index: number;
  zodiac: string;
  wuxing: string;
  yinYang: '阳' | '阴';
  hiddenStems: string[];
  combine: string;
  combineWuxing: string;
  clash: string;
  harm: string;
  break: string;
  hiddenCombine?: string;
  punishment: string;
  punishments: string[];
  punishmentType?: string;
  sanhe: { group: string; partners: string[] };
  sanhui?: { group: string; members: string[] };
}

export interface GanZhiCalculationStep {
  key: string;
  stage: '输入核验' | '六十甲子定位' | '天干资料整理' | '地支资料整理' | '纳音汇总';
  status: '已核验' | '已查询' | '已整理';
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '干支计算步骤只证明输入如何映射到六十甲子序号、天干、地支、纳音与固定关系表；不得把步骤完整度解释为吉凶、事件概率或关系必然成立';
}

export interface GanZhiSourceFact {
  key: string;
  type: '六十甲子' | '纳音' | '天干资料' | '地支资料';
  status: '已查询';
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '干支资料事实只记录当前干支在公共表中的固定属性与关系候选；合冲刑害破是否在具体命盘、课盘或时空条件中成立，必须由上层算法另行判断';
}

export interface GanZhiLimitationFact {
  key: string;
  type: '固定资料边界' | '关系成立边界' | '纳音解释边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '干支限制事实用于约束固定资料的解释范围，不得被反向当作现实结果、吉凶评分、事件概率或唯一结论的证据';
}

export interface GanZhiSummaryFact {
  key: string;
  status: '证据链完整';
  factKeys: string[];
  calculationStepCount: number;
  sourceFactCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '干支证据汇总只统计六十甲子定位、天干、地支、纳音和解释边界的覆盖，不表示传统关系在具体问题中已经触发';
}

export interface GanZhiEvidenceFields {
  key: string;
  status: '已查询';
  calculationSteps: GanZhiCalculationStep[];
  calculationChain: string[];
  sourceFacts: GanZhiSourceFact[];
  summaryFact: GanZhiSummaryFact;
  limitations: string[];
  limitationFacts: GanZhiLimitationFact[];
  source: string;
  promptText: string;
}

export interface GanZhiBaseProfile {
  ganZhi: string;
  index: number;
  yinYang: '阳' | '阴';
  nayin: string;
  nayinWuxing: string;
  stem: StemRelationProfile;
  branch: BranchRelationProfile;
}

export interface GanZhiProfile extends GanZhiBaseProfile, GanZhiEvidenceFields {}

const GANZHI_STEP_LIMITATION =
  '干支计算步骤只证明输入如何映射到六十甲子序号、天干、地支、纳音与固定关系表；不得把步骤完整度解释为吉凶、事件概率或关系必然成立' as const;
const GANZHI_SOURCE_FACT_LIMITATION =
  '干支资料事实只记录当前干支在公共表中的固定属性与关系候选；合冲刑害破是否在具体命盘、课盘或时空条件中成立，必须由上层算法另行判断' as const;
const GANZHI_LIMITATION_FACT_LIMITATION =
  '干支限制事实用于约束固定资料的解释范围，不得被反向当作现实结果、吉凶评分、事件概率或唯一结论的证据' as const;
const GANZHI_SUMMARY_LIMITATION =
  '干支证据汇总只统计六十甲子定位、天干、地支、纳音和解释边界的覆盖，不表示传统关系在具体问题中已经触发' as const;

function buildGanZhiEvidence(profile: GanZhiBaseProfile): GanZhiEvidenceFields {
  const inputStepKey = 'foundation:ganzhi:calculation:input';
  const cycleStepKey = 'foundation:ganzhi:calculation:cycle';
  const stemStepKey = 'foundation:ganzhi:calculation:stem';
  const branchStepKey = 'foundation:ganzhi:calculation:branch';
  const nayinStepKey = 'foundation:ganzhi:calculation:nayin';
  const calculationSteps: GanZhiCalculationStep[] = [
    {
      key: inputStepKey,
      stage: '输入核验',
      status: '已核验',
      dependsOnStepKeys: [],
      promptText: `核验${profile.ganZhi}属于有效六十甲子组合`,
      sources: ['公共六十甲子与纳音映射表'],
      limitation: GANZHI_STEP_LIMITATION,
    },
    {
      key: cycleStepKey,
      stage: '六十甲子定位',
      status: '已查询',
      dependsOnStepKeys: [inputStepKey],
      promptText: `${profile.ganZhi}在六十甲子中的零基序号为${profile.index}，阴阳取${profile.yinYang}`,
      sources: ['公共六十甲子顺序、天干阴阳表'],
      limitation: GANZHI_STEP_LIMITATION,
    },
    {
      key: stemStepKey,
      stage: '天干资料整理',
      status: '已整理',
      dependsOnStepKeys: [cycleStepKey],
      promptText: `${profile.stem.name}为${profile.stem.yinYang}${profile.stem.wuxing}，五合对象为${profile.stem.combine}、传统合化五行为${profile.stem.combineWuxing}${profile.stem.clash ? `，相冲对象为${profile.stem.clash}` : '，主流口径不列固定相冲对象'}`,
      sources: ['tyme4ts 天干五行', '公共天干五合与主流相冲表'],
      limitation: GANZHI_STEP_LIMITATION,
    },
    {
      key: branchStepKey,
      stage: '地支资料整理',
      status: '已整理',
      dependsOnStepKeys: [cycleStepKey],
      promptText: `${profile.branch.name}为${profile.branch.yinYang}${profile.branch.wuxing}、生肖${profile.branch.zodiac}，藏干${profile.branch.hiddenStems.join('、') || '无'}；六合对象${profile.branch.combine}、相冲对象${profile.branch.clash}、相害对象${profile.branch.harm}、相破对象${profile.branch.break}、相刑候选${profile.branch.punishments.join('、') || '无'}`,
      sources: ['tyme4ts 地支五行', '公共藏干、六合、六冲、六害、六破与三刑表'],
      limitation: GANZHI_STEP_LIMITATION,
    },
    {
      key: nayinStepKey,
      stage: '纳音汇总',
      status: '已整理',
      dependsOnStepKeys: [cycleStepKey, stemStepKey, branchStepKey],
      promptText: `${profile.ganZhi}纳音为${profile.nayin}，归属${profile.nayinWuxing}五行`,
      sources: ['公共六十甲子纳音表'],
      limitation: GANZHI_STEP_LIMITATION,
    },
  ];
  const sourceFacts: GanZhiSourceFact[] = [
    {
      key: 'foundation:ganzhi:fact:cycle',
      type: '六十甲子',
      status: '已查询',
      ownerStepKeys: [cycleStepKey],
      promptText: `${profile.ganZhi}序号${profile.index}，阴阳${profile.yinYang}`,
      sources: ['公共六十甲子顺序'],
      limitation: GANZHI_SOURCE_FACT_LIMITATION,
    },
    {
      key: 'foundation:ganzhi:fact:nayin',
      type: '纳音',
      status: '已查询',
      ownerStepKeys: [nayinStepKey],
      promptText: `${profile.ganZhi}纳音${profile.nayin}，纳音五行${profile.nayinWuxing}`,
      sources: ['公共纳音映射表'],
      limitation: GANZHI_SOURCE_FACT_LIMITATION,
    },
    {
      key: 'foundation:ganzhi:fact:stem',
      type: '天干资料',
      status: '已查询',
      ownerStepKeys: [stemStepKey],
      promptText: calculationSteps.find((item) => item.key === stemStepKey)!.promptText,
      sources: ['天干五行、阴阳、五合与相冲公共资料'],
      limitation: GANZHI_SOURCE_FACT_LIMITATION,
    },
    {
      key: 'foundation:ganzhi:fact:branch',
      type: '地支资料',
      status: '已查询',
      ownerStepKeys: [branchStepKey],
      promptText: calculationSteps.find((item) => item.key === branchStepKey)!.promptText,
      sources: ['地支五行、生肖、藏干与合冲刑害破公共资料'],
      limitation: GANZHI_SOURCE_FACT_LIMITATION,
    },
  ];
  const limitations = [
    '本结果是单个干支的固定资料查询，不包含月令、旺衰、柱位、运限或现实问题上下文。',
    '合、冲、刑、害、破只列公共关系对象；是否在具体盘面成立，需结合另一干支、柱位和上层规则判断。',
    '纳音仅作为六十甲子的传统分类资料，不单独证明性格、吉凶、职业、健康或事件结果。',
  ];
  const limitationFacts: GanZhiLimitationFact[] = [
    {
      key: 'foundation:ganzhi:limitation:fixed-profile',
      type: '固定资料边界',
      status: '适用',
      ownerFactKeys: sourceFacts.map((item) => item.key),
      ownerStepKeys: calculationSteps.map((item) => item.key),
      promptText: limitations[0],
      sources: ['单个干支查询的输入范围'],
      limitation: GANZHI_LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:ganzhi:limitation:relation-context',
      type: '关系成立边界',
      status: '适用',
      ownerFactKeys: ['foundation:ganzhi:fact:stem', 'foundation:ganzhi:fact:branch'],
      ownerStepKeys: [stemStepKey, branchStepKey],
      promptText: limitations[1],
      sources: ['合冲刑害破的上层组合判断要求'],
      limitation: GANZHI_LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:ganzhi:limitation:nayin',
      type: '纳音解释边界',
      status: '适用',
      ownerFactKeys: ['foundation:ganzhi:fact:nayin'],
      ownerStepKeys: [nayinStepKey],
      promptText: limitations[2],
      sources: ['纳音作为传统分类资料的解释边界'],
      limitation: GANZHI_LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryFact: GanZhiSummaryFact = {
    key: 'foundation:ganzhi:evidence-summary',
    status: '证据链完整',
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...sourceFacts.map((item) => item.key),
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    sourceFactCount: sourceFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `干支资料证据链完整：计算步骤${calculationSteps.length}项、来源事实${sourceFacts.length}项、限制${limitationFacts.length}项`,
    sources: ['六十甲子、天干、地支、纳音与解释边界汇总'],
    limitation: GANZHI_SUMMARY_LIMITATION,
  };
  const source =
    '六十甲子、纳音、阴阳、藏干及关系表来自公共干支单一真相源；天干地支五行与基础历法能力对齐 tyme4ts';

  return {
    key: `foundation:ganzhi:${profile.ganZhi}`,
    status: '已查询',
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    sourceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    source,
    promptText: `干支资料：${calculationSteps.map((item) => item.promptText).join(' → ')}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.map((item) => item.replace(/[。；]+$/, '')).join('；')}。`,
  };
}

/** 返回六十甲子副本，避免调用方改写公共序列。 */
export function getSixtyCycle(): string[] {
  return [...SIXTY_CYCLE];
}

/** 天干基础属性与合冲关系。 */
export function getStemRelations(stem: string): StemRelationProfile {
  const index = getStemIndex(stem);
  const combine = TIAN_GAN_HE[stem];
  if (!combine) throw new Error(`天干五合数据缺失：${stem}`);
  return {
    name: stem,
    index,
    wuxing: getStemWuxing(stem),
    yinYang: getStemYinYang(stem),
    combine: combine.partner,
    combineWuxing: combine.wuxing,
    clash: TIAN_GAN_CHONG[stem],
  };
}

/** 地支基础属性、藏干与合冲刑害破关系。 */
export function getBranchRelations(branch: string): BranchRelationProfile {
  const index = getBranchIndex(branch);
  const sanhe = BRANCH_SANHE[branch];
  if (!sanhe) throw new Error(`地支三合数据缺失：${branch}`);
  const sanhui = Object.entries(SANHUI_GROUPS).find(([, members]) => members.includes(branch));
  return {
    name: branch,
    index,
    zodiac: getZodiac(branch),
    wuxing: getBranchWuxing(branch),
    yinYang: getBranchYinYang(branch),
    hiddenStems: [...(BRANCH_HIDDEN_STEMS[branch] ?? [])],
    combine: LIUHE_MAP[branch],
    combineWuxing: LIUHE_WUXING[branch],
    clash: LIUCHONG_MAP[branch],
    harm: LIUHAI_MAP[branch],
    break: LIUPO_MAP[branch],
    hiddenCombine: ANHE_MAP[branch],
    punishment: SANXING_MAP[branch],
    punishments: [...(BRANCH_SANXING[branch] ?? [])],
    punishmentType: getSanxingType(branch) ?? undefined,
    sanhe: { group: sanhe.group, partners: [...sanhe.partners] },
    sanhui: sanhui ? { group: sanhui[0], members: [...sanhui[1]] } : undefined,
  };
}

/** 生成单个六十甲子的完整可复用资料。 */
export function describeGanZhi(ganZhi: string): GanZhiProfile {
  assertValidGanZhi(ganZhi);
  const profile: GanZhiBaseProfile = {
    ganZhi,
    index: getSixtyCycleIndex(ganZhi),
    yinYang: getGanZhiYinYang(ganZhi),
    nayin: getNayin(ganZhi),
    nayinWuxing: getNayinWuxing(ganZhi),
    stem: getStemRelations(ganZhi[0]),
    branch: getBranchRelations(ganZhi[1]),
  };
  return { ...profile, ...buildGanZhiEvidence(profile) };
}

/** 干支纪时结果 */
export interface GanZhiDate {
  year: string;
  month: string;
  day: string;
  hour: string;
}

/**
 * 把公历时间统一转换为 tyme4ts 的农历时辰对象。
 *
 * 注意：`LunarHour.fromYmdHms` 接收的是农历年月日，不能直接用于公历输入；
 * 公历必须先创建 `SolarTime`，再调用 `getLunarHour()`。
 */
export function getLunarHourFromDate(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('日期无效');
  return SolarTime.fromYmdHms(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ).getLunarHour();
}

/** 从公历时间获取四柱干支（委托 tyme4ts，已含节气换月、真太阳时请在上层处理） */
export function getGanZhiFromDate(date: Date): GanZhiDate {
  const eightChar = getLunarHourFromDate(date).getEightChar();
  return {
    year: eightChar.getYear().getName(),
    month: eightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
    hour: eightChar.getHour().getName(),
  };
}

/** 天干五行（委托 tyme4ts，回退到本地表） */
export function getStemWuxing(stem: string): string {
  assertHeavenlyStem(stem);
  try {
    return HeavenStem.fromName(stem).getElement().getName();
  } catch {
    const w = STEM_WUXING[stem];
    if (!w) throw new Error(`天干五行数据缺失：${stem}`);
    return w;
  }
}

/** 天干阴阳 */
export function getStemYinYang(stem: string): '阳' | '阴' {
  assertHeavenlyStem(stem);
  const y = STEM_YINYANG[stem];
  if (!y) throw new Error(`天干阴阳数据缺失：${stem}`);
  return y;
}

/** 地支阴阳 */
export function getBranchYinYang(branch: string): '阳' | '阴' {
  assertEarthlyBranch(branch);
  const y = BRANCH_YINYANG[branch];
  if (!y) throw new Error(`地支阴阳数据缺失：${branch}`);
  return y;
}

/** 干支阴阳（以天干阴阳为准） */
export function getGanZhiYinYang(ganZhi: string): '阳' | '阴' {
  assertValidGanZhi(ganZhi);
  return getStemYinYang(ganZhi[0]);
}

/** 天干序号（0-9） */
export function getStemIndex(stem: string): number {
  assertHeavenlyStem(stem);
  const idx = HEAVENLY_STEMS.indexOf(stem as HeavenlyStem);
  return idx;
}

/** 地支序号（0-11） */
export function getBranchIndex(branch: string): number {
  assertEarthlyBranch(branch);
  const idx = EARTHLY_BRANCHES.indexOf(branch as EarthlyBranch);
  return idx;
}

/** 两干支相差的序数差（用于太乙等推算） */
export function diffGanZhi(from: string, to: string): number {
  const a = getSixtyCycleIndex(from);
  const b = getSixtyCycleIndex(to);
  return (((b - a) % 60) + 60) % 60;
}

/** 六十甲子序号（0-59），甲子为 0 */
export function getSixtyCycleIndex(ganZhi: string): number {
  assertValidGanZhi(ganZhi);
  const s = getStemIndex(ganZhi[0]);
  const b = getBranchIndex(ganZhi[1]);
  return (((s * 6 - b * 5) % 60) + 60) % 60;
}

/** 获取指定干支所属旬的旬首，如乙丑属于甲子旬。 */
export function getXunHead(ganZhi: string): string {
  const index = getSixtyCycleIndex(ganZhi);
  const xunHead = SIX_XUN_HEADS[Math.floor(index / 10)];
  if (!xunHead) throw new Error(`旬首数据缺失：${ganZhi}`);
  return xunHead;
}

/** 纳音（如「海中金」，委托 tyme4ts，与《纳音歌》一致） */
export function getNayin(ganZhi: string): string {
  assertValidGanZhi(ganZhi);
  try {
    return SixtyCycle.fromName(ganZhi).getSound().getName();
  } catch {
    const na = NAYIN_MAP[ganZhi];
    if (!na) throw new Error(`纳音数据缺失：${ganZhi}`);
    return na;
  }
}

/** 纳音五行（纳音名称均以五行字结尾，如海中金、炉中火） */
export function getNayinWuxing(ganZhi: string): string {
  const na = getNayin(ganZhi);
  const element = na[na.length - 1];
  if (
    element === '金' ||
    element === '木' ||
    element === '水' ||
    element === '火' ||
    element === '土'
  ) {
    return element;
  }
  throw new Error(`纳音五行无法判定：${na}`);
}

/**
 * 十二长生状态（统一「土长生在寅」流派，与八字/奇门所用 tyme4ts 一致）。
 * 实现：以该五行的阳性天干代算（木→甲、火→丙、土→戊、金→庚、水→壬），
 * 调 tyme4ts HeavenStem.getTerrain(branch) 取得权威长生状态。
 * 本地表（WUXING_CHANGSHENG_START，已同步为寅派）仅作 tyme4ts 异常时的回退。
 */
const YANG_STEM_OF_WUXING: Record<string, string> = {
  木: '甲',
  火: '丙',
  土: '戊',
  金: '庚',
  水: '壬',
};
export function getChangShengState(wuxing: string, branch: string): ChangShengState {
  assertWuxing(wuxing);
  assertEarthlyBranch(branch);
  const stem = YANG_STEM_OF_WUXING[wuxing];
  if (!stem) throw new Error(`五行长生状态缺失：${wuxing}`);
  try {
    const terrain = HeavenStem.fromName(stem).getTerrain(EarthBranch.fromName(branch)).getName();
    return terrain as ChangShengState;
  } catch {
    const start = WUXING_CHANGSHENG_START[wuxing];
    if (!start) throw new Error(`五行长生起点缺失：${wuxing}`);
    const startIdx = EARTHLY_BRANCHES.indexOf(start as EarthlyBranch);
    const branchIdx = EARTHLY_BRANCHES.indexOf(branch as EarthlyBranch);
    if (branchIdx < 0) throw new Error(`地支无效：${branch}`);
    const offset = (((branchIdx - startIdx) % 12) + 12) % 12;
    return CHANGSHENG_ORDER[offset];
  }
}

/** 生肖（由年支取） */
export function getZodiac(yearBranch: string): string {
  assertEarthlyBranch(yearBranch, '年支');
  const idx = EARTHLY_BRANCHES.indexOf(yearBranch as EarthlyBranch);
  return ZODIACS[idx];
}

/** 地支五行（委托 tyme4ts，回退到本地表） */
export function getBranchWuxing(branch: string): string {
  assertEarthlyBranch(branch);
  try {
    return EarthBranch.fromName(branch).getElement().getName();
  } catch {
    const w = BRANCH_WUXING[branch];
    if (!w) throw new Error(`地支五行数据缺失：${branch}`);
    return w;
  }
}

/** 地支六合（委托 tyme4ts） */
export function isLiuhe(a: string, b: string): boolean {
  assertEarthlyBranch(a, '第一个地支');
  assertEarthlyBranch(b, '第二个地支');
  return EarthBranch.fromName(a).getCombine().getName() === b;
}

/** 地支六冲（委托 tyme4ts） */
export function isLiuchong(a: string, b: string): boolean {
  assertEarthlyBranch(a, '第一个地支');
  assertEarthlyBranch(b, '第二个地支');
  return EarthBranch.fromName(a).getOpposite().getName() === b;
}

/** 地支六害（委托 tyme4ts） */
export function isLiuhai(a: string, b: string): boolean {
  assertEarthlyBranch(a, '第一个地支');
  assertEarthlyBranch(b, '第二个地支');
  return EarthBranch.fromName(a).getHarm().getName() === b;
}

/** 天干五合（委托 tyme4ts） */
export function isTianGanHe(a: string, b: string): boolean {
  assertHeavenlyStem(a, '第一个天干');
  assertHeavenlyStem(b, '第二个天干');
  return HeavenStem.fromName(a).getCombine().getName() === b;
}

/** 地支对宫（委托 tyme4ts） */
export function getOppositeBranch(branch: string): string {
  assertEarthlyBranch(branch);
  return EarthBranch.fromName(branch).getOpposite().getName();
}

/** 十神：以 dayStem 为日主，求 stem 的相对十神（委托 tyme4ts，新增能力） */
export function getTenStar(dayStem: string, stem: string): string {
  assertHeavenlyStem(dayStem, '日干');
  assertHeavenlyStem(stem, '目标天干');
  return HeavenStem.fromName(dayStem).getTenStar(HeavenStem.fromName(stem)).getName();
}

export const ganzhi = {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  SIX_XUN_HEADS,
  getLunarHourFromDate,
  getGanZhiFromDate,
  getStemWuxing,
  getStemYinYang,
  getBranchYinYang,
  getGanZhiYinYang,
  getStemIndex,
  getBranchIndex,
  getSixtyCycle,
  getSixtyCycleIndex,
  getXunHead,
  diffGanZhi,
  isValidGanZhi,
  getNayin,
  getNayinWuxing,
  getChangShengState,
  getZodiac,
  getBranchWuxing,
  isLiuhe,
  isLiuchong,
  isLiuhai,
  isTianGanHe,
  getOppositeBranch,
  getTenStar,
  getStemRelations,
  getBranchRelations,
  describeGanZhi,
};
