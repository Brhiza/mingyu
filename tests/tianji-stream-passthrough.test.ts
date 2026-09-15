import assert from 'node:assert/strict';
import test from 'node:test';
import { streamAiChat } from '../src/lib/ai/stream-client';

function sseResponse(events: string[]) {
  const body = events.map((event) => `data: ${event}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

test('天机：前端应解析透传的上游 OpenAI 分块并记录 token 用量', async () => {
  const originalFetch = globalThis.fetch;
  const target = globalThis as typeof globalThis & { __TIANJI_AI_USAGE__?: unknown[] };
  target.__TIANJI_AI_USAGE__ = [];
  globalThis.fetch = async () =>
    sseResponse([
      JSON.stringify({
        model: 'deepseek-flash',
        choices: [{ delta: { content: '辛金' } }],
        usage: null,
      }),
      JSON.stringify({
        model: 'deepseek-flash',
        choices: [{ delta: { content: '日主' } }],
        usage: null,
      }),
      JSON.stringify({
        model: 'deepseek-flash',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      }),
      '[DONE]',
    ]);
  try {
    const chunks: string[] = [];
    let done = false;
    let error = '';
    await streamAiChat([{ role: 'user', content: '测试' }], {
      onChunk: (text) => chunks.push(text),
      onDone: () => {
        done = true;
      },
      onError: (message) => {
        error = message;
      },
    });
    assert.equal(error, '');
    assert.equal(done, true);
    assert.equal(chunks.join(''), '辛金日主');
    assert.equal(target.__TIANJI_AI_USAGE__?.length, 1);
    assert.deepEqual((target.__TIANJI_AI_USAGE__?.[0] as { usage: unknown }).usage, {
      prompt_tokens: 10,
      completion_tokens: 2,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('天机：前端仍兼容上游原有的 content 分块格式', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => sseResponse([JSON.stringify({ content: '你好' }), '[DONE]']);
  try {
    const chunks: string[] = [];
    let done = false;
    await streamAiChat([{ role: 'user', content: '测试' }], {
      onChunk: (text) => chunks.push(text),
      onDone: () => {
        done = true;
      },
      onError: () => {},
    });
    assert.equal(chunks.join(''), '你好');
    assert.equal(done, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
