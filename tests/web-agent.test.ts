import assert from 'node:assert/strict';
import test from 'node:test';
import { streamAgentCompletion, type AgentToolDefinition } from '../src/ai';
import {
  AGENT_TOOLS,
  restoreToolTraceResult,
  runAgentTurn,
  type AgentToolTrace,
} from '../src/web-agent';
import {
  isChatAgentActive,
  setWebAiEnabled,
  writeWebAiConfig,
} from '../src/web-ai';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function streamFrom(text: string, split = 5) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += split) {
        controller.enqueue(bytes.slice(i, i + split));
      }
      controller.close();
    },
  });
}

function installMockWindow() {
  const localStorage = createMemoryStorage();
  const dispatched: string[] = [];
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage,
    dispatchEvent(event: { type?: string }) {
      if (event?.type) dispatched.push(event.type);
      return true;
    },
  };
  return {
    localStorage,
    dispatched,
    restore() {
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = prevWindow;
      }
    },
  };
}

test('streamAgentCompletion 正确拼接分块 SSE tool_calls 并支持 JSON 回退', async () => {
  const config = { baseUrl: 'https://provider.example/v1', apiKey: 'sk-test', model: 'agent-model' };
  const tools: AgentToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'calc',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];

  const sse =
    'data: {"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"calc","arguments":""}}]}}]}\n\n' +
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"ulate","arguments":"{\\"method\\":\\"xiaoliuren\\""}}]}}]}\n\n' +
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":",\\"input\\":{\\"question\\":\\"测试\\"}}"}}]},"finish_reason":"tool_calls"}]}\n\n' +
    'data: [DONE]\n\n';

  const result = await streamAgentCompletion(
    config,
    [{ role: 'user', content: '用小六壬算一卦' }],
    tools,
    {},
    undefined,
    (async () =>
      new Response(streamFrom(sse, 7), {
        headers: { 'content-type': 'text/event-stream' },
      })) as typeof fetch,
  );

  assert.equal(result.finishReason, 'tool_calls');
  assert.equal(result.content, '');
  assert.deepEqual(result.toolCalls, [
    {
      id: 'call_1',
      type: 'function',
      function: {
        name: 'calculate',
        arguments: '{"method":"xiaoliuren","input":{"question":"测试"}}',
      },
    },
  ]);

  const jsonResult = await streamAgentCompletion(
    config,
    [{ role: 'user', content: '你好' }],
    tools,
    {},
    undefined,
    (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '直接回复' }, finish_reason: 'stop' }],
        }),
        { headers: { 'content-type': 'application/json' } },
      )) as typeof fetch,
  );
  assert.equal(jsonResult.content, '直接回复');
  assert.equal(jsonResult.toolCalls.length, 0);
});

test('开启网页 AI 并配置接口与模型后自动激活站内对话，关闭后自动回退本地模型', () => {
  const env = installMockWindow();
  try {
    assert.equal(isChatAgentActive(), false);

    setWebAiEnabled(true);
    assert.equal(isChatAgentActive(), false);

    writeWebAiConfig({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'test',
      model: 'deepseek-chat',
    });
    assert.equal(isChatAgentActive(), true);

    setWebAiEnabled(false);
    assert.equal(isChatAgentActive(), false);
  } finally {
    env.restore();
  }
});

test('runAgentTurn 能通过 tool_calls 调用本地术数工具并还原专业盘面数据', async () => {
  const env = installMockWindow();
  const originalFetch = globalThis.fetch;
  let round = 0;

  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      messages: Array<{ role: string; content: string | null; name?: string }>;
      tools?: unknown[];
    };
    assert.equal(Array.isArray(body.tools), true);
    assert.equal(body.tools?.length, AGENT_TOOLS.length);

    round++;
    if (round === 1) {
      const sse =
        'data: ' +
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_calc_1',
                    type: 'function',
                    function: {
                      name: 'calculate',
                      arguments: JSON.stringify({
                        method: 'xiaoliuren',
                        input: {
                          question: '今天出门办事顺不顺利？',
                          xiaoliuren: { rule: 'common' },
                        },
                      }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }) +
        '\n\ndata: [DONE]\n\n';
      return new Response(streamFrom(sse, 20), {
        headers: { 'content-type': 'text/event-stream' },
      });
    }

    const toolMsg = body.messages.find((m) => m.role === 'tool' && m.name === 'calculate');
    assert.ok(toolMsg && toolMsg.content);
    const toolPayload = JSON.parse(toolMsg.content) as {
      method: string;
      promptText: string;
      repromptToken: string;
    };
    assert.equal(toolPayload.method, 'xiaoliuren');
    assert.ok(toolPayload.promptText.length > 20);
    assert.ok(toolPayload.repromptToken.startsWith('mingyu:v2:d1:'));

    const finalSse =
      'data: ' +
      JSON.stringify({
        choices: [{ delta: { content: '根据小六壬起课结果，整体趋势平稳可办。' }, finish_reason: 'stop' }],
      }) +
      '\n\ndata: [DONE]\n\n';
    return new Response(streamFrom(finalSse, 20), {
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as typeof fetch;

  try {
    const updates: Array<{ content: string; traces: AgentToolTrace[] }> = [];
    const res = await runAgentTurn({
      userText: '帮我用小六壬算一下今天出门办事顺不顺利',
      priorApiHistory: [],
      attachedCase: null,
      config: { baseUrl: 'https://mock.local/v1', apiKey: 'k', model: 'mock-agent' },
      callbacks: {
        onAssistantUpdate: ({ content, toolTraces }) => {
          updates.push({ content, traces: toolTraces });
        },
      },
    });

    assert.equal(round, 2);
    assert.equal(res.finalContent, '根据小六壬起课结果，整体趋势平稳可办。');
    assert.equal(res.toolTraces.length, 1);
    assert.equal(res.toolTraces[0].status, 'success');
    assert.equal(res.toolTraces[0].method, 'xiaoliuren');
    assert.ok(res.toolTraces[0].repromptToken?.startsWith('mingyu:v2:d1:'));

    // Also test restoring full result after stripping in-memory fullResult (simulating reload)
    const strippedTrace: AgentToolTrace = { ...res.toolTraces[0], fullResult: undefined };
    const restored = await restoreToolTraceResult(strippedTrace);
    assert.ok(restored);
    assert.equal(restored.method, 'xiaoliuren');
    assert.ok(restored.result.prompt?.text.includes('今天出门办事顺不顺利'));
  } finally {
    globalThis.fetch = originalFetch;
    env.restore();
  }
});
