/**
 * 西方占星底层适配层。
 *
 * 业务模块只依赖这里的稳定接口，不直接绑定第三方星历库。当前天文位置、宫位与
 * 基础相位由 Caelus 提供；四小行星使用随 mingyu-core 固定版本发布的 Caelus/JPL
 * Chebyshev 数据包，避免浏览器与 Node 运行时采用不同数据源。
 */
import {
  Engine,
  detectPatternsIn,
  PATTERN_ORBS,
  isDayChart,
  lotFortune,
  lotSpirit,
  lunarEclipses,
  solarEclipses,
  type BodyId,
  type ChartBody as CaelusChartBody,
  type EngineData,
  type Position as CaelusPosition,
} from 'caelus';
import { embeddedData } from './vendor/caelus/embedded-data.js';
import {
  createUtcTimestamp,
  daysInGregorianMonth,
  isValidClockTime,
} from '../calendar/date-validation';
import ceresPack from './vendor/caelus/ceres_cheb.js';
import junoPack from './vendor/caelus/juno_cheb.js';
import pallasPack from './vendor/caelus/pallas_cheb.js';
import vestaPack from './vendor/caelus/vesta_cheb.js';

export const ASTROLOGY_ENGINE_MODEL = {
  provider: 'caelus',
  version: '0.24.1',
  coordinate: '地心回归黄道日期坐标',
  asteroidDataRevision: 'caelus dd3461d209b674b1f9b5b3e7a43be86aa6cfaed5',
} as const;

const engineData: EngineData = {
  ...embeddedData,
  chebPacks: {
    ceres: ceresPack,
    pallas: pallasPack,
    juno: junoPack,
    vesta: vestaPack,
  } as unknown as NonNullable<EngineData['chebPacks']>,
};

export const astrologyEngine = new Engine(engineData);

export enum AspectType {
  Conjunction = 'conjunction',
  Sextile = 'sextile',
  Square = 'square',
  Trine = 'trine',
  Opposition = 'opposition',
  SemiSextile = 'semi-sextile',
  SemiSquare = 'semi-square',
  Quintile = 'quintile',
  Sesquiquadrate = 'sesquiquadrate',
  Biquintile = 'biquintile',
  Quincunx = 'quincunx',
  Septile = 'septile',
  Novile = 'novile',
  Decile = 'decile',
}

export enum CelestialBody {
  Sun = 'Sun',
  Moon = 'Moon',
  Mercury = 'Mercury',
  Venus = 'Venus',
  Mars = 'Mars',
  Jupiter = 'Jupiter',
  Saturn = 'Saturn',
  Uranus = 'Uranus',
  Neptune = 'Neptune',
  Pluto = 'Pluto',
  NorthNode = 'North Node',
}

const ASPECT_ANGLES: Record<AspectType, number> = {
  [AspectType.Conjunction]: 0,
  [AspectType.Sextile]: 60,
  [AspectType.Square]: 90,
  [AspectType.Trine]: 120,
  [AspectType.Opposition]: 180,
  [AspectType.SemiSextile]: 30,
  [AspectType.SemiSquare]: 45,
  [AspectType.Quintile]: 72,
  [AspectType.Sesquiquadrate]: 135,
  [AspectType.Biquintile]: 144,
  [AspectType.Quincunx]: 150,
  [AspectType.Septile]: 360 / 7,
  [AspectType.Novile]: 40,
  [AspectType.Decile]: 36,
};

export const DEFAULT_ORBS: Record<AspectType, number> = {
  [AspectType.Conjunction]: 8,
  [AspectType.Sextile]: 6,
  [AspectType.Square]: 7,
  [AspectType.Trine]: 8,
  [AspectType.Opposition]: 8,
  [AspectType.SemiSextile]: 2,
  [AspectType.SemiSquare]: 2,
  [AspectType.Quintile]: 2,
  [AspectType.Sesquiquadrate]: 2,
  [AspectType.Biquintile]: 2,
  [AspectType.Quincunx]: 3,
  [AspectType.Septile]: 1,
  [AspectType.Novile]: 1,
  [AspectType.Decile]: 1,
};

const ASPECT_SYMBOLS: Record<AspectType, string> = {
  [AspectType.Conjunction]: '☌',
  [AspectType.Sextile]: '⚹',
  [AspectType.Square]: '□',
  [AspectType.Trine]: '△',
  [AspectType.Opposition]: '☍',
  [AspectType.SemiSextile]: '⚺',
  [AspectType.SemiSquare]: '∠',
  [AspectType.Quintile]: 'Q',
  [AspectType.Sesquiquadrate]: '⚼',
  [AspectType.Biquintile]: 'bQ',
  [AspectType.Quincunx]: '⚻',
  [AspectType.Septile]: 'S',
  [AspectType.Novile]: 'N',
  [AspectType.Decile]: 'D',
};

const BODY_IDS: Record<string, BodyId> = {
  Sun: 'sun',
  Moon: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
  Pluto: 'pluto',
  'North Node': 'true_node',
  'True Lilith': 'true_lilith',
  Chiron: 'chiron',
  Ceres: 'ceres',
  Pallas: 'pallas',
  Juno: 'juno',
  Vesta: 'vesta',
};

const BODY_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(BODY_IDS).map(([name, id]) => [id, name]),
);

const SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const SIGN_LABELS = [
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座',
] as const;

export interface BirthData {
  /** 公历年，1至9999；星历数据的适用范围由具体计算另行约束。 */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  timezone: number;
  latitude?: number;
  longitude?: number;
}

export interface ChartPlanet {
  name: string;
  longitude: number;
  latitude: number;
  distance: number;
  longitudeSpeed: number;
  isRetrograde: boolean;
  sign: number;
  signName: string;
  degree: number;
  minute: number;
  second: number;
  formatted: string;
  /** 1-12 为已按宫头定位的宫位；0 表示本次只计算位置，未计算宫位。 */
  house: number;
}

export interface AspectBody {
  name: string;
  longitude: number;
  longitudeSpeed?: number;
}

export interface Aspect {
  body1: string;
  body2: string;
  type: AspectType;
  symbol: string;
  angle: number;
  separation: number;
  deviation: number;
  orb: number;
  strength: number;
  isApplying: boolean | null;
  isOutOfSign: boolean;
}

export interface NatalPoint {
  name: string;
  longitude: number;
  type: 'luminary' | 'planet' | 'angle';
  house?: number;
}

export interface TransitPosition {
  longitude: number;
  latitude?: number;
  distance?: number;
  longitudeSpeed?: number;
  isRetrograde: boolean;
  sign: number;
  signName: string;
  degree: number;
  minute: number;
  second: number;
  formatted: string;
}

export interface Transit {
  transitingBodyEnum: CelestialBody;
  transitingBody: string;
  natalPoint: string;
  aspectType: AspectType;
  symbol: string;
  transitingPosition: TransitPosition;
  actualAngle: number;
  exactAngle: number;
  allowedOrb: number;
  isOutOfSign: boolean;
  deviation: number;
  strength: number;
  /** exact 表示偏差按 0.01° 展示为 0.00°；其余按当前位置速度判定入相或出相。 */
  phase: 'applying' | 'exact' | 'separating' | 'unknown';
  isRetrograde: boolean;
}

export interface AspectPattern {
  type: string;
  bodies: string[];
  name: string;
}

function normalize(value: number): number {
  return ((value % 360) + 360) % 360;
}

function separation(first: number, second: number): number {
  const raw = Math.abs(normalize(first) - normalize(second));
  return raw > 180 ? 360 - raw : raw;
}

function isApplyingAspect(first: AspectBody, second: AspectBody, angle: number): boolean | null {
  if (first.longitudeSpeed === undefined || second.longitudeSpeed === undefined) return null;
  const relativeSpeed = second.longitudeSpeed - first.longitudeSpeed;
  if (relativeSpeed === 0) return null;
  const currentSeparation = separation(first.longitude, second.longitude);
  if (currentSeparation === angle) return null;
  const directedSeparation = normalize(second.longitude - first.longitude);
  const separationSpeed = (directedSeparation > 180 ? -1 : 1) * relativeSpeed;
  return (currentSeparation - angle) * separationSpeed < 0;
}

function toUtc(input: BirthData): Date {
  if (!input || typeof input !== 'object') throw new Error('星历日期输入不能为空。');
  const maxDay = daysInGregorianMonth(input.year, input.month);
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > maxDay) {
    throw new Error('星历公历日期不存在。');
  }
  if (!isValidClockTime(input.hour, input.minute, input.second ?? 0)) {
    throw new Error('星历时分秒必须是有效的24小时制时间。');
  }
  if (!Number.isFinite(input.timezone) || input.timezone < -12 || input.timezone > 14) {
    throw new Error('星历时区必须在UTC-12至UTC+14之间。');
  }
  return new Date(
    createUtcTimestamp(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute,
      input.second ?? 0,
    ) -
      input.timezone * 3_600_000,
  );
}

function validateOptionalCoordinates(input: BirthData): void {
  if (
    input.latitude !== undefined &&
    (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90)
  ) {
    throw new Error('星盘纬度必须在-90至90度之间。');
  }
  if (
    input.longitude !== undefined &&
    (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)
  ) {
    throw new Error('星盘经度必须在-180至180度之间。');
  }
}

function requireChartCoordinates(input: BirthData): { latitude: number; longitude: number } {
  validateOptionalCoordinates(input);
  if (input.latitude === undefined || input.longitude === undefined) {
    throw new Error('完整星盘计算必须同时提供出生地纬度和经度。');
  }
  if (Math.abs(input.latitude) === 90) {
    throw new RangeError('地理极点无法确定上升点与宫位，完整星盘纬度必须小于90度。');
  }
  return { latitude: input.latitude, longitude: input.longitude };
}

export function toJulianDate(input: BirthData): number {
  return julianDateOfUtc(toUtc(input));
}

export const time = { toJulianDate } as const;

function julianDateOfUtc(utc: Date): number {
  return utc.getTime() / 86_400_000 + 2_440_587.5;
}

function positionAt(bodyId: string, jd: number): CaelusPosition {
  if (!Number.isFinite(jd)) throw new Error('星历儒略日必须是有限数值。');
  const position = astrologyEngine.position(bodyId, jd);
  if (
    !Number.isFinite(position.lon) ||
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.speed) ||
    (position.dist != null && !Number.isFinite(position.dist))
  ) {
    throw new RangeError('当前儒略日无法计算有效星历位置。');
  }
  return position;
}

function houseForLongitude(cusps: readonly number[], longitude: number): number {
  for (let index = 0; index < cusps.length; index += 1) {
    const current = cusps[index];
    const next = cusps[(index + 1) % cusps.length];
    const span = normalize(next - current) || 360;
    if (normalize(longitude - current) < span) return index + 1;
  }
  return 0;
}

function positionFields(longitude: number) {
  const normalized = normalize(longitude);
  const sign = Math.floor(normalized / 30);
  const degreeInSign = normalized - sign * 30;
  const degree = Math.floor(degreeInSign);
  const minute = Math.floor((degreeInSign - degree) * 60);
  const second = Math.floor((degreeInSign - degree) * 3600 - minute * 60);
  return {
    longitude: normalized,
    sign,
    signName: SIGN_NAMES[sign],
    degree,
    minute,
    second,
    formatted: `${degree}°${String(minute).padStart(2, '0')}'${String(second).padStart(2, '0')}" ${SIGN_NAMES[sign]}`,
  };
}

function mapBody(name: string, body: CaelusChartBody): ChartPlanet {
  return {
    name,
    ...positionFields(body.lon),
    latitude: body.lat,
    distance: body.dist ?? 0,
    longitudeSpeed: body.speed,
    isRetrograde: body.retrograde,
    house: body.house,
  };
}

function mapPosition(name: string, body: CaelusPosition): ChartPlanet {
  return {
    name,
    ...positionFields(body.lon),
    latitude: body.lat,
    distance: body.dist ?? 0,
    longitudeSpeed: body.speed,
    isRetrograde: body.retrograde,
    house: 0,
  };
}

function createPoint(
  name: string,
  longitude: number,
  cusps: readonly number[],
  longitudeSpeed = 0,
): ChartPlanet {
  return {
    name,
    ...positionFields(longitude),
    latitude: 0,
    distance: 0,
    longitudeSpeed,
    isRetrograde: longitudeSpeed < 0,
    house: houseForLongitude(cusps, longitude),
  };
}

function isOutOfSign(first: number, second: number, angle: number): boolean {
  // 只有整星座跨度的相位才有确定的星座关系；谐波相位不能四舍五入成相邻宫数。
  if (angle % 30 !== 0) return false;
  const signDistance = Math.abs(
    Math.floor(normalize(first) / 30) - Math.floor(normalize(second) / 30),
  );
  const wrappedSigns = Math.min(signDistance, 12 - signDistance);
  const expectedSigns = Math.round(angle / 30);
  return wrappedSigns !== Math.min(expectedSigns, 12 - expectedSigns);
}

export function calculateAspects(
  bodies: AspectBody[],
  options: { orbs?: Partial<Record<AspectType, number>>; minimumStrength?: number } = {},
): { aspects: Aspect[] } {
  const orbs = { ...DEFAULT_ORBS };
  for (const type of Object.values(AspectType)) {
    const configured = options.orbs?.[type];
    if (configured !== undefined) {
      if (!Number.isFinite(configured) || configured < 0) {
        throw new Error('相位容许度必须是非负有限数值。');
      }
      orbs[type] = configured;
    }
  }
  const minimumStrength = options.minimumStrength ?? 0;
  if (!Number.isFinite(minimumStrength) || minimumStrength < 0 || minimumStrength > 100) {
    throw new Error('相位最低强度必须在0至100之间。');
  }
  for (const body of bodies) {
    if (!Number.isFinite(body.longitude)) throw new Error('相位主体黄经必须是有限数值。');
    if (body.longitudeSpeed !== undefined && !Number.isFinite(body.longitudeSpeed)) {
      throw new Error('相位主体黄经速度必须是有限数值。');
    }
  }
  const aspects: Aspect[] = [];
  for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
      const first = bodies[firstIndex];
      const second = bodies[secondIndex];
      const actual = separation(first.longitude, second.longitude);
      for (const type of Object.values(AspectType)) {
        const angle = ASPECT_ANGLES[type];
        const deviation = Math.abs(actual - angle);
        const orb = orbs[type];
        if (deviation > orb) continue;
        const strength = orb === 0 ? 100 : Math.max(0, 100 * (1 - deviation / orb));
        if (strength < minimumStrength) continue;
        aspects.push({
          body1: first.name,
          body2: second.name,
          type,
          symbol: ASPECT_SYMBOLS[type],
          angle,
          separation: actual,
          deviation,
          orb,
          strength,
          isApplying: isApplyingAspect(first, second, angle),
          isOutOfSign: isOutOfSign(first.longitude, second.longitude, angle),
        });
      }
    }
  }
  return { aspects };
}

const PATTERN_KIND_LABELS: Record<string, string> = {
  t_square: 'T字刑',
  grand_trine: '大三角',
  grand_cross: '大十字',
  yod: '上帝之指',
  kite: '风筝',
  mystic_rectangle: '神秘矩形',
  stellium: '星群',
  stellium_sign: '同星座星群',
  stellium_house: '同宫星群',
};

const BODY_LABELS: Record<string, string> = {
  Sun: '太阳',
  Chiron: '凯龙星',
  Ceres: '谷神星',
  Pallas: '智神星',
  Juno: '婚神星',
  Vesta: '灶神星',
  'North Node': '北交点',
  'True North Node': '北交点（True North Node）',
  'Mean North Node': '北交点（Mean North Node）',
  'South Node': '南交点',
  'True South Node': '南交点',
  'Mean South Node': '南交点',
  'True Lilith': '真莉莉丝',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
};

function findPatternsFromBodies(
  bodies: Array<AspectBody & { house: number }>,
  selectedAspects: Aspect[],
  selectedTypes: AspectType[],
  minimumStrength: number,
): AspectPattern[] {
  // 格局只使用十大星体；计算点与小行星仍保留在位置和相位明细中。
  const mainNames = new Set(getMainBodyNames({}));
  const patternBodies = bodies.filter((body) => mainNames.has(body.name));
  const patternOrbs = Object.fromEntries(
    Object.entries(PATTERN_ORBS).map(([type, orb]) => [
      type,
      selectedTypes.includes(type as AspectType)
        ? Math.min(orb, DEFAULT_ORBS[type as AspectType] * (1 - minimumStrength / 100))
        : -1,
    ]),
  );
  const detected = detectPatternsIn(
    Object.fromEntries(
      patternBodies.map((body) => [body.name, { lon: body.longitude, house: body.house }]),
    ),
    { bodies: patternBodies.map((body) => body.name), orbs: patternOrbs },
  );
  const requiredAspects: Record<string, AspectType[]> = {
    t_square: [AspectType.Opposition, AspectType.Square, AspectType.Square],
    grand_trine: [AspectType.Trine, AspectType.Trine, AspectType.Trine],
    grand_cross: [
      AspectType.Opposition,
      AspectType.Opposition,
      ...Array(4).fill(AspectType.Square),
    ],
    yod: [AspectType.Sextile, AspectType.Quincunx, AspectType.Quincunx],
    kite: [
      AspectType.Opposition,
      AspectType.Sextile,
      AspectType.Sextile,
      ...Array(3).fill(AspectType.Trine),
    ],
    mystic_rectangle: [
      AspectType.Opposition,
      AspectType.Opposition,
      AspectType.Sextile,
      AspectType.Sextile,
      AspectType.Trine,
      AspectType.Trine,
    ],
  };
  const patterns = detected.filter((pattern) => {
    const expected = requiredAspects[pattern.kind];
    if (!expected) return true;
    const actual: AspectType[] = [];
    for (let first = 0; first < pattern.bodies.length; first += 1) {
      for (let second = first + 1; second < pattern.bodies.length; second += 1) {
        const aspect = selectedAspects.find(
          (item) =>
            (item.body1 === pattern.bodies[first] && item.body2 === pattern.bodies[second]) ||
            (item.body2 === pattern.bodies[first] && item.body1 === pattern.bodies[second]),
        );
        if (!aspect || !expected.includes(aspect.type)) return false;
        actual.push(aspect.type);
      }
    }
    return actual.sort().join(',') === [...expected].sort().join(',');
  });
  return patterns.map((pattern) => {
    const kind = PATTERN_KIND_LABELS[pattern.kind] ?? pattern.kind;
    const members = pattern.bodies.map((item) => BODY_LABELS[item] ?? item).join('、');
    const apex =
      pattern.apex && (pattern.kind === 't_square' || pattern.kind === 'yod')
        ? (BODY_LABELS[pattern.apex] ?? pattern.apex)
        : '';
    const signIndex = SIGN_NAMES.indexOf(pattern.sign as (typeof SIGN_NAMES)[number]);
    const extra = pattern.sign
      ? `，${signIndex >= 0 ? SIGN_LABELS[signIndex] : pattern.sign}`
      : pattern.house
        ? `，第${pattern.house}宫`
        : apex
          ? `，焦点${apex}`
          : '';
    return {
      type: pattern.kind,
      bodies: pattern.bodies,
      name: members ? `${kind}（${members}${extra}）` : kind,
    };
  });
}

type BodySelectionOptions = {
  includeAsteroids?: boolean;
  includeChiron?: boolean;
  includeLilith?: boolean | 'true';
  includeNodes?: boolean | 'true';
};

function getMainBodyNames(options: BodySelectionOptions): string[] {
  return [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
    ...(options.includeChiron ? ['Chiron'] : []),
    ...(options.includeAsteroids ? ['Ceres', 'Pallas', 'Juno', 'Vesta'] : []),
  ];
}

function getRequestedBodyNames(options: BodySelectionOptions): string[] {
  return [
    ...getMainBodyNames(options),
    ...(options.includeNodes ? ['North Node'] : []),
    ...(options.includeLilith ? ['True Lilith'] : []),
  ];
}

function calculatePositionOnlyBodies(jd: number, names: string[]): ChartPlanet[] {
  const positions: ChartPlanet[] = [];
  const missingNames: string[] = [];
  for (const name of names) {
    try {
      const position = mapPosition(name, positionAt(BODY_IDS[name], jd));
      positions.push(position);
      if (name === 'North Node') {
        positions.push({
          ...position,
          name: 'South Node',
          ...positionFields(position.longitude + 180),
        });
      }
    } catch (error) {
      if (error instanceof RangeError) {
        missingNames.push(name);
        continue;
      }
      throw error;
    }
  }
  if (missingNames.length > 0) {
    throw new RangeError(
      `当前日期的星历数据无法提供：${missingNames.map((name) => BODY_LABELS[name] ?? name).join('、')}。`,
    );
  }
  return positions;
}

function calculateDistributions(planets: ChartPlanet[]) {
  const elements = {
    fire: [] as string[],
    earth: [] as string[],
    air: [] as string[],
    water: [] as string[],
  };
  const modalities = {
    cardinal: [] as string[],
    fixed: [] as string[],
    mutable: [] as string[],
  };
  const elementKeys = ['fire', 'earth', 'air', 'water'] as const;
  const modalityKeys = ['cardinal', 'fixed', 'mutable'] as const;
  planets.slice(0, 10).forEach((planet) => {
    elements[elementKeys[planet.sign % 4]].push(planet.name);
    modalities[modalityKeys[planet.sign % 3]].push(planet.name);
  });
  return { elements, modalities };
}

/**
 * 计算完整本命星盘。宫位、四轴和福点/精神点均依赖出生地，因此纬度与经度必须同时提供。
 */
export function calculateChart(
  input: BirthData,
  options: {
    houseSystem?: 'placidus';
    includeAsteroids?: boolean;
    includeChiron?: boolean;
    includeLilith?: boolean | 'true';
    includeNodes?: boolean | 'true';
    includeLots?: boolean;
    aspectTypes?: AspectType[];
    minimumAspectStrength?: number;
  } = {},
) {
  if (options.houseSystem !== undefined && options.houseSystem !== 'placidus') {
    throw new Error('本命宫位制不受支持。');
  }
  const utc = toUtc(input);
  const { latitude, longitude } = requireChartCoordinates(input);
  const aspectTypes = options.aspectTypes ?? Object.values(AspectType);
  if (aspectTypes.some((type) => !Object.values(AspectType).includes(type))) {
    throw new Error('本命相位类型不受支持。');
  }
  const jd = julianDateOfUtc(utc);
  const extraBodies: BodyId[] = [];
  if (options.includeAsteroids) extraBodies.push('ceres', 'pallas', 'juno', 'vesta');
  if (options.includeLilith) extraBodies.push('true_lilith');
  const chart = astrologyEngine.chartAt(jd, latitude, longitude, {
    houseSystem: 'placidus',
    bodies: extraBodies,
  });
  const mainNames = getMainBodyNames(options);
  const missingNames = mainNames.filter((name) => !chart.bodies[BODY_IDS[name]]);
  if (options.includeNodes && !chart.bodies.true_node) missingNames.push('North Node');
  if (options.includeLilith && !chart.bodies.true_lilith) missingNames.push('True Lilith');
  if (missingNames.length > 0) {
    throw new RangeError(
      `当前日期的星历数据无法提供：${missingNames.map((name) => BODY_LABELS[name] ?? name).join('、')}。`,
    );
  }
  const planets = mainNames.map((name): ChartPlanet =>
    mapBody(name, chart.bodies[BODY_IDS[name]]!),
  );
  const warnings = chart.warnings.map((warning) => {
    if (warning.kind === 'outside_validated_range') {
      const name = BODY_NAMES[warning.body] ?? warning.body;
      return `${BODY_LABELS[name] ?? name}位置超出已验证年代（${warning.validated.from}—${warning.validated.to}年），当前数值的精度待验证。`;
    }
    return `时标差估计不确定度约${warning.sigmaSeconds}秒，对应四轴位置约${warning.angleSmearDeg}度、月亮位置约${warning.moonSmearArcmin}角分的不确定度。`;
  });
  const nodes = options.includeNodes
    ? [
        createPoint(
          'North Node',
          chart.bodies.true_node.lon,
          chart.cusps,
          chart.bodies.true_node.speed,
        ),
        createPoint(
          'South Node',
          chart.bodies.true_node.lon + 180,
          chart.cusps,
          chart.bodies.true_node.speed,
        ),
      ]
    : [];
  const lilith = options.includeLilith
    ? [
        {
          ...createPoint(
            'True Lilith',
            chart.bodies.true_lilith!.lon,
            chart.cusps,
            chart.bodies.true_lilith!.speed,
          ),
          latitude: chart.bodies.true_lilith!.lat,
          distance: chart.bodies.true_lilith!.dist ?? 0,
        },
      ]
    : [];
  const dayChart = isDayChart(astrologyEngine, jd, latitude, longitude);
  const chartLots = options.includeLots
    ? (() => {
        const fortune = lotFortune(
          chart.angles.asc,
          chart.bodies.sun.lon,
          chart.bodies.moon.lon,
          dayChart,
        );
        const spirit = lotSpirit(
          chart.angles.asc,
          chart.bodies.sun.lon,
          chart.bodies.moon.lon,
          dayChart,
        );
        return [
          createPoint('Part of Fortune', fortune, chart.cusps),
          createPoint('Part of Spirit', spirit, chart.cusps),
        ];
      })()
    : [];
  const aspectBodies = [
    ...planets,
    ...nodes.filter((node) => node.name === 'North Node'),
    ...lilith,
  ].map((body) => ({
    name: body.name === 'North Node' ? 'True North Node' : body.name,
    longitude: body.longitude,
    longitudeSpeed: body.longitudeSpeed,
    house: body.house,
  }));
  const allAspects = calculateAspects(aspectBodies, {
    minimumStrength: options.minimumAspectStrength,
  }).aspects.filter((aspect) => aspectTypes.includes(aspect.type));
  const distributions = calculateDistributions(planets);
  const patterns = findPatternsFromBodies(
    aspectBodies,
    allAspects,
    aspectTypes,
    options.minimumAspectStrength ?? 0,
  );
  const angle = (name: string, longitude: number) => ({ name, ...positionFields(longitude) });
  return {
    planets,
    warnings,
    nodes,
    lilith,
    lots: chartLots,
    angles: {
      ascendant: angle('Ascendant', chart.angles.asc),
      midheaven: angle('Midheaven', chart.angles.mc),
      descendant: angle('Descendant', chart.angles.asc + 180),
      imumCoeli: angle('Imum Coeli', chart.angles.mc + 180),
    },
    houses: {
      system: chart.houseSystem === 'whole_sign' ? ('whole_sign' as const) : ('placidus' as const),
      cusps: chart.cusps.map((longitude, index) => ({
        house: index + 1,
        ...positionFields(longitude),
      })),
    },
    dayChart,
    aspects: { all: allAspects },
    summary: {
      ...distributions,
      retrograde: planets.filter((planet) => planet.isRetrograde).map((planet) => planet.name),
      patterns: patterns.map((pattern) => pattern.name),
    },
    options: {
      aspectTypes: [...aspectTypes],
      aspectOrbs: { ...DEFAULT_ORBS },
      minimumAspectStrength: options.minimumAspectStrength ?? 0,
      includePatterns: true,
    },
    calculated: {
      julianDate: jd,
      utcDateTime: {
        year: utc.getUTCFullYear(),
        month: utc.getUTCMonth() + 1,
        day: utc.getUTCDate(),
        hour: utc.getUTCHours(),
        minute: utc.getUTCMinutes(),
        second: utc.getUTCSeconds(),
        ...(utc.getUTCMilliseconds() ? { millisecond: utc.getUTCMilliseconds() } : {}),
      },
    },
  };
}

/**
 * 只计算行星、交点与莉莉丝位置。出生地坐标可省略，返回的 house=0 表示未计算宫位；
 * 需要宫位时应调用 calculateChart。
 */
export function calculatePlanets(
  input: BirthData,
  options: {
    houseSystem?: 'placidus';
    includeAsteroids?: boolean;
    includeChiron?: boolean;
    includeLilith?: boolean;
    includeLots?: boolean;
    includeNodes?: boolean;
  } = {},
): ChartPlanet[] {
  if (options.includeLots) {
    throw new Error('福点与精神点需要完整星盘的四轴和宫位，请调用 calculateChart。');
  }
  const utc = toUtc(input);
  validateOptionalCoordinates(input);
  const jd = julianDateOfUtc(utc);
  return calculatePositionOnlyBodies(jd, getRequestedBodyNames(options));
}

export function getSunPosition(jd: number) {
  const position = positionAt('sun', jd);
  return { longitude: position.lon, latitude: position.lat, distance: position.dist ?? 0 };
}

export function getMoonPosition(jd: number) {
  const position = positionAt('moon', jd);
  return { longitude: position.lon, latitude: position.lat, distance: position.dist ?? 0 };
}

export function calculateTransits(
  natalPoints: NatalPoint[],
  jd: number,
  options: {
    aspectTypes: AspectType[];
    transitingBodies: CelestialBody[];
    minimumStrength?: number;
    includeOutOfSign?: boolean;
  },
): { transits: Transit[] } {
  if (!Number.isFinite(jd)) throw new Error('行运儒略日必须是有限数值。');
  const minimumStrength = options.minimumStrength ?? 0;
  if (!Number.isFinite(minimumStrength) || minimumStrength < 0 || minimumStrength > 100) {
    throw new Error('行运最低强度必须在0至100之间。');
  }
  for (const natal of natalPoints) {
    if (!Number.isFinite(natal.longitude)) throw new Error('本命点黄经必须是有限数值。');
  }
  if (options.aspectTypes.some((type) => !Object.values(AspectType).includes(type))) {
    throw new Error('行运相位类型不受支持。');
  }
  if (options.transitingBodies.some((body) => !Object.values(CelestialBody).includes(body))) {
    throw new Error('行运星体不受支持。');
  }
  const transits: Transit[] = [];
  for (const bodyName of options.transitingBodies) {
    const bodyId = BODY_IDS[bodyName];
    const position = positionAt(bodyId, jd);
    const transitingPosition: TransitPosition = {
      ...positionFields(position.lon),
      ...(position.lat !== undefined ? { latitude: position.lat } : {}),
      ...(position.dist != null ? { distance: position.dist } : {}),
      ...(position.speed !== undefined ? { longitudeSpeed: position.speed } : {}),
      isRetrograde: position.retrograde,
    };
    for (const natal of natalPoints) {
      const actual = separation(position.lon, natal.longitude);
      for (const aspectType of options.aspectTypes) {
        const angle = ASPECT_ANGLES[aspectType];
        const orb = DEFAULT_ORBS[aspectType];
        const deviation = Math.abs(actual - angle);
        if (deviation > orb) continue;
        const outOfSign = isOutOfSign(position.lon, natal.longitude, angle);
        if (options.includeOutOfSign === false && outOfSign) {
          continue;
        }
        const strength = Math.max(0, 100 * (1 - deviation / orb));
        if (strength < minimumStrength) continue;
        const applying = isApplyingAspect(
          { name: bodyName, longitude: position.lon, longitudeSpeed: position.speed },
          { name: natal.name, longitude: natal.longitude, longitudeSpeed: 0 },
          angle,
        );
        transits.push({
          transitingBodyEnum: bodyName,
          transitingBody: bodyName,
          natalPoint: natal.name,
          aspectType,
          symbol: ASPECT_SYMBOLS[aspectType],
          transitingPosition,
          actualAngle: actual,
          exactAngle: angle,
          allowedOrb: orb,
          isOutOfSign: outOfSign,
          deviation,
          strength,
          phase:
            deviation < 0.005
              ? 'exact'
              : applying === null
                ? 'unknown'
                : applying
                  ? 'applying'
                  : 'separating',
          isRetrograde: position.retrograde,
        });
      }
    }
  }
  return { transits };
}

export function bodyName(body: BodyId): string {
  return BODY_NAMES[body] ?? body;
}

export const JULIAN_DATE_UNIX_EPOCH = 2_440_587.5;

export function julianDateToUnix(jd: number) {
  if (!Number.isFinite(jd)) throw new Error('儒略日必须是有限数值。');
  const timestamp = (jd - JULIAN_DATE_UNIX_EPOCH) * 86_400_000;
  if (!Number.isFinite(timestamp)) throw new RangeError('儒略日转换超出时间戳数值范围。');
  return timestamp;
}

export function unixToJulianDate(timestamp: number) {
  if (!Number.isFinite(timestamp)) throw new Error('时间戳必须是有限数值。');
  return timestamp / 86_400_000 + JULIAN_DATE_UNIX_EPOCH;
}

export function getApparentPosition(bodyId: string, jd: number) {
  const position = positionAt(bodyId, jd);
  return {
    longitude: position.lon,
    latitude: position.lat,
    speed: position.speed,
    retrograde: position.retrograde,
  };
}

export type SolarEclipseEvent = {
  julianDate: number;
  type: 'total' | 'annular' | 'hybrid' | 'partial';
};

export type LunarEclipseEvent = {
  julianDate: number;
  type: 'total' | 'partial' | 'penumbral';
};

export function findSolarEclipses(jdStart: number, jdEnd: number): SolarEclipseEvent[] {
  if (!Number.isFinite(jdStart) || !Number.isFinite(jdEnd)) {
    throw new Error('日食区间儒略日必须是有限数值。');
  }
  return solarEclipses(astrologyEngine, jdStart, jdEnd).map((item) => ({
    julianDate: item.tMax,
    type: item.type,
  }));
}

export function findLunarEclipses(jdStart: number, jdEnd: number): LunarEclipseEvent[] {
  if (!Number.isFinite(jdStart) || !Number.isFinite(jdEnd)) {
    throw new Error('月食区间儒略日必须是有限数值。');
  }
  return lunarEclipses(astrologyEngine, jdStart, jdEnd).map((item) => ({
    julianDate: item.tMax,
    type: item.type,
  }));
}
