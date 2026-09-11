import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  callRealModel,
  buildCleanModelInputBundle,
  runScenarioLive,
  runLiveEvaluation,
} from '../scripts/evaluate-skill-live';
import { SKILL_SCENARIOS } from './fixtures/skill/scenarios';

test('在线模型请求失败时不得以离线基准冒充通过', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('模拟在线服务不可用');
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const scenario = SKILL_SCENARIOS[0];
  assert.ok(scenario);
  const result = await runScenarioLive(scenario, 'aov-fixture', {
    apiKey: 'test-key',
    baseUrl: 'https://example.invalid/v1',
    model: 'test-model',
    timeoutMs: 100,
  });

  assert.equal(result.artifact.userReply, '');
  assert.equal(result.artifact.prompt, undefined);
  assert.deepEqual(result.artifact.identifiedMethods, []);
  assert.equal(result.artifact.telemetry?.isLiveOnline, false);
  assert.equal(result.artifact.telemetry?.isDegraded, true);
  assert.equal(result.artifact.telemetry?.providerErrorReceived, true);
  assert.equal(result.evaluation.passed, false);
  assert.equal(result.evaluation.status, 'fail');
  assert.match(result.evaluation.errors[0] ?? '', /在线模型调用失败/);
  for (const score of Object.values(result.evaluation.scoreLevels)) {
    assert.equal(score.passed, false);
    assert.equal(score.status, 'needs_review');
  }
});

for (const status of [401, 429]) {
  test(`在线模型返回 ${status} 时保留失败且不填入参考答案`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('服务不可用', { status }));
    const result = await runScenarioLive(SKILL_SCENARIOS[0], 'aov-fixture', {
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      model: 'test-model',
    });
    assert.equal(result.artifact.userReply, '');
    assert.equal(result.evaluation.status, 'fail');
    assert.equal(result.artifact.telemetry?.modelName, 'test-model');
    assert.equal(result.artifact.telemetry?.isLiveOnline, false);
  });
}

for (const format of ['chat', 'gemini'] as const) {
  test(`${format} 在线模型返回空正文时评测失败`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({}));
    const result = await runScenarioLive(SKILL_SCENARIOS[0], 'aov-fixture', {
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      model: 'test-model',
      format,
    });
    assert.equal(result.artifact.userReply, '');
    assert.equal(result.evaluation.status, 'fail');
    assert.equal(result.artifact.telemetry?.isLiveOnline, false);
  });
}

test('在线评测不把预期路由复制成模型已识别方法', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ choices: [{ message: { content: '这是没有选择任何术式的回答。' } }] }),
  );
  const scenario = SKILL_SCENARIOS.find(
    (item) => item.id === 'SCENARIO-03-longterm-startup-normal',
  );
  assert.ok(scenario);
  const result = await runScenarioLive(scenario, 'aov-fixture', {
    apiKey: 'test-key',
    baseUrl: 'https://example.invalid/v1',
    model: 'test-model',
  });
  assert.deepEqual(result.artifact.identifiedMethods, []);
  assert.equal(result.evaluation.scoreLevels.l1Routing.passed, false);
  assert.equal(result.artifact.telemetry?.isLiveOnline, true);
});

test('Gemini 多段正文完整进入在线评测', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ candidates: [{ content: { parts: [{ text: '前段' }, { text: '后段' }] } }] }),
  );
  const result = await callRealModel(
    buildCleanModelInputBundle(SKILL_SCENARIOS[0], 'aov-fixture'),
    {
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid/v1',
      model: 'test-model',
      format: 'gemini',
    },
  );
  assert.equal(result.text, '前段后段');
});

test('在线评测失败时报告标明请求失败并返回失败退出状态', async (t) => {
  const keys = ['AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL'] as const;
  const previous = keys.map((key) => process.env[key]);
  const previousExitCode = process.exitCode;
  t.mock.method(globalThis, 'fetch', async () => new Response('服务不可用', { status: 401 }));
  t.mock.method(console, 'log', () => undefined);
  t.mock.method(console, 'warn', () => undefined);
  try {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'test-model';
    process.env.AI_BASE_URL = 'https://example.invalid/v1';
    await runLiveEvaluation();
    assert.equal(process.exitCode, 1);
    const report = readFileSync('.local/reports/skill-evaluation/live/latest.md', 'utf8');
    assert.match(report, /test-model（请求失败）/u);
    assert.doesNotMatch(report, /offline-reference|\| PASS \|/u);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
    process.exitCode = previousExitCode;
  }
});
