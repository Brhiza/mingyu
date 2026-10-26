import assert from 'node:assert/strict';
import test from 'node:test';

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
