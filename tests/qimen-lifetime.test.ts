import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  generateQimenLifetimePrompt,
  normalizeQimenLifetimeTime,
  extractPersonalMarkers,
  buildTopicCandidates,
  buildLifetimeStages,
  generateQimen,
  scanLifetimeDynamicEvents,
} from '../packages/core/src/divination/algorithms/qimen';
import { diPanPalaces } from '../packages/core/src/divination/algorithms/qimen/helpers/_constants';

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

function findTimezoneSensitiveAnnualYear(targetOffsetMinutes: number): number {
  for (let year = 2024; year <= 2050; year += 1) {
    const date = new Date(Date.UTC(year, 5, 15, 12, 0, 0));
    const defaultChart = generateQimen(date, 'zhuanpan', 'year', 'chaibu', 480);
    const targetChart = generateQimen(date, 'zhuanpan', 'year', 'chaibu', targetOffsetMinutes);
    const taiSuiPalace = diPanPalaces[targetChart.ganzhi.year[1]];
    if (
      taiSuiPalace &&
      JSON.stringify(annualPatternFacts(defaultChart, taiSuiPalace)) !==
        JSON.stringify(annualPatternFacts(targetChart, taiSuiPalace))
    ) {
      return year;
    }
  }
  throw new Error(`未找到 UTC${targetOffsetMinutes / 60} 对年盘经典格局产生差异的年度样本`);
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
  assert.deepEqual(lifetime.baseChart.timeInfo.solar, {
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
  assert.deepEqual(lifetime.baseChart.timeInfo.solar, {
    year: 2024,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
  });
  assert.match(lifetime.basis.timeZoneUsed, /America\/New_York \(UTC-4\)/);
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
  const solar = lifetime.baseChart.timeInfo.solar;

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
  assert.deepEqual(lifetime.baseChart.timeInfo.solar, {
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
  assert.deepEqual(nyBefore.baseChart.timeInfo.solar, {
    year: 2024,
    month: 2,
    day: 4,
    hour: 3,
    minute: 27,
  });
  assert.deepEqual(nyAfter.baseChart.timeInfo.solar, nyBefore.baseChart.timeInfo.solar);
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
  assert.deepEqual(apiaBefore.baseChart.timeInfo.solar, {
    year: 2024,
    month: 2,
    day: 4,
    hour: 22,
    minute: 27,
  });
  assert.deepEqual(apiaAfter.baseChart.timeInfo.solar, apiaBefore.baseChart.timeInfo.solar);
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

  // 3. 符使卦轨模型（覆盖至 80 岁）
  const resultGuaGui = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    stagePolicy: { model: 'fuShiHexagramOrbit' },
  });
  assert.equal(resultGuaGui.stages.length, 8);
  assert.equal(resultGuaGui.stages[7].ageEnd, 80);

  // 4. 虚岁系统测试
  const resultNominal = calculateQimenLifetime({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    stagePolicy: { model: 'pillarFourLimits', ageSystem: 'nominalAge' },
  });
  assert.equal(resultNominal.stages[0].ageStart, 1);
  assert.equal(resultNominal.stages[0].ageEnd, 17);
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
  for (const ec of result.eventClusters) {
    assert.ok(ec.key.startsWith('cluster:'));
    assert.ok(ec.topics.length > 0);
    assert.ok(ec.triggerFact.length > 0);
    assert.ok(ec.verificationQuestions.length > 0);
  }
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

  const invalidTimezoneError = assert.throws(() => {
    scanLifetimeDynamicEvents(base.baseChart, base.stages, periodRange, 'zhuanpan', 'chaibu', {
      timeZoneId: 'Invalid/Unknown',
    });
  }) as Error & { cause?: Error };
  assert.match(invalidTimezoneError.message, /2024年动态年盘生成失败/u);
  const invalidTimezoneCause = invalidTimezoneError.cause;
  assert.ok(invalidTimezoneCause instanceof Error);
  assert.match(invalidTimezoneCause.message, /无法识别 IANA 时区/u);

  const generationError = assert.throws(() => {
    scanLifetimeDynamicEvents(base.baseChart, base.stages, periodRange, 'zhuanpan', 'chaibu', {
      fallbackOffsetMinutes: Number.NaN,
    });
  }) as Error & { cause?: Error };
  assert.match(generationError.message, /2024年动态年盘生成失败/u);
  const generationCause = generationError.cause;
  assert.ok(generationCause instanceof Error);
  assert.match(generationCause.message, /时区偏移分钟数/u);
});

test('奇门终身局动态年盘应采用固定 UTC 偏移而非默认东八区', () => {
  const targetOffsetMinutes = 14 * 60;
  const year = findTimezoneSensitiveAnnualYear(targetOffsetMinutes);
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
      cluster.key.startsWith(`cluster:${year}:`) &&
      !cluster.key.includes(':month-clash:') &&
      !cluster.key.includes(':day-nodal'),
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
});

test('奇门终身局动态年盘应按目标年度读取 IANA 夏令时偏移', () => {
  const targetOffsetMinutes = -4 * 60;
  const year = findTimezoneSensitiveAnnualYear(targetOffsetMinutes);
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
      cluster.key.startsWith(`cluster:${year}:`) &&
      !cluster.key.includes(':month-clash:') &&
      !cluster.key.includes(':day-nodal'),
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
  assert.equal(data.topicCandidates.length, 2, 'topics 过滤应真正生效');
  assert.match(data.basis.timeZoneUsed, /America\/New_York/);
  const currentTimeSection = prompt.split('【传统依据】')[0];
  assert.doesNotMatch(currentTimeSection, /America\/New_York/);
  assert.match(currentTimeSection, /UTC[+-]\d{2}:\d{2}/);
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
  assert.match(prompt, /【传统依据】/);
  assert.doesNotMatch(prompt, /【输出要求】/);

  // 2. 流派依据融入
  assert.match(prompt, /《御定奇门宝鉴》/);
  assert.match(prompt, /《奇门遁甲统宗》/);
  assert.match(prompt, /参考流派：宝鉴派、统宗派/);

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
  const toolResult = await lifetimeTool.handler({
    birthDateTime: '1990-05-15T14:30:00+08:00',
  });
  assert.ok(toolResult.structuredContent);
  const parsedData = toolResult.structuredContent as any;
  assert.ok(parsedData.result.baseChart);
  assert.ok(parsedData.result.personalMarkers);

  // 调用 qimen_lifetime_prompt
  const promptTool = registeredTools['qimen_lifetime_prompt'];
  const promptToolResult = await promptTool.handler({
    question: '我的人生宏观趋势如何？',
    birthDateTime: '1990-05-15T14:30:00+08:00',
  });
  assert.ok(promptToolResult.content);
  assert.match(promptToolResult.content[0].text, /【终身局基础盘】/);
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
