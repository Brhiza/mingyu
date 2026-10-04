import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { getMonthDaysInfo, getYearInfo, resolveBaziFortuneDate } from '@core/bazi/calendarTool';
import {
  buildBaziFortuneSelectionForDate,
  buildCurrentBaziFortuneSelection,
  buildFortuneSelectionContext,
  buildRecentBaziFortuneSelection,
  getCurrentBaziLuckCycle,
  normalizeFortuneSelection,
} from 'mingyu-core/bazi';
import { getDayHourBreakdown } from '@core/bazi/fortuneSelection/helpers/breakdown';
import { buildFortuneSelectionContext as buildSourceFortuneSelectionContext } from '@core/bazi/fortuneSelection/index';
import {
  buildBaziFortuneSelectionForDate as buildSourceFortuneSelectionForDate,
  buildCurrentBaziFortuneSelection as buildSourceCurrentFortuneSelection,
} from '@core/bazi/fortuneSelection/current';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import { formatBaziFortuneSelection } from '@core/prompt/bazi-fortune';

function createMockResult(): BaziChartResult {
  return {
    pillars: {
      year: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    },
    dayMaster: {
      gan: '甲',
      element: '木',
      yinYang: '阳',
    },
    luckInfo: {
      startInfo: '',
      handoverInfo: '',
      cycles: [
        {
          age: 8,
          year: 2008,
          ganZhi: '甲子',
          isXiaoyun: false,
          type: '大运',
          years: [
            {
              year: 2008,
              age: 8,
              ganZhi: '戊子',
              tenGod: '',
              tenGodZhi: '',
              xiaoyun: {
                ganZhi: '丙寅',
                tenGod: '',
                tenGodZhi: '',
              },
            },
            {
              year: 2009,
              age: 9,
              ganZhi: '己丑',
              tenGod: '',
              tenGodZhi: '',
            },
          ],
        },
      ],
    },
  } as BaziChartResult;
}

let cachedCurrentBoundaryChart: ReturnType<typeof baziCalculator.calculateBazi> | undefined;

function createCurrentBoundaryChart() {
  cachedCurrentBoundaryChart ??= baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  return structuredClone(cachedCurrentBoundaryChart);
}

function createHandoverResult(handoverHour: number): BaziChartResult {
  const result = createMockResult();
  const nextCycle = result.luckInfo.cycles[0];
  nextCycle.startSolarTime = {
    year: 2008,
    month: 2,
    day: 8,
    hour: handoverHour,
    minute: 0,
    second: 0,
  };
  nextCycle.endSolarTime = {
    year: 2018,
    month: 2,
    day: 8,
    hour: handoverHour,
    minute: 0,
    second: 0,
  };
  result.luckInfo.cycles.unshift({
    ...nextCycle,
    year: 1998,
    ganZhi: '癸亥',
    startSolarTime: {
      year: 1998,
      month: 2,
      day: 8,
      hour: handoverHour,
      minute: 0,
      second: 0,
    },
    endSolarTime: {
      year: 2008,
      month: 2,
      day: 8,
      hour: handoverHour,
      minute: 0,
      second: 0,
    },
    years: [],
  });
  return result;
}

test('运限选择器的当天快捷值会选择对应的大运、流月和流日', () => {
  const result = createMockResult();
  const selection = buildCurrentBaziFortuneSelection(result, new Date('2008-02-08T12:00:00+08:00'));

  assert.deepEqual(selection, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
});

test('岁运焦点与命宫同按天干相克、地支六冲识别天克地冲', () => {
  const result = createMockResult();
  result.pillars.year = { gan: '甲', zhi: '子', ganZhi: '甲子' };
  result.mingGong = '甲子';
  result.luckInfo.cycles[0].ganZhi = '戊午';

  const context = buildFortuneSelectionContext(result, { scope: 'dayun', cycleIndex: 0 });
  assert.ok(context);
  assert.match(context.promptPayload.summaryLines.join('\n'), /与年柱天克地冲/);
  assert.ok(
    context.promptPayload.selectedFacts?.some((item) =>
      item.includes('大运干支戊午与命宫甲子天克地冲'),
    ),
  );

  result.luckInfo.cycles[0].ganZhi = '壬午';
  const withoutStemOvercome = buildFortuneSelectionContext(result, {
    scope: 'dayun',
    cycleIndex: 0,
  });
  assert.ok(withoutStemOvercome);
  assert.doesNotMatch(withoutStemOvercome.promptPayload.summaryLines.join('\n'), /与年柱天克地冲/);
  assert.ok(
    !withoutStemOvercome.promptPayload.selectedFacts?.some((item) =>
      item.includes('与命宫甲子天克地冲'),
    ),
  );
});

test('近期年限预设会选择当前流月而不是锁定当天', () => {
  const result = createMockResult();
  const selection = buildRecentBaziFortuneSelection(result, new Date('2008-02-08T12:00:00+08:00'));

  assert.deepEqual(selection, {
    scope: 'month',
    cycleIndex: 0,
    year: 2008,
    month: 1,
  });
});

test('元旦至立春前的当前日期应回查上一节令年，不回退到当年首月首日', () => {
  const result = createMockResult();
  // 2008-01-15 处于立春前，节令年应为 2007 年的第十二月
  const selection = buildCurrentBaziFortuneSelection(result, new Date('2008-01-15T12:00:00+08:00'));
  assert.ok(selection);
  assert.equal(selection.year, 2007);
  assert.equal(selection.month, 12);
  assert.ok(selection.day >= 1 && selection.day <= 30);
  assert.equal(selection.cycleIndex, 0);
});

test('当前阶段定位按北京时间计算，不受运行环境时区影响', () => {
  const result = createCurrentBoundaryChart();
  // 2026 年白露后已经进入酉月；显式带 UTC+8 可在 UTC 运行环境复现边界。
  const selection = buildCurrentBaziFortuneSelection(result, new Date('2026-09-08T00:00:00+08:00'));

  assert.ok(selection);
  assert.equal(selection.year, 2026);
  assert.equal(selection.month, 8);
});

test('立春前交运时应覆盖交运公历年对应的上一干支流年', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 2,
    day: 10,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const firstDayun = result.luckInfo.cycles.find(
    (cycle) => !cycle.isXiaoyun && cycle.year === 1998,
  );

  assert.deepEqual(firstDayun?.startSolarTime, {
    year: 1998,
    month: 1,
    day: 1,
    hour: 2,
    minute: 36,
    second: 0,
  });
  assert.equal(firstDayun?.years[0]?.year, 1997);

  const beforeHandover = buildCurrentBaziFortuneSelection(
    result,
    new Date('1998-01-01T02:35:59+08:00'),
  );
  const atHandover = buildCurrentBaziFortuneSelection(
    result,
    new Date('1998-01-01T02:36:00+08:00'),
  );

  assert.equal(beforeHandover?.cycleIndex, 0);
  assert.equal(beforeHandover?.year, 1997);
  assert.equal(atHandover?.cycleIndex, result.luckInfo.cycles.indexOf(firstDayun!));
  assert.equal(atHandover?.year, 1997);
  assert.ok(atHandover);
  assert.equal(buildFortuneSelectionContext(result, atHandover)?.year, 1997);
});

test('立春前出生的童限应生成出生时刻所属的上一节令年', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 1,
    day: 15,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const childCycle = result.luckInfo.cycles.find((cycle) => cycle.isXiaoyun);

  assert.equal(childCycle?.years[0]?.year, 1989);
  assert.equal(childCycle?.years[0]?.age, 1);

  const selection = buildCurrentBaziFortuneSelection(result, new Date('1990-01-20T12:00:00+08:00'));
  assert.ok(selection);
  assert.equal(selection.year, 1989);
  assert.equal(buildFortuneSelectionContext(result, selection)?.year, 1989);
});

test('童运占位文字不得被解读为干支、十神或岁运作用事实', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 1,
    day: 15,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const childIndex = result.luckInfo.cycles.findIndex((cycle) => cycle.isXiaoyun);
  assert.ok(childIndex >= 0);
  const current = buildCurrentBaziFortuneSelection(result, new Date('1990-01-15T12:00:00+08:00'));
  assert.ok(current);
  assert.equal(current.cycleIndex, childIndex);

  for (const selection of [
    { scope: 'dayun' as const, cycleIndex: childIndex },
    { scope: 'year' as const, cycleIndex: childIndex, year: 1989 },
    { scope: 'month' as const, cycleIndex: childIndex, year: current.year, month: current.month },
    current,
  ]) {
    const context = buildSourceFortuneSelectionContext(result, selection);
    assert.ok(context);
    assert.equal(context.cycleGanZhi, '');
    assert.equal(
      context.actionEvidence?.facts.some((fact) => fact.stem === '小'),
      false,
    );
    const text = [
      ...context.promptPayload.summaryLines,
      ...(context.promptPayload.evidenceLines ?? []),
      formatBaziFortuneSelection(context)?.focus ?? '',
    ].join('\n');
    assert.doesNotMatch(text, /天干小|地支运|大运干支：小运|小运童运|童运（小运）|所属大运：童运/);
  }
});

test('当前快捷流日在北京时间 23:00 子初切换到次一民用日', () => {
  const result = createCurrentBoundaryChart();
  const beforeZi = buildCurrentBaziFortuneSelection(result, new Date('2026-09-08T22:59:59+08:00'));
  const atZi = buildCurrentBaziFortuneSelection(result, new Date('2026-09-08T23:00:00+08:00'));
  const nextMidnight = buildCurrentBaziFortuneSelection(
    result,
    new Date('2026-09-09T00:00:00+08:00'),
  );

  assert.deepEqual(
    { year: beforeZi?.year, month: beforeZi?.month, day: beforeZi?.day },
    { year: 2026, month: 8, day: 2 },
  );
  assert.deepEqual(
    { year: atZi?.year, month: atZi?.month, day: atZi?.day },
    { year: 2026, month: 8, day: 3 },
  );
  assert.deepEqual(
    { year: nextMidnight?.year, month: nextMidnight?.month, day: nextMidnight?.day },
    { year: 2026, month: 8, day: 3 },
  );

  assert.ok(atZi);
  assert.equal(buildFortuneSelectionContext(result, atZi)?.dayBreakdown?.[0]?.date, '2026-09-09');
});

test('子初与交节同晚时换日但仍保留交节前的流月', () => {
  const result = createCurrentBoundaryChart();
  // 2022-09-07 白露在 23:32 交节。旧申月的日历切片在交节时刻结束，
  // 23:00 已属 9 月 8 日的命理日，但仍处于交节前申月。
  const selection = buildCurrentBaziFortuneSelection(result, new Date('2022-09-07T23:00:00+08:00'));

  assert.deepEqual(
    { year: selection?.year, month: selection?.month, day: selection?.day },
    { year: 2022, month: 7, day: getMonthDaysInfo(2022, 7).length },
  );
  assert.ok(selection);
  assert.equal(
    buildFortuneSelectionContext(result, selection)?.dayBreakdown?.[0]?.date,
    '2022-09-08',
  );
  assert.equal(
    buildRecentBaziFortuneSelection(result, new Date('2022-09-07T23:00:00+08:00'))?.month,
    7,
  );
  assert.equal(
    buildCurrentBaziFortuneSelection(result, new Date('2022-09-07T23:33:00+08:00'))?.month,
    8,
  );
});

test('当前年份不在命盘运限范围时不应静默回退到第一步大运', () => {
  const result = createMockResult();
  const outOfRangeDate = new Date('1980-02-08T12:00:00+08:00');

  assert.equal(getCurrentBaziLuckCycle(result, 1980), null);
  assert.equal(buildCurrentBaziFortuneSelection(result, outOfRangeDate), null);
  assert.equal(buildRecentBaziFortuneSelection(result, outOfRangeDate), null);
});

test('当前大运定位应服从交运时刻而不是只看交运年份', () => {
  const result = createMockResult();
  const cycle = result.luckInfo.cycles[0];
  cycle.startSolarTime = { year: 2008, month: 2, day: 8, hour: 12, minute: 0, second: 0 };
  cycle.endSolarTime = { year: 2018, month: 2, day: 8, hour: 12, minute: 0, second: 0 };

  assert.equal(getCurrentBaziLuckCycle(result, new Date('2008-02-08T11:59:59+08:00')), null);
  assert.equal(getCurrentBaziLuckCycle(result, new Date('2008-02-08T12:00:00+08:00')), cycle);
});

test('公历日期模式应以北京时间正午精确定位交运当天的大运', () => {
  const handoverAfterNoon = createHandoverResult(13);
  const handoverBeforeNoon = createHandoverResult(11);

  assert.deepEqual(buildBaziFortuneSelectionForDate(handoverAfterNoon, 'dayun', '2008-02-08'), {
    scope: 'dayun',
    cycleIndex: 0,
  });
  assert.deepEqual(buildBaziFortuneSelectionForDate(handoverBeforeNoon, 'dayun', '2008-02-08'), {
    scope: 'dayun',
    cycleIndex: 1,
  });
});

test('选择大运时会附带该大运下的全部流年', () => {
  const result = createMockResult();
  const context = buildFortuneSelectionContext(result, {
    scope: 'dayun',
    cycleIndex: 0,
  });

  assert.ok(context);
  assert.equal(context.scope, 'dayun');
  assert.equal(context.displayLabel, '甲子运');
  assert.equal(context.yearBreakdown?.length, 2);
  assert.match(context.promptPayload.breakdownTitle ?? '', /流年/);
  assert.match(context.promptPayload.breakdownLines?.[0] ?? '', /2008年/);
  assert.doesNotMatch(context.promptPayload.breakdownLines?.[0] ?? '', /童运/);
  assert.match(
    context.promptPayload.summaryLines.join('\n'),
    /大运十神：天干甲为比肩，地支子主气为正印/,
  );
  assert.match(context.promptPayload.summaryLines.join('\n'), /大运触发：/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /天干甲合月柱己/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /地支子冲年柱午/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /地支子合月柱丑/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /干支甲子与日柱甲子同柱伏吟/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【主证】指定年限运限/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【主证】大运干支与十神/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【应期】应期边界/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【限制】断事层级限制/);
  assert.ok(context.promptPayload.triggerEvidence);
  assert.equal(context.promptPayload.triggerEvidence?.key, 'bazi:fortune-trigger:evidence');
  assert.equal(context.promptPayload.triggerEvidence?.status, '已计算');
  assert.ok(context.promptPayload.triggerEvidence?.calculationSteps.length);
  assert.ok(context.promptPayload.triggerEvidence?.relationSummaryFact.relationCount);
  assert.ok(
    context.promptPayload.triggerEvidence?.limitationFacts.some(
      (item) => item.type === '层级应期边界',
    ),
  );
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【八字岁运触发结构化证据】/);
});

test('2030庚戌流年应分别标出干冲、年柱同支与月柱同干', () => {
  const result = createMockResult();
  result.pillars.year = { gan: '甲', zhi: '戌', ganZhi: '甲戌' };
  result.pillars.month = { gan: '庚', zhi: '午', ganZhi: '庚午' };
  result.luckInfo.cycles[0] = {
    ...result.luckInfo.cycles[0],
    year: 2030,
    ganZhi: '庚戌',
    years: [
      {
        year: 2030,
        age: 36,
        ganZhi: '庚戌',
        tenGod: '',
        tenGodZhi: '',
      },
    ],
  };

  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
    year: 2030,
  });

  assert.ok(context);
  const summary = context.promptPayload.summaryLines.join('\n');
  assert.match(summary, /天干庚冲年柱甲/);
  assert.match(summary, /地支戌与年柱戌同支/);
  assert.match(summary, /天干庚与月柱庚同干/);
  assert.doesNotMatch(summary, /地支戌与年柱戌伏吟/);
  assert.doesNotMatch(summary, /天干庚与月柱庚伏吟/);
});

test('选择流年时会附带该流年下的全部流月', () => {
  const result = createMockResult();
  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
    year: 2008,
  });

  assert.ok(context);
  assert.equal(context.scope, 'year');
  assert.equal(context.year, 2008);
  assert.equal(context.monthBreakdown?.length, 12);
  assert.match(context.promptPayload.breakdownTitle ?? '', /流月/);
  assert.match(context.promptPayload.breakdownLines?.[0] ?? '', /寅月/);
  assert.match(
    context.promptPayload.breakdownLines?.[0] ?? '',
    /立春 \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}～惊蛰 \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
  );
  assert.doesNotMatch(context.promptPayload.summaryLines.join('\n'), /童运/);
  assert.match(
    context.promptPayload.summaryLines.join('\n'),
    /流年十神：天干戊为偏财，地支子主气为正印/,
  );
  assert.match(context.promptPayload.summaryLines.join('\n'), /流年触发：/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /与年柱天克地冲/);
  assert.doesNotMatch(context.promptPayload.summaryLines.join('\n'), /地支子冲年柱午/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /地支子合月柱丑/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【辅证】上层岁运背景/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【主证】流年干支与十神/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /未给出具体流月或流日/);
  assert.ok(
    context.promptPayload.triggerEvidence?.relations.some(
      (item) => item.source.type === 'year' && item.target.type === 'dayun',
    ),
  );
});

test('节令月会使用实际交节日期范围，而不是直接套用公历月份', () => {
  const yearInfo = getYearInfo(2024);
  const firstMonth = yearInfo.months[0];
  const firstMonthDays = getMonthDaysInfo(2024, 1);

  assert.equal(firstMonth.month, '寅月');
  assert.equal(firstMonth.ganZhi, '丙寅');
  assert.equal(firstMonth.startDate, '2024-02-04');
  assert.equal(firstMonth.endDate, '2024-03-05');
  assert.equal(firstMonthDays[0]?.solarDate, '2024-02-04');
  assert.equal(firstMonthDays.at(-1)?.solarDate, '2024-03-05');
  assert.ok(firstMonth.startDateTime);
  assert.ok(firstMonth.endDateTime);
});

test('选择流月时会附带该节令月下的全部流日', () => {
  const result = createMockResult();
  const context = buildFortuneSelectionContext(result, {
    scope: 'month',
    cycleIndex: 0,
    year: 2008,
    month: 1,
  });

  assert.ok(context);
  assert.equal(context.scope, 'month');
  assert.equal(context.month, 1);
  assert.match(context.displayText, /2008年 寅月/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /日期范围：2008-02-04 至 2008-03-05/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /交节时刻：立春/);
  assert.equal(context.dayBreakdown?.length, 31);
  assert.match(context.promptPayload.breakdownTitle ?? '', /流日/);
  assert.match(context.promptPayload.breakdownLines?.[0] ?? '', /2008-02-04/);
  assert.match(
    context.promptPayload.summaryLines.join('\n'),
    /流月十神：天干甲为比肩，地支寅主气为比肩/,
  );
  assert.match(context.promptPayload.summaryLines.join('\n'), /流月触发：/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【主证】流月干支与十神/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /以节气月为准/);
});

test('选择流日时只保留该流日本身', () => {
  const result = createMockResult();
  const normalized = normalizeFortuneSelection(result, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
  const context = buildFortuneSelectionContext(result, normalized);

  assert.ok(context);
  assert.equal(context.scope, 'day');
  assert.equal(context.promptPayload.breakdownTitle, '该流日包含的流时');
  assert.equal(context.dayBreakdown?.length, 1);
  assert.equal(context.hourBreakdown?.length, 12);
  assert.match(context.promptPayload.summaryLines.join('\n'), /流日：2008-02-08/);
  assert.match(
    context.promptPayload.summaryLines.join('\n'),
    /按子初换日（命理日口径，与节令月有效范围分列）：2008-02-07 23:00 至 2008-02-08 22:59/,
  );
  assert.match(context.promptPayload.breakdownLines?.[0] ?? '', /子时/);
  assert.doesNotMatch(context.promptPayload.breakdownLines?.join('\n') ?? '', /晚子时|早子时/);
  assert.doesNotMatch(
    context.promptPayload.breakdownLines?.join('\n') ?? '',
    /2008-02-08 23:00-23:59/,
  );
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【主证】流日干支与十神/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /按子初换日/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /不得改写长期命局或整年趋势/);
});

test('流日可显式保留旧版早晚子时拆分', () => {
  const context = buildFortuneSelectionContext(
    createMockResult(),
    { scope: 'day', cycleIndex: 0, year: 2008, month: 1, day: 5 },
    { hourMode: 'splitZi' },
  );

  assert.equal(context?.hourBreakdown?.length, 13);
  assert.equal(context?.day, 5);
  assert.equal(context?.dayBreakdown?.[0]?.date, '2008-02-08');
  assert.match(context?.hourBreakdown?.[0]?.label ?? '', /晚子时/);
  assert.match(context?.hourBreakdown?.[1]?.label ?? '', /早子时/);
});

test('交节日的流时列表不应包含交节前时辰', () => {
  const context = buildFortuneSelectionContext(
    createMockResult(),
    { scope: 'day', cycleIndex: 0, year: 2008, month: 1, day: 1 },
    {},
  );
  assert.ok(context?.hourBreakdown?.length);
  const boundaryStart = context.dayBreakdown?.[0]?.timeRange.startTimestamp ?? 0;
  assert.ok(
    context.hourBreakdown.every((item) => item.interval.startTimestamp >= boundaryStart),
    '交节前时辰不应出现在流时列表',
  );
  assert.ok(context.hourBreakdown.length < 12, '立春日交节前的时辰应被裁剪');
});

test('交节裁剪后的流时文字应与有效时间一致', () => {
  const result = createCurrentBoundaryChart();
  const selection = buildCurrentBaziFortuneSelection(result, new Date('2024-02-04T17:00:00+08:00'));
  assert.ok(selection);
  const context = buildFortuneSelectionContext(result, selection);
  const firstHour = context?.hourBreakdown?.[0];

  assert.equal(firstHour?.interval.startTimestamp, Date.parse('2024-02-04T16:27:07+08:00'));
  assert.equal(firstHour?.interval.endTimestamp, Date.parse('2024-02-04T17:00:00+08:00'));
  assert.equal(firstHour?.timeRange, '2024-02-04 16:27:07至2024-02-04 17:00:00（终点不含）');
  assert.match(
    context?.promptPayload.breakdownLines?.[0] ?? '',
    /申时 2024-02-04 16:27:07至2024-02-04 17:00:00（终点不含）/,
  );
});

test('流时首尾部分裁剪时应提示有效范围，即使仍有十二时辰', () => {
  const result = createMockResult();
  const cycle = result.luckInfo.cycles[0];
  cycle.startSolarTime = { year: 2008, month: 2, day: 8, hour: 23, minute: 30, second: 0 };
  cycle.endSolarTime = { year: 2008, month: 2, day: 9, hour: 22, minute: 30, second: 0 };

  const context = buildFortuneSelectionContext(result, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 6,
  });

  assert.equal(context?.hourBreakdown?.length, 12);
  assert.equal(context?.hourBreakdown?.[0]?.interval.start.minute, 30);
  assert.equal(context?.hourBreakdown?.at(-1)?.interval.end.minute, 30);
  assert.match(
    context?.promptPayload.summaryLines.join('\n') ?? '',
    /流时有效时段：2008-02-08 23:30:00至2008-02-09 22:30:00（终点不含）/,
  );
});

test('岁运各层应按精确交运时刻裁剪并返回结构化时间', () => {
  const result = createMockResult();
  const cycle = result.luckInfo.cycles[0];
  cycle.startSolarTime = { year: 2008, month: 2, day: 8, hour: 12, minute: 0, second: 0 };
  cycle.endSolarTime = { year: 2008, month: 2, day: 9, hour: 12, minute: 0, second: 0 };

  const year = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
    year: 2008,
  });
  assert.equal(year?.monthBreakdown?.length, 1);
  assert.equal(year?.monthBreakdown?.[0]?.timeRange.start.hour, 12);
  assert.equal(year?.monthBreakdown?.[0]?.timeRange.start.day, 8);
  assert.equal(year?.monthBreakdown?.[0]?.timeRange.end.day, 9);
  assert.match(
    year?.promptPayload.breakdownLines?.[0] ?? '',
    /交运 2008-02-08 12:00:00～交运 2008-02-09 12:00:00/,
  );
  assert.match(year?.displayText ?? '', /本运内 2008-02-08 12:00:00 至 2008-02-09 12:00:00/);
  assert.ok(
    year?.promptPayload.summaryLines.includes(
      '本运有效时段：2008-02-08 12:00:00至2008-02-09 12:00:00（终点不含）',
    ),
  );
  assert.match(
    formatBaziFortuneSelection(year)?.focus ?? '',
    /本运有效时段：2008-02-08 12:00:00至2008-02-09 12:00:00（终点不含）/,
  );
  const dayun = buildFortuneSelectionContext(result, { scope: 'dayun', cycleIndex: 0 });
  assert.match(
    dayun?.promptPayload.breakdownLines?.[0] ?? '',
    /本运有效时段：2008-02-08 12:00:00至2008-02-09 12:00:00（终点不含）/,
  );

  const month = buildFortuneSelectionContext(result, {
    scope: 'month',
    cycleIndex: 0,
    year: 2008,
    month: 1,
  });
  assert.equal(month?.dayBreakdown?.length, 2);
  assert.equal(month?.dayBreakdown?.[0]?.timeRange.start.hour, 12);
  assert.equal(month?.dayBreakdown?.[1]?.timeRange.end.hour, 12);
  assert.match(month?.displayText ?? '', /2008-02-08 12:00:00 至 2008-02-09 12:00:00/);
  assert.ok(
    month?.promptPayload.summaryLines.includes(
      '本运有效时段：2008-02-08 12:00:00至2008-02-09 12:00:00（终点不含）',
    ),
  );
  const monthPrompt = formatBaziFortuneSelection(month);
  assert.match(
    monthPrompt?.focus ?? '',
    /本运有效时段：2008-02-08 12:00:00至2008-02-09 12:00:00（终点不含）/,
  );
  assert.doesNotMatch(monthPrompt?.focus ?? '', /选择日期：2008-02-04 至 2008-03-05/);
  assert.match(
    month?.promptPayload.detailGroups?.[0]?.lines?.[0] ?? '',
    /交运 2008-02-08 12:00:00～交运 2008-02-09 12:00:00/,
  );

  const day = buildFortuneSelectionContext(result, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
  assert.equal(day?.cycleTimeRange.startTimestamp, Date.parse('2008-02-08T12:00:00+08:00'));
  assert.ok(
    day?.hourBreakdown?.every(
      (item) => item.interval.startTimestamp >= day.cycleTimeRange.startTimestamp,
    ),
  );
  const clippedHour = day?.hourBreakdown?.find((item) => item.label === '午时');
  assert.equal(clippedHour?.timeRange, '2008-02-08 12:00:00至2008-02-08 13:00:00（终点不含）');
  assert.deepEqual(
    day?.promptPayload.detailGroups?.[0]?.lines.map((line) => line.slice(0, 10)),
    ['2008-02-08', '2008-02-09'],
  );
});

test('2100 节令年末月的 2101 年流日应能构造流时详情', () => {
  const days = getMonthDaysInfo(2100, 12);
  assert.equal(days[0].solarDate, '2101-01-05');
  assert.equal(days.at(-1)?.solarDate, '2101-02-04');
  assert.equal(getDayHourBreakdown(2101, 1, 5).length, 12);
  assert.equal(getDayHourBreakdown(2101, 2, 4).length, 12);

  const result = createMockResult();
  const cycle = result.luckInfo.cycles[0];
  result.luckInfo.cycles[0] = {
    ...cycle,
    year: 2100,
    years: [{ ...cycle.years[0], year: 2100 }],
    startSolarTime: { year: 2100, month: 2, day: 4, hour: 0, minute: 0, second: 0 },
    endSolarTime: { year: 2101, month: 2, day: 5, hour: 0, minute: 0, second: 0 },
  };
  const context = buildFortuneSelectionContext(result, {
    scope: 'day',
    cycleIndex: 0,
    year: 2100,
    month: 12,
    day: 1,
  });
  assert.equal(context?.dayBreakdown?.[0]?.date, '2101-01-05');
  assert.ok(context?.hourBreakdown?.length);
});

test('出生年份边界外的童运和末步流年仍能生成岁运明细', () => {
  const early = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1900,
    month: 1,
    day: 15,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const earlySelection = buildSourceCurrentFortuneSelection(
    early,
    new Date('1900-01-15T12:00:00+08:00'),
  );
  assert.equal(earlySelection?.year, 1899);
  assert.ok(earlySelection);
  assert.equal(buildSourceFortuneSelectionContext(early, earlySelection)?.year, 1899);
  assert.equal(resolveBaziFortuneDate('1900-01-15').year, 1899);

  const late = baziCalculator.calculateBazi({
    gender: 'male',
    year: 2100,
    month: 1,
    day: 15,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const cycleIndex = late.luckInfo.cycles.length - 1;
  const year = late.luckInfo.cycles[cycleIndex].years[0].year;
  assert.ok(year > 2200);
  const yearContext = buildSourceFortuneSelectionContext(late, {
    scope: 'year',
    cycleIndex,
    year,
  });
  assert.ok(yearContext?.monthBreakdown?.length);
  const month = yearContext?.monthBreakdown?.[0]?.month;
  assert.ok(month);
  const monthContext = buildSourceFortuneSelectionContext(late, {
    scope: 'month',
    cycleIndex,
    year,
    month,
  });
  assert.ok(monthContext?.dayBreakdown?.length);
  const day = getMonthDaysInfo(year, month).find(
    (item) => item.solarDate === monthContext.dayBreakdown?.[0]?.date,
  )?.day;
  assert.ok(day);
  const dayContext = buildSourceFortuneSelectionContext(late, {
    scope: 'day',
    cycleIndex,
    year,
    month,
    day,
  });
  assert.ok(dayContext?.hourBreakdown?.length);
  assert.ok(formatBaziFortuneSelection(dayContext)?.focus);
  assert.equal(getYearInfo(year).months[0].startTermEvidence, undefined);

  const dateSelection = buildSourceFortuneSelectionForDate(late, 'year', '2101-01-15');
  assert.equal(dateSelection.year, 2100);

  const lastMonthDays = getMonthDaysInfo(2231, 12);
  assert.match(lastMonthDays.at(-1)?.solarDate ?? '', /^2232-02-/);
  assert.equal(resolveBaziFortuneDate('2232-01-15').year, 2231);
  assert.equal(getDayHourBreakdown(2232, 1, 15).length, 12);
});

test('流日时辰拆解应先拒绝无效日期', () => {
  assert.throws(() => getDayHourBreakdown(2026, 2, 31), /日期需在 1-28 之间/);
  assert.throws(() => getDayHourBreakdown(2026, 13, 1), /月份需在 1-12 之间/);
  assert.throws(() => getDayHourBreakdown(1898, 1, 1), /年份需在 1899-2233 之间/);
  assert.throws(() => getDayHourBreakdown(2234, 1, 1), /年份需在 1899-2233 之间/);
});

test('交运年份默认应归到后一步大运，而不是继续挂在童运或前一步运里', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 12,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const normalized = normalizeFortuneSelection(result, {
    scope: 'year',
    year: 1998,
  });

  assert.equal(normalized.cycleIndex, 1);
  assert.equal(result.luckInfo.cycles[normalized.cycleIndex ?? -1]?.ganZhi, '乙亥');
});

test('核心运限选择应拒绝缺失字段或非整数的流月流日序号', () => {
  const result = createMockResult();

  assert.throws(
    () => normalizeFortuneSelection(result, { scope: 'dayun' }),
    /必须提供有效的大运序号/,
  );
  assert.throws(
    () => normalizeFortuneSelection(result, { scope: 'year', cycleIndex: 0 }),
    /必须提供属于该大运的有效流年年份/,
  );
  assert.throws(
    () =>
      normalizeFortuneSelection(result, {
        scope: 'month',
        cycleIndex: 0,
        year: 2008,
      }),
    /必须提供有效的流月序号/,
  );
  assert.throws(
    () =>
      normalizeFortuneSelection(result, {
        scope: 'day',
        cycleIndex: 0,
        year: 2008,
        month: 1,
      }),
    /必须提供该节令月内的有效流日序号/,
  );
  assert.throws(
    () =>
      normalizeFortuneSelection(result, {
        scope: 'month',
        cycleIndex: 0,
        year: 2008,
        month: 1.5,
      }),
    /必须提供有效的流月序号/,
  );
  assert.throws(
    () =>
      normalizeFortuneSelection(result, {
        scope: 'day',
        cycleIndex: 0,
        year: 2008,
        month: 1,
        day: 1.5,
      }),
    /必须提供该节令月内的有效流日序号/,
  );
});

test('明确流年可定位所属大运，但冲突的大运序号必须拒绝', () => {
  const result = createMockResult();
  const inferred = normalizeFortuneSelection(result, { scope: 'year', year: 2009 });

  assert.deepEqual(inferred, {
    scope: 'year',
    cycleIndex: 0,
    year: 2009,
  });
  assert.throws(
    () => normalizeFortuneSelection(result, { scope: 'year', cycleIndex: 99, year: 2009 }),
    /必须提供有效的大运序号/,
  );
});

test('大运流年引动应识别与命宫、胎元的冲克刑害', () => {
  const mockResult: BaziChartResult = {
    ...createMockResult(),
    mingGong: '庚午',
    taiYuan: '壬申',
  };
  const context = buildFortuneSelectionContext(mockResult, {
    scope: 'year',
    cycleIndex: 0,
    year: 2008, // 戊子年，子冲午（命宫）
  });
  const triggerLine = context.promptPayload.summaryLines.find((line) => line.includes('流年触发'));
  assert.match(triggerLine ?? '', /冲命宫/);
  const focus = formatBaziFortuneSelection(context)?.focus ?? '';
  assert.equal(focus.match(/流年地支子冲命宫午/g)?.length, 1);
  assert.doesNotMatch(focus, /主变迁变动|身心耗损|事业环境与家宅动荡/);
});

test('岁运补齐三合三支时任务书只列一次结构事实，不断为已经成化', () => {
  const result = createMockResult();
  result.pillars.year = { gan: '甲', zhi: '申', ganZhi: '甲申' };
  result.pillars.month = { gan: '戊', zhi: '辰', ganZhi: '戊辰' };
  result.pillars.day = { gan: '甲', zhi: '寅', ganZhi: '甲寅' };
  result.pillars.hour = { gan: '庚', zhi: '午', ganZhi: '庚午' };
  result.luckInfo.cycles[0].ganZhi = '甲寅';

  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
    year: 2008,
  });
  assert.ok(context);
  assert.equal(context.promptPayload.triggerEvidence?.formations.length, 1);
  const focus = formatBaziFortuneSelection(context)?.focus ?? '';
  assert.equal(focus.match(/申子辰三合水/g)?.length, 1);
  assert.doesNotMatch(focus, /与原局会合成|流年触发：|只记录原局与所选岁运层级/);
});
