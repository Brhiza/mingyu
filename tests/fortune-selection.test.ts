import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { getMonthDaysInfo, getYearInfo } from '@core/bazi/calendarTool';
import {
  buildCurrentBaziFortuneSelection,
  buildFortuneSelectionContext,
  buildRecentBaziFortuneSelection,
  getCurrentBaziLuckCycle,
  normalizeFortuneSelection,
} from 'mingyu-core/bazi';
import { getDayHourBreakdown } from '@core/bazi/fortuneSelection/helpers/breakdown';
import type { BaziChartResult } from '@core/bazi/baziTypes';

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

test('运限选择器的当天快捷值会选择对应的大运、流月和流日', () => {
  const result = createMockResult();
  const selection = buildCurrentBaziFortuneSelection(result, new Date(2008, 1, 8, 12));

  assert.deepEqual(selection, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
});

test('近期年限预设会选择当前流月而不是锁定当天', () => {
  const result = createMockResult();
  const selection = buildRecentBaziFortuneSelection(result, new Date(2008, 1, 8, 12));

  assert.deepEqual(selection, {
    scope: 'month',
    cycleIndex: 0,
    year: 2008,
    month: 1,
  });
});

test('当前年份不在命盘运限范围时不应静默回退到第一步大运', () => {
  const result = createMockResult();
  const outOfRangeDate = new Date(1980, 1, 8, 12);

  assert.equal(getCurrentBaziLuckCycle(result, 1980), null);
  assert.equal(buildCurrentBaziFortuneSelection(result, outOfRangeDate), null);
  assert.equal(buildRecentBaziFortuneSelection(result, outOfRangeDate), null);
});

test('当前大运定位应服从交运时刻而不是只看交运年份', () => {
  const result = createMockResult();
  const cycle = result.luckInfo.cycles[0];
  cycle.startSolarTime = { year: 2008, month: 2, day: 8, hour: 12, minute: 0, second: 0 };
  cycle.endSolarTime = { year: 2018, month: 2, day: 8, hour: 12, minute: 0, second: 0 };

  assert.equal(getCurrentBaziLuckCycle(result, new Date(2008, 1, 8, 11, 59, 59)), null);
  assert.equal(getCurrentBaziLuckCycle(result, new Date(2008, 1, 8, 12)), cycle);
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
  assert.match(context.promptPayload.summaryLines.join('\n'), /地支子与日柱子伏吟/);
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
  assert.match(context.promptPayload.breakdownLines?.[0] ?? '', /1月/);
  assert.match(
    context.promptPayload.breakdownLines?.[0] ?? '',
    /\d{4}-\d{2}-\d{2} 至 \d{4}-\d{2}-\d{2}/,
  );
  assert.doesNotMatch(context.promptPayload.summaryLines.join('\n'), /童运/);
  assert.match(
    context.promptPayload.summaryLines.join('\n'),
    /流年十神：天干戊为偏财，地支子主气为正印/,
  );
  assert.match(context.promptPayload.summaryLines.join('\n'), /流年触发：/);
  assert.match(context.promptPayload.summaryLines.join('\n'), /地支子冲年柱午/);
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
    /按子初换日：2008-02-07 23:00 至 2008-02-08 22:59/,
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
  assert.match(context?.hourBreakdown?.[0]?.label ?? '', /晚子时/);
  assert.match(context?.hourBreakdown?.[1]?.label ?? '', /早子时/);
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

  const month = buildFortuneSelectionContext(result, {
    scope: 'month',
    cycleIndex: 0,
    year: 2008,
    month: 1,
  });
  assert.equal(month?.dayBreakdown?.length, 2);
  assert.equal(month?.dayBreakdown?.[0]?.timeRange.start.hour, 12);
  assert.equal(month?.dayBreakdown?.[1]?.timeRange.end.hour, 12);

  const day = buildFortuneSelectionContext(result, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
  assert.equal(day?.cycleTimeRange.startTimestamp, new Date(2008, 1, 8, 12).getTime());
  assert.ok(
    day?.hourBreakdown?.every(
      (item) => item.interval.startTimestamp >= day.cycleTimeRange.startTimestamp,
    ),
  );
});

test('流日时辰拆解应先拒绝无效日期', () => {
  assert.throws(() => getDayHourBreakdown(2026, 2, 31), /日期需在 1-28 之间/);
  assert.throws(() => getDayHourBreakdown(2026, 13, 1), /月份需在 1-12 之间/);
  assert.throws(() => getDayHourBreakdown(1899, 1, 1), /年份需在 1900-2100 之间/);
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

test('核心运限选择不得把缺失字段静默替换成当前时间或第一项', () => {
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
