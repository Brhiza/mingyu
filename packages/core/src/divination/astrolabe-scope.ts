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
  buildAstronomicalTimeEvidence,
  type AstronomicalTimeEvidence,
} from '../calendar/astronomical-time';
import { resolveCivilTime, type CivilTimeZoneInput } from '../calendar/civil-time';

export type AstrolabeScopeContext = {
  scope: AstrolabeScopeMode;
  dateStr: string;
  displayText: string;
  displayLabel: string;
  promptText: string;
  solarReturnEvidence?: SolarReturnEvidence;
  secondaryProgressionEvidence?: SecondaryProgressionEvidence;
  solarArcEvidence?: SolarArcEvidence;
};

export type AstrolabeFullScopeContexts = {
  natal: AstrolabeScopeContext;
  yearly: AstrolabeScopeContext;
  monthly: AstrolabeScopeContext;
  daily: AstrolabeScopeContext;
};

export type AstrolabeAdvancedTechnique = '太阳返照' | '次限推进' | '太阳弧';

export interface AstrolabeAdvancedCalculationStep {
  key: string;
  technique: AstrolabeAdvancedTechnique;
  stage: '输入核验' | '时间映射' | '粗略搜索' | '数值细化' | '位置计算' | '推进弧计算' | '相位筛选';
  status: '已计算' | '近似' | '不可用';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  promptText: string;
  sources: string[];
  limitation: '高级时限步骤只证明太阳返照、次限推进或太阳弧的时间映射、位置计算与相位筛选如何形成；不得把数值精度解释为事件必然性或预测成功率';
}

export interface AstrolabeAdvancedAspectFact {
  key: string;
  technique: AstrolabeAdvancedTechnique;
  status: '命中容许度';
  movingPoint: string;
  natalPoint: string;
  aspectName: string;
  actualAngle: number;
  exactAngle: number;
  deviation: number;
  allowedOrb: number;
  normalizedOrbRatio: number;
  closeness: '紧密' | '中等' | '宽松';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '高级时限相位只描述推进点或返照点与本命点在设定容许度内的几何关系；偏差、紧密等级和数量不代表事件概率、吉凶比例或必然结果';
}

export interface AstrolabeAdvancedAspectSummaryFact {
  key: string;
  status: '有主要相位' | '未见主要相位' | '无法计算';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '高级时限相位汇总只说明当前筛选范围内是否列出主要几何相位；未见不等于没有其他弱相位，有相位也不等于现实事件必然发生';
}

export interface AstrolabeAdvancedLimitationFact {
  key: string;
  technique: AstrolabeAdvancedTechnique;
  type: '输入完整性' | '时间映射边界' | '数值精度边界' | '星历模型边界' | '解释边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束太阳返照、次限推进和太阳弧可以支持的时间与解释范围，不得被反向当作现实事件、吉凶或固定应期证据';
}

export interface AstrolabeAdvancedSummaryFact {
  key: string;
  technique: AstrolabeAdvancedTechnique;
  status: '证据链完整' | '证据链含近似' | '不适用' | '证据链有缺口';
  factKeys: string[];
  calculationStepCount: number;
  aspectFactCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '高级时限证据汇总只统计时间映射、位置或推进弧计算、主要相位、近似状态与限制覆盖；不得按数量、偏差或状态生成预测成功率、吉凶分数、事件概率或固定应期';
}

export type SolarReturnEvidence = {
  key: string;
  status: 'exact' | 'approximate' | 'not-applicable' | 'unavailable';
  targetYear: number;
  dateTime?: string;
  timezone: number;
  residualDegrees?: number;
  searchWindowHours: number;
  coarseStepHours: number;
  refinementToleranceMinutes: number;
  refinementIterations: number;
  aspects: string[];
  calculationSteps: AstrolabeAdvancedCalculationStep[];
  calculationChain: string[];
  aspectFacts: AstrolabeAdvancedAspectFact[];
  aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
  summaryFact: AstrolabeAdvancedSummaryFact;
  source: string;
  limitations: string[];
  limitationFacts: AstrolabeAdvancedLimitationFact[];
  timeScale?: AstronomicalTimeEvidence;
  promptText: string;
};

export interface SecondaryProgressionEvidence {
  key: string;
  status: 'calculated' | 'not-applicable' | 'unavailable';
  targetYear: number;
  age?: number;
  progressedDateTime?: string;
  aspects: string[];
  calculationSteps: AstrolabeAdvancedCalculationStep[];
  calculationChain: string[];
  aspectFacts: AstrolabeAdvancedAspectFact[];
  aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
  summaryFact: AstrolabeAdvancedSummaryFact;
  source: string;
  limitations: string[];
  limitationFacts: AstrolabeAdvancedLimitationFact[];
  promptText: string;
}

export interface SolarArcEvidence {
  key: string;
  status: 'calculated' | 'not-applicable' | 'unavailable';
  targetYear: number;
  age?: number;
  progressedDateTime?: string;
  arcDegrees?: number;
  aspects: string[];
  calculationSteps: AstrolabeAdvancedCalculationStep[];
  calculationChain: string[];
  aspectFacts: AstrolabeAdvancedAspectFact[];
  aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
  summaryFact: AstrolabeAdvancedSummaryFact;
  source: string;
  limitations: string[];
  limitationFacts: AstrolabeAdvancedLimitationFact[];
  promptText: string;
}

const ADVANCED_STEP_LIMITATION =
  '高级时限步骤只证明太阳返照、次限推进或太阳弧的时间映射、位置计算与相位筛选如何形成；不得把数值精度解释为事件必然性或预测成功率' as const;
const ADVANCED_ASPECT_LIMITATION =
  '高级时限相位只描述推进点或返照点与本命点在设定容许度内的几何关系；偏差、紧密等级和数量不代表事件概率、吉凶比例或必然结果' as const;
const ADVANCED_SUMMARY_LIMITATION =
  '高级时限相位汇总只说明当前筛选范围内是否列出主要几何相位；未见不等于没有其他弱相位，有相位也不等于现实事件必然发生' as const;
const ADVANCED_LIMITATION_FACT_LIMITATION =
  '限制事实用于约束太阳返照、次限推进和太阳弧可以支持的时间与解释范围，不得被反向当作现实事件、吉凶或固定应期证据' as const;
const ADVANCED_EVIDENCE_SUMMARY_LIMITATION =
  '高级时限证据汇总只统计时间映射、位置或推进弧计算、主要相位、近似状态与限制覆盖；不得按数量、偏差或状态生成预测成功率、吉凶分数、事件概率或固定应期' as const;

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
  const pattern =
    scope === 'yearly' ? /^\d{4}$/ : scope === 'monthly' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  const expected = scope === 'yearly' ? 'YYYY' : scope === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD';
  if (!pattern.test(dateStr.trim())) {
    throw new Error(`${SCOPE_LABEL_MAP[scope]}必须提供 ${expected} 格式的明确日期。`);
  }

  const parsed = parseDateParts(dateStr);
  if (!parsed) {
    throw new Error(`${SCOPE_LABEL_MAP[scope]}日期无效或超出 1900-2200 年范围。`);
  }

  const year = parsed.year;
  const month = scope === 'yearly' ? 7 : parsed.month!;
  const day = scope === 'yearly' ? 1 : scope === 'monthly' ? 15 : parsed.day!;

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
  return `${transitingBody}${transit.symbol}${natalPoint}（${aspect}，偏差${transit.deviation.toFixed(2)}°，${phase}${retrograde}）`;
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
    actualAngle: distance,
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

function resolveScopeTimezone(
  data: AstrolabeData,
  date: { year: number; month: number; day: number; hour: number; minute: number },
) {
  return resolveCivilTime({
    ...date,
    second: 0,
    ...getScopeTimeZoneInput(data),
  }).timezone;
}

function getScopeTimeZoneInput(data: AstrolabeData): CivilTimeZoneInput {
  if (data.birth.timeZoneId) return { timeZoneId: data.birth.timeZoneId };
  if (!Number.isFinite(data.birth.timezone)) {
    throw new Error('星盘缺少有效时区，无法计算行运。');
  }
  return { timezone: data.birth.timezone };
}

function calculateScopePlanets(
  data: AstrolabeData,
  date: { year: number; month: number; day: number; hour: number; minute: number },
) {
  const coordinates = parseBirthCoordinates(data);
  const timezone = resolveScopeTimezone(data, date);
  return calculatePlanets(
    {
      ...date,
      second: 0,
      timezone,
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

function advancedTechniqueKey(technique: AstrolabeAdvancedTechnique) {
  return technique === '太阳返照'
    ? 'solar-return'
    : technique === '次限推进'
      ? 'secondary-progression'
      : 'solar-arc';
}

function buildAdvancedAspectFacts(
  technique: AstrolabeAdvancedTechnique,
  moving: Array<{ name: string; longitude: number }>,
  natal: Array<{ name: string; longitude: number }>,
  ownerStepKey: string,
  limit = 8,
): AstrolabeAdvancedAspectFact[] {
  const techniqueKey = advancedTechniqueKey(technique);
  return moving
    .flatMap((movingPoint) =>
      natal.flatMap((natalPoint) => {
        const aspect = resolveAdvancedAspect(movingPoint.longitude, natalPoint.longitude);
        if (!aspect) return [];
        const normalizedOrbRatio = Math.min(1, aspect.deviation / aspect.orb);
        const closeness: AstrolabeAdvancedAspectFact['closeness'] =
          normalizedOrbRatio <= 0.35 ? '紧密' : normalizedOrbRatio <= 0.7 ? '中等' : '宽松';
        const movingLabel = CELESTIAL_BODY_LABELS[movingPoint.name] ?? movingPoint.name;
        const natalLabel = NATAL_POINT_NAME_MAP[natalPoint.name] ?? natalPoint.name;
        return [
          {
            key: `${techniqueKey}:aspect:${movingPoint.name}:${natalPoint.name}:${aspect.name}`,
            technique,
            status: '命中容许度' as const,
            movingPoint: movingLabel,
            natalPoint: natalLabel,
            aspectName: aspect.name,
            actualAngle: Number(aspect.actualAngle.toFixed(6)),
            exactAngle: aspect.angle,
            deviation: Number(aspect.deviation.toFixed(6)),
            allowedOrb: aspect.orb,
            normalizedOrbRatio: Number(normalizedOrbRatio.toFixed(6)),
            closeness,
            ownerFactKeys: [ownerStepKey],
            ownerStepKeys: [ownerStepKey],
            promptText: `${movingLabel}${aspect.name}${natalLabel}（实际夹角${aspect.actualAngle.toFixed(2)}°，精确角${aspect.angle}°，偏差${aspect.deviation.toFixed(2)}°，允许容许度${aspect.orb}°，${closeness}）`,
            sources: ['celestine 推进或返照位置', '主要相位精确角与容许度表'],
            limitation: ADVANCED_ASPECT_LIMITATION,
          },
        ];
      }),
    )
    .sort((a, b) => a.deviation - b.deviation)
    .slice(0, limit)
    .map((item) => item);
}

function buildAdvancedAspectSummaryFact(
  technique: AstrolabeAdvancedTechnique,
  aspectFacts: AstrolabeAdvancedAspectFact[],
  unavailable = false,
): AstrolabeAdvancedAspectSummaryFact {
  const techniqueKey = advancedTechniqueKey(technique);
  const status = unavailable ? '无法计算' : aspectFacts.length ? '有主要相位' : '未见主要相位';
  return {
    key: `${techniqueKey}:aspect-summary`,
    status,
    factKeys: aspectFacts.map((item) => item.key),
    promptText:
      status === '无法计算'
        ? `${technique}缺少可用位置，无法筛选主要相位`
        : status === '有主要相位'
          ? `${technique}在当前容许度内列出${aspectFacts.length}组主要相位`
          : `${technique}在当前筛选容许度内未见主要相位`,
    sources: ['高级时限相位事实汇总'],
    limitation: ADVANCED_SUMMARY_LIMITATION,
  };
}

function buildAdvancedLimitationFacts(
  technique: AstrolabeAdvancedTechnique,
  limitations: string[],
  types: AstrolabeAdvancedLimitationFact['type'][],
  ownerStepKeys: string[] | string[][],
): AstrolabeAdvancedLimitationFact[] {
  const techniqueKey = advancedTechniqueKey(technique);
  return limitations.map((promptText, index) => {
    const keys = Array.isArray(ownerStepKeys[0])
      ? ((ownerStepKeys as string[][])[index] ?? [])
      : (ownerStepKeys as string[]);
    return {
      key: `${techniqueKey}:limitation:${index + 1}`,
      technique,
      type: types[index] ?? '解释边界',
      status: '适用' as const,
      ownerFactKeys: [...keys],
      ownerStepKeys: [...keys],
      promptText,
      sources: [
        types[index] === '输入完整性'
          ? '出生资料与本命位置完整性核验'
          : types[index] === '时间映射边界'
            ? '高级时限时间映射规则'
            : types[index] === '数值精度边界'
              ? '数值搜索与取样精度说明'
              : types[index] === '星历模型边界'
                ? 'celestine 星历模型'
                : '高级时限几何解释边界',
      ],
      limitation: ADVANCED_LIMITATION_FACT_LIMITATION,
    };
  });
}

function buildAdvancedEvidenceSummaryFact(args: {
  technique: AstrolabeAdvancedTechnique;
  evidenceStatus: SolarReturnEvidence['status'] | SecondaryProgressionEvidence['status'];
  calculationSteps: AstrolabeAdvancedCalculationStep[];
  aspectFacts: AstrolabeAdvancedAspectFact[];
  aspectSummaryFact: AstrolabeAdvancedAspectSummaryFact;
  limitationFacts: AstrolabeAdvancedLimitationFact[];
  additionalFactKeys?: string[];
}): AstrolabeAdvancedSummaryFact {
  const techniqueKey = advancedTechniqueKey(args.technique);
  const status: AstrolabeAdvancedSummaryFact['status'] =
    args.evidenceStatus === 'exact' || args.evidenceStatus === 'calculated'
      ? '证据链完整'
      : args.evidenceStatus === 'approximate'
        ? '证据链含近似'
        : args.evidenceStatus === 'not-applicable'
          ? '不适用'
          : '证据链有缺口';
  return {
    key: `${techniqueKey}:evidence-summary`,
    technique: args.technique,
    status,
    factKeys: Array.from(
      new Set([
        ...args.calculationSteps.map((item) => item.key),
        ...args.aspectFacts.map((item) => item.key),
        args.aspectSummaryFact.key,
        ...args.limitationFacts.map((item) => item.key),
        ...(args.additionalFactKeys ?? []),
      ]),
    ),
    calculationStepCount: args.calculationSteps.length,
    aspectFactCount: args.aspectFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `${args.technique}证据状态为${status}；记录计算步骤${args.calculationSteps.length}项、主要相位${args.aspectFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: [`${args.technique}时间映射、位置计算、相位筛选与限制事实汇总`],
    limitation: ADVANCED_EVIDENCE_SUMMARY_LIMITATION,
  };
}

function assertAdvancedTargetYear(targetYear: number) {
  if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 2200) {
    throw new Error('高级时限目标年份需在 1900-2200 之间。');
  }
}

export function calculateSecondaryProgressionEvidence(
  data: AstrolabeData,
  targetYear: number,
): SecondaryProgressionEvidence {
  assertAdvancedTargetYear(targetYear);
  const technique: AstrolabeAdvancedTechnique = '次限推进';
  const techniqueKey = advancedTechniqueKey(technique);
  const birth = parseBirthDateTime(data);
  const source = '次限一岁一日时间映射；celestine 推进位置与主要相位容许度表';
  const baseLimitations = ['出生时间或本命点资料不足时不生成次限相位。'];
  if (!birth) {
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:input`,
        technique,
        stage: '输入核验',
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear },
        result: { available: false },
        promptText: '出生时间资料不足，无法建立次限输入',
        sources: ['出生时间记录'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      baseLimitations,
      ['输入完整性'],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'unavailable',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'unavailable',
      targetYear,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations: baseLimitations,
      limitationFacts,
      promptText: `次限证据：${baseLimitations[0]}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${baseLimitations.join('；')}`,
    };
  }
  const age = targetYear - birth.year;
  if (age < 0) {
    const limitations = ['目标年早于出生年，次限一岁一日映射不适用。'];
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:input`,
        technique,
        stage: '输入核验',
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear, birthYear: birth.year },
        result: { applicable: false },
        promptText: `目标年${targetYear}早于出生年${birth.year}，次限不适用`,
        sources: ['出生年与目标年比较'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['时间映射边界'],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'not-applicable',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'not-applicable',
      targetYear,
      age,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `次限证据：${limitations[0]}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${limitations.join('；')}`,
    };
  }
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
    const inputStepKey = `${techniqueKey}:calculation:input`;
    const dateStepKey = `${techniqueKey}:calculation:progressed-date`;
    const positionStepKey = `${techniqueKey}:calculation:positions`;
    const aspectStepKey = `${techniqueKey}:calculation:aspects`;
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: inputStepKey,
        technique,
        stage: '输入核验',
        status: '已计算',
        dependsOnStepKeys: [],
        inputs: { birthYear: birth.year, targetYear },
        result: { age },
        promptText: `固定出生年${birth.year}与目标年${targetYear}，年龄差约${age}岁`,
        sources: ['出生时间与目标年份'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: dateStepKey,
        technique,
        stage: '时间映射',
        status: '已计算',
        dependsOnStepKeys: [inputStepKey],
        inputs: { age, rule: '一岁一日' },
        result: { progressedDateTime: progressedDate.toISOString() },
        promptText: `按一岁一日规则取出生后第${age}日作为次限日期${progressedDate.toISOString()}`,
        sources: ['次限一岁一日传统时间映射'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: positionStepKey,
        technique,
        stage: '位置计算',
        status: '已计算',
        dependsOnStepKeys: [dateStepKey],
        inputs: { progressedDateTime: progressedDate.toISOString() },
        result: { selectedPlanetCount: progressed.length },
        promptText: `计算次限日期的太阳、月亮、水星、金星与火星位置，共${progressed.length}个点`,
        sources: ['celestine 推进位置计算'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: aspectStepKey,
        technique,
        stage: '相位筛选',
        status: '已计算',
        dependsOnStepKeys: [positionStepKey],
        inputs: { selectedPlanetCount: progressed.length },
        result: { selectedAspectCount: 0 },
        promptText: '按主要相位精确角与容许度筛选次限对本命相位',
        sources: ['次限与本命点几何相位核验'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts = buildAdvancedAspectFacts(
      technique,
      progressed,
      buildNatalPoints(data),
      aspectStepKey,
    );
    calculationSteps[3].result.selectedAspectCount = aspectFacts.length;
    const limitations = [
      '一岁一日是传统时间映射，用于阶段性象征参考，不等于现实事件按天等比例发生。',
      '次限位置与相位受出生时间、时区和底层星历模型影响，不宣称达到观测级预测精度。',
      '次限相位只提供当前阶段触发线索，不代表事件概率、吉凶比例或固定应期。',
    ];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['时间映射边界', '星历模型边界', '解释边界'],
      [[dateStepKey], [positionStepKey], [aspectStepKey]],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'calculated',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    const aspects = aspectFacts.map((item) => item.promptText);
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'calculated',
      targetYear,
      age,
      progressedDateTime: progressedDate.toISOString(),
      aspects,
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `次限证据（一岁一日）：目标年约${age}岁，推进盘取出生后第${age}日（${progressedDate.toISOString()}）；${aspects.join('；') || '未见容许度内的主要次限触发'}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.join('；')}`,
    };
  } catch {
    const limitations = ['次限计算失败，不作为本次判断依据。'];
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:failed`,
        technique,
        stage: '位置计算',
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear },
        result: { available: false },
        promptText: limitations[0],
        sources: ['次限位置计算过程'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['星历模型边界'],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'unavailable',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'unavailable',
      targetYear,
      age,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `次限证据：${limitations[0]}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${limitations.join('；')}`,
    };
  }
}

export function calculateSolarArcEvidence(
  data: AstrolabeData,
  targetYear: number,
): SolarArcEvidence {
  assertAdvancedTargetYear(targetYear);
  const technique: AstrolabeAdvancedTechnique = '太阳弧';
  const techniqueKey = advancedTechniqueKey(technique);
  const birth = parseBirthDateTime(data);
  const natalSun = data.planets.find((planet) => planet.name === 'Sun');
  const source = '太阳弧按推进太阳与本命太阳差值平移；celestine 位置与主要相位容许度表';
  if (!birth || !natalSun) {
    const limitations = ['出生时间或本命太阳资料不足，无法计算太阳弧。'];
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:input`,
        technique,
        stage: '输入核验',
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear },
        result: { available: false },
        promptText: limitations[0],
        sources: ['出生时间与本命太阳位置'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['输入完整性'],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'unavailable',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'unavailable',
      targetYear,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `太阳弧证据：${limitations[0]}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${limitations.join('；')}`,
    };
  }
  const age = targetYear - birth.year;
  if (age < 0) {
    const limitations = ['目标年早于出生年，太阳弧不适用。'];
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:input`,
        technique,
        stage: '输入核验',
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear, birthYear: birth.year },
        result: { applicable: false },
        promptText: limitations[0],
        sources: ['出生年与目标年比较'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['时间映射边界'],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'not-applicable',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'not-applicable',
      targetYear,
      age,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `太阳弧证据：${limitations[0]}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${limitations.join('；')}`,
    };
  }
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
    if (!progressedSun) throw new Error('未取得推进太阳位置。');
    const arc = normalizeLongitude(progressedSun.longitude - natalSun.longitude);
    const directed = [...data.planets, ...data.angles]
      .filter((point) => ['Sun', 'Moon', 'Ascendant', 'Midheaven'].includes(point.name))
      .map((point) => ({
        name: `太阳弧${NATAL_POINT_NAME_MAP[point.name] ?? point.name}`,
        longitude: normalizeLongitude(point.longitude + arc),
      }));
    const inputStepKey = `${techniqueKey}:calculation:input`;
    const dateStepKey = `${techniqueKey}:calculation:progressed-date`;
    const arcStepKey = `${techniqueKey}:calculation:arc`;
    const directStepKey = `${techniqueKey}:calculation:directed-points`;
    const aspectStepKey = `${techniqueKey}:calculation:aspects`;
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: inputStepKey,
        technique,
        stage: '输入核验',
        status: '已计算',
        dependsOnStepKeys: [],
        inputs: { birthYear: birth.year, targetYear },
        result: { age },
        promptText: `固定出生年${birth.year}与目标年${targetYear}，年龄差约${age}岁`,
        sources: ['出生时间与目标年份'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: dateStepKey,
        technique,
        stage: '时间映射',
        status: '已计算',
        dependsOnStepKeys: [inputStepKey],
        inputs: { age, rule: '一岁一日' },
        result: { progressedDateTime: progressedDate.toISOString() },
        promptText: `按一岁一日规则取得太阳弧推进日期${progressedDate.toISOString()}`,
        sources: ['太阳弧一岁一日时间映射'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: arcStepKey,
        technique,
        stage: '推进弧计算',
        status: '已计算',
        dependsOnStepKeys: [dateStepKey],
        inputs: { progressedDateTime: progressedDate.toISOString() },
        result: { arcDegrees: Number(arc.toFixed(6)) },
        promptText: `由推进太阳与本命太阳经度差取得太阳弧${arc.toFixed(2)}°`,
        sources: ['celestine 推进太阳位置', '本命太阳黄经'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: directStepKey,
        technique,
        stage: '位置计算',
        status: '已计算',
        dependsOnStepKeys: [arcStepKey],
        inputs: { arcDegrees: Number(arc.toFixed(6)) },
        result: { directedPointCount: directed.length },
        promptText: `将太阳弧${arc.toFixed(2)}°平移至${directed.length}个选定本命点`,
        sources: ['太阳弧点位平移规则'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: aspectStepKey,
        technique,
        stage: '相位筛选',
        status: '已计算',
        dependsOnStepKeys: [directStepKey],
        inputs: { directedPointCount: directed.length },
        result: { selectedAspectCount: 0 },
        promptText: '按主要相位精确角与容许度筛选太阳弧对本命点相位',
        sources: ['太阳弧与本命点几何相位核验'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts = buildAdvancedAspectFacts(
      technique,
      directed,
      buildNatalPoints(data),
      aspectStepKey,
      6,
    );
    calculationSteps[4].result.selectedAspectCount = aspectFacts.length;
    const limitations = [
      '太阳弧把推进太阳与本命太阳的经度差平移到选定本命点，属于传统象征性时间技术。',
      '推进日期、太阳黄经和相位结果受出生时间、时区与底层星历模型影响，不宣称达到观测级预测精度。',
      '太阳弧相位只提供阶段性触发线索，不代表事件概率、吉凶比例或固定应期。',
    ];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['时间映射边界', '星历模型边界', '解释边界'],
      [[dateStepKey], [arcStepKey, directStepKey], [aspectStepKey]],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'calculated',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    const aspects = aspectFacts.map((item) => item.promptText);
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'calculated',
      targetYear,
      age,
      progressedDateTime: progressedDate.toISOString(),
      arcDegrees: Number(arc.toFixed(6)),
      aspects,
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `太阳弧证据：推进弧约${arc.toFixed(2)}°；${aspects.join('；') || '未见容许度内的主要太阳弧触发'}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.join('；')}`,
    };
  } catch {
    const limitations = ['太阳弧计算失败，不作为本次判断依据。'];
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:failed`,
        technique,
        stage: '位置计算',
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear },
        result: { available: false },
        promptText: limitations[0],
        sources: ['太阳弧位置计算过程'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      ['星历模型边界'],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: 'unavailable',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      key: `${techniqueKey}:${targetYear}`,
      status: 'unavailable',
      targetYear,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      source,
      limitations,
      limitationFacts,
      promptText: `太阳弧证据：${limitations[0]}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${limitations.join('；')}`,
    };
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
  assertAdvancedTargetYear(targetYear);
  const technique: AstrolabeAdvancedTechnique = '太阳返照';
  const techniqueKey = advancedTechniqueKey(technique);
  const birth = parseBirthDateTime(data);
  const natalSun = data.planets.find((planet) => planet.name === 'Sun');
  const targetTimezone = birth
    ? resolveScopeTimezone(data, {
        year: targetYear,
        month: birth.month,
        day: Math.min(birth.day, daysInAstrolabeScopeMonth(targetYear, birth.month)),
        hour: birth.hour,
        minute: birth.minute,
      })
    : data.birth.timezone;
  const baseEvidence = {
    key: `${techniqueKey}:${targetYear}`,
    targetYear,
    timezone: targetTimezone,
    searchWindowHours: 48,
    coarseStepHours: 2,
    refinementToleranceMinutes: 1,
    refinementIterations: 0,
    source: 'celestine 太阳黄经；先以 2 小时步长定位过零区间，再以二分法细化返照时刻',
  };
  const unavailableEvidence = (
    message: string,
    stage: AstrolabeAdvancedCalculationStep['stage'],
    sources: string[],
    evidenceStatus: Extract<
      SolarReturnEvidence['status'],
      'not-applicable' | 'unavailable'
    > = 'unavailable',
    limitationType: AstrolabeAdvancedLimitationFact['type'] = stage === '输入核验'
      ? '输入完整性'
      : '星历模型边界',
  ): SolarReturnEvidence => {
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: `${techniqueKey}:calculation:unavailable`,
        technique,
        stage,
        status: '不可用',
        dependsOnStepKeys: [],
        inputs: { targetYear },
        result: { available: false },
        promptText: message,
        sources,
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts: AstrolabeAdvancedAspectFact[] = [];
    const limitations = [message];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts, true);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      [limitationType],
      [calculationSteps[0].key],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus,
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
    });
    return {
      ...baseEvidence,
      status: evidenceStatus,
      aspects: [],
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      limitations,
      limitationFacts,
      promptText: `太阳返照证据：${message}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。相位汇总：${aspectSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。限制：${limitations.join('；')}`,
    };
  };
  if (!birth || !natalSun) {
    return unavailableEvidence('出生时间或本命太阳经度资料不足，无法计算太阳返照。', '输入核验', [
      '出生时间与本命太阳位置',
    ]);
  }
  if (targetYear < birth.year) {
    return unavailableEvidence(
      `目标年${targetYear}早于出生年${birth.year}，太阳返照不适用。`,
      '输入核验',
      ['出生年与目标年比较'],
      'not-applicable',
      '时间映射边界',
    );
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
      return unavailableEvidence('搜索窗口内未取得可用太阳位置。', '粗略搜索', [
        'celestine 太阳位置搜索',
      ]);
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
    const inputStepKey = `${techniqueKey}:calculation:input`;
    const coarseStepKey = `${techniqueKey}:calculation:coarse-search`;
    const refineStepKey = `${techniqueKey}:calculation:refinement`;
    const positionStepKey = `${techniqueKey}:calculation:return-positions`;
    const aspectStepKey = `${techniqueKey}:calculation:aspects`;
    const calculationSteps: AstrolabeAdvancedCalculationStep[] = [
      {
        key: inputStepKey,
        technique,
        stage: '输入核验',
        status: '已计算',
        dependsOnStepKeys: [],
        inputs: { targetYear, natalSunLongitude: natalSun.longitude },
        result: { centerDateTime: formatWallClockDateTime(centerTimestamp) },
        promptText: `以本命太阳黄经${natalSun.longitude.toFixed(6)}°和目标年${targetYear}生日附近时刻为返照搜索输入`,
        sources: ['本命太阳黄经', '出生日期与目标年份'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: coarseStepKey,
        technique,
        stage: '粗略搜索',
        status: bracket ? '已计算' : '近似',
        dependsOnStepKeys: [inputStepKey],
        inputs: { searchWindowHours: 48, coarseStepHours: 2 },
        result: {
          bracketFound: Boolean(bracket),
          bestSampleDateTime: formatWallClockDateTime(best.timestamp),
          bestSampleDifferenceDegrees: Number(best.difference.toFixed(6)),
        },
        promptText: bracket
          ? '在生日附近前后48小时按2小时步长找到太阳黄经过零区间'
          : '前后48小时粗搜未找到过零区间，保留最接近的2小时取样点',
        sources: ['celestine 太阳黄经粗略搜索'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: refineStepKey,
        technique,
        stage: '数值细化',
        status: bracket ? '已计算' : '近似',
        dependsOnStepKeys: [coarseStepKey],
        inputs: { refinementToleranceMinutes: 1 },
        result: {
          refinementIterations: iterations,
          finalDateTime: formatWallClockDateTime(finalTimestamp),
        },
        promptText: bracket
          ? `对过零区间二分${iterations}次，细化到1分钟内`
          : '没有过零区间，不执行二分细化',
        sources: ['太阳黄经差二分求根'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: positionStepKey,
        technique,
        stage: '位置计算',
        status: bracket ? '已计算' : '近似',
        dependsOnStepKeys: [refineStepKey],
        inputs: { returnDateTime: formatWallClockDateTime(finalTimestamp) },
        result: {
          returnPlanetCount: returnPlanets.length,
          residualDegrees: Number(residualDegrees.toFixed(6)),
        },
        promptText: `计算返照时刻七颗主要星体位置，太阳黄经残差${residualDegrees.toFixed(6)}°`,
        sources: ['celestine 返照星体位置'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
      {
        key: aspectStepKey,
        technique,
        stage: '相位筛选',
        status: bracket ? '已计算' : '近似',
        dependsOnStepKeys: [positionStepKey],
        inputs: { returnPlanetCount: returnPlanets.length },
        result: { selectedAspectCount: 0 },
        promptText: '按主要相位精确角与容许度筛选返照星体对本命点相位',
        sources: ['返照星体与本命点几何相位核验'],
        limitation: ADVANCED_STEP_LIMITATION,
      },
    ];
    const aspectFacts = buildAdvancedAspectFacts(
      technique,
      returnPlanets,
      buildNatalPoints(data),
      aspectStepKey,
      8,
    );
    calculationSteps[4].result.selectedAspectCount = aspectFacts.length;
    const aspects = aspectFacts.map((item) => item.promptText);
    const timeScale = buildAstronomicalTimeEvidence({
      ...finalDate,
      second: 0,
      ...getScopeTimeZoneInput(data),
    });
    const limitations = bracket
      ? [
          '返照时刻按出生地历史时区或明确固定偏移的当地钟表时间表达。',
          '分钟级细化只说明数值搜索收敛范围，不代表底层星历达到观测级精度。',
          '返照相位只提供目标年的阶段性触发线索，不代表事件概率、吉凶比例或固定应期。',
        ]
      : [
          '未找到太阳黄经过零区间，仅返回搜索窗口内最接近的 2 小时取样点。',
          '近似取样点和太阳黄经残差受底层星历模型影响，不宣称达到观测级预测精度。',
          '返照相位只提供目标年的阶段性触发线索，不代表事件概率、吉凶比例或固定应期。',
        ];
    const aspectSummaryFact = buildAdvancedAspectSummaryFact(technique, aspectFacts);
    const limitationFacts = buildAdvancedLimitationFacts(
      technique,
      limitations,
      bracket
        ? ['时间映射边界', '数值精度边界', '解释边界']
        : ['数值精度边界', '星历模型边界', '解释边界'],
      bracket
        ? [[coarseStepKey, refineStepKey], [refineStepKey], [aspectStepKey]]
        : [[coarseStepKey, refineStepKey], [positionStepKey], [aspectStepKey]],
    );
    const summaryFact = buildAdvancedEvidenceSummaryFact({
      technique,
      evidenceStatus: bracket ? 'exact' : 'approximate',
      calculationSteps,
      aspectFacts,
      aspectSummaryFact,
      limitationFacts,
      additionalFactKeys: [timeScale.key, timeScale.summaryFact.key],
    });
    const precision = bracket
      ? `粗搜步长${baseEvidence.coarseStepHours}小时、二分细化至${baseEvidence.refinementToleranceMinutes}分钟内，共${iterations}次迭代`
      : `仅取得${baseEvidence.coarseStepHours}小时步长的近似取样点`;
    const dateTime = formatWallClockDateTime(finalTimestamp);
    return {
      ...baseEvidence,
      status: bracket ? 'exact' : 'approximate',
      dateTime,
      residualDegrees: Number(residualDegrees.toFixed(6)),
      refinementIterations: iterations,
      aspects,
      calculationSteps,
      calculationChain: calculationSteps.map((item) => item.promptText),
      aspectFacts,
      aspectSummaryFact,
      summaryFact,
      timeScale,
      limitations,
      limitationFacts,
      promptText: `太阳返照证据：返照当地钟表时刻${dateTime}（UTC${baseEvidence.timezone >= 0 ? '+' : ''}${baseEvidence.timezone}，太阳黄经残差${residualDegrees.toFixed(4)}°）；${timeScale.promptText}；计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}；搜索方法：${precision}；相位汇总：${aspectSummaryFact.promptText}；证据汇总：${summaryFact.promptText}；来源：${baseEvidence.source}；精度边界：${limitations.join('；')}；${aspects.join('；') || '未见容许度内的主要返照对本命触发'}。`,
    };
  } catch {
    return unavailableEvidence('太阳返照计算失败，不作为本次判断依据。', '位置计算', [
      '太阳返照位置计算过程',
    ]);
  }
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

function parseBirthCoordinates(data: AstrolabeData) {
  if (
    typeof data.birth.latitude === 'number' &&
    Number.isFinite(data.birth.latitude) &&
    data.birth.latitude >= -90 &&
    data.birth.latitude <= 90 &&
    typeof data.birth.longitude === 'number' &&
    Number.isFinite(data.birth.longitude) &&
    data.birth.longitude >= -180 &&
    data.birth.longitude <= 180
  ) {
    return { latitude: data.birth.latitude, longitude: data.birth.longitude };
  }

  const matched = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(data.birth.location);
  if (!matched) {
    throw new Error('星盘缺少有效出生地经纬度，无法计算行运。');
  }

  const latitude = Number(matched[1]);
  const longitude = Number(matched[2]);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('星盘出生地经纬度超出有效范围，无法计算行运。');
  }

  return { latitude, longitude };
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
  timezone: number,
) {
  const cusps = getNatalHouseCusps(data);
  if (!cusps) {
    return '行运落宫：本命宫头资料不足。';
  }

  const planets = calculateScopePlanets(data, {
    ...target,
    hour: 12,
    minute: 0,
  });
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

  if (!lines.length) {
    throw new Error('未取得可用行运行星位置，无法计算行运落宫。');
  }
  return `行运落宫：取样时区UTC${timezone >= 0 ? '+' : ''}${timezone}；${lines.join('；')}。`;
}

function buildTransitEvidence(
  data: AstrolabeData,
  target: { year: number; month: number; day: number },
  timezone: number,
) {
  const natalPoints = buildNatalPoints(data);
  if (natalPoints.length < 3) {
    return '主要行运相位：本命点经度资料不足。';
  }

  const julianDate = time.toJulianDate({
    year: target.year,
    month: target.month,
    day: target.day,
    hour: 12,
    minute: 0,
    second: 0,
    timezone,
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
    .sort((first, second) => second.strength - first.strength || first.deviation - second.deviation)
    .slice(0, 4)
    .map(formatTransitLine);

  if (transitLines.length === 0) {
    return '主要行运相位：所选日期未见当前容许度内的主要相位。';
  }

  return `主要行运相位：${transitLines.join('；')}。`;
}

function formatAdvancedScopeFacts(params: {
  solarReturnEvidence?: SolarReturnEvidence;
  secondaryProgressionEvidence?: SecondaryProgressionEvidence;
  solarArcEvidence?: SolarArcEvidence;
}) {
  const lines: string[] = [];
  const solarReturn = params.solarReturnEvidence;
  const progression = params.secondaryProgressionEvidence;
  const solarArc = params.solarArcEvidence;
  const formatAspectFacts = (
    facts: AstrolabeAdvancedAspectFact[],
    technique: AstrolabeAdvancedTechnique,
  ) =>
    facts
      .filter(
        (fact) =>
          technique !== '太阳返照' ||
          !(
            fact.movingPoint === '太阳' &&
            fact.natalPoint === '太阳' &&
            fact.aspectName === '合相'
          ),
      )
      .slice(0, 1)
      .map(
        (fact) =>
          `${fact.movingPoint}${fact.aspectName}${fact.natalPoint}（偏差${fact.deviation.toFixed(2)}°，${fact.closeness}）`,
      )
      .join('；');

  if (solarReturn) {
    lines.push(
      `太阳返照${solarReturn.dateTime ? `（${solarReturn.dateTime}）` : ''}：${formatAspectFacts(solarReturn.aspectFacts, '太阳返照') || '暂无'}。`,
    );
  }
  if (progression) {
    lines.push(`次限相位：${formatAspectFacts(progression.aspectFacts, '次限推进') || '暂无'}。`);
  }
  if (solarArc) {
    lines.push(`太阳弧相位：${formatAspectFacts(solarArc.aspectFacts, '太阳弧') || '暂无'}。`);
  }

  return lines;
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
      promptText: '分析对象：本命盘。',
    };
  }

  if (scope === 'natal') {
    return {
      scope,
      dateStr: '',
      displayText: '仅使用本命信息',
      displayLabel: '本命盘',
      promptText: '分析对象：本命盘。',
    };
  }

  if (scope === 'full') {
    const reference = normalizeTargetDate('full', dateStr);
    const normalizedReferenceDate = formatDateStr('daily', reference);
    return {
      scope,
      dateStr: normalizedReferenceDate,
      displayText: `本命盘与完整行运资料 · ${normalizedReferenceDate}`,
      displayLabel: `完整输出版${normalizedReferenceDate}`,
      promptText: `分析对象：本命盘与以${normalizedReferenceDate}为基准的完整行运资料。`,
    };
  }

  const target = normalizeTargetDate(scope, dateStr);
  const normalizedDateStr = formatDateStr(scope, target);
  const scopeLabel = SCOPE_LABEL_MAP[scope];
  const displayText = `${scopeLabel} · ${normalizedDateStr}`;
  const anchorDate = formatAnchorDate(target);
  const targetTimezone = resolveScopeTimezone(data, { ...target, hour: 12, minute: 0 });
  const timezoneLabel = data.birth.timeZoneId
    ? `${data.birth.timeZoneId}（UTC${targetTimezone >= 0 ? '+' : ''}${targetTimezone}）`
    : `UTC${targetTimezone >= 0 ? '+' : ''}${targetTimezone}`;
  const transitEvidence = buildTransitEvidence(data, target, targetTimezone);
  const transitHouseEvidence = buildTransitHouseEvidence(data, scope, target, targetTimezone);
  const solarReturnEvidence =
    scope === 'yearly' ? calculateSolarReturnEvidence(data, target.year) : undefined;
  const secondaryProgressionEvidence =
    scope === 'yearly' ? calculateSecondaryProgressionEvidence(data, target.year) : undefined;
  const solarArcEvidence =
    scope === 'yearly' ? calculateSolarArcEvidence(data, target.year) : undefined;
  const advancedYearlyFacts = formatAdvancedScopeFacts({
    solarReturnEvidence,
    secondaryProgressionEvidence,
    solarArcEvidence,
  });

  return {
    scope,
    dateStr: normalizedDateStr,
    displayText,
    displayLabel: `${scopeLabel}${normalizedDateStr}`,
    promptText: [
      `分析对象：${scopeLabel}${normalizedDateStr}。`,
      `行运取样：${anchorDate}（${timezoneLabel}）。`,
      transitEvidence,
      transitHouseEvidence,
      ...advancedYearlyFacts,
    ].join('\n'),
    solarReturnEvidence,
    secondaryProgressionEvidence,
    solarArcEvidence,
  };
}

export function buildAstrolabeFullScopeContexts(
  data: AstrolabeData,
  referenceDateStr: string,
): AstrolabeFullScopeContexts {
  const reference = normalizeTargetDate('full', referenceDateStr);
  const dailyDate = formatDateStr('daily', reference);
  const monthlyDate = formatDateStr('monthly', reference);
  const yearlyDate = formatDateStr('yearly', reference);

  return {
    natal: buildAstrolabeScopeContext(data, 'natal', ''),
    yearly: buildAstrolabeScopeContext(data, 'yearly', yearlyDate),
    monthly: buildAstrolabeScopeContext(data, 'monthly', monthlyDate),
    daily: buildAstrolabeScopeContext(data, 'daily', dailyDate),
  };
}

export function getAstrolabeScopeLabel(scope: AstrolabeScopeMode) {
  return SCOPE_LABEL_MAP[scope] ?? SCOPE_LABEL_MAP.natal;
}
