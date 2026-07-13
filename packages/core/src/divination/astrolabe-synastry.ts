import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type {
  AstrolabeData,
  AstrolabeHouseOverlay,
  AstrolabePoint,
  AstrolabeSynastryAspect,
  AstrolabeSynastryAspectType,
  AstrolabeSynastryData,
} from '../types/divination';

const ASPECT_DEFINITIONS: Array<{
  type: AstrolabeSynastryAspectType;
  symbol: string;
  angle: number;
  defaultOrb: number;
  tendency: AstrolabeSynastryAspect['tendency'];
}> = [
  { type: '合相', symbol: '☌', angle: 0, defaultOrb: 8, tendency: '中性' },
  { type: '六合', symbol: '⚹', angle: 60, defaultOrb: 4, tendency: '和谐' },
  { type: '刑相', symbol: '□', angle: 90, defaultOrb: 6, tendency: '紧张' },
  { type: '拱相', symbol: '△', angle: 120, defaultOrb: 6, tendency: '和谐' },
  { type: '冲相', symbol: '☍', angle: 180, defaultOrb: 8, tendency: '紧张' },
];

const DEFAULT_POINT_NAMES = new Set([
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
  'Chiron',
  'Juno',
  'North Node',
  'South Node',
  'Ascendant',
  'Midheaven',
  'Descendant',
  'Imum Coeli',
]);

const CORE_POINT_LABELS = new Set(['太阳', '月亮', '水星', '金星', '火星', '上升', '下降']);

export interface AstrolabeSynastryOptions {
  pointNames?: string[];
  aspectOrbs?: Partial<Record<AstrolabeSynastryAspectType, number>>;
  includeHouseOverlays?: boolean;
  maxAspects?: number;
}

function normalizeLongitude(longitude: number) {
  if (!Number.isFinite(longitude)) throw new Error('合盘计算需要有效的黄经数据。');
  return ((longitude % 360) + 360) % 360;
}

function angularDistance(left: number, right: number) {
  const distance = Math.abs(normalizeLongitude(left) - normalizeLongitude(right));
  return Math.min(distance, 360 - distance);
}

function readPoints(chart: AstrolabeData, pointNames: Set<string>) {
  return [...chart.planets, ...chart.angles].filter((point) => pointNames.has(point.name));
}

function aspectTags(point1: AstrolabePoint, point2: AstrolabePoint) {
  const tags = ['西占合盘', '跨盘相位'];
  if (CORE_POINT_LABELS.has(point1.label) || CORE_POINT_LABELS.has(point2.label)) {
    tags.push('核心点');
  }
  if (point1.label === '月亮' || point2.label === '月亮') tags.push('情绪互动');
  if (point1.label === '金星' || point2.label === '金星') tags.push('关系价值');
  if (point1.label === '火星' || point2.label === '火星') tags.push('行动张力');
  if (point1.label === '水星' || point2.label === '水星') tags.push('沟通方式');
  if (point1.label === '土星' || point2.label === '土星') tags.push('责任边界');
  return tags;
}

function calculateAspects(
  chart1: AstrolabeData,
  chart2: AstrolabeData,
  options: AstrolabeSynastryOptions,
) {
  const selectedNames = new Set(options.pointNames ?? DEFAULT_POINT_NAMES);
  const points1 = readPoints(chart1, selectedNames);
  const points2 = readPoints(chart2, selectedNames);
  const results: AstrolabeSynastryAspect[] = [];

  for (const point1 of points1) {
    for (const point2 of points2) {
      const actualAngle = angularDistance(point1.longitude, point2.longitude);
      for (const definition of ASPECT_DEFINITIONS) {
        const allowedOrb = options.aspectOrbs?.[definition.type] ?? definition.defaultOrb;
        if (!Number.isFinite(allowedOrb) || allowedOrb <= 0 || allowedOrb > 15) {
          throw new Error(`${definition.type}容许度需在 0 到 15 度之间。`);
        }
        const orb = Math.abs(actualAngle - definition.angle);
        if (orb > allowedOrb) continue;
        results.push({
          person1: chart1.birth.name,
          person2: chart2.birth.name,
          point1: point1.label,
          point2: point2.label,
          type: definition.type,
          symbol: definition.symbol,
          exactAngle: definition.angle,
          actualAngle: Number(actualAngle.toFixed(4)),
          orb: Number(orb.toFixed(4)),
          allowedOrb,
          strength: Math.round(Math.max(0, 100 * (1 - orb / allowedOrb))),
          tendency: definition.tendency,
          tags: aspectTags(point1, point2),
        });
        break;
      }
    }
  }

  return results
    .sort((left, right) => right.strength - left.strength || left.orb - right.orb)
    .slice(0, options.maxAspects ?? 40);
}

function isLongitudeInArc(longitude: number, start: number, end: number) {
  const value = normalizeLongitude(longitude);
  const normalizedStart = normalizeLongitude(start);
  const normalizedEnd = normalizeLongitude(end);
  return normalizedStart < normalizedEnd
    ? value >= normalizedStart && value < normalizedEnd
    : value >= normalizedStart || value < normalizedEnd;
}

function locateHouse(longitude: number, houses: AstrolabePoint[]) {
  if (houses.length !== 12) return null;
  const sorted = [...houses].sort((left, right) => left.house - right.house);
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const next = sorted[(index + 1) % sorted.length];
    if (isLongitudeInArc(longitude, current.longitude, next.longitude)) {
      return { house: current.house, start: current.longitude, end: next.longitude };
    }
  }
  return null;
}

function calculateOverlays(owner: AstrolabeData, visitor: AstrolabeData, pointNames: Set<string>) {
  const selectedPoints = readPoints(visitor, pointNames);
  return selectedPoints.flatMap((point): AstrolabeHouseOverlay[] => {
    const placement = locateHouse(point.longitude, owner.houses);
    return placement
      ? [
          {
            owner: owner.birth.name,
            visitor: visitor.birth.name,
            point: point.label,
            house: placement.house,
            longitude: Number(normalizeLongitude(point.longitude).toFixed(4)),
            houseStart: Number(normalizeLongitude(placement.start).toFixed(4)),
            houseEnd: Number(normalizeLongitude(placement.end).toFixed(4)),
          },
        ]
      : [];
  });
}

function createEvidence(
  aspects: AstrolabeSynastryAspect[],
  overlays: AstrolabeHouseOverlay[],
): PromptEvidenceBundle {
  const aspectItems = aspects.slice(0, 16).map((aspect): PromptEvidenceItem => ({
    level: aspect.strength >= 75 && aspect.tags.includes('核心点') ? '主证' : '辅证',
    title: `${aspect.person1}${aspect.point1}${aspect.symbol}${aspect.person2}${aspect.point2}`,
    detail: `${aspect.type}，实际夹角 ${aspect.actualAngle.toFixed(2)}°，偏差 ${aspect.orb.toFixed(2)}°，相对强度 ${aspect.strength}%；此处只记录跨盘相位事实，不单独推导关系吉凶。`,
    source: '双方本命盘黄经与合盘容许度计算',
    weight: aspect.strength,
    tags: [...aspect.tags, aspect.tendency],
  }));
  const overlayItems = overlays
    .filter((overlay) => CORE_POINT_LABELS.has(overlay.point))
    .slice(0, 12)
    .map((overlay): PromptEvidenceItem => ({
      level: '辅证',
      title: `${overlay.visitor}${overlay.point}落入${overlay.owner}第${overlay.house}宫`,
      detail: `按${overlay.owner}宫头黄经区间计算的跨盘落宫事实，需结合宫主星、相位和双方现实问题解释。`,
      source: '双方本命盘黄经与宫头区间计算',
      weight: 45,
      tags: ['西占合盘', '跨盘落宫'],
    }));
  return {
    title: '西洋占星双盘证据',
    items: [
      ...aspectItems,
      ...overlayItems,
      {
        level: '限制',
        title: '合盘证据边界',
        detail:
          '相位与落宫是可核验的盘面关系，不等于关系结果；不得把单一和谐相位写成必然适合，也不得把单一紧张相位写成必然分离。',
        source: '结构化证据解释规则',
        weight: -100,
        tags: ['解释边界'],
      },
    ],
    emptyText: '当前所选计算点之间没有形成设定容许度内的主要相位。',
  };
}

export function analyzeAstrolabeSynastry(
  chart1: AstrolabeData,
  chart2: AstrolabeData,
  options: AstrolabeSynastryOptions = {},
): AstrolabeSynastryData {
  if (!chart1?.birth || !chart2?.birth) throw new Error('西占合盘需要两份完整本命盘。');
  if (
    options.maxAspects !== undefined &&
    (!Number.isInteger(options.maxAspects) || options.maxAspects < 1 || options.maxAspects > 200)
  ) {
    throw new Error('西占合盘最大相位数需为 1 到 200 之间的整数。');
  }
  const selectedNames = new Set(options.pointNames ?? DEFAULT_POINT_NAMES);
  const aspects = calculateAspects(chart1, chart2, options);
  const houseOverlays =
    options.includeHouseOverlays === false
      ? []
      : [
          ...calculateOverlays(chart1, chart2, selectedNames),
          ...calculateOverlays(chart2, chart1, selectedNames),
        ];
  const evidence = createEvidence(aspects, houseOverlays);
  const evidenceLines = formatPromptEvidenceBundle(evidence);

  return {
    people: [chart1.birth.name, chart2.birth.name],
    aspects,
    houseOverlays,
    summary: {
      totalAspects: aspects.length,
      harmonious: aspects.filter((item) => item.tendency === '和谐').length,
      tense: aspects.filter((item) => item.tendency === '紧张').length,
      neutral: aspects.filter((item) => item.tendency === '中性').length,
      strongAspects: aspects.filter((item) => item.strength >= 75).length,
      closestAspects: [...aspects].sort((left, right) => left.orb - right.orb).slice(0, 5),
    },
    evidence,
    promptText: ['【西占双盘结构化证据】', ...evidenceLines].join('\n'),
    methodology: {
      aspectAngles: Object.fromEntries(
        ASPECT_DEFINITIONS.map((item) => [item.type, item.angle]),
      ) as Record<AstrolabeSynastryAspectType, number>,
      defaultOrbs: Object.fromEntries(
        ASPECT_DEFINITIONS.map((item) => [item.type, item.defaultOrb]),
      ) as Record<AstrolabeSynastryAspectType, number>,
      notes: [
        '采用黄经最小夹角计算合、六合、刑、拱、冲五种主要跨盘相位。',
        '容许度为明确可配置参数，默认值随结果返回，便于复核不同占星口径。',
        '静态本命双盘不推断入相或出相；该判断需要星体速度与具体时间上下文。',
        '跨盘落宫按宫头黄经区间计算，宫制沿用输入本命盘。',
      ],
    },
    timestamp: Date.now(),
  };
}
