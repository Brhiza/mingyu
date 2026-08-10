/**
 * @file 八宅风水（BaZhai）
 * @description 以命卦（东四/西四命）与宅卦配合，排八宅大游年四吉四凶方。
 * 复用 bazi.calculateMingGua 与 direction 模块，返回结构化结果与提示词。
 * @古籍依据 《八宅明镜》《阳宅十书》
 */
import { calculateMingGua } from '../bazi/mingGua';
import { daysInGregorianMonth } from '../calendar/date-validation';
import { getGanZhiFromDate } from '../ganzhi';
import {
  getHouseTrigram,
  getEightMansion,
  getEastWestGroup,
  getBaZhaiPalace,
  getSitFacingFromFacingDegree,
  type BaZhaiPalace,
  type SitFacingPosition,
} from '../direction';
import { analyzeBaZhaiEvidence } from './evidence';

export { analyzeBaZhaiEvidence } from './evidence';
export type {
  BaZhaiCalculationFact,
  BaZhaiCalculationStep,
  BaZhaiCounterEvidenceFact,
  BaZhaiCounterSummaryFact,
  BaZhaiDirectionComparison,
  BaZhaiDirectionFact,
  BaZhaiEvidenceAnalysis,
  BaZhaiLimitationFact,
  BaZhaiMeasurementCandidateFact,
  BaZhaiMeasurementFact,
} from './evidence';

export interface BaZhaiInput {
  /** 出生公历年份（用于推命卦；已按立春换年处理） */
  birthYear?: number;
  /** 出生公历月日，用于准确处理立春换年。 */
  birthMonth?: number;
  birthDay?: number;
  /** 性别 */
  gender?: 'male' | 'female';
  /** 也可直接给定命卦（坎坤震巽乾兑艮离） */
  mingGua?: string;
  /** 坐山（二十四山，如「子」），用于推宅卦 */
  sitMountain?: string;
}

export interface BaZhaiResult {
  calculationInput: {
    mingGuaSource: '出生年与性别计算' | '直接给定';
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    gender?: 'male' | 'female';
    directMingGua?: string;
    sitMountain?: string;
  };
  mingGua: string;
  effectiveBirthYear: number | null;
  birthYearBoundaryNote: string;
  mingGroup: '东四命' | '西四命';
  houseGua: string | null;
  houseGroup: '东四命' | '西四命' | null;
  /** 命卦大游年盘 */
  mingPalace: BaZhaiPalace[];
  /** 宅卦大游年盘（若有坐山） */
  housePalace: BaZhaiPalace[] | null;
  /** 命宅配合 */
  match: '相合' | '相冲' | '未知';
  matchAdvice: string;
  luckyDirections: BaZhaiPalace[];
  unluckyDirections: BaZhaiPalace[];
  evidenceAnalysis: import('./evidence').BaZhaiEvidenceAnalysis;
  prompt: string;
}

/** 从大门处面向屋内测量的八宅便捷入参。 */
export interface BaZhaiDoorDegreeInput extends Omit<BaZhaiInput, 'sitMountain'> {
  /** 站在大门处面向屋内时的指南针读数，正北为 0°，顺时针增加。 */
  doorToInteriorDegree: number;
  /** 读数采用的北向基准；未声明时只按原始罗盘读数计算并提示核验。 */
  northReference?: 'unspecified' | 'magnetic' | 'true';
  /** 当读数基于磁北时使用，东偏为正、西偏为负。 */
  magneticDeclinationDegrees?: number;
  /** 测量可能误差，单位为度；用于判断是否跨越二十四山边界。 */
  measurementUncertaintyDegrees?: number;
}

export type BaZhaiMeasurementStability = '稳定' | '山向边界敏感' | '宅卦不稳定';

export interface BaZhaiDirectionCandidate {
  sitMountain: string;
  facingMountain: string;
  label: string;
  houseGua: string;
  houseGroup: '东四命' | '西四命';
  match: '相合' | '相冲';
  housePalace: BaZhaiPalace[];
}

/** 入户测量读数换算成传统坐山朝向后的完整资料。 */
export interface BaZhaiDoorMeasurement {
  method: '站在大门处面向屋内测量';
  measuredDegree: number;
  northReference: 'unspecified' | 'magnetic' | 'true';
  magneticDeclinationDegrees: number | null;
  /** 换算至真北基准后的入户方向；未声明北向时等同原始读数。 */
  trueNorthDegree: number;
  measurementUncertaintyDegrees: number;
  nearestBoundaryDistanceDegrees: number;
  stability: BaZhaiMeasurementStability;
  candidateDirections: BaZhaiDirectionCandidate[];
  warnings: string[];
  facingDegree: number;
  facingMountain: string;
  sitDegree: number;
  sitMountain: string;
  label: string;
  promptText: string;
}

export interface BaZhaiDoorDegreeResult extends BaZhaiResult {
  directionMeasurement: BaZhaiDoorMeasurement;
}

/**
 * 将“从大门面向屋内”的指南针读数换算为八宅传统坐山朝向。
 * 例如读数 0° 表示从大门向屋内看正北，对应子山午向。
 */
export function getBaZhaiSitFacingFromDoorDegree(doorToInteriorDegree: number): SitFacingPosition {
  if (
    typeof doorToInteriorDegree !== 'number' ||
    !Number.isFinite(doorToInteriorDegree) ||
    doorToInteriorDegree < 0 ||
    doorToInteriorDegree > 360
  ) {
    throw new Error('大门朝向屋内的度数必须是 0-360 之间的有限数字。');
  }
  return getSitFacingFromFacingDegree((doorToInteriorDegree + 180) % 360);
}

function normalizeDegree(degree: number) {
  return ((degree % 360) + 360) % 360;
}

function circularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return Math.min(diff, 360 - diff);
}

function nearestMountainBoundaryDistance(degree: number) {
  let minimum = 180;
  for (let index = 0; index < 24; index += 1) {
    minimum = Math.min(minimum, circularDistance(degree, 7.5 + index * 15));
  }
  return minimum;
}

function resolveDoorMeasurement(input: BaZhaiDoorDegreeInput) {
  if (
    typeof input.doorToInteriorDegree !== 'number' ||
    !Number.isFinite(input.doorToInteriorDegree) ||
    input.doorToInteriorDegree < 0 ||
    input.doorToInteriorDegree > 360
  ) {
    throw new Error('大门朝向屋内的度数必须是 0-360 之间的有限数字。');
  }
  const reference = input.northReference ?? 'unspecified';
  const declination = input.magneticDeclinationDegrees;
  const uncertainty = input.measurementUncertaintyDegrees ?? 0;
  if (!['unspecified', 'magnetic', 'true'].includes(reference)) {
    throw new Error('northReference 只能是 unspecified、magnetic 或 true。');
  }
  if (!Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 45) {
    throw new Error('测量误差必须是 0-45 之间的有限数字。');
  }
  if (
    declination !== undefined &&
    (!Number.isFinite(declination) || declination < -30 || declination > 30)
  ) {
    throw new Error('磁偏角必须是 -30 至 30 之间的有限数字，东偏为正、西偏为负。');
  }
  if (reference === 'magnetic' && declination === undefined) {
    throw new Error('读数采用磁北时必须提供当地磁偏角。');
  }
  if (reference !== 'magnetic' && declination !== undefined) {
    throw new Error('只有 northReference 为 magnetic 时才应提供磁偏角。');
  }
  const trueNorthDegree = normalizeDegree(
    input.doorToInteriorDegree + (reference === 'magnetic' ? declination! : 0),
  );
  const candidateDirections: Array<
    Pick<BaZhaiDirectionCandidate, 'sitMountain' | 'facingMountain' | 'label' | 'houseGua'>
  > = [];
  for (let index = 0; index < 24; index += 1) {
    const center = index * 15;
    if (circularDistance(trueNorthDegree, center) > uncertainty + 7.5 + Number.EPSILON * 32) {
      continue;
    }
    const position = getSitFacingFromFacingDegree(normalizeDegree(center + 180));
    candidateDirections.push({
      sitMountain: position.sit.mountain,
      facingMountain: position.facing.mountain,
      label: position.label,
      houseGua: getHouseTrigram(position.sit.mountain),
    });
  }
  const houseGuas = new Set(candidateDirections.map((item) => item.houseGua));
  const stability: BaZhaiMeasurementStability =
    houseGuas.size > 1 ? '宅卦不稳定' : candidateDirections.length > 1 ? '山向边界敏感' : '稳定';
  const warnings = [
    ...(reference === 'unspecified'
      ? ['未声明读数基于磁北还是真北；若设备显示磁北，应补充当地磁偏角后复核']
      : []),
    ...(stability === '山向边界敏感'
      ? ['测量误差范围跨越二十四山边界，但候选山向仍属于同一宅卦']
      : []),
    ...(stability === '宅卦不稳定'
      ? ['测量误差范围跨越宅卦边界，不能只采用单一八宅盘，应重新测量或并列比较候选盘']
      : []),
  ];
  return {
    reference,
    declination: declination ?? null,
    uncertainty,
    trueNorthDegree,
    nearestBoundaryDistanceDegrees: nearestMountainBoundaryDistance(trueNorthDegree),
    stability,
    candidateDirections,
    warnings,
  };
}

function resolveEffectiveBirthYear(input: BaZhaiInput): {
  year: number;
  note: string;
} {
  if (!Number.isSafeInteger(input.birthYear) || input.birthYear! < 1 || input.birthYear! > 9999) {
    throw new Error('出生年份必须是 1-9999 之间的整数。');
  }
  const year = input.birthYear!;
  const hasMonth = input.birthMonth !== undefined;
  const hasDay = input.birthDay !== undefined;
  if (hasMonth !== hasDay) throw new Error('八宅立春换年需同时提供出生月和出生日。');
  if (!hasMonth || !hasDay) {
    return {
      year,
      note: `出生年份：${year}年，未提供月日，按 ${year} 年推命卦。`,
    };
  }
  const month = input.birthMonth!;
  const day = input.birthDay!;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('出生月份需在 1-12 之间。');
  }
  const maxDay = daysInGregorianMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new Error(`出生日期需在 1-${maxDay} 之间。`);
  }
  const birthGanZhiYear = getGanZhiFromDate(new Date(year, month - 1, day, 12, 0, 0)).year;
  const currentGanZhiYear = getGanZhiFromDate(new Date(year, 6, 1, 12, 0, 0)).year;
  const effectiveYear = birthGanZhiYear === currentGanZhiYear ? year : year - 1;
  return {
    year: effectiveYear,
    note:
      effectiveYear === year
        ? `出生日期已过 ${year} 年立春，命卦按 ${year} 年计算。`
        : `出生日期在 ${year} 年立春前，命卦按 ${effectiveYear} 年计算。`,
  };
}

function resolveMingGua(input: BaZhaiInput): {
  gua: string;
  effectiveBirthYear: number | null;
  note: string;
} {
  if (input.mingGua) {
    return { gua: input.mingGua, effectiveBirthYear: null, note: '本次直接使用已给定的命卦。' };
  }
  if (input.birthYear != null && input.gender) {
    const resolved = resolveEffectiveBirthYear(input);
    return {
      gua: calculateMingGua(resolved.year, input.gender).gua,
      effectiveBirthYear: resolved.year,
      note: resolved.note,
    };
  }
  throw new Error('需提供 birthYear+gender 或直接给定 mingGua。');
}

function buildPrompt(r: Omit<BaZhaiResult, 'prompt'>): string {
  const lines: string[] = [];
  lines.push('【八宅风水排盘】');
  lines.push(`命卦：${r.mingGua}（${r.mingGroup}）`);
  lines.push(`立春年界：${r.birthYearBoundaryNote}`);
  if (r.houseGua) {
    lines.push(`宅卦：${r.houseGua}（${r.houseGroup}）`);
    lines.push(`命宅配合：${r.match}`);
  }
  lines.push(`四吉方：${r.luckyDirections.map((p) => `${p.direction}(${p.label})`).join('、')}`);
  lines.push(`四凶方：${r.unluckyDirections.map((p) => `${p.direction}(${p.label})`).join('、')}`);
  return lines.join('\n');
}

/** 八宅风水分析 */
export function analyzeBaZhai(input: BaZhaiInput): BaZhaiResult {
  const resolvedMingGua = resolveMingGua(input);
  const mingGua = resolvedMingGua.gua;
  const mingGroup = getEastWestGroup(mingGua);
  const mingMansion = getEightMansion(mingGua);
  const mingPalace = mingMansion.lucky
    .concat(mingMansion.unlucky)
    .sort((a, b) => a.degree - b.degree);

  let houseGua: string | null = null;
  let houseGroup: '东四命' | '西四命' | null = null;
  let housePalace: BaZhaiPalace[] | null = null;
  let match: BaZhaiResult['match'] = '未知';
  let matchAdvice = '';

  if (input.sitMountain) {
    houseGua = getHouseTrigram(input.sitMountain);
    houseGroup = getEastWestGroup(houseGua);
    housePalace = getBaZhaiPalace(houseGua);
    if (houseGroup === mingGroup) {
      match = '相合';
      matchAdvice = `命卦与宅卦同属${mingGroup}，东四命配东四宅/西四命配西四宅为"命宅相合"，吉方可尽量重合利用。`;
    } else {
      match = '相冲';
      matchAdvice = `命卦属${mingGroup}、宅卦属${houseGroup}，命宅不同组（东四命住西四宅或反之），应以命卦吉方为主、宅卦为辅调和。`;
    }
  }

  const resultBase: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'> = {
    calculationInput: {
      mingGuaSource: input.mingGua ? '直接给定' : '出生年与性别计算',
      ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
      ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
      ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.mingGua ? { directMingGua: input.mingGua } : {}),
      ...(input.sitMountain ? { sitMountain: input.sitMountain } : {}),
    },
    mingGua,
    effectiveBirthYear: resolvedMingGua.effectiveBirthYear,
    birthYearBoundaryNote: resolvedMingGua.note,
    mingGroup,
    houseGua,
    houseGroup,
    mingPalace,
    housePalace,
    match,
    matchAdvice,
    luckyDirections: mingMansion.lucky,
    unluckyDirections: mingMansion.unlucky,
  };
  const evidenceAnalysis = analyzeBaZhaiEvidence(resultBase);
  const result: Omit<BaZhaiResult, 'prompt'> = { ...resultBase, evidenceAnalysis };
  return { ...result, prompt: buildPrompt(result) };
}

/**
 * 直接使用“从大门面向屋内”的指南针读数生成完整八宅结果。
 * 调用方无需自行换算相反方向或二十四山。
 */
export function analyzeBaZhaiByDoorDegree(input: BaZhaiDoorDegreeInput): BaZhaiDoorDegreeResult {
  const {
    doorToInteriorDegree,
    northReference: _northReference,
    magneticDeclinationDegrees: _magneticDeclinationDegrees,
    measurementUncertaintyDegrees: _measurementUncertaintyDegrees,
    ...birthInput
  } = input;
  const measurement = resolveDoorMeasurement(input);
  const { facing, sit, label } = getBaZhaiSitFacingFromDoorDegree(measurement.trueNorthDegree);
  if (facing.isBoundary && measurement.uncertainty === 0) {
    const boundary = facing.boundaryMountains?.join('向与') ?? '两个二十四山';
    throw new Error(`当前度数正好位于${boundary}向的分界线，请重新测量。`);
  }
  const result = analyzeBaZhai({ ...birthInput, sitMountain: sit.mountain });
  const candidateDirections: BaZhaiDirectionCandidate[] = measurement.candidateDirections.map(
    (item) => {
      const houseGroup = getEastWestGroup(item.houseGua);
      return {
        ...item,
        houseGroup,
        match: houseGroup === result.mingGroup ? '相合' : '相冲',
        housePalace: getBaZhaiPalace(item.houseGua),
      };
    },
  );
  const directionMeasurement: BaZhaiDoorMeasurement = {
    method: '站在大门处面向屋内测量',
    measuredDegree: doorToInteriorDegree,
    northReference: measurement.reference,
    magneticDeclinationDegrees: measurement.declination,
    trueNorthDegree: measurement.trueNorthDegree,
    measurementUncertaintyDegrees: measurement.uncertainty,
    nearestBoundaryDistanceDegrees: measurement.nearestBoundaryDistanceDegrees,
    stability: measurement.stability,
    candidateDirections,
    warnings: measurement.warnings,
    facingDegree: facing.degree,
    facingMountain: facing.mountain,
    sitDegree: sit.degree,
    sitMountain: sit.mountain,
    label,
    promptText: [
      `测量方式：站在大门处面向屋内，指南针读数为 ${doorToInteriorDegree}°；北向基准为${measurement.reference === 'magnetic' ? `磁北，磁偏角 ${measurement.declination}°（东偏为正）` : measurement.reference === 'true' ? '真北' : '未声明'}。`,
      `真北口径入户方向为 ${measurement.trueNorthDegree}°，测量误差 ±${measurement.uncertainty}°。`,
      `中心读数换算后住宅坐山 ${sit.degree}° 为${sit.mountain}山，传统朝向 ${facing.degree}° 为${facing.mountain}向，结果为${label}。`,
      `误差候选：${candidateDirections.map((item) => `${item.label}（${item.houseGua}宅、${item.houseGroup}、命宅${item.match}）`).join('、')}。`,
      `测量稳定性为${measurement.stability}，候选坐向${candidateDirections.map((item) => item.label).join('、')}。`,
      ...(measurement.warnings.length
        ? [
            `测量边界：${measurement.warnings
              .map((warning) =>
                warning.includes('候选盘')
                  ? '测量误差范围跨越宅卦边界，并列候选盘'
                  : warning.includes('磁北')
                    ? '北向基准未声明，按原始读数处理'
                    : warning.includes('二十四山')
                      ? '测量误差范围跨越二十四山边界，候选山向仍属同一宅卦'
                      : warning,
              )
              .join('；')}`,
          ]
        : []),
      ...(measurement.stability === '宅卦不稳定'
        ? candidateDirections.map(
            (item) =>
              `- 候选${item.label}：${item.houseGua}宅八宫为${item.housePalace.map((palace) => `${palace.direction}${palace.label}`).join('、')}`,
          )
        : []),
    ]
      .filter(Boolean)
      .join('\n'),
  };
  const { prompt: _prompt, evidenceAnalysis: _evidenceAnalysis, ...resultFacts } = result;
  const evidenceAnalysis = analyzeBaZhaiEvidence(resultFacts, directionMeasurement);
  return {
    ...result,
    evidenceAnalysis,
    prompt: buildPrompt({ ...resultFacts, evidenceAnalysis }),
    directionMeasurement,
  };
}

export const bazhai = {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
};
