import { getMonthDaysInfo, getYearInfo } from '../calendarTool';
import { SolarTerm } from 'tyme4ts';

import type { BaziChartResult } from '../baziTypes';
import type { LocalTimeRange } from '../baziTypes';
import {
  createCivilDate,
  createLocalTimeRange,
  getLuckCycleTimeRange,
  intersectLocalTimeRanges,
  toNativeDate,
  toSolarDateTimeInfo,
} from '../luckTiming';
import {
  areHeavenlyStemsOvercoming,
  getTenGod,
  getTenGodForBranch,
  isGanZhiPair,
} from '../baziUtils';
import { formatPromptEvidenceBundle } from '../../prompt-evidence/format';
import type { PromptEvidenceItem } from '../../prompt-evidence/types';
import {
  analyzeFortuneTriggers,
  type FortuneTriggerEvidenceResult,
  type FortuneTriggerLayer,
} from '../fortuneTriggerEvidence';
import {
  analyzeFortuneActionEvidence,
  formatFortuneActionFactLine,
  type FortuneActionEvidenceResult,
  type FortuneActionLayerInput,
} from '../fortuneActionEvidence';
import { getDayHourBreakdown } from './helpers/breakdown';
import {
  formatCycleLabel,
  formatYearLabel,
  resolveCycleIndex,
  resolveSelectedDay,
  resolveSelectedMonth,
  resolveSelectedYear,
} from './helpers/resolvers';
import type {
  BaziFortuneSelectionValue,
  FortuneSelectionContext,
  FortuneSelectionOptions,
} from './helpers/types';
import { getBaziRelationMappings } from '../baziMappingsData';

const BAZI_RELATION_MAPPINGS = getBaziRelationMappings();

export type {
  BaziFortuneSelectionValue,
  FortuneHourMode,
  FortuneSelectionContext,
  FortuneSelectionOptions,
} from './helpers/types';
export {
  buildBaziFortuneSelectionForDate,
  buildCurrentBaziFortuneSelection,
  buildCurrentBaziFortuneSelectionForScope,
  buildRecentBaziFortuneSelection,
  getCurrentBaziLuckCycle,
} from './current';

type PillarKey = 'year' | 'month' | 'day' | 'hour';

const PILLAR_LABELS: Record<PillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'hour'];

function splitGanZhi(ganZhi: string | undefined) {
  if (!ganZhi || ganZhi.length !== 2 || !isGanZhiPair(ganZhi[0], ganZhi[1])) return null;
  return {
    gan: ganZhi[0],
    zhi: ganZhi[1],
  };
}

function formatGanZhiTenGod(result: BaziChartResult, ganZhi: string | undefined): string {
  const parts = splitGanZhi(ganZhi);
  if (!parts || !result.dayMaster?.gan) return '未知';

  return `天干${parts.gan}为${getTenGod(parts.gan, result.dayMaster.gan)}，地支${parts.zhi}主气为${getTenGodForBranch(parts.zhi, result.dayMaster.gan)}`;
}

function compactTenGod(result: BaziChartResult, ganZhi: string) {
  return formatGanZhiTenGod(result, ganZhi)
    .replace(/天干(.)为/g, '干$1:')
    .replace(/地支(.)主气为/g, '支$1:')
    .replace(/，/g, '/');
}

function formatYearBreakdownLine(
  result: BaziChartResult,
  item: { year: number; age: number; ganZhi: string; timeRange: LocalTimeRange; clipped: boolean },
) {
  return `${item.year}年(${item.age}岁) ${item.ganZhi}｜${compactTenGod(result, item.ganZhi)}${item.clipped ? `｜本运有效时段：${formatClippedHourTimeRange(item.timeRange)}` : ''}`;
}

function formatLocalDateTime(time: LocalTimeRange['start']): string {
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')} ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:${String(time.second).padStart(2, '0')}`;
}

function formatMonthBreakdownLine(
  result: BaziChartResult,
  item: {
    month: number;
    label: string;
    ganZhi: string;
    startDate: string;
    endDate: string;
    startDateTime?: string;
    endDateTime?: string;
    startTermName?: string;
    endTermName?: string;
    timeRange: LocalTimeRange;
  },
) {
  const start = formatLocalDateTime(item.timeRange.start);
  const end = formatLocalDateTime(item.timeRange.end);
  const startName =
    !item.startDateTime || item.startDateTime === start ? item.startTermName || '' : '交运';
  const endName = !item.endDateTime || item.endDateTime === end ? item.endTermName || '' : '交运';
  return `${item.label} ${item.ganZhi}｜${compactTenGod(result, item.ganZhi)}｜${startName} ${start}～${endName} ${end}`;
}

function formatDayBreakdownLine(
  result: BaziChartResult,
  item: {
    date: string;
    ganZhi: string;
    boundaryNote?: string;
  },
) {
  return `${item.date} ${item.ganZhi}｜${compactTenGod(result, item.ganZhi)}${item.boundaryNote ? `｜${item.boundaryNote}` : ''}`;
}

function buildGanZhiTriggerSummary(
  result: BaziChartResult,
  ganZhi: string | undefined,
  scopeLabel: string,
): { summary: string; supplementalFacts: string[] } {
  const parts = splitGanZhi(ganZhi);
  if (!parts || !result.pillars) {
    return {
      summary: `${scopeLabel}触发：原局资料不足，暂无法判断合冲刑害。`,
      supplementalFacts: [],
    };
  }

  const majorEvents: string[] = [];
  const triggers: string[] = [];
  const supplementalFacts: string[] = [];

  PILLAR_KEYS.forEach((key) => {
    const pillar = result.pillars[key];
    if (!pillar) return;
    const pillarLabel = PILLAR_LABELS[key];

    const isStemClash =
      BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.TIAN_GAN_CHONG[parts.gan] === pillar.gan;
    const isBranchClash =
      BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_CHONG[parts.zhi] === pillar.zhi;
    const isStemOvercome = areHeavenlyStemsOvercoming(parts.gan, pillar.gan);
    const isSamePillar = parts.gan === pillar.gan && parts.zhi === pillar.zhi;

    if (isStemOvercome && isBranchClash) {
      majorEvents.push(`与${pillarLabel}天克地冲`);
    } else if (isSamePillar) {
      triggers.push(`干支${parts.gan}${parts.zhi}与${pillarLabel}${pillar.ganZhi}同柱伏吟`);
    } else {
      if (parts.gan === pillar.gan) {
        triggers.push(`天干${parts.gan}与${pillarLabel}${pillar.gan}同干`);
      }
      if (BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.TIAN_GAN_WU_HE[parts.gan] === pillar.gan) {
        triggers.push(`天干${parts.gan}合${pillarLabel}${pillar.gan}`);
      }
      if (isStemClash) {
        triggers.push(`天干${parts.gan}冲${pillarLabel}${pillar.gan}`);
      }

      if (parts.zhi === pillar.zhi) {
        triggers.push(`地支${parts.zhi}与${pillarLabel}${pillar.zhi}同支`);
      }
      if (BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_LIU_HE[parts.zhi] === pillar.zhi) {
        triggers.push(`地支${parts.zhi}合${pillarLabel}${pillar.zhi}`);
      }
      if (isBranchClash) {
        if (key === 'month') {
          majorEvents.push(`地支${parts.zhi}冲月柱${pillar.zhi}`);
        } else if (key === 'day') {
          majorEvents.push(`地支${parts.zhi}冲日柱${pillar.zhi}`);
        } else {
          triggers.push(`地支${parts.zhi}冲${pillarLabel}${pillar.zhi}`);
        }
      }
    }

    if (BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_XING[parts.zhi]?.includes(pillar.zhi)) {
      triggers.push(`地支${parts.zhi}刑${pillarLabel}${pillar.zhi}`);
    }
    if (BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_HAI[parts.zhi] === pillar.zhi) {
      triggers.push(`地支${parts.zhi}害${pillarLabel}${pillar.zhi}`);
    }
    if (BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_PO[parts.zhi] === pillar.zhi) {
      triggers.push(`地支${parts.zhi}破${pillarLabel}${pillar.zhi}`);
    }
  });

  const sanYuanList: Array<{ label: string; gz?: string }> = [
    { label: '命宫', gz: result.mingGong },
    { label: '胎元', gz: result.taiYuan },
  ];
  sanYuanList.forEach(({ label, gz }) => {
    if (!gz) return;
    const syParts = splitGanZhi(gz);
    if (!syParts) return;

    const isBranchClash =
      BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_CHONG[parts.zhi] === syParts.zhi;

    if (areHeavenlyStemsOvercoming(parts.gan, syParts.gan) && isBranchClash) {
      supplementalFacts.push(`${scopeLabel}干支${parts.gan}${parts.zhi}与${label}${gz}天克地冲`);
    } else if (isBranchClash) {
      supplementalFacts.push(`${scopeLabel}地支${parts.zhi}冲${label}${syParts.zhi}`);
    } else if (BAZI_RELATION_MAPPINGS.BASIC_MAPPINGS.DI_ZHI_LIU_HE[parts.zhi] === syParts.zhi) {
      supplementalFacts.push(`${scopeLabel}地支${parts.zhi}合${label}${syParts.zhi}`);
    }
  });

  // 全局三刑齐备检测
  const natalZhis = PILLAR_KEYS.map((k) => result.pillars[k]?.zhi).filter(Boolean) as string[];
  const combinedZhis = new Set([parts.zhi, ...natalZhis]);
  if (combinedZhis.has('寅') && combinedZhis.has('巳') && combinedZhis.has('申')) {
    if (!['寅', '巳', '申'].every((zhi) => natalZhis.includes(zhi))) {
      supplementalFacts.push(`${scopeLabel}补齐寅巳申三支（无恩之刑）`);
    }
  }
  if (combinedZhis.has('丑') && combinedZhis.has('戌') && combinedZhis.has('未')) {
    if (!['丑', '戌', '未'].every((zhi) => natalZhis.includes(zhi))) {
      supplementalFacts.push(`${scopeLabel}补齐丑戌未三支（恃势之刑）`);
    }
  }

  const allItems = [...majorEvents, ...triggers, ...supplementalFacts];
  return {
    summary: `${scopeLabel}触发：${allItems.length ? allItems.join('；') : '未见明显合冲刑害破。'}`,
    supplementalFacts,
  };
}

function buildFortuneEvidenceLines(params: {
  scope: FortuneSelectionContext['scope'];
  scopeLabel: string;
  cycleLabel: string;
  cycleGanZhi: string;
  selectedTitle: string;
  selectedGanZhi?: string;
  selectedTenGod?: string;
  timingText?: string;
  parentText?: string;
  limitText: string;
  triggerEvidence: FortuneTriggerEvidenceResult;
  actionEvidence?: FortuneActionEvidenceResult;
}) {
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '指定年限运限',
      detail: params.cycleGanZhi
        ? `${params.scopeLabel}，所属大运为${params.cycleLabel}（${params.cycleGanZhi}）。`
        : `${params.scopeLabel}，属于${params.cycleLabel}时段。`,
      source: '岁运资料',
      tags: [params.scope],
    },
  ];

  if (params.parentText) {
    items.push({
      level: '辅证',
      title: '上层岁运背景',
      detail: params.parentText,
      source: '岁运资料',
    });
  }

  if (params.selectedGanZhi) {
    items.push({
      level: '主证',
      title: params.selectedTitle,
      detail: `${params.selectedGanZhi}；${params.selectedTenGod ?? '十神资料不足'}`,
      source: '排盘计算',
    });
  }

  if (params.actionEvidence?.facts.length) {
    params.actionEvidence.facts.forEach((fact) => {
      const level: PromptEvidenceItem['level'] =
        fact.conditionStatus === '引用已裁决所忌条件'
          ? '反证'
          : fact.conditionStatus === '双向条件引用'
            ? '主证'
            : fact.conditionStatus === '引用有前提的喜用条件'
              ? '辅证'
              : fact.placement === '岁运透干'
                ? '主证'
                : '辅证';
      items.push({
        level,
        title: '岁运作用事实',
        detail: formatFortuneActionFactLine(fact),
        source: fact.hitSources.length ? fact.hitSources.join('、') : '岁运作用核验',
        tags: ['岁运作用', fact.level, fact.placement, fact.conditionStatus],
      });
    });
  }

  if (params.timingText) {
    items.push({
      level: '应期',
      title: '应期边界',
      detail: params.timingText,
      source: '岁运资料',
    });
  }

  items.push({
    level: '限制',
    title: '断事层级限制',
    detail: params.limitText,
    source: '解读边界',
  });

  return [
    ...formatPromptEvidenceBundle({ items }),
    '',
    params.triggerEvidence.promptText,
    ...(params.actionEvidence ? ['', params.actionEvidence.promptText] : []),
  ];
}

function fortuneLayer(
  id: string,
  type: FortuneTriggerLayer['type'],
  label: string,
  ganZhi: string,
  timeRange?: string,
): FortuneTriggerLayer {
  return { id, type, label, ganZhi, timeRange };
}

function actionLayer(
  id: string,
  type: FortuneActionLayerInput['type'],
  label: string,
  ganZhi: string,
  timeRange?: string,
): FortuneActionLayerInput {
  return { id, type, label, ganZhi, timeRange };
}

function analyzeSelectionTriggers(result: BaziChartResult, layers: FortuneTriggerLayer[]) {
  return analyzeFortuneTriggers(
    result,
    layers.filter(
      (layer) => layer.ganZhi.length === 2 && isGanZhiPair(layer.ganZhi[0], layer.ganZhi[1]),
    ),
  );
}

function analyzeSelectionActions(
  result: BaziChartResult,
  layers: FortuneActionLayerInput[],
  triggerEvidence: FortuneTriggerEvidenceResult,
) {
  return analyzeFortuneActionEvidence({
    result,
    layers: layers.filter(
      (layer) => layer.ganZhi.length === 2 && isGanZhiPair(layer.ganZhi[0], layer.ganZhi[1]),
    ),
    triggerEvidence,
  });
}

function getYearTimeRange(year: number): LocalTimeRange {
  const lichun = SolarTerm.fromIndex(year, 3);
  const start = lichun.getJulianDay().getSolarTime();
  const end = lichun.next(24).getJulianDay().getSolarTime();
  return createLocalTimeRange(
    toNativeDate(toSolarDateTimeInfo(start)),
    toNativeDate(toSolarDateTimeInfo(end)),
  );
}

function clipToCycle(range: LocalTimeRange, cycleRange: LocalTimeRange) {
  return intersectLocalTimeRanges(range, cycleRange);
}

function formatClippedHourTimeRange(range: LocalTimeRange): string {
  return `${formatLocalDateTime(range.start)}至${formatLocalDateTime(range.end)}（终点不含）`;
}

export function normalizeFortuneSelection(
  result: BaziChartResult,
  selection: BaziFortuneSelectionValue,
): BaziFortuneSelectionValue {
  if (selection.scope === 'natal' || selection.scope === 'full' || !result.luckInfo.cycles.length) {
    if (selection.scope === 'full' && result.luckInfo.cycles.length) {
      return { scope: 'full' };
    }
    return { scope: 'natal' };
  }

  const cycleIndex = resolveCycleIndex(result, selection);
  const cycle = result.luckInfo.cycles[cycleIndex];

  if (!cycle) {
    throw new Error(
      selection.scope === 'dayun'
        ? '选择大运时必须提供有效的大运序号。'
        : '选择流年、流月或流日时必须提供有效的大运序号，或提供可定位大运的流年年份。',
    );
  }

  if (selection.scope === 'dayun') {
    return {
      scope: 'dayun',
      cycleIndex,
    };
  }

  const year = resolveSelectedYear(cycle, selection);
  if (!year) {
    throw new Error('所选范围必须提供属于该大运的有效流年年份。');
  }

  if (selection.scope === 'year') {
    return {
      scope: 'year',
      cycleIndex,
      year,
    };
  }

  const month = resolveSelectedMonth(selection);
  if (!month) {
    throw new Error('选择流月或流日时必须提供有效的流月序号。');
  }

  if (selection.scope === 'month') {
    return {
      scope: 'month',
      cycleIndex,
      year,
      month,
    };
  }

  const day = resolveSelectedDay(year, month, selection);
  if (!day) {
    throw new Error('选择流日时必须提供该节令月内的有效流日序号。');
  }

  return {
    scope: 'day',
    cycleIndex,
    year,
    month,
    day,
  };
}

export function buildFortuneSelectionContext(
  result: BaziChartResult,
  selection: BaziFortuneSelectionValue,
  options: FortuneSelectionOptions = {},
): FortuneSelectionContext | null {
  const normalized = normalizeFortuneSelection(result, selection);
  if (normalized.scope === 'natal' || normalized.scope === 'full') {
    return null;
  }

  const cycle = result.luckInfo.cycles[normalized.cycleIndex ?? -1];
  if (!cycle) {
    return null;
  }

  const cycleLabel = formatCycleLabel(cycle);
  const cycleGanZhi = cycle.isXiaoyun ? '' : cycle.ganZhi;
  const cycleTimeRange = getLuckCycleTimeRange(cycle);
  const yearItem = cycle.years.find((item) => item.year === normalized.year);
  const monthInfoList = normalized.year ? getYearInfo(normalized.year).months : [];
  const monthInfo = normalized.month ? monthInfoList[normalized.month - 1] : undefined;
  const dayInfoList =
    normalized.year && normalized.month ? getMonthDaysInfo(normalized.year, normalized.month) : [];
  const dayInfo = dayInfoList.find((item) => item.day === normalized.day);

  const baseContext = {
    cycleIndex: normalized.cycleIndex ?? 0,
    cycleLabel,
    cycleGanZhi,
    cycleStartYear: cycle.year,
    cycleAge: cycle.age,
    cycleType: cycle.type,
    isXiaoyun: cycle.isXiaoyun,
    cycleTimeRange,
    year: yearItem?.year,
    yearGanZhi: yearItem?.ganZhi,
    yearAge: yearItem?.age,
  };

  if (normalized.scope === 'dayun') {
    const breakdown = cycle.years.flatMap((item) => {
      const fullRange = getYearTimeRange(item.year);
      const timeRange = clipToCycle(fullRange, cycleTimeRange);
      return timeRange
        ? [
            {
              year: item.year,
              ganZhi: item.ganZhi,
              age: item.age,
              timeRange,
              clipped:
                timeRange.startTimestamp !== fullRange.startTimestamp ||
                timeRange.endTimestamp !== fullRange.endTimestamp,
            },
          ]
        : [];
    });
    const cycleTenGod = cycleGanZhi ? formatGanZhiTenGod(result, cycleGanZhi) : undefined;
    const cycleTrigger = cycleGanZhi
      ? buildGanZhiTriggerSummary(result, cycleGanZhi, '大运')
      : undefined;
    const cycleTriggerSummary = cycleTrigger?.summary;
    const triggerEvidence = analyzeSelectionTriggers(result, [
      fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
    ]);
    const actionEvidence = analyzeSelectionActions(
      result,
      [
        actionLayer(
          'dayun',
          'dayun',
          cycleLabel,
          cycle.ganZhi,
          `${cycle.year}年起，约${cycle.age}岁交运`,
        ),
      ],
      triggerEvidence,
    );

    return {
      ...baseContext,
      scope: 'dayun',
      yearBreakdown: breakdown,
      displayLabel: cycleLabel,
      displayText: `${cycleLabel}（${cycle.year}年起，${cycle.age}岁交运）`,
      actionEvidence,
      promptPayload: {
        scopeLabel: `分析对象：${cycleLabel}`,
        summaryLines: [
          ...(cycleGanZhi
            ? [`大运干支：${cycleGanZhi}`, `大运十神：${cycleTenGod}`, cycleTriggerSummary!]
            : []),
          `${cycle.isXiaoyun ? '童运起始年份' : '起运年份'}：${cycle.year}年`,
          `${cycle.isXiaoyun ? '童运起始年龄' : '起运年龄'}：${cycle.age}岁`,
          cycle.isXiaoyun
            ? '类型：未起运，行童运'
            : `类型：${cycle.type === '小运' ? '童运' : cycle.type}`,
        ],
        selectedFacts: cycleGanZhi
          ? [`大运十神：${cycleTenGod}`, ...(cycleTrigger?.supplementalFacts ?? [])]
          : [],
        evidenceLines: buildFortuneEvidenceLines({
          scope: 'dayun',
          scopeLabel: `${cycleLabel}`,
          cycleLabel,
          cycleGanZhi,
          selectedTitle: '大运干支与十神',
          selectedGanZhi: cycleGanZhi || undefined,
          selectedTenGod: cycleTenGod,
          timingText: cycle.isXiaoyun
            ? `${formatLocalDateTime(cycleTimeRange.start)}起，至${formatLocalDateTime(cycleTimeRange.end)}交首运；童运时段。`
            : `${cycle.year}年起，约${cycle.age}岁交运；只作为十年阶段主题与强弱背景。`,
          limitText: cycle.isXiaoyun
            ? '童运只表示首运前时段；未给出具体流年时，不展开年度触发。'
            : '大运不能替代流年给出精确年份；未给出具体流年时，只能判断十年阶段，不展开年度触发。',
          triggerEvidence,
          actionEvidence,
        }),
        triggerEvidence,
        actionEvidence,
        breakdownTitle: '该大运包含的流年',
        breakdownLines: breakdown.map((item) => formatYearBreakdownLine(result, item)),
        detailGroups: [
          {
            title: '该大运包含的流年',
            lines: breakdown.map((item) => formatYearBreakdownLine(result, item)),
          },
        ],
      },
    };
  }

  if (!yearItem) {
    return null;
  }

  const fullYearTimeRange = getYearTimeRange(yearItem.year);
  const yearTimeRange = clipToCycle(fullYearTimeRange, cycleTimeRange);
  if (!yearTimeRange) return null;
  const yearClippedByCycle =
    yearTimeRange.startTimestamp !== fullYearTimeRange.startTimestamp ||
    yearTimeRange.endTimestamp !== fullYearTimeRange.endTimestamp;

  if (normalized.scope === 'year') {
    const breakdown = monthInfoList.flatMap((item, index) => {
      const timeRange = clipToCycle(item.timeRange, cycleTimeRange);
      return timeRange
        ? [
            {
              month: index + 1,
              label: item.month,
              ganZhi: item.ganZhi,
              startDate: item.startDate,
              endDate: item.endDate,
              startDateTime: item.startDateTime,
              endDateTime: item.endDateTime,
              startTermName: item.startTermName,
              endTermName: item.endTermName,
              timeRange,
            },
          ]
        : [];
    });
    const cycleYearLines = cycle.years.flatMap((item) => {
      const fullRange = getYearTimeRange(item.year);
      const timeRange = clipToCycle(fullRange, cycleTimeRange);
      return timeRange
        ? [
            formatYearBreakdownLine(result, {
              ...item,
              timeRange,
              clipped:
                timeRange.startTimestamp !== fullRange.startTimestamp ||
                timeRange.endTimestamp !== fullRange.endTimestamp,
            }),
          ]
        : [];
    });
    const monthLines = breakdown.map((item) => formatMonthBreakdownLine(result, item));
    const yearTenGod = formatGanZhiTenGod(result, yearItem.ganZhi);
    const yearTrigger = buildGanZhiTriggerSummary(result, yearItem.ganZhi, '流年');
    const yearTriggerSummary = yearTrigger.summary;
    const triggerEvidence = analyzeSelectionTriggers(result, [
      fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
      fortuneLayer('year', 'year', `${yearItem.year}年流年`, yearItem.ganZhi, `${yearItem.year}年`),
    ]);
    const actionEvidence = analyzeSelectionActions(
      result,
      [
        actionLayer(
          'dayun',
          'dayun',
          cycleLabel,
          cycle.ganZhi,
          `${cycle.year}年起，约${cycle.age}岁交运`,
        ),
        actionLayer(
          'year',
          'year',
          `${yearItem.year}年流年`,
          yearItem.ganZhi,
          `${yearItem.year}年`,
        ),
      ],
      triggerEvidence,
    );

    return {
      ...baseContext,
      scope: 'year',
      monthBreakdown: breakdown,
      displayLabel: formatYearLabel(yearItem),
      displayText: yearClippedByCycle
        ? `${yearItem.year}年 ${yearItem.ganZhi}（${yearItem.age}岁，本运内 ${formatLocalDateTime(yearTimeRange.start)} 至 ${formatLocalDateTime(yearTimeRange.end)}）`
        : `${yearItem.year}年 ${yearItem.ganZhi}（${yearItem.age}岁）`,
      actionEvidence,
      promptPayload: {
        scopeLabel: `分析对象：${yearItem.year}年流年`,
        summaryLines: [
          cycle.isXiaoyun ? '所属大运：未起运，童运时段' : `所属大运：${cycleLabel}`,
          `流年干支：${yearItem.ganZhi}`,
          `流年十神：${yearTenGod}`,
          yearTriggerSummary,
          `对应年龄：${yearItem.age}岁`,
          ...(yearClippedByCycle
            ? [`本运有效时段：${formatClippedHourTimeRange(yearTimeRange)}`]
            : []),
        ].filter(Boolean) as string[],
        selectedFacts: [
          `流年十神：${yearTenGod}`,
          ...yearTrigger.supplementalFacts,
          `对应年龄：${yearItem.age}岁`,
          ...(yearClippedByCycle
            ? [`本运有效时段：${formatClippedHourTimeRange(yearTimeRange)}`]
            : []),
        ],
        evidenceLines: buildFortuneEvidenceLines({
          scope: 'year',
          scopeLabel: `${yearItem.year}年流年`,
          cycleLabel,
          cycleGanZhi,
          selectedTitle: '流年干支与十神',
          selectedGanZhi: yearItem.ganZhi,
          selectedTenGod: yearTenGod,
          parentText: cycle.isXiaoyun
            ? '所属童运时段，流年需结合童运时间范围。'
            : `所属大运：${cycleLabel}（${cycleGanZhi}），年度判断必须承接该十年阶段。`,
          timingText: yearClippedByCycle
            ? `${yearItem.year}年（${yearItem.age}岁）本运有效时段：${formatClippedHourTimeRange(yearTimeRange)}；流月列表对应此时段。`
            : `${yearItem.year}年（${yearItem.age}岁）为年度触发；流月列表只作月份窗口参考。`,
          limitText: '未给出具体流月或流日时，不得把某月某日硬断成唯一应期。',
          triggerEvidence,
          actionEvidence,
        }),
        triggerEvidence,
        actionEvidence,
        breakdownTitle: '该流年包含的流月',
        breakdownLines: monthLines,
        detailGroups: [
          {
            title: '所属大运包含的流年',
            lines: cycleYearLines,
          },
          {
            title: '该流年包含的流月',
            lines: monthLines,
          },
        ],
      },
    };
  }

  if (!monthInfo || !normalized.month) {
    return null;
  }
  const monthTimeRange = clipToCycle(monthInfo.timeRange, cycleTimeRange);
  if (!monthTimeRange) return null;
  const monthClippedByCycle =
    monthTimeRange.startTimestamp !== monthInfo.timeRange.startTimestamp ||
    monthTimeRange.endTimestamp !== monthInfo.timeRange.endTimestamp;

  if (normalized.scope === 'month') {
    const breakdown = dayInfoList.flatMap((item) => {
      const timeRange = clipToCycle(item.timeRange, cycleTimeRange);
      return timeRange
        ? [
            {
              date: item.solarDate,
              label: item.solarLabel,
              ganZhi: item.ganZhi,
              startDateTime: item.startDateTime,
              endDateTime: item.endDateTime,
              boundaryNote: item.boundaryNote,
              timeRange,
            },
          ]
        : [];
    });
    const yearMonthBreakdown = monthInfoList.flatMap((item, index) => {
      const timeRange = clipToCycle(item.timeRange, cycleTimeRange);
      return timeRange
        ? [
            {
              month: index + 1,
              label: item.month,
              ganZhi: item.ganZhi,
              startDate: item.startDate,
              endDate: item.endDate,
              startDateTime: item.startDateTime,
              endDateTime: item.endDateTime,
              startTermName: item.startTermName,
              endTermName: item.endTermName,
              timeRange,
            },
          ]
        : [];
    });
    const yearMonthLines = yearMonthBreakdown.map((item) => formatMonthBreakdownLine(result, item));
    const dayLines = breakdown.map((item) => formatDayBreakdownLine(result, item));
    const monthTenGod = formatGanZhiTenGod(result, monthInfo.ganZhi);
    const monthTrigger = buildGanZhiTriggerSummary(result, monthInfo.ganZhi, '流月');
    const monthTriggerSummary = monthTrigger.summary;
    const triggerEvidence = analyzeSelectionTriggers(result, [
      fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
      fortuneLayer('year', 'year', `${yearItem.year}年流年`, yearItem.ganZhi),
      fortuneLayer(
        'month',
        'month',
        `${yearItem.year}年${monthInfo.month}流月`,
        monthInfo.ganZhi,
        `${monthInfo.startDate}至${monthInfo.endDate}`,
      ),
    ]);
    const actionEvidence = analyzeSelectionActions(
      result,
      [
        actionLayer(
          'dayun',
          'dayun',
          cycleLabel,
          cycle.ganZhi,
          `${cycle.year}年起，约${cycle.age}岁交运`,
        ),
        actionLayer(
          'year',
          'year',
          `${yearItem.year}年流年`,
          yearItem.ganZhi,
          `${yearItem.year}年`,
        ),
        actionLayer(
          'month',
          'month',
          `${yearItem.year}年${monthInfo.month}流月`,
          monthInfo.ganZhi,
          `${monthInfo.startDate}至${monthInfo.endDate}`,
        ),
      ],
      triggerEvidence,
    );

    return {
      ...baseContext,
      scope: 'month',
      month: normalized.month,
      monthGanZhi: monthInfo.ganZhi,
      monthLabel: monthInfo.month,
      monthBreakdown: [
        {
          month: normalized.month,
          label: monthInfo.month,
          ganZhi: monthInfo.ganZhi,
          startDate: monthInfo.startDate,
          endDate: monthInfo.endDate,
          startDateTime: monthInfo.startDateTime,
          endDateTime: monthInfo.endDateTime,
          startTermName: monthInfo.startTermName,
          endTermName: monthInfo.endTermName,
          timeRange: monthTimeRange,
        },
      ],
      dayBreakdown: breakdown,
      displayLabel: `${yearItem.year}年${monthInfo.month}`,
      displayText: monthClippedByCycle
        ? `${yearItem.year}年 ${monthInfo.month}（${monthInfo.ganZhi}，本运内 ${formatLocalDateTime(monthTimeRange.start)} 至 ${formatLocalDateTime(monthTimeRange.end)}）`
        : `${yearItem.year}年 ${monthInfo.month}（${monthInfo.ganZhi}，${monthInfo.startDateTime || monthInfo.startDate} 起，至 ${monthInfo.endDateTime || monthInfo.endDate} 交下节）`,
      actionEvidence,
      promptPayload: {
        scopeLabel: `分析对象：${yearItem.year}年${monthInfo.month}流月`,
        summaryLines: [
          cycle.isXiaoyun ? '所属大运：未起运，童运时段' : `所属大运：${cycleLabel}`,
          `所属流年：${yearItem.year}年 ${yearItem.ganZhi}`,
          `流月：${monthInfo.month} ${monthInfo.ganZhi}`,
          `流月十神：${monthTenGod}`,
          monthTriggerSummary,
          `日期范围：${monthInfo.startDate} 至 ${monthInfo.endDate}`,
          `交节时刻：${monthInfo.startTermName || ''} ${monthInfo.startDateTime || ''} 起，${monthInfo.endTermName || ''} ${monthInfo.endDateTime || ''} 交下节`,
          ...(monthClippedByCycle
            ? [`本运有效时段：${formatClippedHourTimeRange(monthTimeRange)}`]
            : []),
          ...(monthInfo.startTermEvidence
            ? [`起始交节核验：${monthInfo.startTermEvidence.promptText}`]
            : []),
          ...(monthInfo.endTermEvidence
            ? [`结束交节核验：${monthInfo.endTermEvidence.promptText}`]
            : []),
        ],
        selectedFacts: [`流月十神：${monthTenGod}`, ...monthTrigger.supplementalFacts],
        evidenceLines: [
          ...buildFortuneEvidenceLines({
            scope: 'month',
            scopeLabel: `${yearItem.year}年${monthInfo.month}流月`,
            cycleLabel,
            cycleGanZhi,
            selectedTitle: '流月干支与十神',
            selectedGanZhi: monthInfo.ganZhi,
            selectedTenGod: monthTenGod,
            parentText: cycle.isXiaoyun
              ? `所属童运时段；所属流年：${yearItem.year}年${yearItem.ganZhi}。`
              : `所属大运：${cycleLabel}（${cycleGanZhi}）；所属流年：${yearItem.year}年${yearItem.ganZhi}。`,
            timingText: `${monthInfo.startDate}至${monthInfo.endDate}，以节气月为准；${monthInfo.startTermName || ''} ${monthInfo.startDateTime || ''} 起，${monthInfo.endTermName || ''} ${monthInfo.endDateTime || ''} 交下节。`,
            limitText:
              '流月只细化年度主题，不能推翻本命、大运与流年主线；未给出流日时不硬给具体日期。',
            triggerEvidence,
            actionEvidence,
          }),
          ...(monthInfo.startTermEvidence ? [monthInfo.startTermEvidence.promptText] : []),
          ...(monthInfo.endTermEvidence ? [monthInfo.endTermEvidence.promptText] : []),
        ],
        triggerEvidence,
        actionEvidence,
        breakdownTitle: '该流月包含的流日',
        breakdownLines: dayLines,
        detailGroups: [
          {
            title: '所属流年包含的流月',
            lines: yearMonthLines,
          },
          {
            title: '该流月包含的流日',
            lines: dayLines,
          },
        ],
      },
    };
  }

  if (!dayInfo || !normalized.day) {
    return null;
  }
  const dayTimeRange = clipToCycle(dayInfo.timeRange, cycleTimeRange);
  if (!dayTimeRange) return null;

  const actualDate = dayInfo.solarDate;
  const [actualYear, actualMonth, actualDay] = actualDate.split('-').map(Number);
  // 流日与流时均按子初日界；流时再与交运、交节范围求交，保留边界日的实际时段。
  const monthTimeRangeForHours = clipToCycle(monthInfo.timeRange, cycleTimeRange);
  const rawHourBreakdown = getDayHourBreakdown(
    actualYear,
    actualMonth,
    actualDay,
    options.hourMode ?? 'twelve',
  );
  const hourBreakdown = rawHourBreakdown.flatMap((item) => {
    const interval = clipToCycle(item.interval, cycleTimeRange);
    if (!interval || !monthTimeRangeForHours) return [];
    const clippedToMonth = clipToCycle(interval, monthTimeRangeForHours);
    if (!clippedToMonth) return [];
    const isClipped =
      clippedToMonth.startTimestamp !== item.interval.startTimestamp ||
      clippedToMonth.endTimestamp !== item.interval.endTimestamp;
    return [
      {
        ...item,
        interval: clippedToMonth,
        timeRange: isClipped ? formatClippedHourTimeRange(clippedToMonth) : item.timeRange,
      },
    ];
  });
  const hoursClippedByBoundary =
    hourBreakdown.length < rawHourBreakdown.length ||
    hourBreakdown.some((item, index) => {
      const original = rawHourBreakdown[index];
      return (
        original &&
        (item.interval.startTimestamp !== original.interval.startTimestamp ||
          item.interval.endTimestamp !== original.interval.endTimestamp)
      );
    });
  const firstHour = hourBreakdown[0];
  const lastHour = hourBreakdown.at(-1);
  const effectiveHourSummary =
    hoursClippedByBoundary && firstHour && lastHour
      ? `流时有效时段：${formatLocalDateTime(firstHour.interval.start)}至${formatLocalDateTime(lastHour.interval.end)}（终点不含）`
      : undefined;
  const previousDate = createCivilDate(actualYear, actualMonth, actualDay);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const ziChuStart = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, '0')}-${String(previousDate.getUTCDate()).padStart(2, '0')} 23:00`;
  const ziChuEnd = `${actualDate} 22:59`;
  const dayTenGod = formatGanZhiTenGod(result, dayInfo.ganZhi);
  const dayTrigger = buildGanZhiTriggerSummary(result, dayInfo.ganZhi, '流日');
  const dayTriggerSummary = dayTrigger.summary;
  const triggerEvidence = analyzeSelectionTriggers(result, [
    fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
    fortuneLayer('year', 'year', `${yearItem.year}年流年`, yearItem.ganZhi),
    fortuneLayer('month', 'month', `${yearItem.year}年${monthInfo.month}流月`, monthInfo.ganZhi),
    fortuneLayer('day', 'day', `${actualDate}流日`, dayInfo.ganZhi, actualDate),
  ]);
  const actionEvidence = analyzeSelectionActions(
    result,
    [
      actionLayer(
        'dayun',
        'dayun',
        cycleLabel,
        cycle.ganZhi,
        `${cycle.year}年起，约${cycle.age}岁交运`,
      ),
      actionLayer('year', 'year', `${yearItem.year}年流年`, yearItem.ganZhi, `${yearItem.year}年`),
      actionLayer(
        'month',
        'month',
        `${yearItem.year}年${monthInfo.month}流月`,
        monthInfo.ganZhi,
        `${monthInfo.startDate}至${monthInfo.endDate}`,
      ),
      actionLayer('day', 'day', `${actualDate}流日`, dayInfo.ganZhi, actualDate),
    ],
    triggerEvidence,
  );
  const monthDayLines = dayInfoList
    .filter((item) => clipToCycle(item.timeRange, cycleTimeRange))
    .map((item) =>
      formatDayBreakdownLine(result, {
        date: item.solarDate,
        ganZhi: item.ganZhi,
        boundaryNote: item.boundaryNote,
      }),
    );
  const hourLines = hourBreakdown.map((item) =>
    `${item.label} ${item.timeRange || ''} ${item.ganZhi}`.trim(),
  );

  return {
    ...baseContext,
    scope: 'day',
    month: normalized.month,
    day: normalized.day,
    monthGanZhi: monthInfo.ganZhi,
    monthLabel: monthInfo.month,
    hourBreakdown,
    dayBreakdown: [
      {
        date: actualDate,
        label: dayInfo.solarLabel,
        ganZhi: dayInfo.ganZhi,
        startDateTime: dayInfo.startDateTime,
        endDateTime: dayInfo.endDateTime,
        boundaryNote: dayInfo.boundaryNote,
        timeRange: dayTimeRange,
      },
    ],
    displayLabel: actualDate,
    displayText: `${actualDate}（${dayInfo.ganZhi}）`,
    actionEvidence,
    promptPayload: {
      scopeLabel: `分析对象：${actualDate}流日`,
      summaryLines: [
        cycle.isXiaoyun ? '所属大运：未起运，童运时段' : `所属大运：${cycleLabel}`,
        `所属流年：${yearItem.year}年 ${yearItem.ganZhi}`,
        `所属流月：${monthInfo.month} ${monthInfo.ganZhi}`,
        `流日：${actualDate} ${dayInfo.ganZhi}`,
        `流日十神：${dayTenGod}`,
        dayTriggerSummary,
        `按子初换日（命理日口径，与节令月有效范围分列）：${ziChuStart} 至 ${ziChuEnd}`,
        ...(dayInfo.boundaryNote ? [`交节提示：${dayInfo.boundaryNote}`] : []),
        ...(effectiveHourSummary ? [effectiveHourSummary] : []),
      ],
      selectedFacts: [
        `流日十神：${dayTenGod}`,
        ...dayTrigger.supplementalFacts,
        `按子初换日（命理日口径，与节令月有效范围分列）：${ziChuStart} 至 ${ziChuEnd}`,
        ...(dayInfo.boundaryNote ? [`交节提示：${dayInfo.boundaryNote}`] : []),
        ...(effectiveHourSummary ? [effectiveHourSummary] : []),
      ],
      evidenceLines: buildFortuneEvidenceLines({
        scope: 'day',
        scopeLabel: `${actualDate}流日`,
        cycleLabel,
        cycleGanZhi,
        selectedTitle: '流日干支与十神',
        selectedGanZhi: dayInfo.ganZhi,
        selectedTenGod: dayTenGod,
        parentText: cycle.isXiaoyun
          ? `所属童运时段；所属流年：${yearItem.year}年${yearItem.ganZhi}；所属流月：${monthInfo.month}${monthInfo.ganZhi}。`
          : `所属大运：${cycleLabel}（${cycleGanZhi}）；所属流年：${yearItem.year}年${yearItem.ganZhi}；所属流月：${monthInfo.month}${monthInfo.ganZhi}。`,
        timingText: `按子初换日：${ziChuStart}至${ziChuEnd}；流时列表只作当日内短时触发参考。`,
        limitText: '流日只判断当日执行、沟通、避险和即时触发，不得改写长期命局或整年趋势。',
        triggerEvidence,
        actionEvidence,
      }),
      triggerEvidence,
      actionEvidence,
      breakdownTitle: '该流日包含的流时',
      breakdownLines: hourLines,
      detailGroups: [
        {
          title: '所属流月包含的流日',
          lines: monthDayLines,
        },
        {
          title: '该流日包含的流时',
          lines: hourLines,
        },
      ],
    },
  };
}
