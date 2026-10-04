/**
 * @file 五运六气年度结构
 * @description 依据年干支推导岁运太过不及、五步主客运、司天在泉以及六步主气与客气。
 * @传统依据 《素问·天元纪大论》《素问·五运行大论》《素问·六微旨大论》及运气七篇大论。
 */
import {
  getStemMovement,
  getQiProfile,
  getBranchSitianZaiquan,
  getSuihuiBranchElement,
} from './annual-data';
import { calculateSolarTermEvidence } from '../calendar/solar-term-evidence';
import { assertValidGanZhi, SIXTY_CYCLE } from '../ganzhi';
import { buildPromptSchoolSection, type PromptSchoolId } from '../prompt/schools';
import { buildPromptTask, insertPromptSectionBeforeHeading } from '../prompt/guidance';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  type PromptSelection,
} from '../prompt/framework';
import { isKe, isSheng } from '../wuxing';
import {
  evaluateWuyunLiuqiPathomechanism,
  type WuyunLiuqiPathomechanismResult,
} from './pathomechanism';

export { evaluateWuyunLiuqiPathomechanism };
export type { WuyunLiuqiPathomechanismResult };

const CANONICAL_WUYUN_LIUQI_SOURCES = [
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
      '五步主客运、五音太少、交司日期、六步节令、气运相临、司天正对化、南北政以及天符、岁会、太乙天符、同天符、同岁会。',
  },
  {
    title: '《古今医统大全》卷五·论纪运（平气）',
    scope: '司天制运、岁会及同岁会、辛亥癸巳同气相佐；平气还须核交气日时与气候应期。',
  },
] as const;

export const WUYUN_LIUQI_SOURCES = structuredClone(CANONICAL_WUYUN_LIUQI_SOURCES);

export type WuyunElement = '木' | '火' | '土' | '金' | '水';
export type WuyunStrength = '太过' | '不及';
export type WuyunTone = '角' | '徵' | '宫' | '商' | '羽';
export type WuyunToneStrength = '太' | '少';
export type LiuqiName = '厥阴风木' | '少阴君火' | '少阳相火' | '太阴湿土' | '阳明燥金' | '太阳寒水';
export type AnnualQiMovementRelationKind = '同气' | '顺化' | '天刑' | '小逆' | '不和';
export type HostGuestRelationKind = '同气' | '客生主' | '主生客' | '客克主' | '主克客';
export type AnnualConformityName = '天符' | '岁会' | '太乙天符' | '同天符' | '同岁会';

export interface WuyunLiuqiInput {
  /** 公历年份标签；运气年度从该年大寒节令延续至次年大寒节令前。 */
  year?: number;
  /** 明确指定年干支；首尾空白会修剪，提供后以此为准。 */
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
  gregorianStart?: string;
  gregorianEnd?: string;
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
  /** 本步所覆盖的首末北京时间日期；交节当日可同时出现在相邻两步，瞬时归属以 boundaryTime 为准。 */
  gregorianStart?: string;
  gregorianEnd?: string;
  /** 现代节气历表的北京时间交节瞬时，仅用于节令分段，不等同传统六气交司时刻。 */
  boundaryTime?: {
    startTimestamp: number;
    endTimestampExclusive: number;
    startBeijing: string;
    endBeijingExclusive: string;
  };
  hostQi: LiuqiProfile;
  guestQi: LiuqiProfile;
  hostGuestRelation: {
    kind: HostGuestRelationKind;
    basis: string;
    fireOrder?: '君位臣则顺' | '臣位君则逆';
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
  calendarDateStatus: '公历日期已换算' | '节令边界';
  annualMovement: AnnualMovement;
  sitian: LiuqiProfile;
  zaiquan: LiuqiProfile;
  annualRelation: AnnualQiMovementRelation;
  annualClassification: {
    sitianTransformation: '正化' | '对化';
    governance: '南政' | '北政';
    basis: string[];
  };
  annualConformities: AnnualConformities;
  movementSteps: WuyunMovementStep[];
  qiSteps: LiuqiStep[];
  calculationChain: string[];
  sources: Array<{ title: string; scope: string }>;
  limitations: string[];
  pathomechanism?: WuyunLiuqiPathomechanismResult;
}

export interface WuyunLiuqiResult extends WuyunLiuqiCalculation {
  prompt: string;
}

const CANONICAL_HOST_MOVEMENT_ORDER: readonly WuyunElement[] = ['木', '火', '土', '金', '水'];

export const HOST_MOVEMENT_ORDER: typeof CANONICAL_HOST_MOVEMENT_ORDER = [
  ...CANONICAL_HOST_MOVEMENT_ORDER,
];

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
const CANONICAL_MOVEMENT_STEP_BOUNDARIES: readonly {
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

export const MOVEMENT_STEP_BOUNDARIES: typeof CANONICAL_MOVEMENT_STEP_BOUNDARIES =
  CANONICAL_MOVEMENT_STEP_BOUNDARIES.map((boundary) => ({ ...boundary }));

/** 主气的少阳、太阴次序与客气轮转不同。 */
const CANONICAL_HOST_QI_ORDER: readonly LiuqiName[] = [
  '厥阴风木',
  '少阴君火',
  '少阳相火',
  '太阴湿土',
  '阳明燥金',
  '太阳寒水',
];

export const HOST_QI_ORDER: typeof CANONICAL_HOST_QI_ORDER = [...CANONICAL_HOST_QI_ORDER];

const CANONICAL_GUEST_QI_ORDER: readonly LiuqiName[] = [
  '厥阴风木',
  '少阴君火',
  '太阴湿土',
  '少阳相火',
  '阳明燥金',
  '太阳寒水',
];

export const GUEST_QI_ORDER: typeof CANONICAL_GUEST_QI_ORDER = [...CANONICAL_GUEST_QI_ORDER];

const QI_STEP_LABELS: LiuqiStep['label'][] = [
  '初之气',
  '二之气',
  '三之气',
  '四之气',
  '五之气',
  '终之气',
];

const SOLAR_TERM_INDEX: Record<string, number> = {
  冬至: 0,
  小寒: 1,
  大寒: 2,
  立春: 3,
  雨水: 4,
  惊蛰: 5,
  春分: 6,
  清明: 7,
  谷雨: 8,
  立夏: 9,
  小满: 10,
  芒种: 11,
  夏至: 12,
  小暑: 13,
  大暑: 14,
  立秋: 15,
  处暑: 16,
  白露: 17,
  秋分: 18,
  寒露: 19,
  霜降: 20,
  立冬: 21,
  小雪: 22,
  大雪: 23,
};

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function solarTermBoundary(year: number, name: string) {
  const index = SOLAR_TERM_INDEX[name];
  if (index === undefined) throw new Error(`五运六气缺少节气序号：${name}`);
  const evidence = calculateSolarTermEvidence(year, index);
  const shifted = new Date(evidence.utcTimestamp + 8 * 3_600_000);
  const date = {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
  return {
    date,
    timestamp: evidence.utcTimestamp,
    beijing: `${formatCivilDate(date)} ${padDatePart(shifted.getUTCHours())}:${padDatePart(shifted.getUTCMinutes())}:${padDatePart(shifted.getUTCSeconds())}`,
  };
}

function solarTermCivilDate(year: number, name: string) {
  return solarTermBoundary(year, name).date;
}

function addCivilDays(date: { year: number; month: number; day: number }, days: number) {
  const utc = Date.UTC(date.year, date.month - 1, date.day) + days * 86_400_000;
  const next = new Date(utc);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function formatCivilDate(date: { year: number; month: number; day: number }) {
  return `${date.year}-${padDatePart(date.month)}-${padDatePart(date.day)}`;
}

function beijingCivilDateAt(timestamp: number) {
  const shifted = new Date(timestamp + 8 * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** 一年二十四节气按六步分主，每步四个节气。 */
const CANONICAL_QI_STEP_SOLAR_TERMS: readonly (readonly [string, string, string, string])[] = [
  ['大寒', '立春', '雨水', '惊蛰'],
  ['春分', '清明', '谷雨', '立夏'],
  ['小满', '芒种', '夏至', '小暑'],
  ['大暑', '立秋', '处暑', '白露'],
  ['秋分', '寒露', '霜降', '立冬'],
  ['小雪', '大雪', '冬至', '小寒'],
];

export const QI_STEP_SOLAR_TERMS: typeof CANONICAL_QI_STEP_SOLAR_TERMS =
  CANONICAL_QI_STEP_SOLAR_TERMS.map((terms) => [...terms] as [string, string, string, string]);

/** 岁会只取本运临本支之位：木卯、火午、土四维、金酉、水子。 */

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

/** 按北京时间大寒交节瞬时确定当前运气年度的公历年份标签。 */
export function getWuyunLiuqiYearAt(date: Date): number {
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) throw new Error('运气年度时间必须是有效日期。');
  const year = beijingCivilDateAt(timestamp).year;
  if (year < 1900 || year > 2200) {
    throw new Error('按大寒交节确定运气年度仅支持北京时间 1900-2200 年。');
  }
  return timestamp < solarTermBoundary(year, '大寒').timestamp ? year - 1 : year;
}

function resolveYearInput(input: WuyunLiuqiInput): WuyunLiuqiCalculation['input'] {
  const { year: inputYear, yearGanZhi: inputYearGanZhi } = input;
  const hasYear = inputYear !== undefined;
  const hasGanZhi = inputYearGanZhi !== undefined;
  if (!hasYear && !hasGanZhi) {
    throw new Error('必须提供 year 或 yearGanZhi。');
  }

  const year = hasYear ? normalizeYear(inputYear as number) : undefined;
  if (inputYearGanZhi !== undefined) {
    const yearGanZhi = inputYearGanZhi.trim();
    assertValidGanZhi(yearGanZhi, '年干支');
    if (year !== undefined) {
      const derived = getWuyunLiuqiYearGanZhi(year);
      if (derived !== yearGanZhi) {
        throw new Error(`year 与 yearGanZhi 不一致：${year} 年年中为 ${derived}。`);
      }
    }
    return { year, yearGanZhi, yearGanZhiSource: '明确年干支' };
  }

  const yearGanZhi = getWuyunLiuqiYearGanZhi(year as number);
  return { year, yearGanZhi, yearGanZhiSource: '公历年年中换算' };
}

function profile(name: LiuqiName): LiuqiProfile {
  return getQiProfile(name);
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
  host: LiuqiProfile,
  guest: LiuqiProfile,
): LiuqiStep['hostGuestRelation'] {
  const hostElement = host.element;
  const guestElement = guest.element;
  if (hostElement === guestElement) {
    if (host.qi === '相火' && guest.qi === '君火') {
      return {
        kind: '同气',
        fireOrder: '君位臣则顺',
        basis: '客气君火加临主气相火，二火同属火；君位臣则顺。',
      };
    }
    if (host.qi === '君火' && guest.qi === '相火') {
      return {
        kind: '同气',
        fireOrder: '臣位君则逆',
        basis: '客气相火加临主气君火，二火同属火；臣位君则逆。',
      };
    }
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
function buildMovementSteps(annualMovement: AnnualMovement, year?: number): WuyunMovementStep[] {
  const annualIndex = CANONICAL_HOST_MOVEMENT_ORDER.indexOf(annualMovement.element);
  if (annualIndex < 0) throw new Error(`中运五行数据缺失：${annualMovement.element}`);

  const annualToneStrength = annualMovement.toneStrength;
  const oppositeToneStrength: WuyunToneStrength = annualToneStrength === '太' ? '少' : '太';
  const hostMovements = CANONICAL_HOST_MOVEMENT_ORDER.map((element, index) =>
    movementProfile(
      element,
      mod(index - annualIndex, 2) === 0 ? annualToneStrength : oppositeToneStrength,
    ),
  );
  const steps: WuyunMovementStep[] = MOVEMENT_STEP_LABELS.map((label, index) => {
    const boundary = CANONICAL_MOVEMENT_STEP_BOUNDARIES[index];
    const guestElement = CANONICAL_HOST_MOVEMENT_ORDER[mod(annualIndex + index, 5)];
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
    } satisfies WuyunMovementStep;
  });

  if (year !== undefined) {
    const starts = steps.map((step) =>
      addCivilDays(
        solarTermCivilDate(year, step.startBoundary.solarTerm),
        step.startBoundary.offsetDays,
      ),
    );
    const nextYearStart = addCivilDays(solarTermCivilDate(year + 1, '大寒'), 0);
    for (let index = 0; index < steps.length; index += 1) {
      const start = starts[index];
      const end = addCivilDays(index + 1 < starts.length ? starts[index + 1] : nextYearStart, -1);
      steps[index].gregorianStart = formatCivilDate(start);
      steps[index].gregorianEnd = formatCivilDate(end);
    }
  }

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
  const suihuiBranchElement = getSuihuiBranchElement(branch);
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

function buildQiSteps(sitianName: LiuqiName, year?: number): LiuqiStep[] {
  const sitianIndex = CANONICAL_GUEST_QI_ORDER.indexOf(sitianName);
  if (sitianIndex < 0) throw new Error(`司天气序数据缺失：${sitianName}`);

  const steps: LiuqiStep[] = QI_STEP_LABELS.map((label, index) => {
    const guestName = CANONICAL_GUEST_QI_ORDER[mod(sitianIndex + index - 2, 6)];
    const hostQi = profile(CANONICAL_HOST_QI_ORDER[index]);
    const guestQi = profile(guestName);
    return {
      order: index + 1,
      label,
      solarTerms: [...CANONICAL_QI_STEP_SOLAR_TERMS[index]],
      hostQi,
      guestQi,
      hostGuestRelation: buildHostGuestRelation(hostQi, guestQi),
      guestRole: index === 2 ? ('司天' as const) : index === 5 ? ('在泉' as const) : undefined,
    } satisfies LiuqiStep;
  });
  if (year !== undefined) {
    const starts = steps.map((step) => solarTermBoundary(year, step.solarTerms[0]));
    const nextYearStart = solarTermBoundary(year + 1, '大寒');
    for (let index = 0; index < steps.length; index += 1) {
      const start = starts[index];
      const next = index + 1 < starts.length ? starts[index + 1] : nextYearStart;
      steps[index].gregorianStart = formatCivilDate(start.date);
      steps[index].gregorianEnd = formatCivilDate(beijingCivilDateAt(next.timestamp - 1));
      steps[index].boundaryTime = {
        startTimestamp: start.timestamp,
        endTimestampExclusive: next.timestamp,
        startBeijing: start.beijing,
        endBeijingExclusive: next.beijing,
      };
    }
  }
  return steps;
}

function normalizeQuestion(question?: string): string | undefined {
  if (question === undefined) return undefined;
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('问题必须是非空字符串。');
  }
  return question.trim();
}

function formatElementDirection(
  firstName: string,
  firstElement: WuyunElement,
  secondName: string,
  secondElement: WuyunElement,
): string {
  const first = `${firstName}（${firstElement}）`;
  const second = `${secondName}（${secondElement}）`;
  if (firstElement === secondElement) return `${first}与${second}同气`;
  if (isSheng(firstElement, secondElement)) return `${first}生${second}，${second}泄${first}`;
  if (isSheng(secondElement, firstElement)) return `${second}生${first}，${first}泄${second}`;
  return isKe(firstElement, secondElement) ? `${first}克${second}` : `${second}克${first}`;
}

function buildAnnualMovement(yearGanZhi: string): AnnualMovement {
  const stem = yearGanZhi[0];
  const movement = getStemMovement(stem);
  return {
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
}

function buildAnnualClassification(
  yearGanZhi: string,
): WuyunLiuqiCalculation['annualClassification'] {
  return {
    sitianTransformation: '寅午未酉戌亥'.includes(yearGanZhi[1]) ? '正化' : '对化',
    governance: yearGanZhi[0] === '甲' || yearGanZhi[0] === '己' ? '南政' : '北政',
    basis: [
      '司天正对化按年支区分：寅午未酉戌亥为正化，子丑卯辰巳申为对化。',
      '南北政按年干所化中运区分：甲己土运为南政，其余四运为北政。',
    ],
  };
}

/** 按选定年干支核对年度及分步资料，不重排公历交节。 */
export function assertWuyunLiuqiFacts(result: WuyunLiuqiCalculation): void {
  const { yearGanZhi } = resolveYearInput(result.input);
  const movement = buildAnnualMovement(yearGanZhi);
  if (
    (
      [
        'stem',
        'element',
        'name',
        'tone',
        'toneStrength',
        'toneName',
        'yinYang',
        'strength',
      ] as const
    ).some((key) => result.annualMovement[key] !== movement[key])
  )
    throw new Error('岁运资料与年干支不一致。');
  const pair = getBranchSitianZaiquan(yearGanZhi[1]);
  const sitian = profile(pair[0]),
    zaiquan = profile(pair[1]);
  for (const [actual, expected] of [
    [result.sitian, sitian],
    [result.zaiquan, zaiquan],
  ]) {
    if (
      (['name', 'phase', 'qi', 'element'] as const).some((key) => actual[key] !== expected[key])
    ) {
      throw new Error('司天在泉资料与年干支不一致。');
    }
  }
  const annualRelation = buildAnnualRelation(movement.element, sitian.element);
  if (
    (['kind', 'movementElement', 'sitianElement'] as const).some(
      (key) => result.annualRelation[key] !== annualRelation[key],
    )
  ) {
    throw new Error('年度气运关系与岁运、司天不一致。');
  }
  const classification = buildAnnualClassification(yearGanZhi);
  if (
    result.annualClassification.sitianTransformation !== classification.sitianTransformation ||
    result.annualClassification.governance !== classification.governance
  ) {
    throw new Error('司天化令与南北政资料不一致。');
  }
  const conformities = buildAnnualConformities(yearGanZhi, movement, sitian, zaiquan);
  if (
    (['tianfu', 'suihui', 'taiyiTianfu', 'tongTianfu', 'tongSuihui'] as const).some(
      (key) => result.annualConformities[key] !== conformities[key],
    ) ||
    result.annualConformities.names.length !== conformities.names.length ||
    conformities.names.some((name) => !result.annualConformities.names.includes(name))
  )
    throw new Error('年度符会资料与年干支不一致。');
  const movements = buildMovementSteps(movement);
  if (result.movementSteps.length !== movements.length) throw new Error('五步主客运资料不完整。');
  for (const [index, expected] of movements.entries()) {
    const actual = result.movementSteps[index];
    if (
      actual.order !== expected.order ||
      actual.label !== expected.label ||
      actual.periodRule !== expected.periodRule ||
      actual.guestRole !== expected.guestRole ||
      actual.hostGuestRelation.kind !== expected.hostGuestRelation.kind
    ) {
      throw new Error('五步主客运位置或关系与岁运不一致。');
    }
    for (const [actualProfile, expectedProfile] of [
      [actual.hostMovement, expected.hostMovement],
      [actual.guestMovement, expected.guestMovement],
    ]) {
      if (
        (['element', 'tone', 'toneStrength', 'toneName', 'strength', 'climateQi'] as const).some(
          (key) => actualProfile[key] !== expectedProfile[key],
        )
      ) {
        throw new Error('五步主客运属性与岁运不一致。');
      }
    }
  }
  const qiSteps = buildQiSteps(sitian.name);
  if (result.qiSteps.length !== qiSteps.length) throw new Error('六步主客气资料不完整。');
  for (const [index, expected] of qiSteps.entries()) {
    const actual = result.qiSteps[index];
    if (
      actual.order !== expected.order ||
      actual.label !== expected.label ||
      actual.guestRole !== expected.guestRole ||
      actual.solarTerms.length !== expected.solarTerms.length ||
      actual.solarTerms.some((term, at) => term !== expected.solarTerms[at]) ||
      actual.hostGuestRelation.kind !== expected.hostGuestRelation.kind ||
      actual.hostGuestRelation.fireOrder !== expected.hostGuestRelation.fireOrder
    ) {
      throw new Error('六步主客气位置或关系与司天在泉不一致。');
    }
    for (const [actualProfile, expectedProfile] of [
      [actual.hostQi, expected.hostQi],
      [actual.guestQi, expected.guestQi],
    ]) {
      if (
        (['name', 'phase', 'qi', 'element'] as const).some(
          (key) => actualProfile[key] !== expectedProfile[key],
        )
      ) {
        throw new Error('六步主客气属性与司天在泉不一致。');
      }
    }
  }
  if (result.pathomechanism) {
    const expected = evaluateWuyunLiuqiPathomechanism({
      annualMovement: movement,
      sitian,
      yearGanZhi,
      annualConformities: conformities,
    });
    if (
      result.pathomechanism.summary !== expected.summary ||
      result.pathomechanism.isPingQi !== null ||
      result.pathomechanism.classicalReference.conditionEstablished !== null
    ) {
      throw new Error('平气及岁运纪资料与年度条件不一致。');
    }
  }
}

export function formatWuyunLiuqiFacts(result: WuyunLiuqiCalculation): string {
  assertWuyunLiuqiFacts(result);
  const year = result.input.year;
  const calendarYear = year !== undefined && year >= 1900 && year <= 2199 ? year : undefined;
  const movementDates =
    calendarYear === undefined
      ? undefined
      : buildMovementSteps(result.annualMovement, calendarYear);
  const qiDates =
    calendarYear === undefined ? undefined : buildQiSteps(result.sitian.name, calendarYear);
  const firstQiBoundary = result.qiSteps[0]?.boundaryTime && qiDates?.[0].boundaryTime;
  const lastQiBoundary = result.qiSteps.at(-1)?.boundaryTime && qiDates?.at(-1)?.boundaryTime;
  const annualPeriod =
    firstQiBoundary && lastQiBoundary
      ? `${firstQiBoundary.startBeijing}大寒节令起，至${lastQiBoundary.endBeijingExclusive}次年大寒节令前（北京时间，按现代节气交节时刻标示）`
      : '大寒节令起，至次年大寒节令前';
  return [
    `年干支：${result.input.yearGanZhi}${result.input.year === undefined ? '' : `（公历 ${result.input.year} 年对应的运气年度）`}`,
    `运气年度：${annualPeriod}`,
    `岁运：${result.annualMovement.name}（${result.annualMovement.toneName}），${result.annualMovement.strength}（${result.annualMovement.yinYang}干）`,
    `司天：${result.sitian.name}`,
    `在泉：${result.zaiquan.name}`,
    `司天化令：${result.annualClassification.sitianTransformation}；南北政：${result.annualClassification.governance}`,
    `年度五行作用：${formatElementDirection('中运', result.annualMovement.element, `司天${result.sitian.name}`, result.sitian.element)}${result.annualRelation.kind === '同气' ? '' : `（${result.annualRelation.kind}）`}；${formatElementDirection('中运', result.annualMovement.element, `在泉${result.zaiquan.name}`, result.zaiquan.element)}；${formatElementDirection(`司天${result.sitian.name}`, result.sitian.element, `在泉${result.zaiquan.name}`, result.zaiquan.element)}`,
    ...(result.annualConformities.names.length
      ? [`年度符会：${result.annualConformities.names.join('、')}`]
      : []),
    result.pathomechanism
      ? result.pathomechanism.summary
      : evaluateWuyunLiuqiPathomechanism({
          annualMovement: result.annualMovement,
          sitian: result.sitian,
          yearGanZhi: result.input.yearGanZhi,
          annualConformities: result.annualConformities,
        }).summary,
    '五步主客运：',
    ...result.movementSteps.map((step, index) => {
      const canonicalDates = movementDates?.[index];
      const dates =
        step.gregorianStart && step.gregorianEnd && canonicalDates
          ? `；公历${canonicalDates.gregorianStart}至${canonicalDates.gregorianEnd}`
          : '';
      return `${step.order}. ${step.label}（${step.periodRule}${dates}）：主运${step.hostMovement.toneName}（${step.hostMovement.element}）；客运${step.guestMovement.toneName}（${step.guestMovement.element}）${step.guestRole ? `（${step.guestRole}）` : ''}；主客关系${step.hostGuestRelation.kind}${step.hostGuestRelation.kind === '同气' ? '' : `（${formatElementDirection(`主运${step.hostMovement.toneName}`, step.hostMovement.element, `客运${step.guestMovement.toneName}`, step.guestMovement.element)}）`}`;
    }),
    '六步主客气：',
    ...result.qiSteps.map((step, index) => {
      const boundary = step.boundaryTime && qiDates?.[index].boundaryTime;
      const dates = boundary
        ? `；现代节气交节参考（北京时间）${boundary.startBeijing}至${boundary.endBeijingExclusive}前`
        : '';
      return `${step.order}. ${step.label}（${step.solarTerms.join('、')}${dates}）：主气${step.hostQi.name}；客气${step.guestQi.name}${step.guestRole ? `（${step.guestRole}）` : ''}；主客关系${step.hostGuestRelation.kind}${step.hostGuestRelation.kind === '同气' ? '' : `（${formatElementDirection(`主气${step.hostQi.name}`, step.hostQi.element, `客气${step.guestQi.name}`, step.guestQi.element)}）`}${step.hostGuestRelation.fireOrder ? `；二火加临：${step.hostGuestRelation.fireOrder}` : ''}`;
    }),
  ].join('\n');
}

export function buildWuyunLiuqiPrompt(
  result: WuyunLiuqiCalculation,
  question?: string,
  schools?: readonly PromptSchoolId<'wuyun-liuqi'>[],
  selection?: PromptSelection,
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const sections: string[] = [
    '【传统依据】\n以年干定岁运太过不及，以年支定司天在泉，再看五步主客运与六步主客气的阶段关系。',
    `【盘面资料】\n${formatWuyunLiuqiFacts(result)}`,
  ];
  const task = buildPromptTask(
    normalizedQuestion ? '请结合年度运气资料回答【问题】。' : '请解读年度运气节律。',
    'wuyun-liuqi',
  );
  if (selection) {
    sections.push(`【解读选择】\n${getPromptSelectionSection(selection)}`);
  }
  sections.push(`【任务】\n${selection ? buildPromptSelectionTask(task, selection) : task}`);
  if (normalizedQuestion) {
    sections.push(`【问题】\n${normalizedQuestion}`);
  }
  return insertPromptSectionBeforeHeading(
    sections.join('\n\n'),
    '【问题】',
    buildPromptSchoolSection('wuyun-liuqi', schools),
  );
}

export function calculateWuyunLiuqi(input: WuyunLiuqiInput): WuyunLiuqiResult {
  if (!input || typeof input !== 'object') throw new Error('五运六气输入不能为空。');
  const resolved = resolveYearInput(input);
  const stem = resolved.yearGanZhi[0];
  const branch = resolved.yearGanZhi[1];
  const pair = getBranchSitianZaiquan(branch);
  const annualMovement = buildAnnualMovement(resolved.yearGanZhi);
  const sitian = profile(pair[0]);
  const zaiquan = profile(pair[1]);
  // 全年末步延续至下一年大寒，公历日期因此最多支持到 2199 年。
  const calendarYear =
    resolved.year !== undefined && resolved.year >= 1900 && resolved.year <= 2199
      ? resolved.year
      : undefined;
  const movementSteps = buildMovementSteps(annualMovement, calendarYear);
  const qiSteps = buildQiSteps(pair[0], calendarYear);
  if (qiSteps[2].guestQi.name !== sitian.name || qiSteps[5].guestQi.name !== zaiquan.name) {
    throw new Error(`客气轮转与司天在泉不一致：${resolved.yearGanZhi}`);
  }
  const annualRelation = buildAnnualRelation(annualMovement.element, sitian.element);
  const annualClassification = buildAnnualClassification(resolved.yearGanZhi);
  const annualConformities = buildAnnualConformities(
    resolved.yearGanZhi,
    annualMovement,
    sitian,
    zaiquan,
  );

  const pathomechanism = evaluateWuyunLiuqiPathomechanism({
    annualMovement,
    sitian,
    yearGanZhi: resolved.yearGanZhi,
    annualConformities,
  });

  const calculation: WuyunLiuqiCalculation = {
    input: resolved,
    calendarDateStatus: calendarYear === undefined ? '节令边界' : '公历日期已换算',
    annualMovement,
    sitian,
    zaiquan,
    annualRelation,
    annualClassification,
    annualConformities,
    movementSteps,
    qiSteps,
    pathomechanism,
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
    sources: CANONICAL_WUYUN_LIUQI_SOURCES.map((source) => ({ ...source })),
    limitations: [
      '公历交司日期支持1900—2199年；其他年份按节气和传统序日表达五步、六步边界。',
      '五步交司按《运气要诀》所列传统日期序号表达，不把“节气后第几日”换算成现代精确到时分秒的交运时刻。',
      '六步主客气依《运气要诀》按节令分段；北京时间秒级数值为现代节气交节参考，并非传统六气交司时刻。',
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
  getWuyunLiuqiYearAt,
  calculateWuyunLiuqi,
  buildWuyunLiuqiPrompt,
};
