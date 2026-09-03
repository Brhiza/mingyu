import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  generateQimenLifetimePrompt,
  normalizeQimenLifetimeTime,
  extractPersonalMarkers,
  buildTopicCandidates,
  buildLifetimeStages,
  scanLifetimeDynamicEvents,
} from '../packages/core/src/divination/algorithms/qimen';

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
  assert.match(prompt, /【输出要求】/);

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
