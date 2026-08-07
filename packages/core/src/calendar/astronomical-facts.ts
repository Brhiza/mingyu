import { calculatePlanets } from 'celestine';

import { formatFixedTimezoneOffset, resolveCivilTime } from './civil-time';
import type { HistoricalTimezoneEvidence } from './historical-timezone';

export const ASTRONOMY_FACT_MODEL = {
  provider: 'celestine',
  version: '0.2.1',
  coordinate: '地心回归黄道日期坐标',
  recommendedYearRange: [1800, 2200] as const,
  validation: {
    provider: 'NASA/JPL Horizons',
    ephemeris: 'DE441',
    referenceEpoch: '2000-01-01T12:00:00.000Z',
    quantity: 'Observer ecliptic longitude and latitude of date (QUANTITIES=31)',
    sourceUrl: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
    longitudeToleranceDegrees: 0.02,
    latitudeToleranceDegrees: 0.002,
  },
  limitation:
    '本结果是可复算的现代天文位置事实，不是观测站实测值，也不证明任何命理、占星、吉凶或现实事件。',
} as const;

export interface AstronomicalFactInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  /** 固定 UTC 偏移；与 IANA 同时提供时只用于回拨消歧和一致性核验。 */
  timezone?: number;
  /** IANA 历史时区，例如 Asia/Shanghai。 */
  timeZoneId?: string;
  latitude?: number;
  longitude?: number;
}

export interface AstronomicalBodyFact {
  name:
    | 'Sun'
    | 'Moon'
    | 'Mercury'
    | 'Venus'
    | 'Mars'
    | 'Jupiter'
    | 'Saturn'
    | 'Uranus'
    | 'Neptune'
    | 'Pluto';
  longitudeDegrees: number;
  latitudeDegrees: number;
  distance: number;
  distanceUnit: 'AU';
  longitudeSpeedDegreesPerDay: number;
  isRetrograde: boolean;
}

export interface AstronomicalFacts {
  localDateTime: string;
  utcDateTime: string;
  timezone: number;
  timeZoneId?: string;
  timezoneEvidence?: HistoricalTimezoneEvidence;
  julianDateUtc: number;
  coordinate: typeof ASTRONOMY_FACT_MODEL.coordinate;
  bodies: AstronomicalBodyFact[];
  moonPhase: {
    elongationDegrees: number;
    illuminationFraction: number;
    waxing: boolean;
  };
  model: typeof ASTRONOMY_FACT_MODEL;
}

const BODY_NAMES = new Set<AstronomicalBodyFact['name']>([
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
]);

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function validateInput(input: AstronomicalFactInput) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('天文事实查询参数必须是对象。');
  }
  const [minimumYear, maximumYear] = ASTRONOMY_FACT_MODEL.recommendedYearRange;
  if (!Number.isInteger(input.year) || input.year < minimumYear || input.year > maximumYear) {
    throw new Error(`天文事实查询年份需在 ${minimumYear}-${maximumYear} 之间。`);
  }
  const second = input.second ?? 0;
  if (
    input.latitude !== undefined &&
    (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)
  ) {
    throw new Error('天文事实查询纬度需在 -90 至 90 之间。');
  }
  if (
    input.longitude !== undefined &&
    (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)
  ) {
    throw new Error('天文事实查询经度需在 -180 至 180 之间。');
  }
  return second;
}

export function queryAstronomicalFacts(input: AstronomicalFactInput): AstronomicalFacts {
  const second = validateInput(input);
  const civilTime = resolveCivilTime({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second,
    timezone: input.timezone,
    timeZoneId: input.timeZoneId,
  });
  const { timezone, timeZoneId, timezoneEvidence, utcTimestamp: utcMilliseconds } = civilTime;
  const utcDate = new Date(utcMilliseconds);
  const planets = calculatePlanets(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute,
      second,
      timezone,
      latitude: input.latitude ?? 0,
      longitude: input.longitude ?? 0,
    },
    { includeAsteroids: false, includeChiron: false },
  );

  const bodies = planets.flatMap((planet): AstronomicalBodyFact[] => {
    if (!BODY_NAMES.has(planet.name as AstronomicalBodyFact['name'])) return [];
    return [
      {
        name: planet.name as AstronomicalBodyFact['name'],
        longitudeDegrees: normalizeDegrees(planet.longitude),
        latitudeDegrees: planet.latitude,
        distance: planet.distance,
        distanceUnit: 'AU',
        longitudeSpeedDegreesPerDay: planet.longitudeSpeed,
        isRetrograde: planet.isRetrograde,
      },
    ];
  });
  if (bodies.length !== BODY_NAMES.size) {
    throw new Error(
      `天文事实星体数据不完整：应有 ${BODY_NAMES.size} 项，实际 ${bodies.length} 项。`,
    );
  }

  const sun = bodies.find((body) => body.name === 'Sun');
  const moon = bodies.find((body) => body.name === 'Moon');
  if (!sun || !moon) throw new Error('天文事实缺少太阳或月球位置。');
  const elongationDegrees = normalizeDegrees(moon.longitudeDegrees - sun.longitudeDegrees);

  return {
    localDateTime: `${civilTime.localDateTime}${formatFixedTimezoneOffset(timezone)}`,
    utcDateTime: utcDate.toISOString(),
    timezone,
    ...(timeZoneId ? { timeZoneId } : {}),
    ...(timezoneEvidence ? { timezoneEvidence } : {}),
    julianDateUtc: utcMilliseconds / 86_400_000 + 2_440_587.5,
    coordinate: ASTRONOMY_FACT_MODEL.coordinate,
    bodies,
    moonPhase: {
      elongationDegrees,
      illuminationFraction: (1 - Math.cos((elongationDegrees * Math.PI) / 180)) / 2,
      waxing: elongationDegrees < 180,
    },
    model: ASTRONOMY_FACT_MODEL,
  };
}
