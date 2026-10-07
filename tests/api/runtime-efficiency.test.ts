import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAlmanacEvidence, generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

async function call(path: string, input?: Record<string, unknown>, origin = 'https://aov.cc') {
  const response = await handlePublicApiRequest(
    new Request(`${origin}/api/v1/${path}`, {
      ...(input ? { method: 'POST', body: JSON.stringify(input) } : {}),
    }),
  );
  return { status: response.status, body: await response.json() };
}

test('公开目录重复读取与切换域名后应保持独立响应及当前域名', async () => {
  for (const origin of ['https://aov.cc', 'https://preview.example', 'https://aov.cc']) {
    for (const path of ['manifest', 'openapi.json', 'foundation/capabilities']) {
      const first = await call(path, undefined, origin);
      const second = await call(path, undefined, origin);
      assert.equal(first.status, 200);
      assert.deepEqual(second, first);
      assert.equal(first.body.meta.service, new URL(origin).host);
      if (path === 'manifest') assert.equal(first.body.data.baseUrl, `${origin}/api/v1`);
      if (path === 'openapi.json') {
        assert.equal(first.body.data.servers[0].url, `${origin}/api/v1`);
      }
    }
  }
});

test('计算与占卜提示词应在排盘前拒绝无效响应模式', async () => {
  for (const [path, input, expectedField] of [
    ['bazi/calculate', { detailMode: 'tiny' }, 'detailMode'],
    ['divination/almanac/prompt', { responseMode: 'everything' }, 'responseMode'],
    ['divination/almanac/prompt', { detailMode: 'tiny' }, 'detailMode'],
  ] as const) {
    const { status, body } = await call(path, input);
    assert.equal(status, 400);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.match(body.error.message, new RegExp(expectedField));
  }
});

test('黄历复用证据后整段与分页提示词的日期事实应与原算法一致', async () => {
  const input = { topic: 'contract' as const, startDate: '2026-06-01', endDate: '2026-06-03' };
  const result = generateAlmanacSelection({ ...input, participants: [] });
  const full = await call('divination/almanac', { ...input, detailMode: 'full' });
  assert.equal(full.status, 200);
  assert.deepEqual(full.body.data.evidenceAnalysis, result.evidenceAnalysis);

  const page = await call('divination/almanac/prompt', {
    ...input,
    page: 2,
    pageSize: 1,
    detailMode: 'full',
    responseMode: 'full',
  });
  assert.equal(page.status, 200);
  assert.deepEqual(page.body.data.result.days, [result.days[1]]);
  assert.deepEqual(
    page.body.data.result.evidenceAnalysis,
    analyzeAlmanacEvidence({ ...result, days: [result.days[1]] }),
  );
  const promptOnly = await call('divination/almanac/prompt', {
    ...input,
    page: 2,
    pageSize: 1,
  });
  assert.equal(promptOnly.status, 200);
  assert.equal(promptOnly.body.data.prompt, page.body.data.prompt);
  assert.equal(promptOnly.body.data.result, undefined);
});
