import { getMonthDaysInfo, getYearInfo } from '../calendarTool';
import { BASIC_MAPPINGS } from '../baziMappingsData';
import type { BaziChartResult } from '../baziTypes';
import type { LocalTimeRange } from '../baziTypes';
import { getLuckCycleTimeRange, intersectLocalTimeRanges } from '../luckTiming';
import { getTenGod, getTenGodForBranch, isGanZhiPair } from '../baziUtils';
import { formatPromptEvidenceBundle } from '../../prompt-evidence/format';
import type { PromptEvidenceItem } from '../../prompt-evidence/types';
import {
  analyzeFortuneTriggers,
  type FortuneTriggerEvidenceResult,
  type FortuneTriggerLayer,
} from '../fortuneTriggerEvidence';
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

export type {
  BaziFortuneSelectionValue,
  FortuneHourMode,
  FortuneSelectionContext,
  FortuneSelectionOptions,
} from './helpers/types';
export {
  buildCurrentBaziFortuneSelection,
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
  if (!ganZhi || ganZhi.length < 2) return null;
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

function formatYearBreakdownLine(
  result: BaziChartResult,
  item: { year: number; age: number; ganZhi: string },
) {
  return `${item.year}年（${item.age}岁） ${item.ganZhi}｜十神 ${formatGanZhiTenGod(result, item.ganZhi)}`;
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
  },
) {
  return `${item.month}月（${item.label}） ${item.ganZhi}｜十神 ${formatGanZhiTenGod(result, item.ganZhi)}｜日期范围 ${item.startDate} 至 ${item.endDate}｜交节 ${item.startTermName || ''} ${item.startDateTime || ''} 起，${item.endTermName || ''} ${item.endDateTime || ''} 交下节`;
}

function formatDayBreakdownLine(
  result: BaziChartResult,
  item: {
    date: string;
    ganZhi: string;
    boundaryNote?: string;
  },
) {
  return `${item.date} ${item.ganZhi}｜十神 ${formatGanZhiTenGod(result, item.ganZhi)}${item.boundaryNote ? `｜${item.boundaryNote}` : ''}`;
}

function buildGanZhiTriggerSummary(
  result: BaziChartResult,
  ganZhi: string | undefined,
  scopeLabel: string,
): string {
  const parts = splitGanZhi(ganZhi);
  if (!parts || !result.pillars) return `${scopeLabel}触发：原局资料不足，暂无法判断合冲刑害。`;

  const triggers: string[] = [];

  PILLAR_KEYS.forEach((key) => {
    const pillar = result.pillars[key];
    if (!pillar) return;
    const pillarLabel = PILLAR_LABELS[key];

    if (parts.gan === pillar.gan) {
      triggers.push(`天干${parts.gan}与${pillarLabel}${pillar.gan}伏吟`);
    }
    if (BASIC_MAPPINGS.TIAN_GAN_WU_HE[parts.gan] === pillar.gan) {
      triggers.push(`天干${parts.gan}合${pillarLabel}${pillar.gan}`);
    }
    if (BASIC_MAPPINGS.TIAN_GAN_CHONG[parts.gan] === pillar.gan) {
      triggers.push(`天干${parts.gan}冲${pillarLabel}${pillar.gan}`);
    }

    if (parts.zhi === pillar.zhi) {
      triggers.push(`地支${parts.zhi}与${pillarLabel}${pillar.zhi}伏吟`);
    }
    if (BASIC_MAPPINGS.DI_ZHI_LIU_HE[parts.zhi] === pillar.zhi) {
      triggers.push(`地支${parts.zhi}合${pillarLabel}${pillar.zhi}`);
    }
    if (BASIC_MAPPINGS.DI_ZHI_CHONG[parts.zhi] === pillar.zhi) {
      triggers.push(`地支${parts.zhi}冲${pillarLabel}${pillar.zhi}`);
    }
    if (BASIC_MAPPINGS.DI_ZHI_XING[parts.zhi]?.includes(pillar.zhi)) {
      triggers.push(`地支${parts.zhi}刑${pillarLabel}${pillar.zhi}`);
    }
    if (BASIC_MAPPINGS.DI_ZHI_HAI[parts.zhi] === pillar.zhi) {
      triggers.push(`地支${parts.zhi}害${pillarLabel}${pillar.zhi}`);
    }
    if (BASIC_MAPPINGS.DI_ZHI_PO[parts.zhi] === pillar.zhi) {
      triggers.push(`地支${parts.zhi}破${pillarLabel}${pillar.zhi}`);
    }
  });

  return `${scopeLabel}触发：${triggers.length ? triggers.join('；') : '未见明显合冲刑害破。'}`;
}

function buildFortuneEvidenceLines(params: {
  scope: FortuneSelectionContext['scope'];
  scopeLabel: string;
  cycleLabel: string;
  cycleGanZhi: string;
  selectedTitle: string;
  selectedGanZhi?: string;
  selectedTenGod?: string;
  triggerSummary?: string;
  timingText?: string;
  parentText?: string;
  limitText: string;
  triggerEvidence: FortuneTriggerEvidenceResult;
}) {
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '指定年限运限',
      detail: `${params.scopeLabel}，所属大运为${params.cycleLabel}（${params.cycleGanZhi}）。`,
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

  if (params.triggerSummary) {
    items.push({
      level: params.triggerSummary.includes('未见明显') ? '反证' : '主证',
      title: '刑冲合害触发',
      detail: params.triggerSummary,
      source: '所选干支与原局四柱比对',
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

  return [...formatPromptEvidenceBundle({ items }), '', params.triggerEvidence.promptText];
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

function analyzeSelectionTriggers(result: BaziChartResult, layers: FortuneTriggerLayer[]) {
  return analyzeFortuneTriggers(
    result,
    layers.filter(
      (layer) => layer.ganZhi.length === 2 && isGanZhiPair(layer.ganZhi[0], layer.ganZhi[1]),
    ),
  );
}

function getYearTimeRange(year: number): LocalTimeRange {
  const months = getYearInfo(year).months;
  const first = months[0]?.timeRange;
  const last = months.at(-1)?.timeRange;
  if (!first || !last) throw new Error(`${year}年缺少流月时间范围。`);
  return {
    start: first.start,
    end: last.end,
    startTimestamp: first.startTimestamp,
    endTimestamp: last.endTimestamp,
    endExclusive: true,
  };
}

function clipToCycle(range: LocalTimeRange, cycleRange: LocalTimeRange) {
  return intersectLocalTimeRanges(range, cycleRange);
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
    cycleGanZhi: cycle.ganZhi,
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
      const timeRange = clipToCycle(getYearTimeRange(item.year), cycleTimeRange);
      return timeRange ? [{ year: item.year, ganZhi: item.ganZhi, age: item.age, timeRange }] : [];
    });
    const cycleTenGod = formatGanZhiTenGod(result, cycle.ganZhi);
    const cycleTriggerSummary = buildGanZhiTriggerSummary(result, cycle.ganZhi, '大运');
    const triggerEvidence = analyzeSelectionTriggers(result, [
      fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
    ]);

    return {
      ...baseContext,
      scope: 'dayun',
      yearBreakdown: breakdown,
      displayLabel: cycleLabel,
      displayText: `${cycleLabel}（${cycle.year}年起，${cycle.age}岁交运）`,
      promptPayload: {
        scopeLabel: `分析对象：${cycleLabel}`,
        summaryLines: [
          `大运干支：${cycle.ganZhi}`,
          `大运十神：${cycleTenGod}`,
          cycleTriggerSummary,
          `起运年份：${cycle.year}年`,
          `起运年龄：${cycle.age}岁`,
          cycle.isXiaoyun
            ? '类型：未起运，行童运'
            : `类型：${cycle.type === '小运' ? '童运' : cycle.type}`,
        ],
        evidenceLines: buildFortuneEvidenceLines({
          scope: 'dayun',
          scopeLabel: `${cycleLabel}`,
          cycleLabel,
          cycleGanZhi: cycle.ganZhi,
          selectedTitle: '大运干支与十神',
          selectedGanZhi: cycle.ganZhi,
          selectedTenGod: cycleTenGod,
          triggerSummary: cycleTriggerSummary,
          timingText: `${cycle.year}年起，约${cycle.age}岁交运；只作为十年阶段主题与强弱背景。`,
          limitText:
            '大运不能替代流年给出精确年份；未给出具体流年时，只能判断十年阶段，不展开年度触发。',
          triggerEvidence,
        }),
        triggerEvidence,
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

  const yearTimeRange = clipToCycle(getYearTimeRange(yearItem.year), cycleTimeRange);
  if (!yearTimeRange) return null;

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
    const cycleYearLines = cycle.years
      .filter((item) => clipToCycle(getYearTimeRange(item.year), cycleTimeRange))
      .map((item) => formatYearBreakdownLine(result, item));
    const monthLines = breakdown.map((item) => formatMonthBreakdownLine(result, item));
    const yearTenGod = formatGanZhiTenGod(result, yearItem.ganZhi);
    const yearTriggerSummary = buildGanZhiTriggerSummary(result, yearItem.ganZhi, '流年');
    const triggerEvidence = analyzeSelectionTriggers(result, [
      fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
      fortuneLayer('year', 'year', `${yearItem.year}年流年`, yearItem.ganZhi, `${yearItem.year}年`),
    ]);

    return {
      ...baseContext,
      scope: 'year',
      monthBreakdown: breakdown,
      displayLabel: formatYearLabel(yearItem),
      displayText: `${yearItem.year}年 ${yearItem.ganZhi}（${yearItem.age}岁）`,
      promptPayload: {
        scopeLabel: `分析对象：${yearItem.year}年流年`,
        summaryLines: [
          `所属大运：${cycleLabel}`,
          `流年干支：${yearItem.ganZhi}`,
          `流年十神：${yearTenGod}`,
          yearTriggerSummary,
          `对应年龄：${yearItem.age}岁`,
        ].filter(Boolean) as string[],
        evidenceLines: buildFortuneEvidenceLines({
          scope: 'year',
          scopeLabel: `${yearItem.year}年流年`,
          cycleLabel,
          cycleGanZhi: cycle.ganZhi,
          selectedTitle: '流年干支与十神',
          selectedGanZhi: yearItem.ganZhi,
          selectedTenGod: yearTenGod,
          triggerSummary: yearTriggerSummary,
          parentText: `所属大运：${cycleLabel}（${cycle.ganZhi}），年度判断必须承接该十年阶段。`,
          timingText: `${yearItem.year}年（${yearItem.age}岁）为年度触发；流月列表只作月份窗口参考。`,
          limitText: '未给出具体流月或流日时，不得把某月某日硬断成唯一应期。',
          triggerEvidence,
        }),
        triggerEvidence,
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
    const monthTriggerSummary = buildGanZhiTriggerSummary(result, monthInfo.ganZhi, '流月');
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
      displayText: `${yearItem.year}年 ${monthInfo.month}（${monthInfo.ganZhi}，${monthInfo.startDateTime || monthInfo.startDate} 起，至 ${monthInfo.endDateTime || monthInfo.endDate} 交下节）`,
      promptPayload: {
        scopeLabel: `分析对象：${yearItem.year}年${monthInfo.month}流月`,
        summaryLines: [
          `所属大运：${cycleLabel}`,
          `所属流年：${yearItem.year}年 ${yearItem.ganZhi}`,
          `流月：${monthInfo.month} ${monthInfo.ganZhi}`,
          `流月十神：${monthTenGod}`,
          monthTriggerSummary,
          `日期范围：${monthInfo.startDate} 至 ${monthInfo.endDate}`,
          `交节时刻：${monthInfo.startTermName || ''} ${monthInfo.startDateTime || ''} 起，${monthInfo.endTermName || ''} ${monthInfo.endDateTime || ''} 交下节`,
          ...(monthInfo.startTermEvidence
            ? [`起始交节核验：${monthInfo.startTermEvidence.promptText}`]
            : []),
          ...(monthInfo.endTermEvidence
            ? [`结束交节核验：${monthInfo.endTermEvidence.promptText}`]
            : []),
        ],
        evidenceLines: [
          ...buildFortuneEvidenceLines({
            scope: 'month',
            scopeLabel: `${yearItem.year}年${monthInfo.month}流月`,
            cycleLabel,
            cycleGanZhi: cycle.ganZhi,
            selectedTitle: '流月干支与十神',
            selectedGanZhi: monthInfo.ganZhi,
            selectedTenGod: monthTenGod,
            triggerSummary: monthTriggerSummary,
            parentText: `所属大运：${cycleLabel}（${cycle.ganZhi}）；所属流年：${yearItem.year}年${yearItem.ganZhi}。`,
            timingText: `${monthInfo.startDate}至${monthInfo.endDate}，以节气月为准；${monthInfo.startTermName || ''} ${monthInfo.startDateTime || ''} 起，${monthInfo.endTermName || ''} ${monthInfo.endDateTime || ''} 交下节。`,
            limitText:
              '流月只细化年度主题，不能推翻本命、大运与流年主线；未给出流日时不硬给具体日期。',
            triggerEvidence,
          }),
          ...(monthInfo.startTermEvidence ? [monthInfo.startTermEvidence.promptText] : []),
          ...(monthInfo.endTermEvidence ? [monthInfo.endTermEvidence.promptText] : []),
        ],
        triggerEvidence,
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
  const hourBreakdown = getDayHourBreakdown(
    actualYear,
    actualMonth,
    actualDay,
    options.hourMode ?? 'twelve',
  ).flatMap((item) => {
    const interval = clipToCycle(item.interval, cycleTimeRange);
    return interval ? [{ ...item, interval }] : [];
  });
  const previousDate = new Date(actualYear, actualMonth - 1, actualDay - 1);
  const ziChuStart = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')} 23:00`;
  const ziChuEnd = `${actualDate} 22:59`;
  const dayTenGod = formatGanZhiTenGod(result, dayInfo.ganZhi);
  const dayTriggerSummary = buildGanZhiTriggerSummary(result, dayInfo.ganZhi, '流日');
  const triggerEvidence = analyzeSelectionTriggers(result, [
    fortuneLayer('dayun', 'dayun', cycleLabel, cycle.ganZhi, `${cycle.year}年起`),
    fortuneLayer('year', 'year', `${yearItem.year}年流年`, yearItem.ganZhi),
    fortuneLayer('month', 'month', `${yearItem.year}年${monthInfo.month}流月`, monthInfo.ganZhi),
    fortuneLayer('day', 'day', `${actualDate}流日`, dayInfo.ganZhi, actualDate),
  ]);
  const monthDayLines = dayInfoList.map((item) =>
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
    promptPayload: {
      scopeLabel: `分析对象：${actualDate}流日`,
      summaryLines: [
        `所属大运：${cycleLabel}`,
        `所属流年：${yearItem.year}年 ${yearItem.ganZhi}`,
        `所属流月：${monthInfo.month} ${monthInfo.ganZhi}`,
        `流日：${actualDate} ${dayInfo.ganZhi}`,
        `流日十神：${dayTenGod}`,
        dayTriggerSummary,
        `按子初换日：${ziChuStart} 至 ${ziChuEnd}`,
        ...(dayInfo.boundaryNote ? [`交节提示：${dayInfo.boundaryNote}`] : []),
      ],
      evidenceLines: buildFortuneEvidenceLines({
        scope: 'day',
        scopeLabel: `${actualDate}流日`,
        cycleLabel,
        cycleGanZhi: cycle.ganZhi,
        selectedTitle: '流日干支与十神',
        selectedGanZhi: dayInfo.ganZhi,
        selectedTenGod: dayTenGod,
        triggerSummary: dayTriggerSummary,
        parentText: `所属大运：${cycleLabel}（${cycle.ganZhi}）；所属流年：${yearItem.year}年${yearItem.ganZhi}；所属流月：${monthInfo.month}${monthInfo.ganZhi}。`,
        timingText: `按子初换日：${ziChuStart}至${ziChuEnd}；流时列表只作当日内短时触发参考。`,
        limitText: '流日只判断当日执行、沟通、避险和即时触发，不得改写长期命局或整年趋势。',
        triggerEvidence,
      }),
      triggerEvidence,
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
