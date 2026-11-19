import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker';
import { reprompt } from '../src/core';

const env = {
  ASSETS: {
    async fetch(request: Request) {
      return new Response(`asset:${new URL(request.url).pathname}`, { status: 200 });
    },
  },
};

test('Worker 对超大请求体返回 413 并为 API 响应附带安全头', async () => {
  const oversized = JSON.stringify({ method: 'zhuge', input: { question: 'a'.repeat(1024 * 1024 + 64), zhuge: { text: '定乾坤' } } });
  for (const path of ['/api/calculate', '/api/prompt', '/mcp']) {
    const response = await worker.fetch(new Request(`https://example.com${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: oversized,
    }), env);
    assert.equal(response.status, 413, path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }

  const methodsResponse = await worker.fetch(new Request('https://example.com/api/methods'), env);
  assert.equal(methodsResponse.status, 200);
  assert.equal(methodsResponse.headers.get('cache-control'), 'no-store');
  assert.equal(methodsResponse.headers.get('x-content-type-options'), 'nosniff');

  const staticResponse = await worker.fetch(new Request('https://example.com/'), {
    ...env,
    ENABLED_METHODS: 'invalid-method',
  });
  assert.equal(staticResponse.status, 200);
  assert.equal(await staticResponse.text(), 'asset:/');
});

test('reprompt 拒绝畸形或缺少关键字段的占卜结果', async () => {
  const now = '2026-06-15T04:00:00Z';
  await assert.rejects(
    reprompt({ method: 'ssgw', result: { method: 'ssgw', currentTime: now, data: { number: 1, timestamp: Number.NaN, draw: { method: 'random' } } }, question: '测试' }),
    /灵签结果缺少有效签号或求签方式/,
  );
  await assert.rejects(
    reprompt({ method: 'lenormand', result: { method: 'lenormand', currentTime: now, data: { spreadType: 'single', spreadName: '单牌线索', cards: [null] } }, question: '测试' }),
    /雷诺曼牌面资料格式无效/,
  );
  await assert.rejects(
    reprompt({ method: 'xiaoliuren', result: { method: 'xiaoliuren', currentTime: now, data: { rule: 'common', timestamp: null, primary: {} } }, question: '测试' }),
    /小六壬盘面缺少起课时间或口径/,
  );
  await assert.rejects(
    reprompt({ method: 'zhuge', result: { method: 'zhuge', currentTime: now, data: {} }, question: '测试' }),
    /诸葛神数结果缺少有效取数或卦象资料/,
  );
});
