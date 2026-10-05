import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  generateQimenLifetimePrompt,
  buildLifetimePrompt,
  normalizeQimenLifetimeTime,
  extractPersonalMarkers,
  buildTopicCandidates,
  buildLifetimeStages,
  generateQimen,
  scanLifetimeDynamicEvents,
} from '../packages/core/src/divination/algorithms/qimen';
import { getDivinationTime } from '../packages/core/src/calendar/timeManager';
import { resolveCivilTime } from '../packages/core/src/calendar/civil-time';

const qimenCurrentYearInput: Parameters<typeof calculateQimenLifetime>[0] = {
  birthDateTime: '1990-05-15T14:30:00',
  timeZoneId: 'Asia/Shanghai',
  periodRange: { startDate: '2026-01-01', endDate: '2026-12-31' },
};
const qimenCurrentYearQuestion = '未来一年的事业如何？';
const qimenCurrentYearSeed = calculateQimenLifetime(qimenCurrentYearInput);
const qimenBaseSeed = calculateQimenLifetime({ birthDateTime: '1990-05-15T14:30:00+08:00' });
const qimenFuShiSeed = calculateQimenLifetime({
  birthDateTime: '2026-01-01T08:00:00',
  gender: 'male',
  stagePolicy: { model: 'fuShiHexagramOrbit' },
});

function buildQimenCurrentYearFixture() {
  const data = structuredClone(qimenCurrentYearSeed);
  const prompt = buildLifetimePrompt(data, qimenCurrentYearQuestion);
  data.prompt = prompt;
  return { data, prompt };
}

function verifiedChartSolar(chart: ReturnType<typeof generateQimen>, offset: number) {
  const expected = getDivinationTime(new Date(chart.timestamp), offset);
  assert.deepEqual(chart.ganzhi, expected.ganzhi);
  return expected.timeInfo.solar;
}

import { diPanPalaces } from '../packages/core/src/divination/algorithms/qimen/helpers/_constants';

test('天禽为值符时终身局个人标记与符使阶段均采用实际寄宫', () => {
  const lifetime = structuredClone(qimenFuShiSeed);
  const chart = lifetime.baseChart;
  assert.equal(chart.zhiFu, '天禽');
  const companionPalace = chart.jiuGongGe.find((palace) => palace.tianPan.companionStar === '天禽');
  assert.equal(companionPalace?.gong, 6);
  assert.deepEqual(
    lifetime.personalMarkers
      .filter((marker) => marker.markerType === 'zhiFuStar')
      .map((marker) => marker.palace),
    [6],
  );
  assert.equal(lifetime.stages[0].dominantPalaces[0].palace, 6);
  assert.equal(lifetime.stages[2].dominantPalaces[0].palace, 6);
  const prompt = buildLifetimePrompt(lifetime, undefined, { includeCurrentTime: false });
  assert.match(prompt, /值符星落宫（天禽）：[^\n]*乾六宫/);
  assert.match(prompt, /阶段1：[^\n]*\n  主导宫位：乾六宫/);
});

function annualPatternFacts(
  chart: ReturnType<typeof generateQimen>,
  taiSuiPalace: number,
): string[] {
  return (chart.classicPatterns ?? [])
    .filter(
      (pattern) =>
        pattern.palaces.includes(taiSuiPalace) &&
        (pattern.type === 'good' || pattern.type === 'bad'),
    )
    .map((pattern) => `${pattern.type}:${pattern.name}`)
    .sort();
}

function clusterPatternFacts(cluster: {
  supportEvidence: string[];
  counterEvidence: string[];
}): string[] {
  return [
    ...cluster.supportEvidence.flatMap((fact) => {
      const match = fact.match(/岁盘吉格「([^」]+)」/);
      return match ? [`good:${match[1]}`] : [];
    }),
    ...cluster.counterEvidence.flatMap((fact) => {
      const match = fact.match(/岁盘凶格「([^」]+)」/);
      return match ? [`bad:${match[1]}`] : [];
    }),
  ].sort();
}

function assertMonthClashLocalTime(
  clusters: NonNullable<ReturnType<typeof calculateQimenLifetime>['eventClusters']>,
  year: number,
  offsetMinutes: number,
) {
  const monthClash = clusters.find((cluster) =>
    cluster.key.startsWith(`cluster:${year}:month-clash:`),
  );
  assert.ok(monthClash?.triggerDates?.length);
  const term = monthClash.triggerDates[0];
  assert.equal(typeof term.timestamp, 'number');
  const expected = new Date(term.timestamp! + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  assert.equal(term.dateTime, expected);
}

test('奇门终身局 P0：时间标准化与真太阳时校正', () => {
  // 1. 公历常规出生时间（北京时间）
  const normal = normalizeQimenLifetimeTime({
    birthDateTime: '1990-05-15T14:30:00',
    calendarType: 'solar',
  });
  assert.equal(normal.basis.calendar, '公历');
  assert.equal(normal.basis.timeStandard, '法定民用时');
  assert.equal(normal.calculationParts.year, 1990);
  assert.equal(normal.calculationParts.month, 5);
  assert.equal(normal.calculationParts.day, 15);
  assert.equal(normal.calculationParts.hour, 14);

  // 2. 农历换算为公历
  const lunar = normalizeQimenLifetimeTime({
    birthDateTime: '1990-04-21T14:30:00',
    calendarType: 'lunar',
  });
  assert.match(lunar.basis.calendar, /农历/);
  // 1990年农历四月廿一对应公历 1990-05-15
  assert.equal(lunar.calculationParts.year, 1990);
  assert.equal(lunar.calculationParts.month, 5);
  assert.equal(lunar.calculationParts.day, 15);

  // 3. 启用真太阳时（经度 116.4074）
  const tst = normalizeQimenLifetimeTime({
    birthDateTime: '1990-05-15T12:00:00',
    calendarType: 'solar',
    timeStandard: 'trueSolar',
    location: { longitude: 116.4074 },
  });
  assert.equal(tst.basis.timeStandard, '真太阳时');
  assert.ok(typeof tst.basis.trueSolarOffsetSeconds === 'number');

  // 4. 缺少经度时应明确报错
  assert.throws(() => {
    normalizeQimenLifetimeTime({
      birthDateTime: '1990-05-15T12:00:00',
      timeStandard: 'trueSolar',
    });
  }, /启用真太阳时必须提供出生地经度/);
});

test('奇门终身局显式出生偏移与时区必须指向同一真实瞬时', () => {
  const birthDateTime = '2024-02-04T03:27:08+08:00';
  const implicit = normalizeQimenLifetimeTime({ birthDateTime });
  assert.equal(implicit.referenceDate.toISOString(), '2024-02-03T19:27:08.000Z');
  assert.equal(implicit.basis.timeZoneUsed, 'UTC+08:00');
  const chart = calculateQimenLifetime({ birthDateTime, timezone: 8 });
  assert.equal(chart.baseChart.timestamp, Date.parse(birthDateTime));
  assert.equal(chart.basis.timeZoneUsed, 'UTC+08:00');
  assert.equal(chart.baseChart.timeInfo.solarTerm, '大寒');
  assert.equal(chart.baseChart.ganzhi.year, '癸卯');

  const otherInstant = calculateQimenLifetime({
    birthDateTime: '2024-02-04T03:27:08',
    timezone: -5,
  });
  assert.equal(
    new Date(otherInstant.baseChart.timestamp).toISOString(),
    '2024-02-04T08:27:08.000Z',
  );
  assert.equal(otherInstant.baseChart.timeInfo.solarTerm, '立春');
  assert.equal(otherInstant.baseChart.ganzhi.year, '甲辰');

  const quarter = normalizeQimenLifetimeTime({ birthDateTime: '2024-02-04T03:27:00+05:45' });
  assert.equal(quarter.referenceDate.toISOString(), '2024-02-03T21:42:00.000Z');
  assert.equal(quarter.basis.timeZoneUsed, 'UTC+05:45');

  assert.throws(
    () => calculateQimenLifetime({ birthDateTime, timezone: -5 }),
    /出生时刻的 UTC 偏移与 timezone 不一致/u,
  );
  assert.throws(
    () => normalizeQimenLifetimeTime({ birthDateTime: '2024-02-04T03:27:00+08:60', timezone: 9 }),
    /出生时刻的 UTC 偏移分钟无效/u,
  );
});

test('奇门终身局应沿用固定非东八区的 civil 与真实瞬时点', () => {
  const input = {
    birthDateTime: '1990-05-15T14:30:00',
    timezone: -5,
    timeStandard: 'civil' as const,
  };
  const normalized = normalizeQimenLifetimeTime(input);
  const lifetime = calculateQimenLifetime(input);

  assert.equal(normalized.timezoneOffsetMinutes, -300);
  assert.equal(normalized.normalizedDate.toISOString(), '1990-05-15T19:30:00.000Z');
  assert.equal(lifetime.baseChart.timestamp, normalized.normalizedDate.getTime());
  assert.deepEqual(verifiedChartSolar(lifetime.baseChart, normalized.timezoneOffsetMinutes), {
    year: 1990,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
  });
  assert.equal(lifetime.stages[0].calendarStart, '1990-05-15');
});

test('奇门终身局 IANA 夏令时应让基础盘保持当地 civil', () => {
  const input = {
    birthDateTime: '2024-05-15T14:30:00',
    timeZoneId: 'America/New_York',
    timeStandard: 'civil' as const,
  };
  const normalized = normalizeQimenLifetimeTime(input);
  const lifetime = calculateQimenLifetime(input);

  assert.equal(normalized.timezoneOffsetMinutes, -240);
  assert.equal(normalized.normalizedDate.toISOString(), '2024-05-15T18:30:00.000Z');
  assert.equal(lifetime.baseChart.timestamp, normalized.normalizedDate.getTime());
  assert.deepEqual(verifiedChartSolar(lifetime.baseChart, normalized.timezoneOffsetMinutes), {
    year: 2024,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
  });
  assert.match(lifetime.basis.timeZoneUsed, /America\/New_York \(UTC-04:00\)/);
});

test('奇门终身局真太阳时应沿用非东八区修正后的 civil', () => {
  const input = {
    birthDateTime: '2024-05-15T14:30:00',
    timezone: -5,
    timeStandard: 'trueSolar' as const,
    location: { longitude: -74 },
  };
  const normalized = normalizeQimenLifetimeTime(input);
  const lifetime = calculateQimenLifetime(input);
  const solar = verifiedChartSolar(lifetime.baseChart, normalized.timezoneOffsetMinutes);

  assert.equal(lifetime.baseChart.timestamp, normalized.normalizedDate.getTime());
  assert.deepEqual(solar, {
    year: normalized.calculationParts.year,
    month: normalized.calculationParts.month,
    day: normalized.calculationParts.day,
    hour: normalized.calculationParts.hour,
    minute: normalized.calculationParts.minute,
  });
});

test('奇门终身局 UTC+14 当地午夜应保留出生日期并用于阶段日历', () => {
  const input = {
    birthDateTime: '2024-01-02T00:30:00',
    timezone: 14,
    timeStandard: 'civil' as const,
  };
  const normalized = normalizeQimenLifetimeTime(input);
  const lifetime = calculateQimenLifetime(input);

  assert.equal(normalized.normalizedDate.toISOString(), '2024-01-01T10:30:00.000Z');
  assert.deepEqual(verifiedChartSolar(lifetime.baseChart, normalized.timezoneOffsetMinutes), {
    year: 2024,
    month: 1,
    day: 2,
    hour: 0,
    minute: 30,
  });
  assert.equal(lifetime.stages[0].calendarStart, '2024-01-02');
});

test('奇门终身局非东八区应按真实瞬时点切换立春而保留当地日时', () => {
  const nyBefore = calculateQimenLifetime({
    birthDateTime: '2024-02-04T03:27:00',
    timezone: -5,
    timeStandard: 'civil',
  });
  const nyAfter = calculateQimenLifetime({
    birthDateTime: '2024-02-04T03:27:15',
    timezone: -5,
    timeStandard: 'civil',
  });
  assert.equal(nyBefore.baseChart.timeInfo.solarTerm, '大寒');
  assert.equal(nyAfter.baseChart.timeInfo.solarTerm, '立春');
  assert.deepEqual(verifiedChartSolar(nyBefore.baseChart, -300), {
    year: 2024,
    month: 2,
    day: 4,
    hour: 3,
    minute: 27,
  });
  assert.deepEqual(
    verifiedChartSolar(nyAfter.baseChart, -300),
    verifiedChartSolar(nyBefore.baseChart, -300),
  );
  assert.deepEqual(
    [nyBefore.baseChart.ganzhi.year, nyBefore.baseChart.ganzhi.month],
    ['癸卯', '乙丑'],
  );
  assert.deepEqual(
    [nyAfter.baseChart.ganzhi.year, nyAfter.baseChart.ganzhi.month],
    ['甲辰', '丙寅'],
  );
  assert.equal(nyBefore.baseChart.seasonality?.currentJieQi, '大寒');
  assert.equal(nyAfter.baseChart.seasonality?.currentJieQi, '立春');

  const apiaBefore = calculateQimenLifetime({
    birthDateTime: '2024-02-04T22:27:00',
    timezone: 14,
    timeStandard: 'civil',
  });
  const apiaAfter = calculateQimenLifetime({
    birthDateTime: '2024-02-04T22:27:15',
    timezone: 14,
    timeStandard: 'civil',
  });
  assert.equal(apiaBefore.baseChart.timeInfo.solarTerm, '大寒');
  assert.equal(apiaAfter.baseChart.timeInfo.solarTerm, '立春');
  assert.deepEqual(verifiedChartSolar(apiaBefore.baseChart, 840), {
    year: 2024,
    month: 2,
    day: 4,
    hour: 22,
    minute: 27,
  });
  assert.deepEqual(
    verifiedChartSolar(apiaAfter.baseChart, 840),
    verifiedChartSolar(apiaBefore.baseChart, 840),
  );
  assert.deepEqual(
    [apiaBefore.baseChart.ganzhi.year, apiaBefore.baseChart.ganzhi.month],
    ['癸卯', '乙丑'],
  );
  assert.deepEqual(
    [apiaAfter.baseChart.ganzhi.year, apiaAfter.baseChart.ganzhi.month],
    ['甲辰', '丙寅'],
  );
});

test('奇门终身局 P1：个人标记与六亲主题宫提取', () => {
  const lifetime = calculateQimenLifetime({
    birthDateTime: '2024-06-15T14:30:00+08:00', // 芒种阳六局庚戌日癸未时
    calendarType: 'solar',
    gender: 'male',
  });

  // 1. 基础局验证
  assert.equal(lifetime.baseChart.ganzhi.day, '庚戌');
  assert.equal(lifetime.baseChart.ganzhi.hour, '癸未');
  assert.equal(lifetime.baseChart.juShu, 6);
  assert.equal(lifetime.baseChart.zhiFu, '天柱');
  assert.equal(lifetime.baseChart.zhiShi, '惊门');

  // 2. 个人标记核验
  const markers = lifetime.personalMarkers;
  assert.ok(markers.length >= 6);

  // 年命甲辰（2024年干支甲辰）
  const yearStemMarker = markers.find((m) => m.markerType === 'yearStem' && m.layer === 'tianPan');
  assert.ok(yearStemMarker, '应存在天盘年干标记');

  // 年支辰（辰在巽四宫）
  const yearBranchMarker = markers.find((m) => m.markerType === 'yearBranch');
  assert.ok(yearBranchMarker);
  assert.equal(yearBranchMarker.value, '辰');
  assert.equal(yearBranchMarker.palace, 4);

  // 日干庚、时干癸
  const dayStemMarker = markers.find((m) => m.markerType === 'dayStem' && m.layer === 'tianPan');
  assert.ok(dayStemMarker);
  assert.equal(dayStemMarker.value, '庚');

  const hourStemMarker = markers.find((m) => m.markerType === 'hourStem' && m.layer === 'tianPan');
  assert.ok(hourStemMarker);
  assert.equal(hourStemMarker.value, '癸');

  // 3. 主题宫候选核验
  const topics = lifetime.topicCandidates;
  const career = topics.find((t) => t.topic === 'career');
  const wealth = topics.find((t) => t.topic === 'wealth');
  const marriage = topics.find((t) => t.topic === 'marriage');
  const health = topics.find((t) => t.topic === 'health');

  assert.ok(career && career.primaryPalaces.length > 0);
  assert.ok(wealth && wealth.primaryPalaces.length > 0);
  assert.ok(marriage && marriage.primaryPalaces.length > 0);
  assert.ok(health && health.primaryPalaces.length > 0);
  assert.match(career.basis, /《统宗》/);
});

test('奇门终身局 P2：阶段划分引擎（四柱分限 vs 九宫巡行）', () => {
  // 1. 四柱分限模型
  const resultPillar = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    stagePolicy: { model: 'pillarFourLimits' },
  });

  assert.equal(resultPillar.stages.length, 4);
  assert.equal(resultPillar.stages[0].ageStart, 0);
  assert.equal(resultPillar.stages[0].ageEnd, 16);
  assert.equal(resultPillar.stages[1].ageStart, 17);
  assert.equal(resultPillar.stages[1].ageEnd, 32);
  assert.equal(resultPillar.stages[2].ageStart, 33);
  assert.equal(resultPillar.stages[2].ageEnd, 48);
  assert.equal(resultPillar.stages[3].ageStart, 49);
  assert.equal(resultPillar.stages[3].ageEnd, 80);
  assert.deepEqual(
    resultPillar.stages.map((stage) => [stage.calendarStart, stage.calendarEnd]),
    [
      ['1990-05-15', '2007-05-14'],
      ['2007-05-15', '2023-05-14'],
      ['2023-05-15', '2039-05-14'],
      ['2039-05-15', '2070-05-15'],
    ],
    '生日非年初时阶段日历必须连续，不得留下整年空档',
  );

  // 3. 符使卦轨模型（覆盖至 80 岁）
  const resultGuaGui = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    stagePolicy: { model: 'fuShiHexagramOrbit' },
  });
  assert.equal(resultGuaGui.stages.length, 8);
  assert.equal(resultGuaGui.stages[0].calendarEnd, '2000-05-14');
  assert.equal(resultGuaGui.stages[1].calendarStart, '2000-05-15');
  assert.equal(resultGuaGui.stages[7].ageEnd, 79);

  // 4. 虚岁系统测试
  const resultNominal = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    stagePolicy: { model: 'pillarFourLimits', ageSystem: 'nominalAge' },
  });
  assert.equal(resultNominal.stages[0].ageStart, 1);
  assert.equal(resultNominal.stages[0].ageEnd, 17);
});

test('奇门终身局阶段门神空马取象进入提示词时保留盘面与核对条件', () => {
  const { data, prompt } = generateQimenLifetimePrompt({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    stagePolicy: { model: 'palaceWalk' },
  });
  const stageText = prompt.split('【人生阶段资料】')[1]?.split('【任务】')[0] ?? '';
  const doorAndGodFacts = data.stages.flatMap((stage) => [
    ...stage.supportFacts,
    ...stage.constraintFacts,
  ]);

  assert.ok(doorAndGodFacts.some((fact) => fact.includes('传统门象')));
  assert.ok(doorAndGodFacts.some((fact) => fact.includes('传统神象')));
  assert.ok(doorAndGodFacts.some((fact) => fact.includes('宫逢旬空')));
  assert.ok(doorAndGodFacts.some((fact) => fact.includes('临驿马星')));
  assert.match(stageText, /宫位支持类象：/);
  assert.match(stageText, /宫位制约类象：/);
  assert.match(prompt, /多种解释用可核实的现实信息区分/);
  assert.doesNotMatch(stageText, /结合本宫配置与现实条件核对|结合本宫星神干与现实条件核对/);
  assert.doesNotMatch(
    stageText,
    /人事实质通达顺畅|贵人引路|名气外显|吉凶能量暂未落地|中年鼎盛|晚景安泰/u,
  );
});

test('奇门终身局动态扫描不得将阶段范围外日期归入首阶段', () => {
  const lifetime = structuredClone(qimenBaseSeed);
  const clusters = scanLifetimeDynamicEvents(
    lifetime.baseChart,
    lifetime.stages,
    { startDate: '1989-01-01', endDate: '1989-12-31' },
    'zhuanpan',
    'chaibu',
    { timezone: 8 },
  );
  assert.ok(clusters.length > 0);
  assert.ok(clusters.every((cluster) => cluster.stageIndex === undefined));
  assert.ok(clusters.some((cluster) => cluster.triggerDates?.length));
  const keys = new Set(clusters.map((cluster) => cluster.key));
  assert.ok(
    lifetime.stages.every(
      (stage) => stage.eventClusterKeys?.every((key) => !keys.has(key)) ?? true,
    ),
  );
});

test('奇门终身局 P3：动态周期扫描与事件聚类（含年月日关键节点）', () => {
  const result = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    periodRange: {
      startDate: '2026-01-01',
      endDate: '2028-12-31',
    },
  });

  assert.ok(result.eventClusters, '应生成事件簇');
  assert.ok(result.eventClusters.length >= 2, '2026-2028 应产生若干流年事件簇');
  assert.ok(
    result.eventClusters.some(
      (ec) => ec.key.includes('month-clash') || ec.timeSpan.includes('月建'),
    ),
    '短区间应生成月令关键节点事件簇',
  );
  const triggerFacts = result.eventClusters.flatMap((ec) => ec.triggerDates ?? []);
  const dailyFacts = triggerFacts.filter((fact) => fact.ganzhi);
  assert.ok(triggerFacts.length > 0, '窗口内应保留实际日支关系日期');
  assert.ok(triggerFacts.every((fact) => /^202[6-8]-\d{2}-\d{2}$/u.test(fact.date)));
  assert.ok(dailyFacts.length > 0, '窗口内应保留日干支事实');
  assert.ok(dailyFacts.every((fact) => typeof fact.ganzhi === 'string'));
  assert.equal(
    new Set(result.eventClusters.map((ec) => ec.key)).size,
    result.eventClusters.length,
    '事件簇主键必须唯一',
  );
  assert.ok(
    result.eventClusters.every((ec) => !ec.key.endsWith(':day-nodal')),
    '不能以整段窗口冒充日级节点',
  );
  const monthFacts = result.eventClusters
    .filter((ec) => ec.key.includes(':month-clash:'))
    .flatMap((ec) => ec.triggerDates ?? []);
  assert.ok(monthFacts.length > 0, '月令节点应带真实交节日期');
  assert.ok(monthFacts.every((fact) => /^202[6-8]-\d{2}-\d{2}$/u.test(fact.date)));
  const ziMonth = result.eventClusters.find((ec) =>
    ec.key.startsWith('cluster:2026:month-clash:子:'),
  );
  assert.equal(ziMonth?.triggerDates?.length, 1);
  assert.match(ziMonth!.triggerDates![0].date, /^2026-12-/u);
  const chouMonth = result.eventClusters.find((ec) =>
    ec.key.startsWith('cluster:2027:month-clash:丑:'),
  );
  assert.equal(chouMonth?.triggerDates?.length, 1);
  assert.match(chouMonth!.triggerDates![0].date, /^2028-01-/u);
  for (const ec of result.eventClusters) {
    assert.ok(ec.key.startsWith('cluster:'));
    assert.ok(ec.topics.length > 0);
    assert.ok(ec.triggerFact.length > 0);
    assert.ok(ec.verificationQuestions.length > 0);
  }
});

test('奇门日级事件跨阶段时应逐日归属并保留全部日期', () => {
  const lifetime = structuredClone(qimenBaseSeed);
  const stages = [
    {
      ...lifetime.stages[0],
      stageIndex: 0,
      calendarStart: '2026-01-01',
      calendarEnd: '2026-06-14',
    },
    {
      ...lifetime.stages[0],
      stageIndex: 1,
      calendarStart: '2026-06-15',
      calendarEnd: '2026-12-31',
    },
  ];
  const clusters = scanLifetimeDynamicEvents(
    lifetime.baseChart,
    stages,
    { startDate: '2026-01-01', endDate: '2026-12-31' },
    'zhuanpan',
    'chaibu',
    { timezone: 8 },
  ).filter((cluster) => cluster.key.includes(':day:'));
  assert.ok(clusters.some((cluster) => cluster.stageIndex === 0));
  assert.ok(clusters.some((cluster) => cluster.stageIndex === 1));
  for (const cluster of clusters) {
    assert.notEqual(cluster.stageIndex, undefined);
    const stage = stages[cluster.stageIndex!];
    assert.ok(cluster.triggerDates?.length);
    assert.ok(
      cluster.triggerDates!.every(
        (fact) => fact.date >= stage.calendarStart && fact.date <= stage.calendarEnd,
      ),
    );
  }
  const original = scanLifetimeDynamicEvents(
    lifetime.baseChart,
    [{ ...stages[0], calendarEnd: '2026-12-31' }],
    { startDate: '2026-01-01', endDate: '2026-12-31' },
    'zhuanpan',
    'chaibu',
    { timezone: 8 },
  ).filter((cluster) => cluster.key.includes(':day:'));
  const dates = (items: typeof clusters) =>
    items
      .flatMap((cluster) => cluster.triggerDates ?? [])
      .map((fact) => `${fact.date}:${fact.relation}`)
      .sort();
  assert.deepEqual(dates(clusters), dates(original));
  const prompt = buildLifetimePrompt({ ...lifetime, stages, eventClusters: clusters }, undefined, {
    includeCurrentTime: false,
  });
  assert.match(prompt, /2026年本命空亡填实（涉及阶段1） 共\d+个日辰/u);
  assert.match(prompt, /2026年本命空亡填实（涉及阶段2） 共\d+个日辰/u);
});

test('奇门终身局一月窗口应回看上一干支年丑月交节', () => {
  const result = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    periodRange: {
      startDate: '2028-01-01',
      endDate: '2028-01-31',
    },
  });
  const chouMonth = result.eventClusters?.find((cluster) =>
    cluster.key.startsWith('cluster:2027:month-clash:丑:'),
  );
  assert.ok(chouMonth, '一月窗口应保留上一干支年丑月的小寒节点');
  assert.equal(chouMonth.triggerDates?.length, 1);
  assert.match(chouMonth.triggerDates![0].date, /^2028-01-/u);
});

test('奇门终身局日级关系应跨年裁切并保留当地日干支', () => {
  const result = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    periodRange: {
      startDate: '2025-01-01',
      endDate: '2026-12-31',
    },
  });
  const dates =
    result.eventClusters
      ?.flatMap((cluster) => cluster.triggerDates ?? [])
      .filter((fact) => fact.ganzhi)
      .map((fact) => fact.date) ?? [];
  assert.ok(dates.length > 0);
  assert.ok(dates.some((date) => date.startsWith('2025-')));
  assert.ok(dates.some((date) => date.startsWith('2026-')));
  assert.ok(
    result.eventClusters
      ?.filter((cluster) => cluster.key.includes(':day:'))
      .every((cluster) => !cluster.timeSpan.includes('至')),
  );
});

test('奇门终身局日级关系应按纽约夏令时读取当地日期', () => {
  const localNoon = resolveCivilTime({
    year: 2024,
    month: 3,
    day: 10,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: 'America/New_York',
  });
  const expected = getDivinationTime(new Date(localNoon.utcTimestamp), -240).ganzhi.day;
  const lifetime = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00',
    periodRange: {
      startDate: '2024-03-10',
      endDate: '2024-03-10',
    },
    timeZoneId: 'America/New_York',
  });
  const { horseStar: _horseStar, ...baseChartWithoutHorse } = lifetime.baseChart;
  const baseChart = { ...baseChartWithoutHorse, voidBranches: [expected.charAt(1)] };
  const clusters = scanLifetimeDynamicEvents(
    baseChart,
    lifetime.stages,
    { startDate: '2024-03-10', endDate: '2024-03-10' },
    'zhuanpan',
    'chaibu',
    { timeZoneId: 'America/New_York' },
  );
  const fact = clusters
    .flatMap((cluster) => cluster.triggerDates ?? [])
    .find((item) => item.date === '2024-03-10');
  assert.deepEqual(fact, {
    date: '2024-03-10',
    ganzhi: expected,
    relation: `本命空亡填实（${expected.charAt(1)}）`,
  });
});

test('奇门终身局日级关系应按 UTC+14 的当地日期读取跨 UTC 日', () => {
  const localNoon = resolveCivilTime({
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: 'Pacific/Kiritimati',
  });
  const expected = getDivinationTime(new Date(localNoon.utcTimestamp), 840).ganzhi.day;
  const lifetime = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00',
    periodRange: {
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    },
    timezone: 14,
  });
  const { horseStar: _horseStar, ...baseChartWithoutHorse } = lifetime.baseChart;
  const baseChart = { ...baseChartWithoutHorse, voidBranches: [expected.charAt(1)] };
  const clusters = scanLifetimeDynamicEvents(
    baseChart,
    lifetime.stages,
    { startDate: '2024-01-01', endDate: '2024-01-01' },
    'zhuanpan',
    'chaibu',
    { timezone: 14, fallbackOffsetMinutes: 840 },
  );
  const fact = clusters
    .flatMap((cluster) => cluster.triggerDates ?? [])
    .find((item) => item.date === '2024-01-01');
  assert.deepEqual(fact, {
    date: '2024-01-01',
    ganzhi: expected,
    relation: `本命空亡填实（${expected.charAt(1)}）`,
  });
});

test('奇门终身局动态年盘失败应保留年份与原始原因', () => {
  const base = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00',
    timezone: 8,
    timeStandard: 'civil',
  });
  const periodRange = {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  };

  for (const [context, causePattern] of [
    [{ timeZoneId: 'Invalid/Unknown' }, /无法识别 IANA 时区/u],
    [{ fallbackOffsetMinutes: Number.NaN }, /时区偏移分钟数/u],
  ] as const) {
    assert.throws(
      () =>
        scanLifetimeDynamicEvents(
          base.baseChart,
          base.stages,
          periodRange,
          'zhuanpan',
          'chaibu',
          context,
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /2024年动态年盘生成失败/u);
        assert.ok(error.cause instanceof Error);
        assert.match(error.cause.message, causePattern);
        return true;
      },
    );
  }
});

test('奇门终身局动态年盘应采用固定 UTC 偏移而非默认东八区', () => {
  const targetOffsetMinutes = 14 * 60;
  const year = 2024;
  const result = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00',
    timezone: 14,
    timeStandard: 'civil',
    periodRange: {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    },
  });
  const annualCluster = result.eventClusters?.find(
    (cluster) =>
      cluster.key.startsWith(`cluster:${year}:`) && cluster.key.includes(':after-lichun:'),
  );
  assert.ok(annualCluster, `应存在${year}年年度事件簇`);

  const date = new Date(Date.UTC(year, 5, 15, 12, 0, 0));
  const expectedChart = generateQimen(date, 'zhuanpan', 'year', 'chaibu', targetOffsetMinutes);
  const taiSuiPalace = diPanPalaces[expectedChart.ganzhi.year[1]];
  assert.ok(taiSuiPalace);
  assert.deepEqual(
    clusterPatternFacts(annualCluster),
    annualPatternFacts(expectedChart, taiSuiPalace),
  );
  assertMonthClashLocalTime(result.eventClusters!, year, targetOffsetMinutes);
});

test('终身局流年景门六合与空马事实在在线提示词中保持条件取象', () => {
  const birth = structuredClone(qimenBaseSeed);
  const year = 2026;
  const range = { startDate: '2026-06-15', endDate: '2026-06-15' };
  const annualChart = generateQimen(new Date(Date.UTC(year, 5, 15, 12)), 'zhuanpan', 'year');
  const branch = annualChart.ganzhi.year[1];
  const palaceNumber = diPanPalaces[branch];
  assert.ok(palaceNumber);
  const baseChart = structuredClone(birth.baseChart);
  const palace = baseChart.jiuGongGe.find((item) => item.gong === palaceNumber);
  assert.ok(palace);
  palace.renPan.door = '景门';
  palace.shenPan.god = '六合';
  baseChart.voidBranches = [branch];
  baseChart.horseStar = {
    branch,
    palace: palaceNumber,
    name: palace.name,
    sourceBranch: branch,
  };
  const eventClusters = scanLifetimeDynamicEvents(baseChart, birth.stages, range);
  const annual = eventClusters.find((cluster) => cluster.key.startsWith(`cluster:${year}:丙午:`));
  assert.ok(annual);
  const prompt = buildLifetimePrompt(
    { ...birth, baseChart, eventClusters, input: { ...birth.input, periodRange: range } },
    '本年有哪些可核对的事项？',
    { includeCurrentTime: false },
  );
  const dynamicText = prompt.split('【周期触发与事件簇】')[1]?.split('【任务】')[0] ?? '';

  assert.ok(
    annual.supportEvidence.some((fact) => fact.includes('景门') && fact.includes('传统门象')),
  );
  assert.ok(
    annual.supportEvidence.some((fact) => fact.includes('六合') && fact.includes('传统神象')),
  );
  assert.ok(annual.supportEvidence.some((fact) => fact.includes('传统填实条件')));
  assert.ok(
    annual.supportEvidence.some((fact) => fact.includes('驿马') && fact.includes('传统取象')),
  );
  assert.match(dynamicText, /太岁临本命景门，传统门象涉及文书、呈现与声誉议题/);
  assert.ok(annual.supportEvidence.every((fact) => !/现实核对|现实安排核对/u.test(fact)));
  assert.doesNotMatch(dynamicText, /名气外显|促成合作契约|虚转为实|主主动出行|事必速/u);

  palace.renPan.door = '伤门';
  const constrained = scanLifetimeDynamicEvents(baseChart, birth.stages, range).find((cluster) =>
    cluster.key.startsWith(`cluster:${year}:丙午:`),
  );
  assert.ok(constrained);
  assert.ok(
    constrained.counterEvidence.some((fact) => fact.includes('伤门') && fact.includes('传统门象')),
  );
});

test('奇门终身局动态年盘应按目标年度读取 IANA 夏令时偏移', () => {
  const targetOffsetMinutes = -4 * 60;
  const year = 2024;
  const result = calculateQimenLifetime({
    birthDateTime: '2023-01-15T14:30:00',
    timeZoneId: 'America/New_York',
    timeStandard: 'civil',
    periodRange: {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    },
  });
  const annualCluster = result.eventClusters?.find(
    (cluster) =>
      cluster.key.startsWith(`cluster:${year}:`) && cluster.key.includes(':after-lichun:'),
  );
  assert.ok(annualCluster, `应存在${year}年年度事件簇`);

  const date = new Date(Date.UTC(year, 5, 15, 12, 0, 0));
  const expectedChart = generateQimen(date, 'zhuanpan', 'year', 'chaibu', targetOffsetMinutes);
  const taiSuiPalace = diPanPalaces[expectedChart.ganzhi.year[1]];
  assert.ok(taiSuiPalace);
  assert.deepEqual(
    clusterPatternFacts(annualCluster),
    annualPatternFacts(expectedChart, taiSuiPalace),
  );
  assertMonthClashLocalTime(result.eventClusters!, year, targetOffsetMinutes);
});

test('奇门终身局 P4：自包含提示词规范、多流派依据与合规红线核验', () => {
  // 验证独立非东八区 timeZoneId 与 topics/schools 过滤
  const { data, prompt } = generateQimenLifetimePrompt(
    {
      birthDateTime: '1990-05-15T14:30:00',
      timeZoneId: 'America/New_York',
      topics: ['career', 'wealth'],
      schools: ['baojian', 'tongzong'],
      periodRange: {
        startDate: '2026-01-01',
        endDate: '2027-12-31',
      },
    },
    '请问我未来两年的事业与财运重点是什么？',
  );

  assert.ok(prompt.length > 500);
  assert.match(prompt, /换象：/);
  assert.match(prompt, /造象：/);
  assert.match(prompt, /九宫四盘明细：[\s\S]*天盘\[[^\n]+地盘干\[/);
  assert.doesNotMatch(prompt, /同干定位（本命局）：/);
  assert.match(prompt, /阶段与流年各用本层已列盘面/);
  assert.equal(data.topicCandidates.length, 2, 'topics 过滤应真正生效');
  assert.match(data.basis.timeZoneUsed, /America\/New_York/);
  const currentTimeSection = prompt.split('【传统依据】')[0];
  assert.doesNotMatch(currentTimeSection, /America\/New_York/);
  assert.match(currentTimeSection, /UTC\+08:00/);
  assert.ok(prompt.includes(`出生时区：${data.basis.timeZoneUsed}`));

  // 1. 结构化指定标题必须齐全
  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【问题】/);
  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【起盘依据】/);
  assert.match(prompt, /【终身局基础盘】/);
  assert.match(prompt, /【个人标记与主题宫】/);
  assert.match(prompt, /【人生阶段资料】/);
  assert.match(prompt, /【周期触发与事件簇】/);
  const annualLine = prompt.split('\n').find((line) => line.startsWith('2027年（丁未）立春后'));
  assert.ok(annualLine);
  assert.match(annualLine, /太岁值临/u);
  assert.equal(annualLine.match(/2027年/gu)?.length, 1);
  assert.doesNotMatch(prompt, /动态交互：流年岁气与本命/u);
  const monthClash = data.eventClusters?.find((cluster) => cluster.key.includes(':month-clash:'));
  assert.ok(monthClash?.triggerDates?.length);
  assert.ok(prompt.includes(monthClash.triggerFact));
  assert.ok(prompt.includes(monthClash.triggerDates[0]!.dateTime!));
  assert.doesNotMatch(prompt, /动态交互：月建[^\n]+构成相冲/u);
  assert.doesNotMatch(prompt, /增益因素：[^\n]*月建交节日：/u);
  assert.match(prompt, /【传统依据】/);
  assert.doesNotMatch(prompt, /【输出要求】/);

  // 2. 流派依据融入
  assert.match(prompt, /《御定奇门宝鉴》/);
  assert.match(prompt, /《奇门遁甲统宗》/);
  assert.match(prompt, /参考流派：宝鉴派、统宗派/);
  const promptDateFact = data.eventClusters
    ?.filter((cluster) => !cluster.key.includes(':day:void-fill:'))
    ?.flatMap((cluster) => cluster.triggerDates ?? [])
    .find((fact) => fact.ganzhi);
  assert.ok(promptDateFact?.date, '提示词应带具体日级日期事实');
  assert.ok(prompt.includes(promptDateFact!.date), '提示词应保留可复核的完整日期');
  const promptDateLines = prompt.split('\n').filter((line) => line.includes('可复核日期：'));
  const dailyVoidFillClusters = data.eventClusters?.filter((cluster) =>
    cluster.key.includes(':day:void-fill:'),
  );
  const dailyVoidFillDates = [
    ...new Set(
      dailyVoidFillClusters?.flatMap((cluster) =>
        (cluster.triggerDates ?? []).map((fact) => fact.date),
      ) ?? [],
    ),
  ].sort();
  assert.ok(dailyVoidFillDates.length);
  assert.ok(
    prompt.includes(
      `日级空亡填实条件：日支逢本命旬空地支${data.baseChart.voidBranches?.join('、')}；核验范围${data.input.periodRange?.startDate ?? dailyVoidFillDates[0]}至${data.input.periodRange?.endDate ?? dailyVoidFillDates.at(-1)}，各年符合条件的日数见下。`,
    ),
  );
  const dailyClusters =
    data.eventClusters?.filter((cluster) => cluster.key.includes(':day:')) ?? [];
  assert.ok(dailyClusters.length > 0);
  for (const cluster of dailyClusters) {
    const firstDate = cluster.triggerDates![0]!;
    assert.ok(
      prompt
        .split('\n')
        .some(
          (line) =>
            line.startsWith(cluster.timeSpan) &&
            line.includes(`共${cluster.triggerDates!.length}个日辰`),
        ),
    );
    if (cluster.key.includes(':day:void-fill:')) {
      assert.ok(
        !promptDateLines.some((line) => line.includes(`日干支关系：${firstDate.relation}`)),
        '本命空亡填实保留年份数量，不逐日展开日期清单',
      );
      continue;
    }
    const datesByGanzhi = new Map<string, string[]>();
    for (const fact of cluster.triggerDates!) {
      const dates = datesByGanzhi.get(fact.ganzhi!) ?? [];
      dates.push(fact.date);
      datesByGanzhi.set(fact.ganzhi!, dates);
    }
    const entries = [...datesByGanzhi].map(([ganzhi, dates]) => `${ganzhi}：${dates.join('、')}`);
    const expectedDateLine = `  可复核日期：${entries.join('；')}；日干支关系：${firstDate.relation}`;
    assert.ok(promptDateLines.includes(expectedDateLine), '同一日辰事件簇应保留完整干支分组与日期');
    assert.equal(
      expectedDateLine.split(`日干支关系：${firstDate.relation}`).length - 1,
      1,
      '同一事件簇只应输出一次关系说明',
    );
  }
  assert.doesNotMatch(prompt, /按当地民用日读取日支与本命/);
  assert.doesNotMatch(prompt, /这些日辰是否对应/);
  assert.doesNotMatch(prompt, /增益因素：日支关系：/);
  assert.doesNotMatch(prompt, /交节日前后是否出现阶段性决策、迁动或环境变化/);
  assert.doesNotMatch(prompt, /指定日期窗口引动本命/u);
  assert.doesNotMatch(prompt, /至2027-12-31关键动应日/u);
  assert.doesNotMatch(prompt, /日干支关系：本命空亡填实/u);

  // 3. 严禁泄漏工程术语与内部层位键名
  assert.doesNotMatch(prompt, /ownerFactKeys/);
  assert.doesNotMatch(prompt, /factKey/);
  assert.doesNotMatch(prompt, /status:\s*['"]已命中['"]/);
  assert.doesNotMatch(prompt, /\btianPan\b/);
  assert.doesNotMatch(prompt, /\bdiPan\b/);
  assert.doesNotMatch(prompt, /\bbaseGong\b/);
  assert.doesNotMatch(prompt, /风险与制约/);
  assert.doesNotMatch(prompt, /\bAPI\b/);
  assert.doesNotMatch(prompt, /\bMCP\b/);
  assert.doesNotMatch(prompt, /\bmingyu\b/);
  assert.doesNotMatch(prompt, /\bgit\b/);

  // 4. 严禁出现无古籍依据的数字总分与成功率
  assert.doesNotMatch(prompt, /综合评分\s*\d+/);
  assert.doesNotMatch(prompt, /成功率\s*\d+%/);
});

test('奇门终身局提示词将年支空亡填实保留为事实并折叠日级日期', () => {
  const { data, prompt } = generateQimenLifetimePrompt(
    {
      birthDateTime: '1990-05-15T14:30:00',
      timeZoneId: 'Asia/Shanghai',
      periodRange: { startDate: '2026-01-01', endDate: '2029-12-31' },
    },
    '未来四年的阶段变化',
  );

  assert.match(prompt, /2028年（戊申）[^\n]*本命空亡地支【申】逢流年填实。/u);
  assert.match(prompt, /2029年（己酉）[^\n]*本命空亡地支【酉】逢流年填实。/u);
  assert.doesNotMatch(prompt, /潜藏势能全面激活/u);
  assert.doesNotMatch(prompt, /日干支关系：本命空亡填实/u);

  const annualVoidFillClusters =
    data.eventClusters?.filter(
      (cluster) =>
        cluster.timeSpan.startsWith('2028年（戊申）立春后') ||
        cluster.timeSpan.startsWith('2029年（己酉）立春后'),
    ) ?? [];
  assert.equal(annualVoidFillClusters.length, 2);
  assert.ok(
    annualVoidFillClusters.every(
      (cluster) =>
        cluster.triggerFact.includes('本命空亡地支') &&
        !cluster.triggerFact.includes('潜藏势能全面激活'),
    ),
  );

  const dailyVoidFillClusters =
    data.eventClusters?.filter((cluster) => cluster.key.includes(':day:void-fill:')) ?? [];
  assert.ok(dailyVoidFillClusters.length);
  const dailyVoidFillDates = [
    ...new Set(
      dailyVoidFillClusters.flatMap((cluster) =>
        (cluster.triggerDates ?? []).map((fact) => fact.date),
      ),
    ),
  ].sort();
  assert.ok(
    prompt.includes(
      `日级空亡填实条件：日支逢本命旬空地支${data.baseChart.voidBranches?.join('、')}；核验范围${data.input.periodRange?.startDate ?? dailyVoidFillDates[0]}至${data.input.periodRange?.endDate ?? dailyVoidFillDates.at(-1)}，各年符合条件的日数见下。`,
    ),
  );
  for (const cluster of dailyVoidFillClusters) {
    assert.ok(cluster.triggerDates?.length);
    assert.ok(
      prompt
        .split('\n')
        .some(
          (line) =>
            line.startsWith(cluster.timeSpan) &&
            line.includes(`共${cluster.triggerDates!.length}个日辰`),
        ),
    );
  }
});

test('奇门终身局同盘保留基础格局条件并避免阶段重复解释', () => {
  const { data, prompt } = buildQimenCurrentYearFixture();
  const pattern = data.baseChart.classicPatterns?.find((item) =>
    data.stages.some((stage) =>
      [...stage.supportFacts, ...stage.constraintFacts].some((fact) =>
        fact.includes(`「${item.name}」：${item.summary}`),
      ),
    ),
  );
  assert.ok(pattern);
  const label = pattern.type === 'good' ? '成吉格' : '逢凶格';
  const fullFact = `${label}「${pattern.name}」：${pattern.summary}`;
  assert.ok(
    data.stages.some((stage) =>
      [...stage.supportFacts, ...stage.constraintFacts].includes(fullFact),
    ),
  );
  const baseSection = prompt.split('【终身局基础盘】')[1].split('【个人标记与主题宫】')[0];
  const topicSection = prompt.split('【个人标记与主题宫】')[1].split('【人生阶段资料】')[0];
  const stageSection = prompt.split('【人生阶段资料】')[1].split('【周期触发与事件簇】')[0];
  const taskSection = prompt.split('【任务】')[1].split('\n\n【问题】')[0];
  const basePatternLine = baseSection
    .split('\n')
    .find((line) => line.trimStart().startsWith(`${pattern.name}（`));
  assert.ok(basePatternLine);
  assert.ok(
    pattern.palaces.every((gong) =>
      basePatternLine.includes(
        data.baseChart.jiuGongGe.find((palace) => palace.gong === gong)?.name ?? `${gong}宫`,
      ),
    ),
  );
  assert.ok(data.topicCandidates.some((item) => item.patternSummary.length > 0));
  assert.match(topicSection, /人生重点主题候选宫：/);
  assert.doesNotMatch(topicSection, /宫位现状：/);
  assert.ok(stageSection.includes(`${label}「${pattern.name}」`));
  assert.ok(!stageSection.includes(fullFact));
  assert.match(taskSection, /取象：先按问题确定主体、事项用神、主客与原宫/);
  assert.match(taskSection, /分层说明原盘现状与条件变化后的方案/);
  assert.match(taskSection, /终身局取象以本命为根，阶段与流年各用本层已列盘面/);
  assert.match(taskSection, /先综述全盘态势，再围绕所问事项整理主判断及可观察的应期线索/);
  assert.doesNotMatch(taskSection, /不视为原盘改动/);
  assert.doesNotMatch(taskSection, /按事项定用神与主客，以用神宫门星神干核对格局和空迫墓的作用/);
  const patterns = prompt.split('盘面吉凶格局：')[1]?.split('【个人标记与主题宫】')[0] ?? '';

  assert.match(patterns, /虎遁（吉，艮八宫）：主威严稳固、资源回归/u);
  assert.match(patterns, /休诈（吉，乾六宫）：主和合调停、协作成事/u);
  assert.match(baseSection, /艮八宫（土）：天盘\[天冲，干乙\]，人盘\[生门\]/u);
  assert.match(baseSection, /乾六宫（金）：天盘\[天蓬，干丁\]，人盘\[开门\]，神盘\[六合\]/u);
  assert.doesNotMatch(
    patterns,
    /生门、乙奇落艮八宫|丁奇、开门、六合同宫于乾六宫|乃(?:虎遁|休诈)之格|三奇、吉门、六合同宫/u,
  );
  assert.match(patterns, /丙奇升殿（吉）：月奇·光明显达入离九宫，得本气之地/u);
  assert.doesNotMatch(patterns, /升殿得位/u);
  assert.match(patterns, /戊击刑（凶）：戊在震三宫击刑，主规则、口舌、文书/u);
  assert.doesNotMatch(patterns, /在此宫落于相刑之位/u);
  assert.match(patterns, /干合蛇刑（中性，坎一宫）：主文书财喜/u);
  assert.match(prompt, /坎一宫（水）：天盘\[[^\n]*干壬\][^\n]*地盘干\[丁\]/u);
  assert.doesNotMatch(patterns, /天盘壬加地盘丁于坎一宫/u);
  assert.doesNotMatch(patterns, /壬加地盘丁为干合蛇刑/u);
  assert.match(patterns, /罗网青龙（中性）：[^\n]*癸加地盘甲为罗网青龙；排盘时以甲子戊代甲/u);
  assert.doesNotMatch(patterns, /故癸加地盘戊按此格论/u);
  assert.ok(data.baseChart.classicPatterns?.some((item) => item.summary.includes('乃虎遁之格')));
  const extraPalaceConditionData = structuredClone(data);
  const extraTiger = extraPalaceConditionData.baseChart.classicPatterns!.find(
    (item) => item.name === '虎遁',
  )!;
  extraTiger.summary += '；另须核本次甲旬条件';
  const extraTigerFact = extraPalaceConditionData.baseChart.evidenceAnalysis!.patternFacts.find(
    (item) => item.kind === '经典格局' && item.name === '虎遁',
  )!;
  extraTigerFact.originalText = extraTiger.summary;
  extraTigerFact.promptText = extraTiger.summary;
  const extraPalaceConditionBefore = structuredClone(extraPalaceConditionData);
  assert.match(
    buildLifetimePrompt(extraPalaceConditionData, undefined, { includeCurrentTime: false }),
    /虎遁（吉，艮八宫）：主威严稳固、资源回归；另须核本次甲旬条件/u,
  );
  assert.deepEqual(extraPalaceConditionData, extraPalaceConditionBefore);
  const duplicate = data.baseChart.classicPatterns!.find((item) => item.name === '虎遁')!;
  data.baseChart.classicPatterns!.push(structuredClone(duplicate));
  data.stages[0].supportFacts = [`成吉格「虎遁」：${duplicate.summary}`];
  const duplicatePrompt = buildLifetimePrompt(data, undefined, { includeCurrentTime: false });
  const duplicatePatterns =
    duplicatePrompt.split('盘面吉凶格局：')[1]?.split('【个人标记与主题宫】')[0] ?? '';
  assert.equal(duplicatePatterns.match(/^  虎遁（吉，艮八宫）：/gmu)?.length, 1);
  assert.equal(data.baseChart.classicPatterns!.filter((item) => item.name === '虎遁').length, 2);
  assert.match(duplicatePrompt.split('阶段1：')[1].split('阶段2：')[0], /成吉格「虎遁」/u);

  const trueZhaData = calculateQimenLifetime({
    birthDateTime: '2026-06-18T12:00:00',
    timeZoneId: 'Asia/Shanghai',
    periodRange: { startDate: '2026-06-18', endDate: '2026-06-18' },
  });
  const before = structuredClone(trueZhaData);
  const trueZhaPrompt = buildLifetimePrompt(trueZhaData, undefined, { includeCurrentTime: false });
  assert.match(trueZhaPrompt, /真诈（吉，兑七宫）：主隐蔽得助、柔性成事/u);
  assert.doesNotMatch(trueZhaPrompt, /三奇、吉门、太阴同宫/u);
  assert.equal(
    trueZhaData.baseChart.classicPatterns!.find((item) => item.name === '真诈')!.summary,
    '丁奇、开门、太阴同宫于兑七宫，三奇、吉门、太阴同宫，乃真诈之格，主隐蔽得助、柔性成事。',
  );
  assert.deepEqual(trueZhaData, before);

  const trueZhaLines = trueZhaPrompt.split('\n');
  assert.equal(trueZhaData.baseChart.zhiFu, '天禽');
  assert.equal(trueZhaData.baseChart.zhiShi, '死门');
  assert.ok(trueZhaLines.includes('值符星：天禽 | 值使门：死门'));
  for (const palaceLine of [
    '  坎一宫（水）：天盘[天任，干乙]，人盘[生门]，神盘[白虎]，地盘干[己]【旬空】',
    '  坤二宫（土）：天盘[天柱，干丙]，人盘[惊门]，神盘[螣蛇]，地盘干[庚]【临马】',
    '  震三宫（木）：天盘[天辅，干壬]，人盘[杜门]，神盘[九地]，地盘干[辛]',
    '  巽四宫（木）：天盘[天英，干戊]，人盘[景门]，神盘[九天]，地盘干[壬]',
    '  中五宫（土）：天盘[，干]，人盘[]，神盘[]，地盘干[癸]',
    '  乾六宫（金）：天盘[天蓬，干己]，人盘[休门]，神盘[六合]，地盘干[丁]',
    '  兑七宫（金）：天盘[天心，干丁]，人盘[开门]，神盘[太阴]，地盘干[丙]',
    '  艮八宫（土）：天盘[天冲，干辛]，人盘[伤门]，神盘[玄武]，地盘干[乙]【旬空】',
    '  离九宫（火）：天盘[天芮（携天禽），干庚（携癸）]，人盘[死门]，神盘[值符]，地盘干[戊]',
  ]) {
    assert.ok(trueZhaLines.includes(palaceLine), palaceLine);
  }
  for (const patternLine of [
    '  符使同宫（吉，离九宫）：事情有极强的集中力量',
    '  日奇入雾（凶，坎一宫）：乙为日奇（太阳），己为地户土雾，日入雾中，主被遮蔽、才能难伸',
    '  荧入太白（凶，坤二宫）：丙为荧惑（火星），庚为太白（金星），火克金，荧入太白，主贼盗破财',
    '  螣蛇格干（凶，震三宫）：符门虽吉亦不可安，谋事内生欺瞒',
    '  奇入墓（凶，乾六宫）：主文书诉讼先有理、后受惩',
    '  加中复奇（中性，兑七宫）：主口舌跷蹊，贵招官禄，常人防刑',
    '  白虎猖狂（凶，艮八宫）：辛为白虎，乙为青龙，金克木，白虎势盛而猖狂，主争斗破坏',
  ]) {
    assert.equal(trueZhaLines.filter((line) => line === patternLine).length, 1, patternLine);
  }
  const trueZhaPatterns = trueZhaPrompt.split('盘面吉凶格局：')[1].split('【个人标记与主题宫】')[0];
  assert.doesNotMatch(
    trueZhaPatterns,
    /天盘(?:乙加地盘己于坎一宫|丙加地盘庚于坤二宫|壬加地盘辛于震三宫|己加地盘丁于乾六宫|丁加地盘丙于兑七宫|辛加地盘乙于艮八宫)|值符天禽与值使死门同落离九宫/u,
  );

  const sunPatternLine =
    '  日奇入雾（凶）：天盘乙加地盘己于坎一宫，乙为日奇（太阳），己为地户土雾，日入雾中，主被遮蔽、才能难伸';
  const fuShiPatternLine = '  符使同宫（吉）：值符天禽与值使死门同落离九宫，事情有极强的集中力量';
  const extraConditionData = structuredClone(trueZhaData);
  const extraPattern = extraConditionData.baseChart.classicPatterns!.find(
    (item) => item.name === '日奇入雾',
  )!;
  extraPattern.summary += '；另须核本次甲旬条件';
  const extraFact = extraConditionData.baseChart.evidenceAnalysis!.patternFacts.find(
    (item) => item.kind === '经典格局' && item.name === '日奇入雾',
  )!;
  extraFact.originalText = extraPattern.summary;
  extraFact.promptText = extraPattern.summary;
  const extraConditionBefore = structuredClone(extraConditionData);
  const extraConditionPrompt = buildLifetimePrompt(extraConditionData, undefined, {
    includeCurrentTime: false,
  });
  assert.ok(extraConditionPrompt.split('\n').includes(`${sunPatternLine}；另须核本次甲旬条件`));
  assert.deepEqual(extraConditionData, extraConditionBefore);

  const missingStemData = structuredClone(trueZhaData);
  missingStemData.baseChart.jiuGongGe.find((palace) => palace.gong === 1)!.tianPan.stem = '';
  const missingStemBefore = structuredClone(missingStemData);
  const missingStemPrompt = buildLifetimePrompt(missingStemData, undefined, {
    includeCurrentTime: false,
  });
  assert.ok(missingStemPrompt.split('\n').includes(sunPatternLine));
  assert.match(missingStemPrompt, /坎一宫（水）：天盘\[天任，干\]/u);
  assert.deepEqual(missingStemData, missingStemBefore);

  const missingZhiFuData = structuredClone(trueZhaData);
  missingZhiFuData.baseChart.zhiFu = '';
  const missingZhiFuBefore = structuredClone(missingZhiFuData);
  const missingZhiFuPrompt = buildLifetimePrompt(missingZhiFuData, undefined, {
    includeCurrentTime: false,
  });
  assert.ok(missingZhiFuPrompt.split('\n').includes(fuShiPatternLine));
  assert.ok(missingZhiFuPrompt.split('\n').includes('值符星： | 值使门：死门'));
  assert.deepEqual(missingZhiFuData, missingZhiFuBefore);

  const missingEvidenceData = structuredClone(trueZhaData);
  delete missingEvidenceData.baseChart.evidenceAnalysis;
  const missingEvidenceBefore = structuredClone(missingEvidenceData);
  const missingEvidencePrompt = buildLifetimePrompt(missingEvidenceData, undefined, {
    includeCurrentTime: false,
  });
  assert.ok(missingEvidencePrompt.split('\n').includes(sunPatternLine));
  assert.ok(missingEvidencePrompt.split('\n').includes(fuShiPatternLine));
  assert.match(
    missingEvidencePrompt,
    /真诈（吉）：丁奇、开门、太阴同宫于兑七宫，主隐蔽得助、柔性成事/u,
  );
  assert.deepEqual(missingEvidenceData, missingEvidenceBefore);
});

test('奇门终身局同宫得使合并基础条件，保留不同宫位的独立事实', () => {
  const data = structuredClone(qimenFuShiSeed);
  const prompt = buildLifetimePrompt(data, undefined, { includeCurrentTime: false });
  const baseSection = prompt.split('【终身局基础盘】')[1].split('【个人标记与主题宫】')[0];
  const stageSection = prompt.split('【人生阶段资料】')[1].split('【任务】')[0];
  assert.doesNotMatch(baseSection, /月奇得使（吉）/);
  assert.match(
    baseSection,
    /月奇得使临吉门（吉）：丙奇加地盘[戊庚]（甲子\/甲申所遁）于[^；]+；同宫临(?:开|休|生)门/u,
  );
  assert.match(stageSection, /成吉格「月奇得使临吉门」/);
  assert.doesNotMatch(stageSection, /成吉格「月奇得使」(?:；|\n|$)/u);
  assert.ok(data.baseChart.classicPatterns?.some((item) => item.name === '月奇得使'));
  assert.ok(data.baseChart.classicPatterns?.some((item) => item.name === '月奇得使临吉门'));
  assert.doesNotMatch(baseSection, /月奇得使又临吉门|得门得使，双重吉利/u);

  const emptyStageData = structuredClone(data);
  const originalParent = emptyStageData.baseChart.classicPatterns!.find(
    (item) => item.name === '月奇得使',
  )!;
  emptyStageData.stages[0].supportFacts = [
    `成吉格「${originalParent.name}」：${originalParent.summary}`,
  ];
  emptyStageData.stages[0].constraintFacts = [];
  const emptyStagePrompt = buildLifetimePrompt(emptyStageData, undefined, {
    includeCurrentTime: false,
  });
  const firstStage = emptyStagePrompt.split('阶段1：')[1].split('阶段2：')[0];
  assert.doesNotMatch(firstStage, /宫位支持类象：|宫位制约类象：/u);

  // 模拟跨宫聚合资料，核对同名格局只在全部宫位被涵盖时省略。
  const separatePalaceData = structuredClone(data);
  const parent = separatePalaceData.baseChart.classicPatterns!.find(
    (item) => item.name === '月奇得使',
  )!;
  const strengthened = separatePalaceData.baseChart.classicPatterns!.find(
    (item) => item.name === '月奇得使临吉门',
  )!;
  const separatePalace = separatePalaceData.baseChart.jiuGongGe.find(
    (palace) => !strengthened.palaces.includes(palace.gong),
  )!;
  parent.palaces.push(separatePalace.gong);
  separatePalaceData.stages[0].supportFacts = [`成吉格「${parent.name}」：${parent.summary}`];
  const separatePrompt = buildLifetimePrompt(separatePalaceData, undefined, {
    includeCurrentTime: false,
  });
  const separateBase = separatePrompt.split('【终身局基础盘】')[1].split('【个人标记与主题宫】')[0];
  const separateStages = separatePrompt.split('【人生阶段资料】')[1].split('【任务】')[0];
  assert.match(separateBase, /月奇得使（吉）/);
  assert.match(separateStages, /成吉格「月奇得使」/);
});

test('奇门终身局历史秒级偏移在出生时区和任务书中保持精度', () => {
  const data = calculateQimenLifetime({
    birthDateTime: '1900-01-02T12:00:00',
    timeZoneId: 'Asia/Shanghai',
  });
  assert.equal(data.basis.timeZoneUsed, 'Asia/Shanghai (UTC+08:05:43)');
  assert.equal(data.baseChart.timestamp, Date.parse('1900-01-02T03:54:17Z'));
  const prompt = buildLifetimePrompt(data, undefined, { includeCurrentTime: false });
  assert.match(prompt, /出生时区：Asia\/Shanghai \(UTC\+08:05:43\)/u);
  assert.doesNotMatch(prompt, /8\.095277/u);
});

test('奇门终身局 P5：公开 API 接口验证', async () => {
  const { handlePublicApiRequest } = await import('../src/lib/public-api/handler');

  // 1. 计算接口 POST /api/v1/divination/qimen/lifetime
  const reqCalc = new Request('https://aov.cc/api/v1/divination/qimen/lifetime', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      birthDateTime: '1990-05-15T14:30:00+08:00',
      method: 'zhuanpan',
      juMethod: 'chaibu',
      periodRange: {
        startDate: '2026-01-01',
        endDate: '2027-12-31',
      },
    }),
  });
  const resCalc = await handlePublicApiRequest(reqCalc);
  assert.equal(resCalc.status, 200);
  const jsonCalc = (await resCalc.json()) as any;
  assert.equal(jsonCalc.ok, true);
  assert.ok(jsonCalc.data.baseChart);
  assert.ok(jsonCalc.data.personalMarkers.length > 0);
  assert.ok(jsonCalc.data.stages.length > 0);
  assert.ok(jsonCalc.data.eventClusters.length > 0);

  // 2. 提示词接口 POST /api/v1/divination/qimen/lifetime/prompt
  const reqPrompt = new Request('https://aov.cc/api/v1/divination/qimen/lifetime/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: '请解读我的终身格局与大限',
      birthDateTime: '1990-05-15T14:30:00+08:00',
      responseMode: 'summary',
    }),
  });
  const resPrompt = await handlePublicApiRequest(reqPrompt);
  assert.equal(resPrompt.status, 200);
  const jsonPrompt = (await resPrompt.json()) as any;
  assert.equal(jsonPrompt.ok, true);
  assert.match(jsonPrompt.data.prompt, /【任务】/);
  assert.ok(jsonPrompt.data.summary);
});

test('奇门终身局 P5：MCP 工具注册与调用', async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { registerQimenTool } = await import('../mcp/src/tools/qimen');

  const server = new McpServer({ name: 'test-mcp', version: '1.0.0' });
  registerQimenTool(server);

  const registeredTools = (server as any)._registeredTools;
  assert.ok(registeredTools['divine_qimen_lifetime'], '应注册 divine_qimen_lifetime 工具');
  assert.ok(registeredTools['qimen_lifetime_prompt'], '应注册 qimen_lifetime_prompt 工具');

  // 调用 divine_qimen_lifetime
  const lifetimeTool = registeredTools['divine_qimen_lifetime'];
  const lifetimeInput = {
    birthDateTime: '1990-05-15T14:30:00+08:00',
    topics: ['career'],
  };
  const parsedLifetimeInput = lifetimeTool.inputSchema.safeParse(lifetimeInput);
  assert.equal(parsedLifetimeInput.success, true, 'MCP 终身局 schema 应保留 topics');
  if (!parsedLifetimeInput.success) throw new Error('MCP 终身局 schema 未接受 topics。');
  const toolResult = await lifetimeTool.handler(parsedLifetimeInput.data);
  assert.ok(toolResult.structuredContent);
  const parsedData = toolResult.structuredContent as any;
  assert.ok(parsedData.result.baseChart);
  assert.ok(parsedData.result.personalMarkers);
  assert.deepEqual(parsedData.result.input.topics, ['career']);
  assert.equal(parsedData.result.topicCandidates.length, 1);

  // 调用 qimen_lifetime_prompt
  const promptTool = registeredTools['qimen_lifetime_prompt'];
  const promptInput = {
    question: '我的人生宏观趋势如何？',
    birthDateTime: '1990-05-15T14:30:00+08:00',
    topics: ['wealth'],
  };
  const parsedPromptInput = promptTool.inputSchema.safeParse(promptInput);
  assert.equal(parsedPromptInput.success, true, 'MCP 终身局提示词 schema 应保留 topics');
  if (!parsedPromptInput.success) throw new Error('MCP 终身局提示词 schema 未接受 topics。');
  const promptToolResult = await promptTool.handler(parsedPromptInput.data);
  assert.ok(promptToolResult.content);
  assert.match(promptToolResult.content[0].text, /【终身局基础盘】/);
  const promptData = promptToolResult.structuredContent as any;
  assert.deepEqual(promptData.result.input.topics, ['wealth']);
  assert.deepEqual(
    promptData.result.topicCandidates.map((candidate: { topic: string }) => candidate.topic),
    ['wealth'],
  );
  assert.match(promptToolResult.content[0].text, /资产财帛：主落/);
});

test('奇门终身局前端与命盘集成：纳入命盘分类并可复用个人案例', async () => {
  const { WORKSPACE_FEATURES, isChartWorkspaceId } = await import('../src/lib/workspace');
  const { buildChartFeaturePathForCase } = await import('../src/lib/case-navigation');
  const { parsePromptState, parseInputState } = await import('../src/lib/query-state');

  // 1. 确认已进入命盘（group === 'chart'）
  const qimenFeature = WORKSPACE_FEATURES.find((f) => f.id === 'qimen-lifetime');
  assert.ok(qimenFeature, '工作区功能中应包含 qimen-lifetime');
  assert.equal(qimenFeature.group, 'chart', '奇门终身局应归属于命盘分组');
  assert.equal(isChartWorkspaceId('qimen-lifetime'), true, '应被识别为命盘工作区工具');

  // 2. 确认可以复用已有案例生成终身局路径与参数
  const sampleCase = {
    id: 'case-user-001',
    type: 'single' as const,
    name: '张三',
    gender: 'male' as const,
    chartType: 'bazi' as const,
    workspaceSource: 'bazi' as const,
    birthText: '1992-06-20',
    input: {
      analysisMode: 'single' as const,
      chartType: 'bazi' as const,
      name: '张三',
      gender: 'male' as const,
      dateType: 'solar' as const,
      year: '1992',
      month: '6',
      day: '20',
      timeIndex: 6,
      isLeapMonth: false,
      useTrueSolarTime: false,
      birthHour: '',
      birthMinute: '',
      birthPlace: '',
      birthLongitude: '',
      birthLatitude: '',
      partnerName: '',
      partnerGender: 'female' as const,
      partnerDateType: 'solar' as const,
      partnerYear: '',
      partnerMonth: '',
      partnerDay: '',
      partnerTimeIndex: '' as const,
      partnerIsLeapMonth: false,
      partnerUseTrueSolarTime: false,
      partnerBirthHour: '',
      partnerBirthMinute: '',
      partnerBirthPlace: '',
      partnerBirthLongitude: '',
      partnerBirthLatitude: '',
    },
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const chartPath = buildChartFeaturePathForCase(sampleCase, 'qimen-lifetime');
  assert.equal(chartPath.startsWith('/result?'), true);
  const params = new URLSearchParams(chartPath.split('?')[1]);
  assert.equal(params.get('rid'), 'case-user-001');
  assert.equal(parsePromptState(params).promptSource, 'qimen-lifetime');
  assert.equal(parsePromptState(params).tab, 'qimen-lifetime');
  assert.equal(parseInputState(params).name, '张三');
  assert.equal(parseInputState(params).year, '1992');
});
