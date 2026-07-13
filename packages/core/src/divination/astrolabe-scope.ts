import {
  AspectType,
  CelestialBody,
  calculatePlanets,
  calculateTransits,
  time,
  type ChartPlanet,
  type NatalPoint,
  type Transit,
} from 'celestine';
export type AstrolabeScopeMode = 'natal' | 'full' | 'yearly' | 'monthly' | 'daily';
import type { AstrolabeData, AstrolabePoint } from '../types/divination';
import {
  classifyAspectClosenessFromStrength,
  normalizedOrbRatioFromStrength,
} from './astrolabe-aspect-evidence';

export type AstrolabeScopeContext = {
  scope: AstrolabeScopeMode;
  dateStr: string;
  displayText: string;
  displayLabel: string;
  promptText: string;
};

export type SolarReturnEvidence = {
  status: 'exact' | 'approximate' | 'unavailable';
  targetYear: number;
  dateTime?: string;
  timezone: number;
  residualDegrees?: number;
  searchWindowHours: number;
  coarseStepHours: number;
  refinementToleranceMinutes: number;
  refinementIterations: number;
  aspects: string[];
  source: string;
  limitations: string[];
};

const SCOPE_LABEL_MAP: Record<AstrolabeScopeMode, string> = {
  natal: '本命',
  full: '完整输出',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
};

const CELESTIAL_BODY_LABELS: Record<string, string> = {
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

const NATAL_POINT_NAME_MAP: Record<string, string> = {
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

const HOUSE_RULER_MAP: Record<
  string,
  {
    primary: string;
    modern?: string;
  }
> = {
  白羊座: { primary: 'Mars' },
  金牛座: { primary: 'Venus' },
  双子座: { primary: 'Mercury' },
  巨蟹座: { primary: 'Moon' },
  狮子座: { primary: 'Sun' },
  处女座: { primary: 'Mercury' },
  天秤座: { primary: 'Venus' },
  天蝎座: { primary: 'Mars', modern: 'Pluto' },
  射手座: { primary: 'Jupiter' },
  摩羯座: { primary: 'Saturn' },
  水瓶座: { primary: 'Saturn', modern: 'Uranus' },
  双鱼座: { primary: 'Jupiter', modern: 'Neptune' },
};

const ASPECT_LABELS: Record<string, string> = {
  conjunction: '合相',
  sextile: '六合',
  square: '刑相',
  trine: '拱相',
  opposition: '冲相',
};

const PHASE_LABELS: Record<Transit['phase'], string> = {
  applying: '入相',
  exact: '精准',
  separating: '出相',
};

const TRANSITING_BODIES = [
  CelestialBody.Jupiter,
  CelestialBody.Saturn,
  CelestialBody.Uranus,
  CelestialBody.Neptune,
  CelestialBody.Pluto,
  CelestialBody.Mars,
  CelestialBody.Venus,
  CelestialBody.Mercury,
  CelestialBody.Sun,
  CelestialBody.Moon,
];

const ASTROLABE_EVIDENCE_SCOPE_NOTE =
  '资料范围：以本命盘结构、本命宫主星链条，以及所选流年、流月或流日的主要行运相位和行运落本命宫位为判断依据。';

function parseDateParts(dateStr: string) {
  const matched = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(dateStr.trim());
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = matched[2] ? Number(matched[2]) : undefined;
  const day = matched[3] ? Number(matched[3]) : undefined;
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return null;
  }
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return null;
  }
  if (day !== undefined) {
    if (month === undefined || !Number.isInteger(day) || day < 1) {
      return null;
    }

    try {
      if (day > daysInAstrolabeScopeMonth(year, month)) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return { year, month, day };
}

function getCurrentLocalDate() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function daysInMonth(year: number, month: number) {
  return daysInAstrolabeScopeMonth(year, month);
}

function daysInAstrolabeScopeMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error('年份需在 1900-2200 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeTargetDate(scope: AstrolabeScopeMode, dateStr: string) {
  const current = getCurrentLocalDate();
  const parsed = parseDateParts(dateStr);
  const year = parsed?.year ?? current.year;
  const month = scope === 'yearly' ? 7 : Math.min(Math.max(parsed?.month ?? current.month, 1), 12);
  const maxDay = daysInMonth(year, month);
  const day =
    scope === 'yearly'
      ? Math.min(1, maxDay)
      : scope === 'monthly'
        ? Math.min(15, maxDay)
        : Math.min(Math.max(parsed?.day ?? current.day, 1), maxDay);

  return { year, month, day };
}

function formatDateStr(
  scope: AstrolabeScopeMode,
  date: { year: number; month: number; day: number },
) {
  if (scope === 'yearly') {
    return `${date.year}`;
  }
  if (scope === 'monthly') {
    return `${date.year}-${String(date.month).padStart(2, '0')}`;
  }
  if (scope === 'daily') {
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  }
  return '';
}

function formatAnchorDate(date: { year: number; month: number; day: number }) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')} 12:00`;
}

function formatAstrolabePlanetPosition(
  planet: Pick<ChartPlanet, 'signName' | 'degree' | 'minute'>,
) {
  return `${SIGN_LABELS[planet.signName] ?? planet.signName}${planet.degree}°${String(planet.minute).padStart(2, '0')}′`;
}

function isFiniteLongitude(point: Partial<AstrolabePoint>) {
  return typeof point.longitude === 'number' && Number.isFinite(point.longitude);
}

function buildNatalPoint(point: AstrolabePoint): NatalPoint | null {
  if (!isFiniteLongitude(point)) {
    return null;
  }

  const isAngle =
    point.name === 'Ascendant' ||
    point.name === 'Midheaven' ||
    point.name === 'Descendant' ||
    point.name === 'Imum Coeli';
  const type =
    point.name === 'Sun' || point.name === 'Moon' ? 'luminary' : isAngle ? 'angle' : 'planet';

  return {
    name: point.name,
    longitude: point.longitude,
    type,
    house: point.house || undefined,
  };
}

function buildNatalPoints(data: AstrolabeData): NatalPoint[] {
  const planetNames = new Set([
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
  const angleNames = new Set(['Ascendant', 'Midheaven']);

  return [
    ...data.planets.filter((item) => planetNames.has(item.name)),
    ...data.angles.filter((item) => angleNames.has(item.name)),
  ]
    .map(buildNatalPoint)
    .filter((item): item is NatalPoint => Boolean(item));
}

function formatTransitLine(transit: Transit) {
  const transitingBody =
    CELESTIAL_BODY_LABELS[transit.transitingBodyEnum] ??
    CELESTIAL_BODY_LABELS[transit.transitingBody] ??
    transit.transitingBody;
  const natalPoint = NATAL_POINT_NAME_MAP[transit.natalPoint] ?? transit.natalPoint;
  const aspect = ASPECT_LABELS[transit.aspectType] ?? transit.aspectType;
  const phase = PHASE_LABELS[transit.phase] ?? transit.phase;
  const retrograde = transit.isRetrograde ? '，逆行' : '';
  const closeness = classifyAspectClosenessFromStrength(transit.strength);
  const normalizedOrbRatio = normalizedOrbRatioFromStrength(transit.strength);

  return `${transitingBody}${transit.symbol}${natalPoint}（${aspect}，偏差${transit.deviation.toFixed(2)}°，${closeness}等级，归一化容许度位置${normalizedOrbRatio.toFixed(2)}，${phase}${retrograde}）`;
}

function getNatalHouseCusps(data: AstrolabeData) {
  const cusps = data.houses
    .slice()
    .sort((first, second) => first.house - second.house)
    .map((item) => item.longitude);

  return cusps.length === 12 && cusps.every((item) => Number.isFinite(item)) ? cusps : null;
}

function normalizeLongitude(longitude: number) {
  const normalized = longitude % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

const ADVANCED_ASPECTS = [
  { name: '合相', angle: 0, orb: 6 },
  { name: '六合', angle: 60, orb: 4 },
  { name: '刑相', angle: 90, orb: 5 },
  { name: '拱相', angle: 120, orb: 5 },
  { name: '冲相', angle: 180, orb: 6 },
] as const;

function longitudeDistance(first: number, second: number) {
  const raw = Math.abs(normalizeLongitude(first) - normalizeLongitude(second));
  return raw > 180 ? 360 - raw : raw;
}

function signedLongitudeDifference(first: number, second: number) {
  return ((normalizeLongitude(first) - normalizeLongitude(second) + 540) % 360) - 180;
}

function resolveAdvancedAspect(first: number, second: number) {
  const distance = longitudeDistance(first, second);
  return ADVANCED_ASPECTS.map((aspect) => ({
    ...aspect,
    deviation: Math.abs(distance - aspect.angle),
  }))
    .filter((aspect) => aspect.deviation <= aspect.orb)
    .sort((a, b) => a.deviation / a.orb - b.deviation / b.orb)[0];
}

function parseBirthDateTime(data: AstrolabeData) {
  const text = data.birth.standardDateTime || data.birth.dateTime;
  const matched = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(text);
  if (!matched) return null;
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
    hour: Number(matched[4]),
    minute: Number(matched[5]),
  };
}

function calculateScopePlanets(
  data: AstrolabeData,
  date: { year: number; month: number; day: number; hour: number; minute: number },
) {
  const coordinates = parseBirthCoordinates(data);
  return calculatePlanets(
    {
      ...date,
      second: 0,
      timezone: data.birth.timezone,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    },
    {
      houseSystem: 'placidus',
      includeAsteroids: false,
      includeChiron: false,
      includeLilith: false,
      includeNodes: false,
      includeLots: false,
    },
  );
}

function formatCrossAspects(
  moving: Array<{ name: string; longitude: number }>,
  natal: Array<{ name: string; longitude: number }>,
  limit = 8,
) {
  return moving
    .flatMap((movingPoint) =>
      natal.flatMap((natalPoint) => {
        const aspect = resolveAdvancedAspect(movingPoint.longitude, natalPoint.longitude);
        if (!aspect) return [];
        return [
          {
            text: `${CELESTIAL_BODY_LABELS[movingPoint.name] ?? movingPoint.name}${aspect.name}${NATAL_POINT_NAME_MAP[natalPoint.name] ?? natalPoint.name}（偏差${aspect.deviation.toFixed(2)}°）`,
            deviation: aspect.deviation,
          },
        ];
      }),
    )
    .sort((a, b) => a.deviation - b.deviation)
    .slice(0, limit)
    .map((item) => item.text);
}

function buildSecondaryProgressionEvidence(data: AstrolabeData, targetYear: number) {
  const birth = parseBirthDateTime(data);
  if (!birth) return '次限证据：出生时间资料不足，无法计算。';
  const age = targetYear - birth.year;
  if (age < 0) return '次限证据：目标年早于出生年，不适用。';
  const progressedDate = new Date(
    Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) + age * 86400000,
  );
  try {
    const progressed = calculateScopePlanets(data, {
      year: progressedDate.getUTCFullYear(),
      month: progressedDate.getUTCMonth() + 1,
      day: progressedDate.getUTCDate(),
      hour: progressedDate.getUTCHours(),
      minute: progressedDate.getUTCMinutes(),
    }).filter((planet) => ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'].includes(planet.name));
    const aspects = formatCrossAspects(progressed, buildNatalPoints(data));
    return `次限证据（一岁一日）：目标年约${age}岁，推进盘取出生后第${age}日；${aspects.join('；') || '未见容许度内的主要次限触发'}。`;
  } catch {
    return '次限证据：计算失败，不作为本次判断依据。';
  }
}

function buildSolarArcEvidence(data: AstrolabeData, targetYear: number) {
  const birth = parseBirthDateTime(data);
  const natalSun = data.planets.find((planet) => planet.name === 'Sun');
  if (!birth || !natalSun) return '太阳弧证据：出生时间或本命太阳资料不足。';
  const age = targetYear - birth.year;
  const progressedDate = new Date(
    Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) +
      Math.max(0, age) * 86400000,
  );
  try {
    const progressedSun = calculateScopePlanets(data, {
      year: progressedDate.getUTCFullYear(),
      month: progressedDate.getUTCMonth() + 1,
      day: progressedDate.getUTCDate(),
      hour: progressedDate.getUTCHours(),
      minute: progressedDate.getUTCMinutes(),
    }).find((planet) => planet.name === 'Sun');
    if (!progressedSun) return '太阳弧证据：未取得推进太阳位置。';
    const arc = normalizeLongitude(progressedSun.longitude - natalSun.longitude);
    const directed = [...data.planets, ...data.angles]
      .filter((point) => ['Sun', 'Moon', 'Ascendant', 'Midheaven'].includes(point.name))
      .map((point) => ({
        name: `太阳弧${NATAL_POINT_NAME_MAP[point.name] ?? point.name}`,
        longitude: normalizeLongitude(point.longitude + arc),
      }));
    const aspects = formatCrossAspects(directed, buildNatalPoints(data), 6);
    return `太阳弧证据：推进弧约${arc.toFixed(2)}°；${aspects.join('；') || '未见容许度内的主要太阳弧触发'}。`;
  } catch {
    return '太阳弧证据：计算失败，不作为本次判断依据。';
  }
}

function datePartsFromWallClockTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function formatWallClockDateTime(timestamp: number) {
  const date = datePartsFromWallClockTimestamp(timestamp);
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')} ${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`;
}

export function calculateSolarReturnEvidence(
  data: AstrolabeData,
  targetYear: number,
): SolarReturnEvidence {
  const birth = parseBirthDateTime(data);
  const natalSun = data.planets.find((planet) => planet.name === 'Sun');
  const baseEvidence = {
    targetYear,
    timezone: data.birth.timezone,
    searchWindowHours: 48,
    coarseStepHours: 2,
    refinementToleranceMinutes: 1,
    refinementIterations: 0,
    aspects: [],
    source: 'celestine 太阳黄经；先以 2 小时步长定位过零区间，再以二分法细化返照时刻',
  };
  if (!birth || !natalSun) {
    return {
      ...baseEvidence,
      status: 'unavailable',
      limitations: ['出生时间或本命太阳经度资料不足，无法计算太阳返照。'],
    };
  }
  const maxDay = daysInAstrolabeScopeMonth(targetYear, birth.month);
  const centerDay = Math.min(birth.day, maxDay);
  const centerTimestamp = Date.UTC(
    targetYear,
    birth.month - 1,
    centerDay,
    birth.hour,
    birth.minute,
  );
  try {
    let previous: { timestamp: number; difference: number } | undefined;
    let bracket: { left: number; right: number; leftDifference: number } | undefined;
    let best: { timestamp: number; difference: number } | undefined;
    for (let offsetHours = -48; offsetHours <= 48; offsetHours += 2) {
      const timestamp = centerTimestamp + offsetHours * 3600000;
      const sun = calculateScopePlanets(data, datePartsFromWallClockTimestamp(timestamp)).find(
        (planet) => planet.name === 'Sun',
      );
      if (!sun) continue;
      const difference = signedLongitudeDifference(sun.longitude, natalSun.longitude);
      if (!best || Math.abs(difference) < Math.abs(best.difference)) {
        best = { timestamp, difference };
      }
      if (
        previous &&
        (previous.difference === 0 || difference === 0 || previous.difference * difference < 0)
      ) {
        bracket = {
          left: previous.timestamp,
          right: timestamp,
          leftDifference: previous.difference,
        };
        break;
      }
      previous = { timestamp, difference };
    }
    if (!best) {
      return {
        ...baseEvidence,
        status: 'unavailable',
        limitations: ['搜索窗口内未取得可用太阳位置。'],
      };
    }

    let finalTimestamp = best.timestamp;
    let iterations = 0;
    if (bracket) {
      let { left, right, leftDifference } = bracket;
      while (right - left > 60000 && iterations < 32) {
        const middle = Math.round((left + right) / 2);
        const sun = calculateScopePlanets(data, datePartsFromWallClockTimestamp(middle)).find(
          (planet) => planet.name === 'Sun',
        );
        if (!sun) break;
        const middleDifference = signedLongitudeDifference(sun.longitude, natalSun.longitude);
        if (leftDifference * middleDifference <= 0) {
          right = middle;
        } else {
          left = middle;
          leftDifference = middleDifference;
        }
        iterations += 1;
      }
      finalTimestamp = Math.round((left + right) / 2 / 60000) * 60000;
    }
    const finalDate = datePartsFromWallClockTimestamp(finalTimestamp);
    const returnPlanets = calculateScopePlanets(data, finalDate).filter((planet) =>
      ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(planet.name),
    );
    const returnSun = returnPlanets.find((planet) => planet.name === 'Sun');
    const residualDegrees = returnSun
      ? longitudeDistance(returnSun.longitude, natalSun.longitude)
      : Math.abs(best.difference);
    const aspects = formatCrossAspects(returnPlanets, buildNatalPoints(data), 8);
    return {
      ...baseEvidence,
      status: bracket ? 'exact' : 'approximate',
      dateTime: formatWallClockDateTime(finalTimestamp),
      residualDegrees: Number(residualDegrees.toFixed(6)),
      refinementIterations: iterations,
      aspects,
      limitations: bracket
        ? [
            '返照时刻按出生地固定时区的当地钟表时间表达。',
            '分钟级细化只说明数值搜索收敛范围，不代表底层星历达到观测级精度。',
          ]
        : ['未找到太阳黄经过零区间，仅返回搜索窗口内最接近的 2 小时取样点。'],
    };
  } catch {
    return {
      ...baseEvidence,
      status: 'unavailable',
      limitations: ['太阳返照计算失败，不作为本次判断依据。'],
    };
  }
}

function buildSolarReturnEvidence(data: AstrolabeData, targetYear: number) {
  const evidence = calculateSolarReturnEvidence(data, targetYear);
  if (evidence.status === 'unavailable' || !evidence.dateTime) {
    return `太阳返照证据：${evidence.limitations.join('；')}`;
  }
  const precision =
    evidence.status === 'exact'
      ? `粗搜步长${evidence.coarseStepHours}小时、二分细化至${evidence.refinementToleranceMinutes}分钟内，共${evidence.refinementIterations}次迭代`
      : `仅取得${evidence.coarseStepHours}小时步长的近似取样点`;
  return `太阳返照证据：返照当地钟表时刻${evidence.dateTime}（UTC${evidence.timezone >= 0 ? '+' : ''}${evidence.timezone}，太阳黄经残差${evidence.residualDegrees?.toFixed(4)}°）；搜索方法：${precision}；来源：${evidence.source}；精度边界：${evidence.limitations.join('；')}；${evidence.aspects.join('；') || '未见容许度内的主要返照对本命触发'}。`;
}

function isLongitudeInHouse(longitude: number, cusp: number, nextCusp: number) {
  if (nextCusp > cusp) {
    return longitude >= cusp && longitude < nextCusp;
  }

  return longitude >= cusp || longitude < nextCusp;
}

function getNatalHouseByLongitude(longitude: number, cusps: number[]) {
  const normalized = normalizeLongitude(longitude);
  for (let index = 0; index < cusps.length; index += 1) {
    const cusp = normalizeLongitude(cusps[index]);
    const nextCusp = normalizeLongitude(cusps[(index + 1) % cusps.length]);
    if (isLongitudeInHouse(normalized, cusp, nextCusp)) {
      return index + 1;
    }
  }

  return null;
}

function buildHouseRulerChainEvidence(data: AstrolabeData) {
  const lines = data.houses
    .slice()
    .sort((first, second) => first.house - second.house)
    .map((house) => {
      const ruler = HOUSE_RULER_MAP[house.sign];
      if (!ruler) {
        return `第${house.house}宫${house.sign}宫头：宫主星未识别，只按宫头星座和宫内星体保守判断`;
      }

      const primary = data.planets.find((planet) => planet.name === ruler.primary);
      const modern = ruler.modern
        ? data.planets.find((planet) => planet.name === ruler.modern)
        : null;
      const primaryLabel = CELESTIAL_BODY_LABELS[ruler.primary] ?? ruler.primary;
      const primaryText = primary
        ? `${primaryLabel}落本命第${primary.house}宫${primary.formatted}${primary.retrograde ? '逆行' : ''}`
        : `${primaryLabel}未提供落点`;
      const modernText =
        ruler.modern && modern
          ? `，现代辅看${CELESTIAL_BODY_LABELS[ruler.modern] ?? ruler.modern}落本命第${modern.house}宫`
          : ruler.modern
            ? `，现代辅看${CELESTIAL_BODY_LABELS[ruler.modern] ?? ruler.modern}但未提供落点`
            : '';

      return `第${house.house}宫${house.sign}宫头，${primaryText}${modernText}`;
    });

  return `本命宫主星链条：${lines.join('；')}；宫主星链条只用于定位议题落点，不能脱离本命星体、相位和行运触发单独下结论。`;
}

function parseBirthCoordinates(data: AstrolabeData) {
  const matched = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(data.birth.location);
  if (!matched) {
    return { latitude: 0, longitude: 0 };
  }

  return {
    latitude: Number(matched[1]),
    longitude: Number(matched[2]),
  };
}

function getTransitBodiesForScope(scope: AstrolabeScopeMode) {
  if (scope === 'yearly') {
    return new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
  }
  if (scope === 'monthly') {
    return new Set(['Jupiter', 'Saturn', 'Mars', 'Venus', 'Mercury', 'Sun']);
  }
  return new Set(['Jupiter', 'Saturn', 'Mars', 'Venus', 'Mercury', 'Sun', 'Moon']);
}

function buildTransitHouseEvidence(
  data: AstrolabeData,
  scope: AstrolabeScopeMode,
  target: { year: number; month: number; day: number },
) {
  const cusps = getNatalHouseCusps(data);
  if (!cusps) {
    return '行运落宫提示：本命宫头资料不足，无法可靠判断行运行星落入本命哪一宫；不得编造行运落宫。';
  }

  try {
    const coordinates = parseBirthCoordinates(data);
    const planets = calculatePlanets(
      {
        year: target.year,
        month: target.month,
        day: target.day,
        hour: 12,
        minute: 0,
        second: 0,
        timezone: 8,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      {
        houseSystem: 'placidus',
        includeAsteroids: false,
        includeChiron: false,
        includeLilith: false,
        includeNodes: false,
        includeLots: false,
      },
    );
    const allowedBodies = getTransitBodiesForScope(scope);
    const lines = planets
      .filter((planet) => allowedBodies.has(planet.name))
      .map((planet) => {
        const natalHouse = getNatalHouseByLongitude(planet.longitude, cusps);
        const label = CELESTIAL_BODY_LABELS[planet.name] ?? planet.name;
        const position = formatAstrolabePlanetPosition(planet);
        const retrograde = planet.isRetrograde ? '，逆行' : '';
        return natalHouse
          ? `${label}${position}${retrograde}落本命第${natalHouse}宫`
          : `${label}${position}${retrograde}未能定位本命落宫`;
      });

    return lines.length
      ? `行运落宫提示：${lines.join('；')}；落宫只说明被触发的生活领域，必须与行运相位、本命宫主星和【问题】互证。`
      : '行运落宫提示：未取得可用行运行星位置，不得编造行运落宫。';
  } catch {
    return '行运落宫提示：行运行星位置计算失败，不能使用行运落宫作证据。';
  }
}

function buildTransitEvidence(
  data: AstrolabeData,
  target: { year: number; month: number; day: number },
) {
  const natalPoints = buildNatalPoints(data);
  if (natalPoints.length < 3) {
    return '行运证据：本命点经度资料不足，无法可靠计算行运行星与本命点相位；请只按本命盘做长期结构分析，不要硬断具体年份。';
  }

  try {
    const julianDate = time.toJulianDate({
      year: target.year,
      month: target.month,
      day: target.day,
      hour: 12,
      minute: 0,
      second: 0,
      timezone: 8,
    });
    const result = calculateTransits(natalPoints, julianDate, {
      aspectTypes: [
        AspectType.Conjunction,
        AspectType.Sextile,
        AspectType.Square,
        AspectType.Trine,
        AspectType.Opposition,
      ],
      transitingBodies: TRANSITING_BODIES,
      minimumStrength: 35,
      includeOutOfSign: true,
    });
    const transitLines = result.transits
      .sort(
        (first, second) => second.strength - first.strength || first.deviation - second.deviation,
      )
      .slice(0, 10)
      .map(formatTransitLine);

    if (transitLines.length === 0) {
      return '行运证据：所选日期未检测到进入当前筛选容许度的主要行运相位；请以本命盘结构为主，只把该时间段当作弱触发背景。';
    }

    return `行运证据：${transitLines.join('；')}。来源为 celestine 行运计算；归一化容许度位置只用于相位紧密分层，不代表事件概率或吉凶比例。`;
  } catch {
    return '行运证据：行运计算失败；请以本命盘结构为主，不要硬断具体年份。';
  }
}

export function buildAstrolabeScopeContext(
  data: AstrolabeData | null | undefined,
  scope: AstrolabeScopeMode,
  dateStr: string,
): AstrolabeScopeContext {
  if (!data) {
    return {
      scope: 'natal',
      dateStr: '',
      displayText: '仅使用本命信息',
      displayLabel: '本命盘',
      promptText: [
        '分析对象：本命盘。',
        '时间边界：只判断长期性格结构、人生主题、稳定倾向与可长期调整的模式；不得自行指定流年、流月、流日或具体应期。',
        ASTROLABE_EVIDENCE_SCOPE_NOTE,
      ].join('\n'),
    };
  }

  const houseRulerChain = buildHouseRulerChainEvidence(data);
  if (scope === 'natal' || scope === 'full') {
    return {
      scope,
      dateStr: '',
      displayText: scope === 'full' ? '本命盘与完整行运资料' : '仅使用本命信息',
      displayLabel: scope === 'full' ? '完整输出版' : '本命盘',
      promptText: [
        scope === 'full' ? '分析对象：本命盘与完整行运资料。' : '分析对象：本命盘。',
        houseRulerChain,
        '时间边界：只判断长期性格结构、人生主题、稳定倾向与可长期调整的模式；不得自行指定流年、流月、流日或具体应期。',
        ASTROLABE_EVIDENCE_SCOPE_NOTE,
      ].join('\n'),
    };
  }

  const target = normalizeTargetDate(scope, dateStr);
  const normalizedDateStr = formatDateStr(scope, target);
  const scopeLabel = SCOPE_LABEL_MAP[scope];
  const displayText = `${scopeLabel} · ${normalizedDateStr}`;
  const anchorDate = formatAnchorDate(target);
  const transitEvidence = buildTransitEvidence(data, target);
  const transitHouseEvidence = buildTransitHouseEvidence(data, scope, target);
  const advancedYearlyEvidence =
    scope === 'yearly'
      ? [
          buildSolarReturnEvidence(data, target.year),
          buildSecondaryProgressionEvidence(data, target.year),
          buildSolarArcEvidence(data, target.year),
        ]
      : [];

  return {
    scope,
    dateStr: normalizedDateStr,
    displayText,
    displayLabel: `${scopeLabel}${normalizedDateStr}`,
    promptText: [
      `分析对象：${scopeLabel}${normalizedDateStr}。`,
      `取样时间：${anchorDate}（按北京时间中午取样，用于计算行运行星触发）。`,
      houseRulerChain,
      transitEvidence,
      transitHouseEvidence,
      ...advancedYearlyEvidence,
      ASTROLABE_EVIDENCE_SCOPE_NOTE,
      '时间边界：本命盘只定长期结构；所选流年、流月或流日只作为当前阶段触发与应期参考。回答时必须先围绕这个分析对象作答，不能把没有行运证据支持的年份、月份或日期硬说成确定应期。',
    ].join('\n'),
  };
}

export function getAstrolabeScopeLabel(scope: AstrolabeScopeMode) {
  return SCOPE_LABEL_MAP[scope] ?? SCOPE_LABEL_MAP.natal;
}
