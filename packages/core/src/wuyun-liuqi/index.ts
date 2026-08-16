/**
 * @file 五运六气年度结构
 * @description 依据年干支推导岁运太过不及、五步主客运、司天在泉以及六步主气与客气。
 * @传统依据 《素问·天元纪大论》《素问·五运行大论》《素问·六微旨大论》及运气七篇大论。
 */
import { assertValidGanZhi, SIXTY_CYCLE } from '../ganzhi';
import { buildPromptSchoolSection, type PromptSchoolId } from '../prompt/schools';
import { insertPromptSectionBeforeHeading } from '../prompt/guidance';
import { isKe, isSheng } from '../wuxing';

export const WUYUN_LIUQI_SOURCES = [
  {
    title: '《素问·天元纪大论》',
    scope: '天干化五运、地支配司天以及运气年度纲领。',
  },
  {
    title: '《素问·五运行大论》',
    scope: '五运与五行、气候属性的传统关系。',
  },
  {
    title: '《素问·六微旨大论》',
    scope: '六气司天、在泉与主客气位置关系。',
  },
  {
    title: '吴谦《运气要诀》',
    scope:
      '五步主客运、五音太少、交司日期、六步节令、气运相临以及天符、岁会、太乙天符、同天符、同岁会。',
  },
] as const;

export type WuyunElement = '木' | '火' | '土' | '金' | '水';
export type WuyunStrength = '太过' | '不及';
export type WuyunTone = '角' | '徵' | '宫' | '商' | '羽';
export type WuyunToneStrength = '太' | '少';
export type LiuqiName = '厥阴风木' | '少阴君火' | '少阳相火' | '太阴湿土' | '阳明燥金' | '太阳寒水';
export type AnnualQiMovementRelationKind = '同气' | '顺化' | '天刑' | '小逆' | '不和';
export type HostGuestRelationKind = '同气' | '客生主' | '主生客' | '客克主' | '主克客';
export type AnnualConformityName = '天符' | '岁会' | '太乙天符' | '同天符' | '同岁会';

export interface WuyunLiuqiInput {
  /** 公历年；按该年年中所属年柱换算，避免元旦与立春边界混淆。 */
  year?: number;
  /** 明确指定年干支；提供后以此为准。 */
  yearGanZhi?: string;
  /** 可选问题，只用于生成完整提示词，不改变排盘。 */
  question?: string;
}

export interface AnnualMovement {
  stem: string;
  element: WuyunElement;
  name: string;
  tone: WuyunTone;
  toneStrength: WuyunToneStrength;
  toneName: string;
  yinYang: '阳' | '阴';
  strength: WuyunStrength;
  basis: string;
}

export interface WuyunMovementProfile {
  element: WuyunElement;
  tone: WuyunTone;
  toneStrength: WuyunToneStrength;
  toneName: string;
  strength: WuyunStrength;
  climateQi: '风' | '热' | '湿' | '燥' | '寒';
}

export interface WuyunMovementStep {
  order: number;
  label: '初运' | '二运' | '三运' | '四运' | '五运';
  startBoundary: {
    solarTerm: '大寒' | '春分' | '芒种' | '处暑' | '立冬';
    offsetDays: number;
    description: string;
    precision: '传统日期序号';
  };
  periodRule: string;
  hostMovement: WuyunMovementProfile;
  guestMovement: WuyunMovementProfile;
  hostGuestRelation: {
    kind: HostGuestRelationKind;
    basis: string;
  };
  guestRole?: '中运起点';
}

export interface LiuqiProfile {
  name: LiuqiName;
  phase: '厥阴' | '少阴' | '少阳' | '太阴' | '阳明' | '太阳';
  qi: '风' | '君火' | '相火' | '湿' | '燥' | '寒';
  element: WuyunElement;
}

export interface LiuqiStep {
  order: number;
  label: '初之气' | '二之气' | '三之气' | '四之气' | '五之气' | '终之气';
  solarTerms: string[];
  hostQi: LiuqiProfile;
  guestQi: LiuqiProfile;
  hostGuestRelation: {
    kind: HostGuestRelationKind;
    basis: string;
  };
  guestRole?: '司天' | '在泉';
}

export interface AnnualQiMovementRelation {
  kind: AnnualQiMovementRelationKind;
  movementElement: WuyunElement;
  sitianElement: WuyunElement;
  basis: string;
}

export interface AnnualConformityFact {
  name: AnnualConformityName;
  matched: boolean;
  rule: string;
  basis: string;
}

export interface AnnualConformities {
  names: AnnualConformityName[];
  tianfu: boolean;
  suihui: boolean;
  taiyiTianfu: boolean;
  tongTianfu: boolean;
  tongSuihui: boolean;
  facts: AnnualConformityFact[];
  sourceReconciliation: {
    distinctYearsByListedRules: 26;
    sourceSummaryYears: 28;
    handling: string;
  };
}

export interface WuyunLiuqiCalculation {
  input: {
    year?: number;
    yearGanZhi: string;
    yearGanZhiSource: '明确年干支' | '公历年年中换算';
  };
  annualMovement: AnnualMovement;
  sitian: LiuqiProfile;
  zaiquan: LiuqiProfile;
  annualRelation: AnnualQiMovementRelation;
  annualConformities: AnnualConformities;
  movementSteps: WuyunMovementStep[];
  qiSteps: LiuqiStep[];
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
}

export interface WuyunLiuqiResult extends WuyunLiuqiCalculation {
  prompt: string;
}

const STEM_MOVEMENT: Record<
  string,
  { element: WuyunElement; yinYang: '阳' | '阴'; strength: WuyunStrength }
> = {
  甲: { element: '土', yinYang: '阳', strength: '太过' },
  乙: { element: '金', yinYang: '阴', strength: '不及' },
  丙: { element: '水', yinYang: '阳', strength: '太过' },
  丁: { element: '木', yinYang: '阴', strength: '不及' },
  戊: { element: '火', yinYang: '阳', strength: '太过' },
  己: { element: '土', yinYang: '阴', strength: '不及' },
  庚: { element: '金', yinYang: '阳', strength: '太过' },
  辛: { element: '水', yinYang: '阴', strength: '不及' },
  壬: { element: '木', yinYang: '阳', strength: '太过' },
  癸: { element: '火', yinYang: '阴', strength: '不及' },
};

export const HOST_MOVEMENT_ORDER: readonly WuyunElement[] = ['木', '火', '土', '金', '水'];

const MOVEMENT_TONE: Record<WuyunElement, WuyunTone> = {
  木: '角',
  火: '徵',
  土: '宫',
  金: '商',
  水: '羽',
};

const MOVEMENT_CLIMATE_QI: Record<WuyunElement, WuyunMovementProfile['climateQi']> = {
  木: '风',
  火: '热',
  土: '湿',
  金: '燥',
  水: '寒',
};

const MOVEMENT_STEP_LABELS: WuyunMovementStep['label'][] = ['初运', '二运', '三运', '四运', '五运'];

/**
 * 《运气要诀》五运交司日期。offsetDays 表示原文“节气后第几日”的日期序号，
 * 不把它解释成自交节时刻起累计若干个 24 小时的现代精确时刻。
 */
export const MOVEMENT_STEP_BOUNDARIES: readonly {
  solarTerm: WuyunMovementStep['startBoundary']['solarTerm'];
  offsetDays: number;
  description: string;
  periodRule: string;
}[] = [
  {
    solarTerm: '大寒',
    offsetDays: 0,
    description: '大寒日起',
    periodRule: '大寒日起，至春分后第12日',
  },
  {
    solarTerm: '春分',
    offsetDays: 13,
    description: '春分后第13日起',
    periodRule: '春分后第13日起，至芒种后第9日',
  },
  {
    solarTerm: '芒种',
    offsetDays: 10,
    description: '芒种后第10日起',
    periodRule: '芒种后第10日起，至处暑后第6日',
  },
  {
    solarTerm: '处暑',
    offsetDays: 7,
    description: '处暑后第7日起',
    periodRule: '处暑后第7日起，至立冬后第3日',
  },
  {
    solarTerm: '立冬',
    offsetDays: 4,
    description: '立冬后第4日起',
    periodRule: '立冬后第4日起，至小寒末日',
  },
];

const QI_PROFILES: Record<LiuqiName, LiuqiProfile> = {
  厥阴风木: { name: '厥阴风木', phase: '厥阴', qi: '风', element: '木' },
  少阴君火: { name: '少阴君火', phase: '少阴', qi: '君火', element: '火' },
  少阳相火: { name: '少阳相火', phase: '少阳', qi: '相火', element: '火' },
  太阴湿土: { name: '太阴湿土', phase: '太阴', qi: '湿', element: '土' },
  阳明燥金: { name: '阳明燥金', phase: '阳明', qi: '燥', element: '金' },
  太阳寒水: { name: '太阳寒水', phase: '太阳', qi: '寒', element: '水' },
};

/** 主气的少阳、太阴次序与客气轮转不同。 */
export const HOST_QI_ORDER: readonly LiuqiName[] = [
  '厥阴风木',
  '少阴君火',
  '少阳相火',
  '太阴湿土',
  '阳明燥金',
  '太阳寒水',
];

export const GUEST_QI_ORDER: readonly LiuqiName[] = [
  '厥阴风木',
  '少阴君火',
  '太阴湿土',
  '少阳相火',
  '阳明燥金',
  '太阳寒水',
];

const BRANCH_SITIAN_ZAIQUAN: Record<string, readonly [LiuqiName, LiuqiName]> = {
  子: ['少阴君火', '阳明燥金'],
  午: ['少阴君火', '阳明燥金'],
  丑: ['太阴湿土', '太阳寒水'],
  未: ['太阴湿土', '太阳寒水'],
  寅: ['少阳相火', '厥阴风木'],
  申: ['少阳相火', '厥阴风木'],
  卯: ['阳明燥金', '少阴君火'],
  酉: ['阳明燥金', '少阴君火'],
  辰: ['太阳寒水', '太阴湿土'],
  戌: ['太阳寒水', '太阴湿土'],
  巳: ['厥阴风木', '少阳相火'],
  亥: ['厥阴风木', '少阳相火'],
};

const QI_STEP_LABELS: LiuqiStep['label'][] = [
  '初之气',
  '二之气',
  '三之气',
  '四之气',
  '五之气',
  '终之气',
];

/** 一年二十四节气按六步分主，每步四个节气。 */
export const QI_STEP_SOLAR_TERMS: readonly (readonly [string, string, string, string])[] = [
  ['大寒', '立春', '雨水', '惊蛰'],
  ['春分', '清明', '谷雨', '立夏'],
  ['小满', '芒种', '夏至', '小暑'],
  ['大暑', '立秋', '处暑', '白露'],
  ['秋分', '寒露', '霜降', '立冬'],
  ['小雪', '大雪', '冬至', '小寒'],
];

/** 岁会只取本运临本支之位：木卯、火午、土四维、金酉、水子。 */
const SUIHUI_BRANCH_ELEMENT: Partial<Record<string, WuyunElement>> = {
  卯: '木',
  午: '火',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土',
  酉: '金',
  子: '水',
};

export const ANNUAL_CONFORMITY_SOURCE_RECONCILIATION = Object.freeze({
  distinctYearsByListedRules: 26 as const,
  sourceSummaryYears: 28 as const,
  handling:
    '吴谦《运气要诀》逐项名单按六十甲子去重为26年，与原文“二十八年”汇总不一致；计算采用逐项定义和逐年名单，不用汇总数反改规则。',
});

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function normalizeYear(year: number): number {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new Error('公历年必须是 1-9999 之间的整数。');
  }
  return year;
}

/** 公历年中对应的年柱；1984 年为甲子年。 */
export function getWuyunLiuqiYearGanZhi(year: number): string {
  const normalized = normalizeYear(year);
  const ganZhi = SIXTY_CYCLE[mod(normalized - 1984, 60)];
  if (!ganZhi) throw new Error(`无法换算公历年干支：${normalized}`);
  return ganZhi;
}

function resolveYearInput(input: WuyunLiuqiInput): WuyunLiuqiCalculation['input'] {
  const hasYear = input.year !== undefined;
  const hasGanZhi = input.yearGanZhi !== undefined;
  if (!hasYear && !hasGanZhi) {
    throw new Error('必须提供 year 或 yearGanZhi。');
  }

  const year = hasYear ? normalizeYear(input.year as number) : undefined;
  if (hasGanZhi) {
    assertValidGanZhi(input.yearGanZhi, '年干支');
    if (year !== undefined) {
      const derived = getWuyunLiuqiYearGanZhi(year);
      if (derived !== input.yearGanZhi) {
        throw new Error(`year 与 yearGanZhi 不一致：${year} 年年中为 ${derived}。`);
      }
    }
    return { year, yearGanZhi: input.yearGanZhi, yearGanZhiSource: '明确年干支' };
  }

  const yearGanZhi = getWuyunLiuqiYearGanZhi(year as number);
  return { year, yearGanZhi, yearGanZhiSource: '公历年年中换算' };
}

function profile(name: LiuqiName): LiuqiProfile {
  return { ...QI_PROFILES[name] };
}

function buildAnnualRelation(
  movementElement: WuyunElement,
  sitianElement: WuyunElement,
): AnnualQiMovementRelation {
  let kind: AnnualQiMovementRelationKind;
  let basis: string;
  if (movementElement === sitianElement) {
    kind = '同气';
    basis = `司天${sitianElement}与中运${movementElement}同气。`;
  } else if (isSheng(sitianElement, movementElement)) {
    kind = '顺化';
    basis = `司天${sitianElement}生中运${movementElement}，为顺化。`;
  } else if (isKe(sitianElement, movementElement)) {
    kind = '天刑';
    basis = `司天${sitianElement}克中运${movementElement}，为天刑。`;
  } else if (isSheng(movementElement, sitianElement)) {
    kind = '小逆';
    basis = `中运${movementElement}生司天${sitianElement}，为小逆。`;
  } else if (isKe(movementElement, sitianElement)) {
    kind = '不和';
    basis = `中运${movementElement}克司天${sitianElement}，为不和。`;
  } else {
    throw new Error(`无法判定中运${movementElement}与司天${sitianElement}的生克关系。`);
  }
  return { kind, movementElement, sitianElement, basis };
}

function buildHostGuestRelation(
  hostElement: WuyunElement,
  guestElement: WuyunElement,
): LiuqiStep['hostGuestRelation'] {
  if (hostElement === guestElement) {
    return { kind: '同气', basis: `客气${guestElement}与主气${hostElement}同气。` };
  }
  if (isSheng(guestElement, hostElement)) {
    return { kind: '客生主', basis: `客气${guestElement}生主气${hostElement}。` };
  }
  if (isSheng(hostElement, guestElement)) {
    return { kind: '主生客', basis: `主气${hostElement}生客气${guestElement}。` };
  }
  if (isKe(guestElement, hostElement)) {
    return { kind: '客克主', basis: `客气${guestElement}克主气${hostElement}。` };
  }
  if (isKe(hostElement, guestElement)) {
    return { kind: '主克客', basis: `主气${hostElement}克客气${guestElement}。` };
  }
  throw new Error(`无法判定主气${hostElement}与客气${guestElement}的生克关系。`);
}

function buildMovementHostGuestRelation(
  hostElement: WuyunElement,
  guestElement: WuyunElement,
): WuyunMovementStep['hostGuestRelation'] {
  if (hostElement === guestElement) {
    return { kind: '同气', basis: `客运${guestElement}与主运${hostElement}同气。` };
  }
  if (isSheng(guestElement, hostElement)) {
    return { kind: '客生主', basis: `客运${guestElement}生主运${hostElement}。` };
  }
  if (isSheng(hostElement, guestElement)) {
    return { kind: '主生客', basis: `主运${hostElement}生客运${guestElement}。` };
  }
  if (isKe(guestElement, hostElement)) {
    return { kind: '客克主', basis: `客运${guestElement}克主运${hostElement}。` };
  }
  if (isKe(hostElement, guestElement)) {
    return { kind: '主克客', basis: `主运${hostElement}克客运${guestElement}。` };
  }
  throw new Error(`无法判定主运${hostElement}与客运${guestElement}的生克关系。`);
}

function toToneStrength(strength: WuyunStrength): WuyunToneStrength {
  return strength === '太过' ? '太' : '少';
}

function toMovementStrength(toneStrength: WuyunToneStrength): WuyunStrength {
  return toneStrength === '太' ? '太过' : '不及';
}

function movementProfile(
  element: WuyunElement,
  toneStrength: WuyunToneStrength,
): WuyunMovementProfile {
  const tone = MOVEMENT_TONE[element];
  return {
    element,
    tone,
    toneStrength,
    toneName: `${toneStrength}${tone}`,
    strength: toMovementStrength(toneStrength),
    climateQi: MOVEMENT_CLIMATE_QI[element],
  };
}

/**
 * 主运木火土金水年年不变；各音太少由本年中运所在五音向前后相生推定。
 * 客运以中运为初运，按五行相生轮转，并沿五音太少相生次序逐步交替。
 */
function buildMovementSteps(annualMovement: AnnualMovement): WuyunMovementStep[] {
  const annualIndex = HOST_MOVEMENT_ORDER.indexOf(annualMovement.element);
  if (annualIndex < 0) throw new Error(`中运五行数据缺失：${annualMovement.element}`);

  const annualToneStrength = annualMovement.toneStrength;
  const oppositeToneStrength: WuyunToneStrength = annualToneStrength === '太' ? '少' : '太';
  const hostMovements = HOST_MOVEMENT_ORDER.map((element, index) =>
    movementProfile(
      element,
      mod(index - annualIndex, 2) === 0 ? annualToneStrength : oppositeToneStrength,
    ),
  );
  const steps = MOVEMENT_STEP_LABELS.map((label, index) => {
    const boundary = MOVEMENT_STEP_BOUNDARIES[index];
    const guestElement = HOST_MOVEMENT_ORDER[mod(annualIndex + index, 5)];
    const hostMovement = hostMovements[index];
    if (!boundary || !hostMovement || !guestElement) {
      throw new Error(`五步主客运数据缺失：第${index + 1}步`);
    }
    const guestToneStrength = index % 2 === 0 ? annualToneStrength : oppositeToneStrength;
    const guestMovement = movementProfile(guestElement, guestToneStrength);
    return {
      order: index + 1,
      label,
      startBoundary: {
        solarTerm: boundary.solarTerm,
        offsetDays: boundary.offsetDays,
        description: boundary.description,
        precision: '传统日期序号' as const,
      },
      periodRule: boundary.periodRule,
      hostMovement,
      guestMovement,
      hostGuestRelation: buildMovementHostGuestRelation(
        hostMovement.element,
        guestMovement.element,
      ),
      guestRole: index === 0 ? ('中运起点' as const) : undefined,
    };
  });

  const firstGuest = steps[0]?.guestMovement;
  if (
    firstGuest?.element !== annualMovement.element ||
    firstGuest.toneStrength !== annualMovement.toneStrength
  ) {
    throw new Error(`客运初运与中运不一致：${annualMovement.toneName}`);
  }
  return steps;
}

function buildAnnualConformities(
  yearGanZhi: string,
  movement: AnnualMovement,
  sitian: LiuqiProfile,
  zaiquan: LiuqiProfile,
): AnnualConformities {
  const branch = yearGanZhi[1];
  const suihuiBranchElement = SUIHUI_BRANCH_ELEMENT[branch];
  const tianfu = movement.element === sitian.element;
  const suihui = suihuiBranchElement === movement.element;
  const taiyiTianfu = tianfu && suihui;
  const zaiquanMatches = movement.element === zaiquan.element;
  const tongTianfu = movement.yinYang === '阳' && zaiquanMatches;
  const tongSuihui = movement.yinYang === '阴' && zaiquanMatches;
  const facts: AnnualConformityFact[] = [
    {
      name: '天符',
      matched: tianfu,
      rule: '中运五行与司天五行相同。',
      basis: `中运为${movement.element}，司天为${sitian.element}，${tianfu ? '两者同气' : '两者不同气'}。`,
    },
    {
      name: '岁会',
      matched: suihui,
      rule: '本运临本支之位：木卯、火午、土辰戌丑未、金酉、水子。',
      basis: `${branch}支${suihuiBranchElement ? `本位五行为${suihuiBranchElement}` : '不属于岁会所列本位'}，中运为${movement.element}，${suihui ? '相合' : '不相合'}。`,
    },
    {
      name: '太乙天符',
      matched: taiyiTianfu,
      rule: '同一年同时构成天符与岁会。',
      basis: `天符${tianfu ? '成立' : '不成立'}，岁会${suihui ? '成立' : '不成立'}。`,
    },
    {
      name: '同天符',
      matched: tongTianfu,
      rule: '阳干年中运五行与在泉五行相同。',
      basis: `${movement.yinYang}干年，中运为${movement.element}，在泉为${zaiquan.element}，${tongTianfu ? '符合' : '不符合'}同天符。`,
    },
    {
      name: '同岁会',
      matched: tongSuihui,
      rule: '阴干年中运五行与在泉五行相同。',
      basis: `${movement.yinYang}干年，中运为${movement.element}，在泉为${zaiquan.element}，${tongSuihui ? '符合' : '不符合'}同岁会。`,
    },
  ];
  return {
    names: facts.filter((fact) => fact.matched).map((fact) => fact.name),
    tianfu,
    suihui,
    taiyiTianfu,
    tongTianfu,
    tongSuihui,
    facts,
    sourceReconciliation: { ...ANNUAL_CONFORMITY_SOURCE_RECONCILIATION },
  };
}

function buildQiSteps(sitianName: LiuqiName): LiuqiStep[] {
  const sitianIndex = GUEST_QI_ORDER.indexOf(sitianName);
  if (sitianIndex < 0) throw new Error(`司天气序数据缺失：${sitianName}`);

  return QI_STEP_LABELS.map((label, index) => {
    const guestName = GUEST_QI_ORDER[mod(sitianIndex + index - 2, 6)];
    const hostQi = profile(HOST_QI_ORDER[index]);
    const guestQi = profile(guestName);
    return {
      order: index + 1,
      label,
      solarTerms: [...QI_STEP_SOLAR_TERMS[index]],
      hostQi,
      guestQi,
      hostGuestRelation: buildHostGuestRelation(hostQi.element, guestQi.element),
      guestRole: index === 2 ? '司天' : index === 5 ? '在泉' : undefined,
    };
  });
}

function normalizeQuestion(question?: string): string | undefined {
  if (question === undefined) return undefined;
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('问题必须是非空字符串。');
  }
  return question.trim();
}

export function buildWuyunLiuqiPrompt(
  result: WuyunLiuqiCalculation,
  question?: string,
  schools?: readonly PromptSchoolId<'wuyun-liuqi'>[],
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const lines = [
    '【任务】',
    normalizedQuestion ? '请结合年度运气资料回答【问题】。' : '请解读年度运气节律。',
  ];
  if (normalizedQuestion) lines.push('', '【问题】', normalizedQuestion);
  lines.push(
    '',
    '【盘面资料】',
    `年干支：${result.input.yearGanZhi}${result.input.year === undefined ? '' : `（公历 ${result.input.year} 年）`}`,
    `岁运：${result.annualMovement.name}（${result.annualMovement.toneName}），${result.annualMovement.strength}（${result.annualMovement.yinYang}干）`,
    `司天：${result.sitian.name}`,
    `在泉：${result.zaiquan.name}`,
    `司天与中运：${result.annualRelation.kind}；${result.annualRelation.basis}`,
    `年度符会：${result.annualConformities.names.length ? result.annualConformities.names.join('、') : '未形成天符、岁会、太乙天符、同天符或同岁会'}`,
    '五步主客运：',
    ...result.movementSteps.map(
      (step) =>
        `${step.order}. ${step.label}（${step.periodRule}）：主运${step.hostMovement.toneName}（${step.hostMovement.element}）；客运${step.guestMovement.toneName}（${step.guestMovement.element}）${step.guestRole ? `（${step.guestRole}）` : ''}；主客关系${step.hostGuestRelation.kind}`,
    ),
    '六步主客气：',
    ...result.qiSteps.map(
      (step) =>
        `${step.order}. ${step.label}（${step.solarTerms.join('、')}）：主气${step.hostQi.name}；客气${step.guestQi.name}${step.guestRole ? `（${step.guestRole}）` : ''}；主客关系${step.hostGuestRelation.kind}`,
    ),
    '',
    '【传统依据】',
    '以年干定岁运太过不及，以年支定司天在泉，再看五步主客运与六步主客气的阶段关系。',
  );
  return insertPromptSectionBeforeHeading(
    lines.join('\n'),
    '【问题】',
    buildPromptSchoolSection('wuyun-liuqi', schools),
  );
}

export function calculateWuyunLiuqi(input: WuyunLiuqiInput): WuyunLiuqiResult {
  if (!input || typeof input !== 'object') throw new Error('五运六气输入不能为空。');
  const resolved = resolveYearInput(input);
  const stem = resolved.yearGanZhi[0];
  const branch = resolved.yearGanZhi[1];
  const movement = STEM_MOVEMENT[stem];
  const pair = BRANCH_SITIAN_ZAIQUAN[branch];
  if (!movement || !pair) throw new Error(`五运六气基础表缺失：${resolved.yearGanZhi}`);

  const annualMovement: AnnualMovement = {
    stem,
    element: movement.element,
    name: `${movement.element}运`,
    tone: MOVEMENT_TONE[movement.element],
    toneStrength: toToneStrength(movement.strength),
    toneName: `${toToneStrength(movement.strength)}${MOVEMENT_TONE[movement.element]}`,
    yinYang: movement.yinYang,
    strength: movement.strength,
    basis: `${stem}干化${movement.element}运；${movement.yinYang}干为${movement.strength}，五音为${toToneStrength(movement.strength)}${MOVEMENT_TONE[movement.element]}。`,
  };
  const sitian = profile(pair[0]);
  const zaiquan = profile(pair[1]);
  const movementSteps = buildMovementSteps(annualMovement);
  const qiSteps = buildQiSteps(pair[0]);
  if (qiSteps[2].guestQi.name !== sitian.name || qiSteps[5].guestQi.name !== zaiquan.name) {
    throw new Error(`客气轮转与司天在泉不一致：${resolved.yearGanZhi}`);
  }
  const annualRelation = buildAnnualRelation(annualMovement.element, sitian.element);
  const annualConformities = buildAnnualConformities(
    resolved.yearGanZhi,
    annualMovement,
    sitian,
    zaiquan,
  );

  const calculation: WuyunLiuqiCalculation = {
    input: resolved,
    annualMovement,
    sitian,
    zaiquan,
    annualRelation,
    annualConformities,
    movementSteps,
    qiSteps,
    calculationChain: [
      `${resolved.yearGanZhi}取年干${stem}、年支${branch}`,
      annualMovement.basis,
      `${branch}支对应${sitian.name}司天、${zaiquan.name}在泉`,
      annualRelation.basis,
      `年度符会逐项核验：${annualConformities.names.length ? annualConformities.names.join('、') : '五项均未形成'}`,
      `主运按木火土金水五步固定顺行，以中运${annualMovement.toneName}推定各音太少`,
      `客运以中运${annualMovement.toneName}为初运，按五行相生顺推，并依太少相生逐步交替`,
      '五步交司依次为大寒、春分后第13日、芒种后第10日、处暑后第7日、立冬后第4日',
      `客气以${sitian.name}落三之气，依客气次序前后轮转，${zaiquan.name}落终之气`,
      '二十四节气自大寒起按每四气一组分为六步，并逐步核验主客气五行关系',
    ],
    sources: WUYUN_LIUQI_SOURCES.map((source) => ({ ...source })),
    limitations: [
      '五步交司按《运气要诀》所列传统日期序号表达，不把“节气后第几日”换算成现代精确到时分秒的交运时刻。',
      '结果为年度传统节律结构，不含逐日气候计算。',
      '传统运气模型不能替代地域气象资料、个人健康资料或医疗诊断。',
      '符会与气运关系按吴谦《运气要诀》通行口径核验，不延伸为疾病轻重或现实事件预测。',
      ANNUAL_CONFORMITY_SOURCE_RECONCILIATION.handling,
    ],
  };

  return { ...calculation, prompt: buildWuyunLiuqiPrompt(calculation, input.question) };
}

export const wuyunLiuqi = {
  HOST_MOVEMENT_ORDER,
  MOVEMENT_STEP_BOUNDARIES,
  HOST_QI_ORDER,
  GUEST_QI_ORDER,
  QI_STEP_SOLAR_TERMS,
  ANNUAL_CONFORMITY_SOURCE_RECONCILIATION,
  WUYUN_LIUQI_SOURCES,
  getWuyunLiuqiYearGanZhi,
  calculateWuyunLiuqi,
  buildWuyunLiuqiPrompt,
};
