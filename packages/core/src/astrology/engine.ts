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
  isDayChart,
  julianDay,
  lotFortune,
  lotSpirit,
  lunarEclipses,
  solarEclipses,
  type BodyId,
  type ChartBody as CaelusChartBody,
  type EngineData,
} from 'caelus';
import { embeddedData } from './vendor/caelus/embedded-data.js';
import { createUtcTimestamp } from '../calendar/date-validation';
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

export interface Transit {
  transitingBodyEnum: CelestialBody;
  transitingBody: string;
  natalPoint: string;
  aspectType: AspectType;
  symbol: string;
  deviation: number;
  strength: number;
  phase: 'applying' | 'exact' | 'separating';
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
  const directedSeparation = normalize(second.longitude - first.longitude);
  const separationSpeed = (directedSeparation > 180 ? -1 : 1) * relativeSpeed;
  return (separation(first.longitude, second.longitude) - angle) * separationSpeed < 0;
}

function toUtc(input: BirthData): Date {
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

export function toJulianDate(input: BirthData): number {
  return toUtc(input).getTime() / 86_400_000 + 2_440_587.5;
}

export const time = { toJulianDate } as const;

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
  const orbs = { ...DEFAULT_ORBS, ...options.orbs };
  const minimumStrength = options.minimumStrength ?? 0;
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

const PATTERN_BODY_LABELS: Record<string, string> = {
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
};

function findPatternsFromBodies(bodies: AspectBody[]): AspectPattern[] {
  const detected = detectPatternsIn(
    Object.fromEntries(bodies.map((body) => [body.name, { lon: body.longitude }])),
    { bodies: bodies.map((body) => body.name) },
  );
  return detected.map((pattern) => {
    const kind = PATTERN_KIND_LABELS[pattern.kind] ?? pattern.kind;
    const members = pattern.bodies.map((item) => PATTERN_BODY_LABELS[item] ?? item).join('、');
    const apex = pattern.apex ? (PATTERN_BODY_LABELS[pattern.apex] ?? pattern.apex) : '';
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
  const utc = toUtc(input);
  const jd = julianDay(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes(),
    utc.getUTCSeconds(),
  );
  const extraBodies: BodyId[] = [];
  if (options.includeAsteroids) extraBodies.push('ceres', 'pallas', 'juno', 'vesta');
  if (options.includeLilith) extraBodies.push('true_lilith');
  const chart = astrologyEngine.chartAt(jd, input.latitude ?? 0, input.longitude ?? 0, {
    houseSystem: 'placidus',
    bodies: extraBodies,
  });
  const mainNames = [
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
  const planets = mainNames.flatMap((name): ChartPlanet[] => {
    const body = chart.bodies[BODY_IDS[name]];
    return body ? [mapBody(name, body)] : [];
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
        createPoint(
          'True Lilith',
          chart.bodies.true_lilith!.lon,
          chart.cusps,
          chart.bodies.true_lilith!.speed,
        ),
      ]
    : [];
  const chartLots = options.includeLots
    ? (() => {
        const day = isDayChart(astrologyEngine, jd, input.latitude ?? 0, input.longitude ?? 0);
        const fortune = lotFortune(
          chart.angles.asc,
          chart.bodies.sun.lon,
          chart.bodies.moon.lon,
          day,
        );
        const spirit = lotSpirit(
          chart.angles.asc,
          chart.bodies.sun.lon,
          chart.bodies.moon.lon,
          day,
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
  }));
  const aspectTypes = options.aspectTypes ?? Object.values(AspectType);
  const allAspects = calculateAspects(aspectBodies, {
    minimumStrength: options.minimumAspectStrength,
  }).aspects.filter((aspect) => aspectTypes.includes(aspect.type));
  const distributions = calculateDistributions(planets);
  const patterns = findPatternsFromBodies(aspectBodies);
  const angle = (name: string, longitude: number) => ({ name, ...positionFields(longitude) });
  return {
    planets,
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
      cusps: chart.cusps.map((longitude, index) => ({
        house: index + 1,
        ...positionFields(longitude),
      })),
    },
    aspects: { all: allAspects },
    summary: {
      ...distributions,
      retrograde: planets.filter((planet) => planet.isRetrograde).map((planet) => planet.name),
      patterns: patterns.map((pattern) => pattern.name),
    },
    options: {
      aspectTypes,
      aspectOrbs: DEFAULT_ORBS,
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
      },
    },
  };
}

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
  const chart = calculateChart(input, options);
  return [
    ...chart.planets,
    ...(options.includeNodes ? chart.nodes : []),
    ...(options.includeLilith ? chart.lilith : []),
  ];
}

export function getSunPosition(jd: number) {
  const position = astrologyEngine.position('sun', jd);
  return { longitude: position.lon, latitude: position.lat, distance: position.dist ?? 0 };
}

export function getMoonPosition(jd: number) {
  const position = astrologyEngine.position('moon', jd);
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
  const transits: Transit[] = [];
  for (const bodyName of options.transitingBodies) {
    const bodyId = BODY_IDS[bodyName];
    const position = astrologyEngine.position(bodyId, jd);
    for (const natal of natalPoints) {
      const actual = separation(position.lon, natal.longitude);
      for (const aspectType of options.aspectTypes) {
        const angle = ASPECT_ANGLES[aspectType];
        const orb = DEFAULT_ORBS[aspectType];
        const deviation = Math.abs(actual - angle);
        if (deviation > orb) continue;
        if (
          options.includeOutOfSign === false &&
          isOutOfSign(position.lon, natal.longitude, angle)
        ) {
          continue;
        }
        const strength = Math.max(0, 100 * (1 - deviation / orb));
        if (strength < (options.minimumStrength ?? 0)) continue;
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
          deviation,
          strength,
          phase: deviation <= 0.1 ? 'exact' : applying ? 'applying' : 'separating',
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
  return (jd - JULIAN_DATE_UNIX_EPOCH) * 86_400_000;
}

export function unixToJulianDate(timestamp: number) {
  return timestamp / 86_400_000 + JULIAN_DATE_UNIX_EPOCH;
}

export function getApparentPosition(bodyId: string, jd: number) {
  const position = astrologyEngine.position(bodyId, jd);
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
  return solarEclipses(astrologyEngine, jdStart, jdEnd).map((item) => ({
    julianDate: item.tMax,
    type: item.type,
  }));
}

export function findLunarEclipses(jdStart: number, jdEnd: number): LunarEclipseEvent[] {
  return lunarEclipses(astrologyEngine, jdStart, jdEnd).map((item) => ({
    julianDate: item.tMax,
    type: item.type,
  }));
}
