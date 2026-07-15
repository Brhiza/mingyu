import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type {
  AstrolabeData,
  AstrolabeHouseOverlay,
  AstrolabePoint,
  AstrolabeSynastryCalculationStep,
  AstrolabeSynastryAspect,
  AstrolabeSynastryAspectType,
  AstrolabeSynastryCounterEvidenceFact,
  AstrolabeSynastryData,
  AstrolabeSynastryLimitationFact,
  AstrolabeSynastrySummaryFact,
} from '../types/divination';
import { classifyAspectClosenessByRatio } from './astrolabe-aspect-evidence';

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

const ASPECT_FACT_LIMITATION =
  '跨盘相位只证明双方计算点黄经最小夹角进入所设相位角与容许度范围；和谐或紧张标签不等于现实关系好坏、匹配程度、事件结果或发生概率' as const;
const HOUSE_OVERLAY_LIMITATION =
  '跨盘落宫只证明访客计算点黄经位于宫主本命盘某一宫头区间；不证明现实事件、关系角色、他人意图、匹配程度或固定应期' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明双方本命计算点、黄经、容许度与宫头区间经过固定几何规则形成当前相位和落宫事实，不证明现实关系、匹配程度、事件概率或固定应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录主要相位、跨盘落宫、关系类型与静态应期的覆盖情况；未命中不等于关系有利或不利，命中也不证明现实结果' as const;
const SUMMARY_LIMITATION =
  '双盘证据汇总只统计几何相位、容许度筛选与落宫定位事实，不得按数量生成匹配分、成功率、关系概率、吉凶结论或唯一应期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束跨盘相位与落宫能够支持的解释范围，不得被反向当作现实关系结果、他人意图、吉凶概率或保证有效建议的证据' as const;

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
        const orbRatio = Number((orb / allowedOrb).toFixed(4));
        results.push({
          key: `astrolabe:synastry:aspect:${point1.name}:${point2.name}:${definition.type}`,
          status: '已命中',
          person1: chart1.birth.name,
          person2: chart2.birth.name,
          point1Name: point1.name,
          point2Name: point2.name,
          point1: point1.label,
          point2: point2.label,
          type: definition.type,
          symbol: definition.symbol,
          exactAngle: definition.angle,
          actualAngle: Number(actualAngle.toFixed(4)),
          orb: Number(orb.toFixed(4)),
          allowedOrb,
          closeness: classifyAspectClosenessByRatio(orbRatio),
          orbRatio,
          source: '双方本命盘黄经最小夹角与当前相位允许容许度',
          sourcePointKey: `astrolabe:synastry:point:person1:${point1.name}`,
          targetPointKey: `astrolabe:synastry:point:person2:${point2.name}`,
          calculationStepKey: 'astrolabe:synastry:calculation:aspect-filter',
          promptText: `${chart1.birth.name}${point1.label}与${chart2.birth.name}${point2.label}实际夹角${actualAngle.toFixed(4)}°，距${definition.type}精确角${definition.angle}°偏差${orb.toFixed(4)}°，进入允许容许度${allowedOrb}°`,
          sources: ['双方本命计算点黄经', '主要相位精确角与当前容许度配置'],
          limitation: ASPECT_FACT_LIMITATION,
          tendency: definition.tendency,
          tags: aspectTags(point1, point2),
        });
        break;
      }
    }
  }

  const sorted = results.sort(
    (left, right) => left.orbRatio - right.orbRatio || left.orb - right.orb,
  );
  return {
    aspects: sorted.slice(0, options.maxAspects ?? 40),
    selectedPointCount1: points1.length,
    selectedPointCount2: points2.length,
    evaluatedPairCount: points1.length * points2.length,
    matchedAspectCount: sorted.length,
  };
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

function calculateOverlays(
  ownerPerson: 'person1' | 'person2',
  visitorPerson: 'person1' | 'person2',
  owner: AstrolabeData,
  visitor: AstrolabeData,
  pointNames: Set<string>,
) {
  const selectedPoints = readPoints(visitor, pointNames);
  return selectedPoints.flatMap((point): AstrolabeHouseOverlay[] => {
    const placement = locateHouse(point.longitude, owner.houses);
    return placement
      ? [
          {
            key: `astrolabe:synastry:house-overlay:${ownerPerson}:${visitorPerson}:${point.name}:house-${placement.house}`,
            status: '已定位',
            ownerPerson,
            visitorPerson,
            owner: owner.birth.name,
            visitor: visitor.birth.name,
            pointName: point.name,
            point: point.label,
            house: placement.house,
            longitude: Number(normalizeLongitude(point.longitude).toFixed(4)),
            houseStart: Number(normalizeLongitude(placement.start).toFixed(4)),
            houseEnd: Number(normalizeLongitude(placement.end).toFixed(4)),
            ownerChartKey: `astrolabe:synastry:chart:${ownerPerson}`,
            visitorPointKey: `astrolabe:synastry:point:${visitorPerson}:${point.name}`,
            calculationStepKey: 'astrolabe:synastry:calculation:house-overlays',
            promptText: `${visitor.birth.name}${point.label}黄经${normalizeLongitude(point.longitude).toFixed(4)}°落入${owner.birth.name}第${placement.house}宫区间${normalizeLongitude(placement.start).toFixed(4)}°至${normalizeLongitude(placement.end).toFixed(4)}°`,
            sources: ['访客本命计算点黄经', '宫主本命十二宫宫头黄经区间'],
            limitation: HOUSE_OVERLAY_LIMITATION,
          },
        ]
      : [];
  });
}

function isCoreOverlay(overlay: AstrolabeHouseOverlay) {
  return CORE_POINT_LABELS.has(overlay.point);
}

function buildBaseCalculationSteps(params: {
  chart1: AstrolabeData;
  chart2: AstrolabeData;
  options: AstrolabeSynastryOptions;
  selectedPointCount1: number;
  selectedPointCount2: number;
  evaluatedPairCount: number;
  matchedAspectCount: number;
  aspects: AstrolabeSynastryAspect[];
  overlays: AstrolabeHouseOverlay[];
}): AstrolabeSynastryCalculationStep[] {
  const maxAspects = params.options.maxAspects ?? 40;
  const houseOverlaysEnabled = params.options.includeHouseOverlays !== false;
  const customOrbTypes = Object.keys(params.options.aspectOrbs ?? {});
  return [
    {
      key: 'astrolabe:synastry:calculation:input',
      stage: '双盘输入校验',
      status: '已计算',
      inputs: { person1: params.chart1.birth.name, person2: params.chart2.birth.name },
      result: {
        validChartCount: 2,
        person1HouseCount: params.chart1.houses.length,
        person2HouseCount: params.chart2.houses.length,
      },
      dependsOnStepKeys: [],
      promptText: `已校验${params.chart1.birth.name}与${params.chart2.birth.name}两份本命盘及计算点黄经`,
      sources: ['双方本命出生资料、计算点黄经与宫头资料'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:calculation:point-selection',
      stage: '计算点筛选',
      status: '已计算',
      inputs: {
        requestedPointNames: params.options.pointNames ?? Array.from(DEFAULT_POINT_NAMES),
      },
      result: {
        selectedPointCount1: params.selectedPointCount1,
        selectedPointCount2: params.selectedPointCount2,
      },
      dependsOnStepKeys: ['astrolabe:synastry:calculation:input'],
      promptText: `按所选计算点筛出第一人${params.selectedPointCount1}个、第二人${params.selectedPointCount2}个有效点位`,
      sources: ['双方本命行星、交点与四轴点位名称'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:calculation:aspect-geometry',
      stage: '跨盘角距计算',
      status: '已计算',
      inputs: {
        selectedPointCount1: params.selectedPointCount1,
        selectedPointCount2: params.selectedPointCount2,
      },
      result: { evaluatedPairCount: params.evaluatedPairCount },
      dependsOnStepKeys: ['astrolabe:synastry:calculation:point-selection'],
      promptText: `双方所选点位共完成${params.evaluatedPairCount}组黄经最小夹角计算`,
      sources: ['黄经归一化与圆周最小夹角公式'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:calculation:aspect-filter',
      stage: '相位容许度筛选',
      status: '已计算',
      inputs: {
        aspectTypes: ASPECT_DEFINITIONS.map((item) => item.type),
        customOrbTypes,
        maxAspects,
      },
      result: {
        matchedAspectCount: params.matchedAspectCount,
        returnedAspectCount: params.aspects.length,
        truncatedAspectCount: Math.max(0, params.matchedAspectCount - params.aspects.length),
      },
      dependsOnStepKeys: ['astrolabe:synastry:calculation:aspect-geometry'],
      promptText: `按合、六合、刑、拱、冲的精确角和当前容许度筛出${params.matchedAspectCount}项相位，按归一化偏差排序后返回${params.aspects.length}项`,
      sources: ['主要相位精确角', '默认或自定义容许度', '归一化容许度偏差排序'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:calculation:house-cusps',
      stage: '宫头区间校验',
      status: '已计算',
      inputs: {
        includeHouseOverlays: houseOverlaysEnabled,
        person1HouseCount: params.chart1.houses.length,
        person2HouseCount: params.chart2.houses.length,
      },
      result: {
        person1HouseCuspsComplete: params.chart1.houses.length === 12,
        person2HouseCuspsComplete: params.chart2.houses.length === 12,
      },
      dependsOnStepKeys: ['astrolabe:synastry:calculation:input'],
      promptText: houseOverlaysEnabled
        ? `已核验双方宫头数量，第一人${params.chart1.houses.length}个、第二人${params.chart2.houses.length}个`
        : '当前明确关闭跨盘落宫计算，仍保留关闭状态',
      sources: ['双方本命宫头序号与黄经资料', '跨盘落宫开关'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:calculation:house-overlays',
      stage: '跨盘落宫定位',
      status: '已计算',
      inputs: {
        includeHouseOverlays: houseOverlaysEnabled,
        selectedPointCount1: params.selectedPointCount1,
        selectedPointCount2: params.selectedPointCount2,
      },
      result: {
        overlayCount: params.overlays.length,
        coreOverlayCount: params.overlays.filter(isCoreOverlay).length,
      },
      dependsOnStepKeys: [
        'astrolabe:synastry:calculation:point-selection',
        'astrolabe:synastry:calculation:house-cusps',
      ],
      promptText: houseOverlaysEnabled
        ? `访客点黄经按宫主十二宫宫头区间完成双向定位，记录${params.overlays.length}项跨盘落宫事实`
        : '跨盘落宫计算已关闭，未生成落宫事实',
      sources: ['访客计算点黄经', '宫主十二宫宫头黄经区间'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildCounterEvidenceFacts(params: {
  chart1: AstrolabeData;
  chart2: AstrolabeData;
  options: AstrolabeSynastryOptions;
  aspects: AstrolabeSynastryAspect[];
  overlays: AstrolabeHouseOverlay[];
}): AstrolabeSynastryCounterEvidenceFact[] {
  const harmonious = params.aspects.filter((item) => item.tendency === '和谐');
  const tense = params.aspects.filter((item) => item.tendency === '紧张');
  const overlaysEnabled = params.options.includeHouseOverlays !== false;
  const houseDataComplete =
    params.chart1.houses.length === 12 && params.chart2.houses.length === 12;
  return [
    {
      key: 'astrolabe:synastry:counter:aspect-coverage',
      type: '主要相位覆盖',
      status: params.aspects.length ? '有可用证据' : '未命中',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:aspect-filter',
        ...params.aspects.map((item) => item.key),
      ],
      promptText: params.aspects.length
        ? `当前返回${params.aspects.length}项进入容许度的主要跨盘相位`
        : '当前所选计算点未命中设定容许度内的合、六合、刑、拱或冲；未命中不等于双方没有互动或关系必然平稳',
      sources: ['全部跨盘黄经最小夹角与相位容许度筛选结果'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:counter:house-overlay-coverage',
      type: '跨盘落宫覆盖',
      status: !overlaysEnabled
        ? '已关闭'
        : !houseDataComplete
          ? '资料不足'
          : params.overlays.length
            ? '有可用证据'
            : '未命中',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:house-cusps',
        'astrolabe:synastry:calculation:house-overlays',
        ...params.overlays.map((item) => item.key),
      ],
      promptText: !overlaysEnabled
        ? '当前明确关闭跨盘落宫计算，不把缺少落宫事实误写成未命中'
        : !houseDataComplete
          ? '至少一方未提供完整十二宫宫头，无法安全生成跨盘落宫事实'
          : params.overlays.length
            ? `当前记录${params.overlays.length}项跨盘落宫事实`
            : '双方宫头完整但当前所选点未形成可定位落宫；不得补造宫位',
      sources: ['跨盘落宫开关、双方宫头完整性与落宫定位结果'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:counter:tendency-coverage',
      type: '关系类型覆盖',
      status:
        harmonious.length && tense.length
          ? '存在多类关系'
          : params.aspects.length
            ? '单一类型'
            : '未命中',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:aspect-filter',
        ...params.aspects.map((item) => item.key),
      ],
      promptText:
        harmonious.length && tense.length
          ? `同时记录${harmonious.length}项和谐相位与${tense.length}项紧张相位，必须并列解释，不得只取单一方向`
          : params.aspects.length
            ? `当前返回相位未同时覆盖和谐与紧张两类；单一类型不等于关系整体好坏`
            : '当前没有相位事实可供关系类型对照，不生成和谐或紧张结论',
      sources: ['已返回相位的和谐、紧张与中性标签逐项汇总'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:synastry:counter:static-timing',
      type: '静态应期边界',
      status: '固有限制',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:aspect-filter',
        'astrolabe:synastry:calculation:house-overlays',
        ...params.aspects.map((item) => item.key),
        ...params.overlays.map((item) => item.key),
      ],
      promptText:
        '当前只比较双方静态本命盘，未接入双方同层级行运、推运或具体时间上下文，不生成关系事件的具体年份、月份或日期应期',
      sources: ['当前分析对象为双方静态本命盘'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function buildSummaryFact(params: {
  selectedPointCount1: number;
  selectedPointCount2: number;
  evaluatedPairCount: number;
  matchedAspectCount: number;
  aspects: AstrolabeSynastryAspect[];
  overlays: AstrolabeHouseOverlay[];
}): AstrolabeSynastrySummaryFact {
  const aspectTypeCounts: Partial<Record<AstrolabeSynastryAspectType, number>> = {};
  const tendencyCounts: Record<'和谐' | '紧张' | '中性', number> = {
    和谐: 0,
    紧张: 0,
    中性: 0,
  };
  params.aspects.forEach((item) => {
    aspectTypeCounts[item.type] = (aspectTypeCounts[item.type] ?? 0) + 1;
    tendencyCounts[item.tendency] += 1;
  });
  const status = params.aspects.length
    ? params.overlays.length
      ? '相位与落宫均有证据'
      : '仅见相位证据'
    : params.overlays.length
      ? '仅见落宫证据'
      : '未见已列交叉事实';
  const truncatedAspectCount = Math.max(0, params.matchedAspectCount - params.aspects.length);
  return {
    key: 'astrolabe:synastry:evidence-summary',
    status,
    factKeys: [
      'astrolabe:synastry:calculation:input',
      'astrolabe:synastry:calculation:point-selection',
      'astrolabe:synastry:calculation:aspect-geometry',
      'astrolabe:synastry:calculation:aspect-filter',
      'astrolabe:synastry:calculation:house-cusps',
      'astrolabe:synastry:calculation:house-overlays',
      ...params.aspects.map((item) => item.key),
      ...params.overlays.map((item) => item.key),
    ],
    selectedPointCount1: params.selectedPointCount1,
    selectedPointCount2: params.selectedPointCount2,
    evaluatedPairCount: params.evaluatedPairCount,
    matchedAspectCount: params.matchedAspectCount,
    returnedAspectCount: params.aspects.length,
    truncatedAspectCount,
    houseOverlayCount: params.overlays.length,
    coreHouseOverlayCount: params.overlays.filter(isCoreOverlay).length,
    aspectTypeCounts,
    tendencyCounts,
    promptText: `双方分别选取${params.selectedPointCount1}与${params.selectedPointCount2}个计算点，核验${params.evaluatedPairCount}组角距，命中${params.matchedAspectCount}项主要相位并返回${params.aspects.length}项${truncatedAspectCount ? `（另有${truncatedAspectCount}项因最大返回数截断）` : ''}；记录跨盘落宫${params.overlays.length}项，其中核心点落宫${params.overlays.filter(isCoreOverlay).length}项`,
    sources: ['全部相位筛选、排序截断与跨盘落宫事实汇总'],
    limitation: SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(params: {
  options: AstrolabeSynastryOptions;
  aspects: AstrolabeSynastryAspect[];
  overlays: AstrolabeHouseOverlay[];
  summaryFact: AstrolabeSynastrySummaryFact;
}): AstrolabeSynastryLimitationFact[] {
  const definitions: Array<
    Pick<
      AstrolabeSynastryLimitationFact,
      'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'
    >
  > = [
    {
      key: 'astrolabe:synastry:limitation:aspect-geometry',
      type: '相位几何边界',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:aspect-filter',
        ...params.aspects.map((item) => item.key),
      ],
      promptText:
        '跨盘相位只表示黄经夹角进入精确角与容许度范围；不包含现实因果、关系角色、他人意图或事件结果',
      sources: ['圆周最小夹角与主要相位角定义'],
    },
    {
      key: 'astrolabe:synastry:limitation:orb-truncation',
      type: '容许度与截断边界',
      ownerFactKeys: [
        params.summaryFact.key,
        'astrolabe:synastry:calculation:aspect-filter',
        ...params.aspects.map((item) => item.key),
      ],
      promptText: `容许度是可配置口径，当前最多返回${params.options.maxAspects ?? 40}项相位；排序或截断只控制输出范围，不代表未返回相位不存在或不重要`,
      sources: ['当前相位容许度与最大返回数配置'],
    },
    {
      key: 'astrolabe:synastry:limitation:house-data',
      type: '落宫资料边界',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:house-cusps',
        'astrolabe:synastry:calculation:house-overlays',
        ...params.overlays.map((item) => item.key),
      ],
      promptText: '跨盘落宫沿用宫主本命盘的宫制和宫头区间；关闭落宫或宫头不完整时，不生成落宫结论',
      sources: ['宫主本命宫制、宫头区间与落宫开关'],
    },
    {
      key: 'astrolabe:synastry:limitation:tendency',
      type: '关系类型边界',
      ownerFactKeys: [
        'astrolabe:synastry:calculation:aspect-filter',
        ...params.aspects.map((item) => item.key),
      ],
      promptText:
        '不得把单一和谐相位写成必然适合，也不得把单一紧张相位写成必然冲突或分离；中性相位也不等于没有影响，必须结合双方现实问题并列解释',
      sources: ['相位几何事实与关系评价分离原则'],
    },
    {
      key: 'astrolabe:synastry:limitation:static-timing',
      type: '静态应期边界',
      ownerFactKeys: [params.summaryFact.key, ...params.summaryFact.factKeys],
      promptText:
        '静态本命双盘不判断入相、出相或具体关系应期；这些结论需要星体速度与双方同层级行运、推运资料',
      sources: ['本命盘与动态时限分析层级边界'],
    },
    {
      key: 'astrolabe:synastry:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key, ...params.summaryFact.factKeys],
      promptText:
        '不输出匹配总分、成功率、分手或离婚概率、出轨判断、合作收益保证、必然断语，也不以盘面关系替代现实沟通与风险核验',
      sources: ['盘面几何事实与现实决策分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function createEvidence(
  calculationSteps: AstrolabeSynastryCalculationStep[],
  aspects: AstrolabeSynastryAspect[],
  overlays: AstrolabeHouseOverlay[],
  counterEvidenceFacts: AstrolabeSynastryCounterEvidenceFact[],
  summaryFact: AstrolabeSynastrySummaryFact,
  limitationFacts: AstrolabeSynastryLimitationFact[],
): PromptEvidenceBundle {
  const aspectItems = aspects.slice(0, 16).map((aspect): PromptEvidenceItem => ({
    level: aspect.closeness === '紧密' && aspect.tags.includes('核心点') ? '主证' : '辅证',
    title: `${aspect.person1}${aspect.point1}${aspect.symbol}${aspect.person2}${aspect.point2}`,
    detail: `${aspect.promptText}，属于${aspect.closeness}等级；此处只记录跨盘相位事实，不单独推导关系吉凶；边界：${aspect.limitation}`,
    source: aspect.sources.join('、'),
    tags: [...aspect.tags, aspect.tendency],
  }));
  const overlayItems = overlays
    .filter(isCoreOverlay)
    .slice(0, 12)
    .map((overlay): PromptEvidenceItem => ({
      level: '辅证',
      title: `${overlay.visitor}${overlay.point}落入${overlay.owner}第${overlay.house}宫`,
      detail: `${overlay.promptText}；边界：${overlay.limitation}`,
      source: overlay.sources.join('、'),
      tags: ['西占合盘', '跨盘落宫'],
    }));
  return {
    title: '西洋占星双盘证据',
    items: [
      {
        level: '辅证',
        title: '西占双盘计算链',
        detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
        source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
        tags: ['西占合盘', '计算链'],
      },
      ...aspectItems,
      ...overlayItems,
      ...counterEvidenceFacts
        .filter((item) => item.status !== '有可用证据')
        .map((item): PromptEvidenceItem => ({
          level: '反证',
          title: `${item.type}：${item.status}`,
          detail: `${item.promptText}；边界：${item.limitation}`,
          source: item.sources.join('、'),
          tags: ['西占合盘', '反证', item.type, item.status],
        })),
      {
        level: '辅证',
        title: `西占双盘证据汇总：${summaryFact.status}`,
        detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
        source: summaryFact.sources.join('、'),
        tags: ['西占合盘', '证据汇总', summaryFact.status],
      },
      {
        level: '应期',
        title: '静态双盘应期边界',
        detail: `${limitationFacts.find((item) => item.type === '静态应期边界')?.promptText ?? ''}；相位或落宫成立不证明某个具体时间必然发生关系事件。`,
        source: '本命盘与动态时限分析层级边界',
        tags: ['西占合盘', '应期边界'],
      },
      {
        level: '限制',
        title: '合盘证据边界',
        detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
        source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
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
  const aspectCalculation = calculateAspects(chart1, chart2, options);
  const aspects = aspectCalculation.aspects;
  const houseOverlays =
    options.includeHouseOverlays === false
      ? []
      : [
          ...calculateOverlays('person1', 'person2', chart1, chart2, selectedNames),
          ...calculateOverlays('person2', 'person1', chart2, chart1, selectedNames),
        ];
  const calculationSteps = buildBaseCalculationSteps({
    chart1,
    chart2,
    options,
    selectedPointCount1: aspectCalculation.selectedPointCount1,
    selectedPointCount2: aspectCalculation.selectedPointCount2,
    evaluatedPairCount: aspectCalculation.evaluatedPairCount,
    matchedAspectCount: aspectCalculation.matchedAspectCount,
    aspects,
    overlays: houseOverlays,
  });
  const counterEvidenceFacts = buildCounterEvidenceFacts({
    chart1,
    chart2,
    options,
    aspects,
    overlays: houseOverlays,
  });
  const summaryFact = buildSummaryFact({
    selectedPointCount1: aspectCalculation.selectedPointCount1,
    selectedPointCount2: aspectCalculation.selectedPointCount2,
    evaluatedPairCount: aspectCalculation.evaluatedPairCount,
    matchedAspectCount: aspectCalculation.matchedAspectCount,
    aspects,
    overlays: houseOverlays,
  });
  calculationSteps.push({
    key: 'astrolabe:synastry:calculation:summary',
    stage: '证据汇总',
    status: '已计算',
    inputs: { factCount: summaryFact.factKeys.length },
    result: {
      status: summaryFact.status,
      returnedAspectCount: summaryFact.returnedAspectCount,
      truncatedAspectCount: summaryFact.truncatedAspectCount,
      houseOverlayCount: summaryFact.houseOverlayCount,
      tendencyCounts: Object.entries(summaryFact.tendencyCounts).map(
        ([key, value]) => `${key}:${value}`,
      ),
    },
    dependsOnStepKeys: [
      'astrolabe:synastry:calculation:aspect-filter',
      'astrolabe:synastry:calculation:house-overlays',
    ],
    promptText: summaryFact.promptText,
    sources: summaryFact.sources,
    limitation: CALCULATION_STEP_LIMITATION,
  });
  const limitationFacts = buildLimitationFacts({
    options,
    aspects,
    overlays: houseOverlays,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);
  const evidence = createEvidence(
    calculationSteps,
    aspects,
    houseOverlays,
    counterEvidenceFacts,
    summaryFact,
    limitationFacts,
  );
  const evidenceLines = formatPromptEvidenceBundle(evidence);

  return {
    key: 'astrolabe:synastry:evidence',
    status: '已计算',
    people: [chart1.birth.name, chart2.birth.name],
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    aspects,
    houseOverlays,
    summary: {
      totalAspects: aspects.length,
      harmonious: aspects.filter((item) => item.tendency === '和谐').length,
      tense: aspects.filter((item) => item.tendency === '紧张').length,
      neutral: aspects.filter((item) => item.tendency === '中性').length,
      tightAspects: aspects.filter((item) => item.closeness === '紧密').length,
      closestAspects: [...aspects].sort((left, right) => left.orb - right.orb).slice(0, 5),
    },
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText: [
      '【西占双盘结构化证据】',
      ...evidenceLines,
      `计算链概览：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `反证与应期边界：${counterEvidence.join('；')}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
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
        'closeness 与 orbRatio 描述偏差在允许容许度中的位置；结果不另行返回百分制强度，避免被误读为关系概率、匹配率或吉凶比例。',
        '静态本命双盘不推断入相或出相；该判断需要星体速度与具体时间上下文。',
        '跨盘落宫按宫头黄经区间计算，宫制沿用输入本命盘。',
      ],
    },
    timestamp: Date.now(),
  };
}
