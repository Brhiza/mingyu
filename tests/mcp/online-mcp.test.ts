import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/mcp.js';
import { handleMcpRequest } from '../../src/lib/mcp/handler.js';

test('在线 MCP 无状态端点拒绝独立 SSE GET，同时保留跨域响应头', async () => {
  for (const accept of ['text/event-stream', 'application/json, text/event-stream']) {
    const response = await onRequest({
      request: new Request('https://aov.cc/mcp', {
        method: 'GET',
        headers: { Accept: accept },
      }),
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(response.headers.get('content-type'), null);
    assert.equal(await response.text(), '');
  }

  const sessionResponse = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'GET',
      headers: { Accept: 'application/json', 'Mcp-Session-Id': 'stale-session' },
    }),
  });
  assert.equal(sessionResponse.status, 405);
});

test('在线 MCP 端点 (functions/mcp.ts) 应正确处理 OPTIONS、GET 健康检查与 JSON-RPC 工具请求', async () => {
  // 1. OPTIONS CORS 预检
  const optionsRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'OPTIONS',
    }),
  });
  assert.equal(optionsRes.status, 204);
  assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');

  // 2. 浏览器直接访问 GET /mcp
  const getRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    }),
  });
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  assert.equal(getJson.status, 'ok');
  assert.equal(getJson.service, 'mingyu-mcp-server');
  assert.equal(getJson.endpoint, '/mcp');

  // 3. POST initialize 初始化协议
  const initRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'online-test-client', version: '1.0.0' },
        },
      }),
    }),
  });
  assert.equal(initRes.status, 200);
  const initJson = await initRes.json();
  assert.equal(initJson.jsonrpc, '2.0');
  assert.equal(initJson.id, 1);
  assert.equal(initJson.result?.serverInfo?.name, 'mingyu-mcp-server');

  // 4. POST tools/list 获取工具列表
  const listRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    }),
  });
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.ok(Array.isArray(listJson.result?.tools));
  assert.equal(listJson.result.tools.length >= 63, true);
  const baziPromptTool = listJson.result.tools.find(
    (tool: { name?: string }) => tool.name === 'bazi_prompt',
  );
  assert.deepEqual(baziPromptTool?.inputSchema?.properties?.responseMode?.enum, [
    'prompt-only',
    'summary',
    'full',
  ]);
  assert.equal(baziPromptTool?.title, '八字解读提示词');
  assert.equal(baziPromptTool?._meta?.category, 'bazi');
  assert.equal(baziPromptTool?._meta?.type, 'prompt');
  assert.equal(baziPromptTool?._meta?.endpoint, '/bazi/prompt');
  assert.deepEqual(baziPromptTool?._meta?.example, {
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 6,
    dateType: 'solar',
    question: '分析事业发展重点',
  });
  assert.match(baziPromptTool?.description ?? '', /示例：/);
  const astrolabeTool = listJson.result.tools.find(
    (tool: { name?: string }) => tool.name === 'divine_astrolabe',
  );
  assert.deepEqual(astrolabeTool?.inputSchema?.anyOf, [
    { required: ['timezone'] },
    { required: ['timeZoneId'] },
  ]);
  const astrolabeSynastryTool = listJson.result.tools.find(
    (tool: { name?: string }) => tool.name === 'astrolabe_synastry',
  );
  assert.deepEqual(astrolabeSynastryTool?.inputSchema?.properties?.person1?.anyOf, [
    { required: ['timezone'] },
    { required: ['timeZoneId'] },
  ]);
  const almanacTool = listJson.result.tools.find(
    (tool: { name?: string }) => tool.name === 'divine_almanac',
  );
  assert.match(
    almanacTool?.inputSchema?.properties?.endDate?.description ?? '',
    /在线调用单次最多 7 天/,
  );
  const qimenLifetimeTool = listJson.result.tools.find(
    (tool: { name?: string }) => tool.name === 'divine_qimen_lifetime',
  );
  assert.match(
    qimenLifetimeTool?.inputSchema?.properties?.periodRange?.description ?? '',
    /在线调用单次最多覆盖连续 10 个年份/,
  );
  const promptTools = listJson.result.tools.filter((tool: { name?: string }) =>
    tool.name?.endsWith('_prompt'),
  );
  assert.ok(promptTools.length >= 20);
  for (const tool of promptTools) {
    assert.deepEqual(
      tool.inputSchema?.properties?.responseMode?.enum,
      ['prompt-only', 'summary', 'full'],
      `${tool.name} 应暴露 responseMode`,
    );
  }

  // 4. Accept: application/json 的无会话 GET 仍返回健康信息，不被误判为 MCP 流式请求
  const jsonGetRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
  });
  assert.equal(jsonGetRes.status, 200);
  assert.equal((await jsonGetRes.json()).protocol, 'mcp-streamable-http');

  // 5. SDK 参数校验错误也统一为可恢复的结构化错误
  const invalidRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'bazi_prompt', arguments: {} },
      }),
    }),
  });
  const invalidJson = await invalidRes.json();
  assert.equal(invalidJson.result?.isError, true);
  assert.equal(invalidJson.result?.structuredContent?.code, 'INVALID_ARGUMENTS');
  assert.deepEqual(invalidJson.result?.structuredContent?.missingFields, [
    'gender',
    'year',
    'month',
    'day',
    'dateType',
    'question',
  ]);

  // 6. prompt-only 真正只返回任务书，避免在线客户端无意接收巨大重复盘面
  const promptOnlyRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'bazi_prompt',
          arguments: {
            gender: 'male',
            year: 1990,
            month: 5,
            day: 15,
            timeIndex: 6,
            dateType: 'solar',
            question: '请分析事业重点',
            responseMode: 'prompt-only',
          },
        },
      }),
    }),
  });
  const promptOnlyJson = await promptOnlyRes.json();
  assert.equal(promptOnlyJson.result?.isError, undefined);
  assert.equal(typeof promptOnlyJson.result?.structuredContent?.prompt, 'string');
  assert.equal(promptOnlyJson.result?.structuredContent?.result, undefined);
  assert.equal(promptOnlyJson.result?.structuredContent?.resultSummary, undefined);

  // 7. 容易触发边缘资源限制的长范围请求在计算前返回明确降级建议
  const rangeRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'almanac_prompt',
          arguments: { startDate: '2026-01-01', endDate: '2026-01-08', question: '测试' },
        },
      }),
    }),
  });
  const rangeJson = await rangeRes.json();
  assert.equal(rangeJson.result?.isError, true);
  assert.equal(rangeJson.result?.structuredContent?.code, 'RESOURCE_LIMIT');
  assert.equal(rangeJson.result?.structuredContent?.retryable, true);
  assert.equal(rangeJson.result?.structuredContent?.maxAllowed, 7);
  assert.equal(rangeJson.result?._meta?.unit, 'days');

  // 8. 条件输入缺失时一次性返回可执行的字段清单
  const trueSolarErrorRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'bazi_calculate',
          arguments: {
            gender: 'male',
            year: 1990,
            month: 5,
            day: 15,
            dateType: 'solar',
            useTrueSolarTime: true,
          },
        },
      }),
    }),
  });
  const trueSolarErrorJson = await trueSolarErrorRes.json();
  assert.deepEqual(trueSolarErrorJson.result?.structuredContent?.missingFields, [
    'birthHour',
    'birthMinute',
    'birthLongitude',
  ]);

  // 9. POST tools/call 执行排盘工具并返回响应元数据
  const callRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'foundation_capabilities',
          arguments: {},
        },
      }),
    }),
  });
  assert.equal(callRes.status, 200);
  const callJson = await callRes.json();
  assert.equal(callJson.result?.isError, undefined);
  assert.ok(callJson.result?.structuredContent || callJson.result?.content);
  assert.equal(callJson.result?._meta?.tool, 'foundation_capabilities');
  assert.equal(typeof callJson.result?._meta?.durationMs, 'number');
  assert.equal(callJson.result?._meta?.version, initJson.result?.serverInfo?.version);

  // 10. 在线 MCP 默认优化选项：提示词工具省略 responseMode 时默认 summary，避免序列化数百 KB 原始盘面对象
  const defaultSummaryRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'bazi_prompt',
          arguments: {
            gender: 'male',
            year: 1990,
            month: 5,
            day: 15,
            timeIndex: 6,
            dateType: 'solar',
            question: '请分析事业重点',
          },
        },
      }),
    }),
  });
  const defaultSummaryJson = await defaultSummaryRes.json();
  assert.equal(defaultSummaryJson.result?.isError, undefined);
  assert.equal(typeof defaultSummaryJson.result?.structuredContent?.prompt, 'string');
  assert.equal(defaultSummaryJson.result?.structuredContent?.result, undefined);
  assert.ok(defaultSummaryJson.result?.structuredContent?.resultSummary);

  // 11. 在线 MCP 显式要求 full 模式时仍可获取完整盘面
  const explicitFullRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'bazi_prompt',
          arguments: {
            gender: 'male',
            year: 1990,
            month: 5,
            day: 15,
            timeIndex: 6,
            dateType: 'solar',
            question: '请分析事业重点',
            responseMode: 'full',
          },
        },
      }),
    }),
  });
  const explicitFullJson = await explicitFullRes.json();
  assert.equal(explicitFullJson.result?.isError, undefined);
  assert.ok(explicitFullJson.result?.structuredContent?.result);

  // 12. 在线 MCP 星盘提示词默认范围为 natal（秒级本命完成），避免流年返照/次限/太阳弧强算导致 10ms CPU 超时
  const defaultAstrolabeRes = await onRequest({
    request: new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'astrolabe_prompt',
          arguments: {
            year: 1990,
            month: 5,
            day: 15,
            hour: 14,
            minute: 30,
            latitude: 39.9,
            longitude: 116.4,
            timezone: 8,
            question: '看星盘',
          },
        },
      }),
    }),
  });
  const defaultAstrolabeJson = await defaultAstrolabeRes.json();
  assert.equal(defaultAstrolabeJson.result?.isError, undefined);
  assert.equal(typeof defaultAstrolabeJson.result?.structuredContent?.prompt, 'string');
  assert.match(defaultAstrolabeJson.result?.structuredContent?.prompt ?? '', /本命/);

  // 13. 本地/自部署模式 (preset: 'full') 保留完整默认选项 (responseMode: full, astrolabeScope: yearly)
  const localFullRes = await handleMcpRequest(
    new Request('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'bazi_prompt',
          arguments: {
            gender: 'male',
            year: 1990,
            month: 5,
            day: 15,
            timeIndex: 6,
            dateType: 'solar',
            question: '请分析事业重点',
          },
        },
      }),
    }),
    { preset: 'full' },
  );
  const localFullJson = await localFullRes.json();
  assert.equal(localFullJson.result?.isError, undefined);
  assert.ok(localFullJson.result?.structuredContent?.result, '本地 full 预设应默认返回完整 result');
});
