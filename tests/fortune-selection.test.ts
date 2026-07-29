import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { getMonthDaysInfo, getYearInfo } from '@core/bazi/calendarTool';
import {
  buildFortuneSelectionContext,
  normalizeFortuneSelection,
} from '@core/bazi/fortuneSelection';
import { getDayHourBreakdown } from '@core/bazi/fortuneSelection/helpers/breakdown';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import {
  buildCurrentBaziFortuneSelection,
  buildRecentBaziFortuneSelection,
} from '../src/components/BaziFortuneTools/helpers';

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
  assert.ok(Array.isArray(context.promptPayload.triggerEvidence?.wealthPatternRuleFacts));
  assert.ok(Array.isArray(context.promptPayload.triggerEvidence?.resourcePatternRuleFacts));
  assert.ok(Array.isArray(context.promptPayload.triggerEvidence?.foodPatternRuleFacts));
  assert.ok(Array.isArray(context.promptPayload.triggerEvidence?.killerPatternRuleFacts));
  assert.ok(Array.isArray(context.promptPayload.triggerEvidence?.hurtPatternRuleFacts));
  assert.ok(
    context.promptPayload.triggerEvidence?.limitationFacts.some(
      (item) => item.type === '层级应期边界',
    ),
  );
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【八字岁运触发结构化证据】/);
});

test('真实食神格排盘应把逐字取运事实贯穿到岁运提示资料', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 2,
    day: 13,
    timeIndex: 4,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '戊寅', '丙辰', '壬辰'],
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气食神格');

  const context = buildFortuneSelectionContext(result, {
    scope: 'dayun',
    cycleIndex: 4,
  });

  assert.ok(context);
  assert.equal(context.displayLabel, '壬午运');
  const foodFacts = context.promptPayload.triggerEvidence.foodPatternRuleFacts;
  assert.deepEqual(
    foodFacts.map((item) => [item.type, item.status]),
    [
      ['食神生财取运候选', '条件待复核'],
      ['食神生财取运候选', '带忌候选'],
    ],
  );
  assert.match(foodFacts[0]?.trigger ?? '', /财食重.*帮身方向/);
  assert.match(foodFacts[1]?.trigger ?? '', /官煞之方俱为不美/);

  const evidenceText = context.promptPayload.evidenceLines?.join('\n') ?? '';
  assert.match(evidenceText, /【主证】食神格逐字取运候选/);
  assert.match(evidenceText, /财食重.*条件待复核/);
  assert.match(evidenceText, /官煞之方俱为不美.*带忌候选/);
  assert.match(evidenceText, /不得把单项候选定为最终喜运、忌运、吉凶或现实事件/);
});

test('真实七杀格排盘应把相反逐字取运候选贯穿到岁运提示资料', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 4,
    timeIndex: 12,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['己未', '丙子', '丁丑', '庚子'],
  );
  assert.equal(result.analysis.mingGe.pattern, '七杀格');

  const context = buildFortuneSelectionContext(result, {
    scope: 'dayun',
    cycleIndex: 5,
  });

  assert.ok(context);
  assert.equal(context.displayLabel, '辛未运');
  const killerFacts = context.promptPayload.triggerEvidence.killerPatternRuleFacts;
  assert.ok(
    killerFacts.some(
      (item) => item.type === '杀用食制取运候选' && item.trigger.includes('杀重食轻'),
    ),
  );
  assert.ok(
    killerFacts.some((item) => item.status === '带忌候选' && item.trigger.includes('印绶夺食')),
  );
  assert.ok(
    killerFacts.some(
      (item) => item.type === '七杀用财助杀取运候选' && item.trigger.includes('财已足'),
    ),
  );
  assert.ok(
    killerFacts.some(
      (item) => item.type === '七杀用财助杀取运候选' && item.trigger.includes('财未足'),
    ),
  );

  const evidenceText = context.promptPayload.evidenceLines?.join('\n') ?? '';
  assert.match(evidenceText, /【主证】七杀格逐字取运候选/);
  assert.match(evidenceText, /杀重食轻.*条件待复核/);
  assert.match(evidenceText, /印绶夺食.*带忌候选/);
  assert.match(evidenceText, /财已足/);
  assert.match(evidenceText, /财未足/);
  assert.match(evidenceText, /不得把单项候选定为最终喜运、忌运、吉凶或现实事件/);
});

test('真实金水伤官排盘应把佩印与用官的相反取运候选贯穿到提示资料', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 12,
    day: 13,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['庚申', '戊子', '庚申', '丁丑'],
  );
  assert.equal(result.analysis.mingGe.pattern, '伤官格');

  const context = buildFortuneSelectionContext(result, {
    scope: 'dayun',
    cycleIndex: 5,
  });

  assert.ok(context);
  assert.equal(context.displayLabel, '癸巳运');
  const hurtFacts = context.promptPayload.triggerEvidence.hurtPatternRuleFacts;
  assert.ok(
    hurtFacts.some(
      (item) =>
        item.type === '伤官佩印取运候选' &&
        item.status === '支持候选' &&
        item.trigger.includes('伤食不碍'),
    ),
  );
  assert.ok(
    hurtFacts.some(
      (item) =>
        item.type === '伤官用官取运候选' &&
        item.status === '带忌候选' &&
        item.trigger.includes('不利食伤'),
    ),
  );
  assert.ok(
    hurtFacts.every(
      (item) =>
        item.natalStructure.includes('伤官、日主与印星实际轻重') ||
        item.natalStructure.includes('财印明透尚未俱备'),
    ),
  );

  const evidenceText = context.promptPayload.evidenceLines?.join('\n') ?? '';
  assert.match(evidenceText, /【主证】伤官格逐字取运候选/);
  assert.match(evidenceText, /伤食不碍.*支持候选/);
  assert.match(evidenceText, /不利食伤.*带忌候选/);
  assert.match(evidenceText, /相反候选须全部保留/);
  assert.match(evidenceText, /不得把单项候选定为最终喜运、忌运、吉凶或现实事件/);
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
  assert.equal(context.hourBreakdown?.length, 13);
  assert.match(context.promptPayload.summaryLines.join('\n'), /流日：2008-02-08/);
  assert.match(
    context.promptPayload.summaryLines.join('\n'),
    /按子初换日：2008-02-07 23:00 至 2008-02-08 22:59/,
  );
  assert.match(context.promptPayload.breakdownLines?.[0] ?? '', /晚子时/);
  assert.match(context.promptPayload.breakdownLines?.[1] ?? '', /早子时/);
  assert.doesNotMatch(
    context.promptPayload.breakdownLines?.join('\n') ?? '',
    /2008-02-08 23:00-23:59/,
  );
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /【主证】流日干支与十神/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /按子初换日/);
  assert.match(context.promptPayload.evidenceLines?.join('\n') ?? '', /不得改写长期命局或整年趋势/);
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
