/**
 * @file 西洋星盘算法
 * @传统依据 现代西方占星通行的本命、宫位、相位与行运定义；星体位置采用现代天文星历计算资料。
 */
import { AspectType, calculateChart } from 'celestine';
import type {
  AstrolabeAspect,
  AstrolabeBirthInput,
  AstrolabeData,
  AstrolabePoint,
} from '../../types/divination';
import { daysInSolarMonth } from '../../calendar/date-validation';
import { resolveCivilTime } from '../../calendar/civil-time';
import { calculateSolarIlluminationEvidence } from '../../calendar/solar-illumination-evidence';
import { resolveTrueSolarBirthTime } from '../../calendar/true-solar-time';
import { classifyAspectClosenessByRatio } from '../astrolabe-aspect-evidence';
import { analyzeAstrolabeEvidence } from '../astrolabe-evidence';

export { analyzeAstrolabeEvidence } from '../astrolabe-evidence';
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
  strength: number;
  isApplying: boolean | null;
  isOutOfSign: boolean;
}): AstrolabeAspect {
  const normalizedOrbRatio = Number((aspect.deviation / aspect.orb).toFixed(4));
  return {
    body1: PLANET_LABELS[aspect.body1] ?? aspect.body1,
    body2: PLANET_LABELS[aspect.body2] ?? aspect.body2,
    type: ASPECT_LABELS[aspect.type] ?? aspect.type,
    symbol: aspect.symbol,
    exactAngle: Number(aspect.angle.toFixed(4)),
    actualAngle: Number(aspect.separation.toFixed(4)),
    orb: Number(aspect.deviation.toFixed(2)),
    allowedOrb: Number(aspect.orb.toFixed(4)),
    closeness: classifyAspectClosenessByRatio(normalizedOrbRatio),
    normalizedOrbRatio,
    isOutOfSign: aspect.isOutOfSign,
    source: 'celestine 本命相位计算；紧密等级按偏差占本次允许容许度的比例换算',
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
export function generateAstrolabe(input: AstrolabeBirthInput): AstrolabeData {
  const standardBirth = localTimestamp(input);
  const latitude = requireNumber(input.latitude, '出生地纬度');
  const longitude = requireNumber(input.longitude, '出生地经度');
  if (input.timezone === undefined && !input.timeZoneId) {
    throw new Error('时区或 IANA 时区名至少需要提供一项。');
  }
  const fixedTimezone =
    input.timezone === undefined ? undefined : requireNumber(input.timezone, '时区');
  const civilTime = resolveCivilTime({
    ...standardBirth,
    second: 0,
    timezone: fixedTimezone,
    timeZoneId: input.timeZoneId,
  });
  const { timezone, timezoneEvidence, timeZoneId } = civilTime;
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
        timezone: fixedTimezone,
        timeZoneId,
      })
    : null;
  const locationName = readOptionalText(input.locationName, '');
  const solarIllumination = calculateSolarIlluminationEvidence({
    ...standardBirth,
    second: 0,
    latitude,
    longitude,
    timezone: fixedTimezone,
    timeZoneId,
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
      aspectTypes: [
        AspectType.Conjunction,
        AspectType.Sextile,
        AspectType.Square,
        AspectType.Trine,
        AspectType.Opposition,
        AspectType.SemiSextile,
        AspectType.SemiSquare,
        AspectType.Quintile,
        AspectType.Sesquiquadrate,
        AspectType.Biquintile,
      ],
      // 相位强度过滤阈值（celestine 0-100 strength，基于容许度偏离）；
      // 调整需结合占星容许度口径评估，调低会纳入更多弱相位、调高会丢失有效相位。
      minimumAspectStrength: 30,
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

  const result: AstrolabeData = {
    birth: {
      name: readOptionalText(input.name, '未命名'),
      gender: input.gender,
      dateTime: formatDateTime(standardBirth),
      location:
        locationName.length > 0
          ? `${locationName}（${latitude.toFixed(4)}, ${longitude.toFixed(4)}）`
          : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitude,
      longitude,
      timezone,
      timeZoneId,
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
    aspects: [...chart.aspects.all].sort((a, b) => b.strength - a.strength).map(mapAspect),
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
      patterns: [...new Set(chart.summary.patterns.map((item) => item.trim()).filter(Boolean))],
    },
    timestamp: Date.now(),
  };
  result.evidenceAnalysis = analyzeAstrolabeEvidence(result);
  return result;
}
