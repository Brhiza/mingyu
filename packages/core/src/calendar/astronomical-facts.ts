import { calculatePlanets } from 'celestine';

import { daysInGregorianMonth, isValidClockTime } from './date-validation';

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
  timezone: number;
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
  const maximumDay = daysInGregorianMonth(input.year, input.month);
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > maximumDay) {
    throw new Error(`天文事实查询日期需在 1-${maximumDay} 之间。`);
  }
  const second = input.second ?? 0;
  if (!isValidClockTime(input.hour, input.minute, second)) {
    throw new Error('天文事实查询时分秒无效。');
  }
  if (!Number.isFinite(input.timezone) || input.timezone < -14 || input.timezone > 14) {
    throw new Error('天文事实查询时区偏移需在 UTC-14 至 UTC+14 之间。');
  }
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

function formatLocalDateTime(input: AstronomicalFactInput, second: number) {
  return `${String(input.year).padStart(4, '0')}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}T${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${input.timezone >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(input.timezone))).padStart(2, '0')}:${String(Math.round((Math.abs(input.timezone) % 1) * 60)).padStart(2, '0')}`;
}

export function queryAstronomicalFacts(input: AstronomicalFactInput): AstronomicalFacts {
  const second = validateInput(input);
  const utcMilliseconds =
    Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, second) -
    input.timezone * 60 * 60 * 1000;
  const utcDate = new Date(utcMilliseconds);
  const planets = calculatePlanets(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute,
      second,
      timezone: input.timezone,
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
    localDateTime: formatLocalDateTime(input, second),
    utcDateTime: utcDate.toISOString(),
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
