/**
 * @file 八宅风水（BaZhai）
 * @description 以命卦（东四/西四命）与宅卦配合，排八宅大游年四吉四凶方。
 * 复用 bazi.calculateMingGua 与 direction 模块，返回结构化结果与提示词。
 * @古籍依据 《八宅明镜》《阳宅十书》
 */
import { calculateMingGua } from '../bazi/mingGua';
import { SolarTerm } from 'tyme4ts';
import { createUtcTimestamp, daysInGregorianMonth } from '../calendar/date-validation';
import { formatFixedTimezoneOffset, resolveCivilTime } from '../calendar/civil-time';
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
import { evaluateBaZhaiRegulation, type BaZhaiGasRegulationResult } from './suppression';

export { analyzeBaZhaiEvidence } from './evidence';
export { evaluateBaZhaiRegulation } from './suppression';
export type { BaZhaiGasRegulationResult, BaZhaiSuppressionFact } from './suppression';
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
  /** 出生地民用时分秒；缺失分钟或秒数时按已知精度核对立春年界。 */
  birthHour?: number;
  birthMinute?: number;
  birthSecond?: number;
  /** 出生地相对 UTC 的小时偏移；未提供时按北京时间 UTC+8。 */
  birthTimezone?: number;
  /** 出生地 IANA 历史时区，例如 Asia/Shanghai。 */
  birthTimeZoneId?: string;
  /** 性别 */
  gender?: 'male' | 'female';
  /** 也可直接给定命卦（坎坤震巽乾兑艮离） */
  mingGua?: string;
  /** 坐山（二十四山，如「子」），用于推宅卦 */
  sitMountain?: string;
}

export type BaZhaiHouseGroup = '东四宅' | '西四宅';

function getHouseGroup(gua: string): BaZhaiHouseGroup {
  return getEastWestGroup(gua) === '东四命' ? '东四宅' : '西四宅';
}

export interface BaZhaiResult {
  calculationInput: {
    mingGuaSource: '出生年与性别计算' | '直接给定';
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    birthHour?: number;
    birthMinute?: number;
    birthSecond?: number;
    birthTimezone?: number;
    birthTimeZoneId?: string;
    gender?: 'male' | 'female';
    directMingGua?: string;
    sitMountain?: string;
  };
  mingGua: string;
  effectiveBirthYear: number | null;
  birthYearBoundaryStatus: '已核定' | '待复核' | '直接命卦';
  birthYearBoundaryNote: string;
  mingGroup: '东四命' | '西四命';
  houseGua: string | null;
  houseGroup: BaZhaiHouseGroup | null;
  /** 命卦大游年盘 */
  mingPalace: BaZhaiPalace[];
  /** 宅卦大游年盘（若有坐山） */
  housePalace: BaZhaiPalace[] | null;
  /** 命宅配合 */
  match: '相合' | '相冲' | '未知';
  matchAdvice: string;
  luckyDirections: BaZhaiPalace[];
  unluckyDirections: BaZhaiPalace[];
  gasRegulation?: BaZhaiGasRegulationResult;
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
  houseGroup: BaZhaiHouseGroup;
  match: '相合' | '相冲';
  housePalace: BaZhaiPalace[];
}

/** 入户测量读数换算成传统坐山朝向后的完整资料。 */
export interface BaZhaiDoorMeasurement {
  method: '站在大门处面向屋内测量' | '按住宅坐山度数换算';
  measuredDegree: number;
  northReference: 'unspecified' | 'magnetic' | 'true';
  magneticDeclinationDegrees: number | null;
  /** 按已声明北向基准换算的方向；未声明时保留原始读数作暂算值，并非已确认真北。 */
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
  status: '已核定' | '待复核';
} {
  if (!Number.isSafeInteger(input.birthYear) || input.birthYear! < 1 || input.birthYear! > 9999) {
    throw new Error('出生年份必须是 1-9999 之间的整数。');
  }
  const year = input.birthYear!;
  const hasMonth = input.birthMonth !== undefined;
  const hasDay = input.birthDay !== undefined;
  if (hasMonth !== hasDay) throw new Error('八宅立春换年需同时提供出生月和出生日。');
  if (input.birthHour === undefined && input.birthMinute !== undefined) {
    throw new Error('提供出生分钟时需同时提供出生小时。');
  }
  if (
    input.birthSecond !== undefined &&
    (input.birthHour === undefined || input.birthMinute === undefined)
  ) {
    throw new Error('提供出生秒数时需同时提供出生小时和分钟。');
  }
  if (input.birthHour === undefined && input.birthTimezone !== undefined) {
    throw new Error('提供出生时区时需同时提供出生小时。');
  }
  if (input.birthHour === undefined && input.birthTimeZoneId !== undefined) {
    throw new Error('提供出生历史时区时需同时提供出生小时。');
  }
  if (
    input.birthHour !== undefined &&
    (!Number.isInteger(input.birthHour) || input.birthHour < 0 || input.birthHour > 23)
  ) {
    throw new Error('出生小时需在 0-23 之间。');
  }
  if (
    input.birthMinute !== undefined &&
    (!Number.isInteger(input.birthMinute) || input.birthMinute < 0 || input.birthMinute > 59)
  ) {
    throw new Error('出生分钟需在 0-59 之间。');
  }
  if (
    input.birthSecond !== undefined &&
    (!Number.isInteger(input.birthSecond) || input.birthSecond < 0 || input.birthSecond > 59)
  ) {
    throw new Error('出生秒数需在 0-59 之间。');
  }
  if (
    input.birthTimezone !== undefined &&
    (!Number.isFinite(input.birthTimezone) || input.birthTimezone < -12 || input.birthTimezone > 14)
  ) {
    throw new Error('出生时区需在 UTC-12 至 UTC+14 之间。');
  }
  if (
    !hasMonth &&
    (input.birthHour !== undefined ||
      input.birthTimezone !== undefined ||
      input.birthTimeZoneId !== undefined)
  ) {
    throw new Error('提供出生时刻或时区时需同时提供出生月日。');
  }
  if (!hasMonth || !hasDay) {
    return {
      year,
      note: `出生年份：${year}年，未提供月日，按 ${year} 年推命卦。`,
      status: '待复核',
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
  // 完全缺少时刻时沿用北京时间正午口径；部分时刻按其可能区间核对立春。
  const lichun = SolarTerm.fromIndex(year, 3).getJulianDay().getSolarTime();
  const hasBirthTime = input.birthHour !== undefined;
  const resolveBirthTime = (minute: number, second: number) =>
    resolveCivilTime(
      {
        year,
        month,
        day,
        hour: input.birthHour!,
        minute,
        second,
        ...(input.birthTimezone !== undefined ? { timezone: input.birthTimezone } : {}),
        ...(input.birthTimeZoneId !== undefined ? { timeZoneId: input.birthTimeZoneId } : {}),
      },
      { defaultTimezone: 8 },
    );
  const birthTime = hasBirthTime
    ? resolveBirthTime(input.birthMinute ?? 0, input.birthSecond ?? 0)
    : null;
  const birthCivil =
    birthTime?.utcTimestamp ?? createUtcTimestamp(year, month - 1, day, 12) - 8 * 3_600_000;
  const lichunCivil =
    createUtcTimestamp(
      lichun.getYear(),
      lichun.getMonth() - 1,
      lichun.getDay(),
      lichun.getHour(),
      lichun.getMinute(),
      lichun.getSecond(),
    ) -
    8 * 3_600_000;
  const effectiveYear = birthCivil >= lichunCivil ? year : year - 1;
  const isLichunDate =
    year === lichun.getYear() && month === lichun.getMonth() && day === lichun.getDay();
  const possibleIntervalMillis = (input.birthMinute === undefined ? 3600 : 60) * 1000;
  const birthCivilLatest =
    hasBirthTime &&
    input.birthSecond === undefined &&
    birthCivil < lichunCivil &&
    lichunCivil - birthCivil < possibleIntervalMillis
      ? resolveBirthTime(input.birthMinute ?? 59, 59).utcTimestamp
      : null;
  const precisionCrossesLichun =
    birthCivilLatest !== null && birthCivil < lichunCivil && birthCivilLatest >= lichunCivil;
  return {
    year: effectiveYear,
    note:
      isLichunDate && !hasBirthTime
        ? `出生日期与 ${year} 年立春同日，未提供出生时刻；按当日正午与立春时刻比较，命卦暂按 ${effectiveYear === 0 ? '公元前1年（天文年0）' : `${effectiveYear} 年`}计算，年界待复核。`
        : precisionCrossesLichun
          ? `出生时刻精度不足：${input.birthMinute === undefined ? '仅提供出生小时' : '未提供出生秒数'}，该时段跨越 ${year} 年立春瞬时；命卦暂按时段起点所属的 ${effectiveYear === 0 ? '公元前1年（天文年0）' : `${effectiveYear} 年`}计算，年界待复核。`
          : isLichunDate
            ? `出生日期与 ${year} 年立春同日，已按出生${input.birthMinute === undefined ? '小时' : input.birthSecond === undefined ? '时分' : '时分秒'}（${birthTime?.timeZoneId ? `${birthTime.timeZoneId}，` : ''}UTC${formatFixedTimezoneOffset(birthTime!.timezone)}）与立春瞬时核定命卦年份为 ${effectiveYear} 年。`
            : effectiveYear === year
              ? `${hasBirthTime ? '出生时刻' : '出生日期'}已过 ${year} 年立春，命卦按 ${year} 年计算。`
              : `${hasBirthTime ? '出生时刻' : '出生日期'}在 ${year} 年立春前，命卦按 ${effectiveYear === 0 ? '公元前1年（天文年0）' : `${effectiveYear} 年`}计算。`,
    status: (isLichunDate && !hasBirthTime) || precisionCrossesLichun ? '待复核' : '已核定',
  };
}

function resolveMingGua(input: BaZhaiInput): {
  gua: string;
  effectiveBirthYear: number | null;
  status: BaZhaiResult['birthYearBoundaryStatus'];
  note: string;
} {
  if (input.mingGua !== undefined) {
    return {
      gua: input.mingGua,
      effectiveBirthYear: null,
      status: '直接命卦',
      note: '本次直接使用已给定的命卦。',
    };
  }
  if (input.birthYear != null && input.gender) {
    const resolved = resolveEffectiveBirthYear(input);
    const candidateYears = [input.birthYear - 1, input.birthYear];
    const candidateGuas = candidateYears.map((year) => calculateMingGua(year, input.gender!).gua);
    const candidateNote =
      resolved.status === '待复核'
        ? `候选命卦：${candidateYears.map((year, index) => `${year === 0 ? '公元前1年' : `${year}年`}${candidateGuas[index]}命`).join('、')}。`
        : '';
    return {
      gua: calculateMingGua(resolved.year, input.gender).gua,
      effectiveBirthYear: resolved.year,
      status: resolved.status,
      note: `${resolved.note}${candidateNote}`,
    };
  }
  throw new Error('需提供 birthYear+gender 或直接给定 mingGua。');
}

function formatBirthYearBasis(input: BaZhaiResult['calculationInput']): string {
  if (input.mingGuaSource === '直接给定') return '';
  const date = `${input.birthYear}年${
    input.birthMonth === undefined ? '（月日未提供）' : `${input.birthMonth}月${input.birthDay}日`
  }`;
  const facts = [`${input.gender === 'male' ? '男' : '女'}，公历${date}`];
  if (input.birthMonth !== undefined) {
    if (input.birthHour === undefined) {
      facts.push('出生时刻未提供，年界比较按中国标准时间正午');
    } else {
      const time =
        input.birthMinute === undefined
          ? `${input.birthHour}时（分钟、秒数未提供）`
          : input.birthSecond === undefined
            ? `${input.birthHour}时${input.birthMinute}分（秒数未提供）`
            : `${input.birthHour}时${input.birthMinute}分${input.birthSecond}秒`;
      const offset = `UTC${formatFixedTimezoneOffset(input.birthTimezone ?? 8)}`;
      const timezone = input.birthTimeZoneId
        ? `${input.birthTimeZoneId.trim()}${input.birthTimezone !== undefined ? `（${offset}）` : ''}`
        : offset;
      facts.push(`民用时刻${time}，取时按${timezone}`);
    }
  }
  return `命卦取年资料：${facts.join('；')}。`;
}

function buildPrompt(r: Omit<BaZhaiResult, 'prompt'>, measurement?: BaZhaiDoorMeasurement): string {
  const lines: string[] = [];
  const houseUnstable = measurement?.stability === '宅卦不稳定';
  const northReferenceUnspecified = measurement?.northReference === 'unspecified';
  lines.push('【任务】');
  lines.push(
    r.houseGua
      ? measurement && measurement.candidateDirections.length > 1
        ? '请依据以下命卦、宅卦与大游年八方资料解读住宅的人宅配合，并结合实际测向条件说明候选坐向的差异。'
        : '请依据以下命卦、宅卦与大游年八方资料解读住宅的人宅配合。'
      : '请依据以下命卦与大游年八方资料解读居住人的方位适配。',
  );
  lines.push('【盘面资料】');
  if (measurement?.northReference === 'unspecified') {
    lines.push('北向基准未声明；以下坐向按原始读数暂算，补充磁北或真北基准后复核。');
  }
  if (measurement) {
    const northReference =
      measurement.northReference === 'magnetic'
        ? `磁北，磁偏角${measurement.magneticDeclinationDegrees}°（东偏为正）`
        : measurement.northReference === 'true'
          ? '真北'
          : '：未声明，按原始读数暂算';
    lines.push(
      `测向资料：${measurement.method}，读数${measurement.measuredDegree}°，北向基准${northReference}，换算角度${measurement.trueNorthDegree}°，误差±${measurement.measurementUncertaintyDegrees}°；换算为${measurement.label}，距最近二十四山分界${measurement.nearestBoundaryDistanceDegrees}°，测量状态${measurement.stability}。`,
    );
    if (measurement.stability === '山向边界敏感') {
      lines.push(
        `候选坐向：${measurement.candidateDirections.map((item) => item.label).join('、')}；宅卦仍属${measurement.candidateDirections[0].houseGua}。`,
      );
    }
  }
  if (!measurement && r.calculationInput.sitMountain) {
    lines.push(`坐山：${r.calculationInput.sitMountain}`);
  }
  const birthYearBasis = formatBirthYearBasis(r.calculationInput);
  if (birthYearBasis) lines.push(birthYearBasis);
  lines.push(
    `命卦：${r.mingGua}（${r.mingGroup}${r.birthYearBoundaryStatus === '待复核' ? '，暂按' : ''}）`,
  );
  lines.push(`立春年界：${r.birthYearBoundaryNote}`);
  if (measurement?.stability === '宅卦不稳定') {
    lines.push(
      `测量误差跨越宅卦边界；候选坐向：${measurement.candidateDirections.map((item) => `${item.label}（${item.houseGua}宅、命宅${item.match}）`).join('、')}。以下宅卦及八方以中心读数列示。`,
    );
  }
  if (r.houseGua) {
    lines.push(`宅卦：${r.houseGua}（${r.houseGroup}${houseUnstable ? '，中心读数' : ''}）`);
    lines.push(
      `命宅配合：${northReferenceUnspecified ? '暂按' : ''}${r.match}${r.birthYearBoundaryStatus === '待复核' ? '（暂按命卦）' : ''}${houseUnstable ? '（中心读数）' : ''}`,
    );
  }
  if (r.mingPalace?.length) {
    lines.push(`命卦八方${r.birthYearBoundaryStatus === '待复核' ? '（暂按）' : ''}：`);
    for (const palace of r.mingPalace) {
      lines.push(`  ${palace.direction}${palace.label}（${palace.luck}，约${palace.degree}°）`);
    }
  }
  if (r.housePalace?.length) {
    lines.push(`宅卦八方${houseUnstable ? '（中心读数）' : ''}：`);
    for (const palace of r.housePalace) {
      lines.push(`  ${palace.direction}${palace.label}（${palace.luck}，约${palace.degree}°）`);
    }
  }
  if (measurement?.stability === '宅卦不稳定') {
    const alternateHouseGuas = new Set<string>();
    for (const candidate of measurement.candidateDirections) {
      if (candidate.houseGua === r.houseGua || alternateHouseGuas.has(candidate.houseGua)) continue;
      alternateHouseGuas.add(candidate.houseGua);
      lines.push(`候选${candidate.houseGua}宅八方：`);
      for (const palace of candidate.housePalace) {
        lines.push(`  ${palace.direction}${palace.label}（${palace.luck}，约${palace.degree}°）`);
      }
    }
  }
  if (r.gasRegulation?.promptSummary) {
    lines.push(r.gasRegulation.promptSummary);
  }
  lines.push('【传统依据】');
  lines.push(
    r.houseGua
      ? '八宅以命卦与坐山宅卦分别排大游年八方，再按东四与西四归属对照人宅配合。'
      : '八宅以命卦排大游年八方，并按东四与西四归属查看方位适配。',
  );
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
  let houseGroup: BaZhaiHouseGroup | null = null;
  let housePalace: BaZhaiPalace[] | null = null;
  let match: BaZhaiResult['match'] = '未知';
  let matchAdvice = '';

  if (input.sitMountain !== undefined) {
    houseGua = getHouseTrigram(input.sitMountain);
    houseGroup = getHouseGroup(houseGua);
    housePalace = getBaZhaiPalace(houseGua);
    if (getEastWestGroup(houseGua) === mingGroup) {
      match = '相合';
      matchAdvice = `命卦属${mingGroup}、宅卦属${houseGroup}，东四命配东四宅/西四命配西四宅为"命宅相合"，吉方可尽量重合利用。`;
    } else {
      match = '相冲';
      matchAdvice = `命卦属${mingGroup}、宅卦属${houseGroup}，命宅不同组（东四命住西四宅或反之），应以命卦吉方为主、宅卦为辅调和。`;
    }
    if (resolvedMingGua.status === '待复核') matchAdvice = `暂按命卦推得：${matchAdvice}`;
  }

  const resultBase: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'> = {
    calculationInput: {
      mingGuaSource: input.mingGua ? '直接给定' : '出生年与性别计算',
      ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
      ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
      ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
      ...(input.birthHour !== undefined ? { birthHour: input.birthHour } : {}),
      ...(input.birthMinute !== undefined ? { birthMinute: input.birthMinute } : {}),
      ...(input.birthSecond !== undefined ? { birthSecond: input.birthSecond } : {}),
      ...(input.birthTimezone !== undefined ? { birthTimezone: input.birthTimezone } : {}),
      ...(input.birthTimeZoneId !== undefined ? { birthTimeZoneId: input.birthTimeZoneId } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.mingGua ? { directMingGua: input.mingGua } : {}),
      ...(input.sitMountain ? { sitMountain: input.sitMountain } : {}),
    },
    mingGua,
    effectiveBirthYear: resolvedMingGua.effectiveBirthYear,
    birthYearBoundaryStatus: resolvedMingGua.status,
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
    gasRegulation: evaluateBaZhaiRegulation({
      mingGua,
      houseGua,
      mingGroup,
      houseGroup,
    }),
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
  return analyzeBaZhaiByMeasurement(input, '站在大门处面向屋内测量');
}

/** 用已提供的住宅坐山度数排八宅，并保留测量容差及候选宅卦。 */
export function analyzeBaZhaiBySitDegree(
  input: Omit<BaZhaiDoorDegreeInput, 'doorToInteriorDegree'> & { sitDegree: number },
): BaZhaiDoorDegreeResult {
  const { sitDegree, ...rest } = input;
  return analyzeBaZhaiByMeasurement(
    { ...rest, doorToInteriorDegree: sitDegree },
    '按住宅坐山度数换算',
  );
}

function analyzeBaZhaiByMeasurement(
  input: BaZhaiDoorDegreeInput,
  method: BaZhaiDoorMeasurement['method'],
): BaZhaiDoorDegreeResult {
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
      const houseGroup = getHouseGroup(item.houseGua);
      return {
        ...item,
        houseGroup,
        match: getEastWestGroup(item.houseGua) === result.mingGroup ? '相合' : '相冲',
        housePalace: getBaZhaiPalace(item.houseGua),
      };
    },
  );
  const directionMeasurement: BaZhaiDoorMeasurement = {
    method,
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
      `${method === '站在大门处面向屋内测量' ? '测量方式：站在大门处面向屋内，指南针读数' : '住宅坐山度数'}为 ${doorToInteriorDegree}°；北向基准为${measurement.reference === 'magnetic' ? `磁北，磁偏角 ${measurement.declination}°（东偏为正）` : measurement.reference === 'true' ? '真北' : '未声明'}。`,
      measurement.reference === 'unspecified'
        ? `北向基准未声明；按原始读数 ${measurement.trueNorthDegree}°暂算${method === '站在大门处面向屋内测量' ? '入户' : '坐山'}方向（非已确认真北），测量误差 ±${measurement.uncertainty}°，距最近二十四山分界 ${measurement.nearestBoundaryDistanceDegrees}°。`
        : `真北口径${method === '站在大门处面向屋内测量' ? '入户' : '坐山'}方向为 ${measurement.trueNorthDegree}°，测量误差 ±${measurement.uncertainty}°，距最近二十四山分界 ${measurement.nearestBoundaryDistanceDegrees}°。`,
      `中心读数换算后住宅坐山 ${sit.degree}° 为${sit.mountain}山，传统朝向 ${facing.degree}° 为${facing.mountain}向，结果为${label}。`,
      `误差候选：${candidateDirections.map((item) => `${item.label}（${item.houseGua}宅、${item.houseGroup}、命宅${item.match}）`).join('、')}。`,
      `测量稳定性为${measurement.stability}，候选坐向${candidateDirections.map((item) => item.label).join('、')}。`,
      ...(measurement.stability === '宅卦不稳定'
        ? candidateDirections.map(
            (item) =>
              `  候选${item.label}：${item.houseGua}宅八宫为${item.housePalace.map((palace) => `${palace.direction}${palace.label}`).join('、')}`,
          )
        : []),
    ]
      .filter(Boolean)
      .join('\n'),
  };
  const { prompt: _prompt, evidenceAnalysis: _evidenceAnalysis, ...resultFacts } = result;
  const measuredFacts = {
    ...resultFacts,
    matchAdvice:
      measurement.reference === 'unspecified' && resultFacts.matchAdvice
        ? `按原始读数暂列：${resultFacts.matchAdvice}`
        : resultFacts.matchAdvice,
  };
  const evidenceAnalysis = analyzeBaZhaiEvidence(measuredFacts, directionMeasurement);
  return {
    ...result,
    matchAdvice: measuredFacts.matchAdvice,
    evidenceAnalysis,
    prompt: buildPrompt({ ...measuredFacts, evidenceAnalysis }, directionMeasurement),
    directionMeasurement,
  };
}

export const bazhai = {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  analyzeBaZhaiBySitDegree,
  getBaZhaiSitFacingFromDoorDegree,
};
