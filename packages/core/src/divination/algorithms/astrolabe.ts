import { AspectType, calculateAspects, calculateChart } from 'celestine';
import type {
  AstrolabeAspect,
  AstrolabeBirthInput,
  AstrolabeData,
  AstrolabeGenerationSource,
  AstrolabePoint,
} from '../../types/divination';
import { daysInSolarMonth } from '../../calendar/date-validation';
import { resolveHistoricalTimezone } from '../../calendar/historical-timezone';
import { calculateSolarIlluminationEvidence } from '../../calendar/solar-illumination-evidence';
import { resolveTrueSolarBirthTime } from '../../calendar/true-solar-time';
import { analyzeRebuiltAstrolabeEvidence } from '../astrolabe-evidence';
export type {
  AstrolabeAspectFact,
  AstrolabeCalculationFact,
  AstrolabeCalculationStep,
  AstrolabeCounterEvidenceFact,
  AstrolabeCounterSummaryFact,
  AstrolabeDistributionFact,
  AstrolabeEvidenceAnalysis,
  AstrolabeIlluminationFact,
  AstrolabeLimitationFact,
  AstrolabePositionFact,
  AstrolabePrimaryCoverageFact,
  AstrolabePrimaryFact,
} from '../astrolabe-evidence';

const PLANET_LABELS: Record<string, string> = {
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
  Chiron: '凯龙星',
  Ceres: '谷神星',
  Pallas: '智神星',
  Juno: '婚神星',
  Vesta: '灶神星',
  'North Node': '北交点',
  'True North Node': '北交点',
  'Mean North Node': '北交点',
  'South Node': '南交点',
  'True South Node': '南交点',
  'Mean South Node': '南交点',
  'True Lilith': '莉莉丝',
  'Mean Lilith': '莉莉丝',
  'Part of Fortune': '福点',
  'Part of Spirit': '精神点',
};

const ANGLE_LABELS: Record<string, string> = {
  Ascendant: '上升',
  Midheaven: '天顶',
  Descendant: '下降',
  'Imum Coeli': '天底',
};

const SIGN_LABELS: Record<string, string> = {
  Aries: '白羊座',
  Taurus: '金牛座',
  Gemini: '双子座',
  Cancer: '巨蟹座',
  Leo: '狮子座',
  Virgo: '处女座',
  Libra: '天秤座',
  Scorpio: '天蝎座',
  Sagittarius: '射手座',
  Capricorn: '摩羯座',
  Aquarius: '水瓶座',
  Pisces: '双鱼座',
};

const ASPECT_LABELS: Record<string, string> = {
  conjunction: '合相',
  sextile: '六合',
  square: '刑相',
  trine: '拱相',
  opposition: '冲相',
  'semi-sextile': '半六合',
  semisextile: '半六合',
  'semi-square': '半刑',
  semisquare: '半刑',
  quintile: '五分相',
  sesquiquadrate: '补八分相',
  biquintile: '倍五分相',
};

const NATAL_ASPECT_DEFINITIONS = [
  { type: AspectType.Conjunction, label: '合相', symbol: '☌', exactAngle: 0, allowedOrb: 8 },
  { type: AspectType.SemiSextile, label: '半六合', symbol: '⚺', exactAngle: 30, allowedOrb: 2 },
  { type: AspectType.SemiSquare, label: '半刑', symbol: '∠', exactAngle: 45, allowedOrb: 2 },
  { type: AspectType.Sextile, label: '六合', symbol: '⚹', exactAngle: 60, allowedOrb: 6 },
  { type: AspectType.Quintile, label: '五分相', symbol: 'Q', exactAngle: 72, allowedOrb: 2 },
  { type: AspectType.Square, label: '刑相', symbol: '□', exactAngle: 90, allowedOrb: 7 },
  { type: AspectType.Trine, label: '拱相', symbol: '△', exactAngle: 120, allowedOrb: 8 },
  {
    type: AspectType.Sesquiquadrate,
    label: '补八分相',
    symbol: '⚼',
    exactAngle: 135,
    allowedOrb: 2,
  },
  {
    type: AspectType.Biquintile,
    label: '倍五分相',
    symbol: 'bQ',
    exactAngle: 144,
    allowedOrb: 2,
  },
  { type: AspectType.Opposition, label: '冲相', symbol: '☍', exactAngle: 180, allowedOrb: 8 },
] as const;

const NATAL_ASPECT_TYPES = NATAL_ASPECT_DEFINITIONS.map((item) => item.type);

function requireNumber(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new Error(`星盘需要填写有效的${label}`);
  }
  const text = value.trim();
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error(`星盘需要填写有效的${label}`);
  }

  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`星盘需要填写有效的${label}`);
  }
  return number;
}

function assertIntegerRange(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间。`);
  }
}

function assertNumberRange(value: number, label: string, min: number, max: number) {
  if (value < min || value > max) {
    throw new Error(`${label}需在 ${min} 到 ${max} 之间。`);
  }
}

function formatPosition(signName: string, degree: number, minute: number) {
  return `${SIGN_LABELS[signName] ?? signName}${degree}°${String(minute).padStart(2, '0')}′`;
}

function mapPlanet(planet: {
  name: string;
  longitude: number;
  signName: string;
  degree: number;
  minute: number;
  house: number;
  isRetrograde?: boolean;
}): AstrolabePoint {
  return {
    name: planet.name,
    label: PLANET_LABELS[planet.name] ?? planet.name,
    longitude: planet.longitude,
    sign: SIGN_LABELS[planet.signName] ?? planet.signName,
    degree: planet.degree,
    minute: planet.minute,
    house: planet.house,
    formatted: formatPosition(planet.signName, planet.degree, planet.minute),
    retrograde: planet.isRetrograde ?? false,
  };
}

function mapAngle(angle: {
  name: string;
  longitude: number;
  signName: string;
  degree: number;
  minute: number;
}): AstrolabePoint {
  return {
    name: angle.name,
    label: ANGLE_LABELS[angle.name] ?? angle.name,
    longitude: angle.longitude,
    sign: SIGN_LABELS[angle.signName] ?? angle.signName,
    degree: angle.degree,
    minute: angle.minute,
    house: 0,
    formatted: formatPosition(angle.signName, angle.degree, angle.minute),
  };
}

function mapAspect(aspect: {
  body1: string;
  body2: string;
  type: string;
  symbol: string;
  angle: number;
  separation: number;
  deviation: number;
  orb: number;
  isApplying: boolean | null;
  isOutOfSign: boolean;
}): AstrolabeAspect {
  return {
    body1: PLANET_LABELS[aspect.body1] ?? ANGLE_LABELS[aspect.body1] ?? aspect.body1,
    body2: PLANET_LABELS[aspect.body2] ?? ANGLE_LABELS[aspect.body2] ?? aspect.body2,
    type: ASPECT_LABELS[aspect.type] ?? aspect.type,
    symbol: aspect.symbol,
    exactAngle: Number(aspect.angle.toFixed(4)),
    actualAngle: Number(aspect.separation.toFixed(4)),
    orb: Number(aspect.deviation.toFixed(2)),
    allowedOrb: Number(aspect.orb.toFixed(4)),
    isOutOfSign: aspect.isOutOfSign,
    source: 'celestine 黄经最小夹角计算；按当前列明的精确角与容许度完整筛选',
    applying: aspect.isApplying,
  };
}

function localTimestamp(input: AstrolabeBirthInput) {
  const year = requireNumber(input.year, '出生年份');
  const month = requireNumber(input.month, '出生月份');
  const day = requireNumber(input.day, '出生日期');
  const hour = requireNumber(input.hour, '出生小时');
  const minute = requireNumber(input.minute, '出生分钟');

  assertIntegerRange(year, '出生年份', 1900, 2100);
  assertIntegerRange(month, '出生月份', 1, 12);
  const maxDay = daysInSolarMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间。`);
  }
  assertIntegerRange(hour, '出生小时', 0, 23);
  assertIntegerRange(minute, '出生分钟', 0, 59);

  return { year, month, day, hour, minute };
}

function formatDateTime(birth: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  return `${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')} ${String(birth.hour).padStart(2, '0')}:${String(birth.minute).padStart(2, '0')}`;
}

function readOptionalText(value: unknown, fallback: string) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error('星盘文本字段必须是字符串。');
  }
  return value.trim() || fallback;
}

function normalizeAstrolabeBirthInput(input: AstrolabeBirthInput): AstrolabeBirthInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('星盘生成参数必须是对象。');
  }
  if (typeof input.name !== 'string') {
    throw new Error('星盘文本字段必须是字符串。');
  }
  if (input.gender !== '' && input.gender !== '男' && input.gender !== '女') {
    throw new Error('星盘性别只能是男、女或空字符串。');
  }
  if (input.useTrueSolarTime !== undefined && typeof input.useTrueSolarTime !== 'boolean') {
    throw new Error('星盘真太阳时开关必须是布尔值。');
  }
  if (input.locationName !== undefined && typeof input.locationName !== 'string') {
    throw new Error('星盘文本字段必须是字符串。');
  }
  if (input.timeZoneId !== undefined && typeof input.timeZoneId !== 'string') {
    throw new Error('星盘文本字段必须是字符串。');
  }

  const normalizedTimeZoneId = input.timeZoneId?.trim();
  return {
    name: input.name.trim(),
    gender: input.gender,
    year: typeof input.year === 'string' ? input.year.trim() : input.year,
    month: typeof input.month === 'string' ? input.month.trim() : input.month,
    day: typeof input.day === 'string' ? input.day.trim() : input.day,
    hour: typeof input.hour === 'string' ? input.hour.trim() : input.hour,
    minute: typeof input.minute === 'string' ? input.minute.trim() : input.minute,
    latitude: typeof input.latitude === 'string' ? input.latitude.trim() : input.latitude,
    longitude: typeof input.longitude === 'string' ? input.longitude.trim() : input.longitude,
    ...(input.timezone !== undefined
      ? {
          timezone: typeof input.timezone === 'string' ? input.timezone.trim() : input.timezone,
        }
      : {}),
    ...(normalizedTimeZoneId ? { timeZoneId: normalizedTimeZoneId } : {}),
    locationName: input.locationName?.trim() ?? '',
    useTrueSolarTime: input.useTrueSolarTime ?? false,
  } as AstrolabeBirthInput;
}

function assertAstrolabeGenerationTimestamp(timestamp: unknown): asserts timestamp is number {
  if (
    typeof timestamp !== 'number' ||
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    Number.isNaN(new Date(timestamp).getTime())
  ) {
    throw new Error('星盘原始生成时间必须是有效的非负毫秒时间戳。');
  }
}

/**
 * 生成西洋占星星盘
 *
 * 使用 Placidus 宫位制计算本命盘，含太阳、月亮、上升、十大星体
 * 落宫、星座、以及主要相位分析。真太阳时只作为传统时间参考证据，
 * 不替换现代星历计算所需的实际出生时刻。
 *
 * @param input 出生信息，含经纬度、时区、出生日期时间等。
 *   设置 useTrueSolarTime 为 true 可附带真太阳时参考证据。
 * @returns 星盘数据对象 AstrolabeData，含星体、宫位、相位等信息。
 *
 * @example
 * ```ts
 * const result = generateAstrolabe({
 *   name: '某人',
 *   gender: '男',
 *   year: '1990',
 *   month: '1',
 *   day: '1',
 *   hour: '10',
 *   minute: '30',
 *   latitude: '39.9',
 *   longitude: '116.4',
 *   timezone: '8',
 * });
 * ```
 */
function buildAstrolabe(input: AstrolabeBirthInput, timestamp: number): AstrolabeData {
  input = normalizeAstrolabeBirthInput(input);
  assertAstrolabeGenerationTimestamp(timestamp);
  const standardBirth = localTimestamp(input);
  const latitude = requireNumber(input.latitude, '出生地纬度');
  const longitude = requireNumber(input.longitude, '出生地经度');
  if (input.timezone === undefined && !input.timeZoneId) {
    throw new Error('时区或 IANA 时区名至少需要提供一项。');
  }
  const fixedTimezone =
    input.timezone === undefined ? undefined : requireNumber(input.timezone, '时区');
  const timezoneEvidence = input.timeZoneId
    ? resolveHistoricalTimezone({
        ...standardBirth,
        second: 0,
        timeZoneId: input.timeZoneId,
        fixedOffsetHours: fixedTimezone,
      })
    : undefined;
  const timezone = timezoneEvidence?.resolvedOffsetHours ?? fixedTimezone!;
  assertNumberRange(latitude, '出生地纬度', -90, 90);
  assertNumberRange(longitude, '出生地经度', -180, 180);
  assertNumberRange(timezone, '时区', -12, 14);
  const trueSolarResult = input.useTrueSolarTime
    ? resolveTrueSolarBirthTime({
        dateType: 'solar',
        year: standardBirth.year,
        month: standardBirth.month,
        day: standardBirth.day,
        hour: standardBirth.hour,
        minute: standardBirth.minute,
        longitude,
        timezone,
      })
    : null;
  const locationName = readOptionalText(input.locationName, '');
  const solarIllumination = calculateSolarIlluminationEvidence({
    ...standardBirth,
    second: 0,
    latitude,
    longitude,
    timezone: fixedTimezone,
    timeZoneId: input.timeZoneId,
  });

  const chart = calculateChart(
    {
      ...standardBirth,
      second: 0,
      timezone,
      latitude,
      longitude,
    },
    {
      houseSystem: 'placidus',
      // 按现代占星实践开启小行星/南北交点/凯龙星/莉莉丝/阿拉伯点；
      // 此前全部关闭属简化算法，开启后数据更完整，AI 可按需选用。
      includeAsteroids: true,
      includeChiron: true,
      includeLilith: 'true' as const,
      includeNodes: 'true' as const,
      includeLots: true,
      aspectTypes: NATAL_ASPECT_TYPES,
      // 不使用 celestine 的派生强度门槛；相位命中只由逐项公开的精确角和容许度决定。
      minimumAspectStrength: 0,
    },
  );

  const angles = [
    chart.angles.ascendant,
    chart.angles.midheaven,
    chart.angles.descendant,
    chart.angles.imumCoeli,
  ].map(mapAngle);
  const calculatedPoints = [...chart.planets, ...chart.nodes, ...chart.lilith, ...chart.lots].map(
    mapPlanet,
  );
  const aspectBodies = [
    ...chart.planets.map((point) => ({
      name: point.name,
      longitude: point.longitude,
      longitudeSpeed: point.longitudeSpeed,
    })),
    ...chart.nodes.map((point) => ({ name: point.name, longitude: point.longitude })),
    ...chart.lilith.map((point) => ({ name: point.name, longitude: point.longitude })),
    ...chart.lots.map((point) => ({ name: point.name, longitude: point.longitude })),
    ...[
      chart.angles.ascendant,
      chart.angles.midheaven,
      chart.angles.descendant,
      chart.angles.imumCoeli,
    ].map((point) => ({ name: point.name, longitude: point.longitude })),
  ];
  const aspectResult = calculateAspects(aspectBodies, {
    aspectTypes: NATAL_ASPECT_TYPES,
    minimumStrength: 0,
    includeOutOfSign: true,
    includeApplying: true,
  });
  const pointOrder = new Map(aspectBodies.map((point, index) => [point.name, index]));
  const aspectOrder = new Map<AspectType, number>(
    NATAL_ASPECT_TYPES.map((type, index) => [type, index]),
  );
  const aspects = [...aspectResult.aspects]
    .sort(
      (first, second) =>
        (pointOrder.get(first.body1) ?? Number.MAX_SAFE_INTEGER) -
          (pointOrder.get(second.body1) ?? Number.MAX_SAFE_INTEGER) ||
        (pointOrder.get(first.body2) ?? Number.MAX_SAFE_INTEGER) -
          (pointOrder.get(second.body2) ?? Number.MAX_SAFE_INTEGER) ||
        (aspectOrder.get(first.type) ?? Number.MAX_SAFE_INTEGER) -
          (aspectOrder.get(second.type) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(mapAspect);

  const result: AstrolabeData = {
    generation: {
      input: { ...input },
      timestamp,
    },
    birth: {
      name: readOptionalText(input.name, '未命名'),
      gender: input.gender,
      dateTime: formatDateTime(standardBirth),
      location:
        locationName.length > 0
          ? `${locationName}（${latitude.toFixed(4)}, ${longitude.toFixed(4)}）`
          : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      timezone,
      timeZoneId: input.timeZoneId,
      timezoneStatus: timezoneEvidence?.status,
      timezoneDiagnostics: timezoneEvidence?.diagnostics,
      timezoneEvidence,
      standardDateTime: formatDateTime(standardBirth),
      trueSolarDateTime: trueSolarResult
        ? formatDateTime(trueSolarResult.correctedTime)
        : undefined,
      trueSolarEvidence: trueSolarResult
        ? {
            key: trueSolarResult.key,
            status: trueSolarResult.status,
            calculationSteps: trueSolarResult.calculationSteps,
            calculationChain: trueSolarResult.calculationChain,
            correctionFacts: trueSolarResult.correctionFacts,
            summaryFact: trueSolarResult.summaryFact,
            limitations: trueSolarResult.limitations,
            limitationFacts: trueSolarResult.limitationFacts,
            source: trueSolarResult.source,
            promptText: trueSolarResult.promptText,
          }
        : undefined,
      isTrueSolarTime: Boolean(trueSolarResult),
    },
    planets: calculatedPoints,
    angles,
    houses: chart.houses.cusps.map((cusp) => ({
      name: `House ${cusp.house}`,
      label: `第${cusp.house}宫`,
      longitude: cusp.longitude,
      sign: SIGN_LABELS[cusp.signName] ?? cusp.signName,
      degree: cusp.degree,
      minute: cusp.minute,
      house: cusp.house,
      formatted: formatPosition(cusp.signName, cusp.degree, cusp.minute),
    })),
    aspects,
    aspectCalculation: {
      selectedPointNames: aspectBodies.map(
        (point) => PLANET_LABELS[point.name] ?? ANGLE_LABELS[point.name] ?? point.name,
      ),
      aspectDefinitions: NATAL_ASPECT_DEFINITIONS.map((item) => ({
        type: item.label,
        symbol: item.symbol,
        exactAngle: item.exactAngle,
        allowedOrb: item.allowedOrb,
      })),
      evaluatedPairCount: aspectResult.pairsChecked,
      matchedAspectCount: aspects.length,
      enumeration: '完整穷举',
    },
    solarIllumination,
    summary: {
      elements: {
        火: chart.summary.elements.fire.map((item) => PLANET_LABELS[item] ?? item),
        土: chart.summary.elements.earth.map((item) => PLANET_LABELS[item] ?? item),
        风: chart.summary.elements.air.map((item) => PLANET_LABELS[item] ?? item),
        水: chart.summary.elements.water.map((item) => PLANET_LABELS[item] ?? item),
      },
      modalities: {
        开创: chart.summary.modalities.cardinal.map((item) => PLANET_LABELS[item] ?? item),
        固定: chart.summary.modalities.fixed.map((item) => PLANET_LABELS[item] ?? item),
        变动: chart.summary.modalities.mutable.map((item) => PLANET_LABELS[item] ?? item),
      },
      retrograde: chart.summary.retrograde.map((item) => PLANET_LABELS[item] ?? item),
    },
    timestamp,
  };
  result.evidenceAnalysis = analyzeRebuiltAstrolabeEvidence(result);
  return result;
}

export function generateAstrolabe(input: AstrolabeBirthInput): AstrolabeData {
  return buildAstrolabe(input, Date.now());
}

/** 只凭保存的原始出生输入和生成时间重建完整本命盘。 */
export function rebuildAuditedAstrolabeData(
  input: Pick<AstrolabeData, 'generation'>,
): AstrolabeData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('星盘审核重建必须提供结果对象。');
  }
  if (!input.generation) {
    throw new Error('星盘旧结果缺少可信原始出生输入，无法审核重建。');
  }
  const generation = input.generation as AstrolabeGenerationSource;
  if (!generation || typeof generation !== 'object' || Array.isArray(generation)) {
    throw new Error('星盘审核重建必须提供原始出生输入。');
  }
  return buildAstrolabe(generation.input, generation.timestamp);
}

/** 先从可信原始输入重建本命盘，再返回结构化证据。 */
export function analyzeAstrolabeEvidence(input: Pick<AstrolabeData, 'generation'>) {
  return rebuildAuditedAstrolabeData(input).evidenceAnalysis!;
}
