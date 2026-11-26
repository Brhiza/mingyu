import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate } from '../src/core';
import { createServer } from '../src/mcp';
import { createThinkTagSplitter, streamChat, type AgentApiMessage } from '../src/ai';
import { normalizeAgentToolInput } from '../src/tool-input-normalizer';
import { compressApiHistoryToolOutputs } from '../src/web-agent';

test('G1 宽松入参归一化：自然日期串、中文性别与东方/星占结构自动互转并通过 calculate', async () => {
  // 1. 八字：传自然日期字符串 + 中文性别 + 顶层 includeClassics
  const baziNorm = normalizeAgentToolInput('bazi', {
    question: '今年事业如何？',
    birth: '1992-05-12 10:30',
    gender: '男',
    includeClassics: false,
  });
  const baziRes = await calculate('bazi', baziNorm);
  assert.equal(baziRes.method, 'bazi');
  assert.ok(baziRes.prompt.text.includes('今年事业如何？'));

  // 2. 七政四余：模型误传 clock 对象 + 未传 flow 却带了 gender
  const qzNorm = normalizeAgentToolInput('qizheng', {
    question: '看看本命格局',
    birth: { year: 1995, month: 8, day: 20, clock: { kind: 'exact', hour: 14, minute: 15, second: 0 } },
    gender: '女',
  });
  const qzRes = await calculate('qizheng', qzNorm);
  assert.equal(qzRes.method, 'qizheng');
  assert.ok(qzRes.prompt.text.includes('看看本命格局'));

  // 3. 八字合盘：模型误用紫微嵌套风格 + 中文关系名
  const baziSynNorm = normalizeAgentToolInput('bazi-synastry', {
    question: '我们俩合不合财？',
    relationship: '合伙',
    person1: { name: '甲', gender: '乾造', birth: '1990-05-15 14:30' },
    person2: { name: '乙', gender: '坤造', birth: '1992-08-12 09:00' },
  });
  const baziSynRes = await calculate('bazi-synastry', baziSynNorm);
  assert.equal(baziSynRes.method, 'bazi-synastry');
  assert.ok(baziSynRes.prompt.text.includes('合不合财'));

  // 4. 紫微合盘：模型误用八字扁平风格
  const zwSynNorm = normalizeAgentToolInput('ziwei-synastry', {
    question: '看看感情契合度',
    relationship: '合婚',
    person1: { name: '甲', gender: '男', year: 1990, month: 5, day: 15, hour: 14, minute: 30 },
    person2: { name: '乙', gender: '女', year: 1992, month: 8, day: 12, hour: 9, minute: 0 },
  });
  const zwSynRes = await calculate('ziwei-synastry', zwSynNorm);
  assert.equal(zwSynRes.method, 'ziwei-synastry');
});

test('G1 MCP router 模式 calculate 工具原生兼容宽松入参', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(['bazi', 'astrolabe'], undefined, { mode: 'router' });
  const client = new Client({ name: 'wave1-test', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const res = await client.callTool({
    name: 'calculate',
    arguments: {
      method: 'bazi',
      input: {
        question: '看看流年财运',
        birth: '1993-03-18 08:20',
        gender: '女',
      },
    },
  });
  assert.equal(res.isError, undefined);
  const structured = res.structuredContent as { method?: string; prompt?: { text?: string } };
  assert.equal(structured.method, 'bazi');
  assert.ok(structured.prompt?.text?.includes('看看流年财运'));
  await Promise.all([client.close(), server.close()]);
});

test('L1 思考链状态机与 streamChat 支持跨分片 <think> 与 reasoning_content', async () => {
  let outText = '';
  let outReason = '';
  const splitter = createThinkTagSplitter(
    (t) => { outText += t; },
    (r) => { outReason += r; },
  );
  for (const part of ['<thi', 'nk>先看', '月令与格局</th', 'ink>最终结论：', '利求稳。']) {
    splitter.push(part);
  }
  splitter.end();
  assert.equal(outReason, '先看月令与格局');
  assert.equal(outText, '最终结论：利求稳。');

  // Mock SSE stream with reasoning_content + content
  const encoder = new TextEncoder();
  const sseBody = [
    'data: {"choices":[{"delta":{"reasoning_content":"第一步分析日主强弱。"}}]}\n\n',
    'data: {"choices":[{"delta":{"reasoning_content":"第二步核对流年。"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"核心结论：今年宜稳中求进。"},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');
  const mockFetch = (async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseBody));
          controller.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )) as unknown as typeof fetch;

  let streamedText = '';
  let streamedReasoning = '';
  const chatRes = await streamChat(
    { baseUrl: 'https://mock.local/v1', model: 'deepseek-reasoner' },
    [{ role: 'user', content: '测试' }],
    (t) => { streamedText += t; },
    undefined,
    mockFetch,
    (r) => { streamedReasoning += r; },
  );
  assert.equal(streamedReasoning, '第一步分析日主强弱。第二步核对流年。');
  assert.equal(streamedText, '核心结论：今年宜稳中求进。');
  assert.equal(chatRes.reasoning, '第一步分析日主强弱。第二步核对流年。');
  assert.equal(chatRes.content, '核心结论：今年宜稳中求进。');
});

test('G4 上下文滑动窗口折叠早期工具正文并保留 repromptToken', () => {
  const bigPrompt = '【八字命盘】\n' + '详细盘面事实数据。'.repeat(120);
  const history: AgentApiMessage[] = [
    { role: 'user', content: '第1问' },
    {
      role: 'tool',
      tool_call_id: 'c1',
      name: 'calculate',
      content: JSON.stringify({
        method: 'bazi',
        label: '八字',
        summary: { title: '八字排盘' },
        promptText: bigPrompt,
        repromptToken: 'tok_1',
      }),
    },
    { role: 'assistant', content: '第1答' },
    {
      role: 'tool',
      tool_call_id: 'c2',
      name: 'calculate',
      content: JSON.stringify({
        method: 'liuyao',
        label: '六爻',
        summary: { title: '六爻起卦' },
        promptText: bigPrompt,
        repromptToken: 'tok_2',
      }),
    },
    { role: 'assistant', content: '第2答' },
    {
      role: 'tool',
      tool_call_id: 'c3',
      name: 'calculate',
      content: JSON.stringify({
        method: 'qimen',
        label: '奇门',
        summary: { title: '奇门起局' },
        promptText: bigPrompt,
        repromptToken: 'tok_3',
      }),
    },
  ];

  const compressed = compressApiHistoryToolOutputs(history, 2);
  const firstTool = JSON.parse((compressed[1] as { content: string }).content) as Record<string, unknown>;
  const secondTool = JSON.parse((compressed[3] as { content: string }).content) as Record<string, unknown>;
  const thirdTool = JSON.parse((compressed[5] as { content: string }).content) as Record<string, unknown>;

  // 最早的 tool 被折叠，不保留大段 promptText，但保留 repromptToken 和 summary
  assert.equal(firstTool.promptText, undefined);
  assert.equal(firstTool.repromptToken, 'tok_1');
  assert.ok(typeof firstTool.compressedHistoryNote === 'string');
  // 最近 2 条 tool 保持完整 promptText
  assert.equal(secondTool.promptText, bigPrompt);
  assert.equal(thirdTool.promptText, bigPrompt);
});
