import assert from 'node:assert/strict';
import test from 'node:test';
import { BaziCalculator } from '../../packages/core/src/bazi/baziCalculator';
import type {
  BaziChartResult,
  BaziUnknownTimeBatchMetadata,
} from '../../packages/core/src/bazi/baziTypes';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const unknownInput = {
  dateType: 'solar',
  gender: 'female',
  year: 2024,
  month: 2,
  day: 4,
  timeIndex: -1,
};

const knownInput = { ...unknownInput, timeIndex: 4 };

async function callApi(path: string, body: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json()) as { data?: unknown; error?: unknown };
  return { response, payload };
}

type UnknownPage = BaziChartResult & {
  batch: { unknownTimeBatch: BaziUnknownTimeBatchMetadata };
};

function assertSingleCandidatePage(result: BaziChartResult, batch: BaziUnknownTimeBatchMetadata) {
  assert.equal(result.isThreePillars, true);
  assert.equal(result.unknownTimeAnalysis?.scenarios.length, 1);
  assert.equal(result.unknownTimeAnalysis?.batch?.candidateKey, batch.candidateKey);
  assert.equal(result.unknownTimeAnalysis?.scenarios[0]?.scenarioKey, batch.candidateKey);
  assert.equal(batch.unit, 'candidate');
  assert.equal(batch.endIndexExclusive, batch.startIndex + 1);
}

test('HTTP 未知时辰默认一项并按 next 续取，compact 保留当前候选', async () => {
  const firstCall = await callApi('bazi/calculate', { ...unknownInput, detailMode: 'full' });
  assert.equal(firstCall.response.status, 200, JSON.stringify(firstCall.payload));
  const first = firstCall.payload.data as UnknownPage;
  const firstBatch = first.batch.unknownTimeBatch;
  assertSingleCandidatePage(first, firstBatch);
  assert.equal(firstBatch.startIndex, 0);
  assert.ok(firstBatch.next);

  const nextCall = await callApi('bazi/calculate', {
    ...unknownInput,
    detailMode: 'full',
    unknownTimeBatch: firstBatch.next,
  });
  assert.equal(nextCall.response.status, 200, JSON.stringify(nextCall.payload));
  const next = nextCall.payload.data as UnknownPage;
  const nextBatch = next.batch.unknownTimeBatch;
  assertSingleCandidatePage(next, nextBatch);
  assert.equal(nextBatch.startIndex, 1);
  assert.equal(nextBatch.contextKey, firstBatch.contextKey);
  assert.notEqual(nextBatch.candidateKey, firstBatch.candidateKey);

  const compactCall = await callApi('bazi/calculate', {
    ...unknownInput,
    unknownTimeBatch: firstBatch.next,
  });
  assert.equal(compactCall.response.status, 200, JSON.stringify(compactCall.payload));
  const compact = compactCall.payload.data as UnknownPage;
  assertSingleCandidatePage(compact, compact.batch.unknownTimeBatch);
  assert.ok(compact.warningSummaryFact);
});

test('HTTP 未知时辰候选把非法、越界和跨出生上下文游标映射为 400', async () => {
  const firstCall = await callApi('bazi/calculate', { ...unknownInput, detailMode: 'full' });
  assert.equal(firstCall.response.status, 200, JSON.stringify(firstCall.payload));
  const first = firstCall.payload.data as UnknownPage;
  const batch = first.batch.unknownTimeBatch;
  assert.ok(batch.next);

  for (const unknownTimeBatch of [
    { startIndex: 0.5 },
    { startIndex: batch.totalCandidates, contextKey: batch.contextKey },
    { ...batch.next, contextKey: `${batch.contextKey}-changed` },
  ]) {
    const call = await callApi('bazi/calculate', {
      ...unknownInput,
      detailMode: 'full',
      unknownTimeBatch,
    });
    assert.equal(call.response.status, 400, JSON.stringify(call.payload));
  }

  const changedBirth = await callApi('bazi/calculate', {
    ...unknownInput,
    day: unknownInput.day + 1,
    detailMode: 'full',
    unknownTimeBatch: batch.next,
  });
  assert.equal(changedBirth.response.status, 400, JSON.stringify(changedBirth.payload));
});

test('HTTP 未知时辰提示词三种响应模式与纯八字专题共用单候选续读', async () => {
  let contextKey: string | undefined;
  for (const responseMode of ['prompt-only', 'summary', 'full'] as const) {
    const call = await callApi('bazi/prompt', {
      ...unknownInput,
      question: '比较当前未知时辰候选。',
      baziFortuneScope: 'natal',
      responseMode,
    });
    assert.equal(call.response.status, 200, JSON.stringify(call.payload));
    const data = call.payload.data as {
      prompt: string;
      result?: BaziChartResult;
      resultSummary?: BaziChartResult;
      batch: { unknownTimeBatch: BaziUnknownTimeBatchMetadata };
    };
    const batch = data.batch.unknownTimeBatch;
    contextKey ??= batch.contextKey;
    assert.equal(batch.contextKey, contextKey);
    assert.match(data.prompt, /当前时辰候选：第1\//);
    if (responseMode === 'prompt-only') {
      assert.equal(data.result, undefined);
      assert.equal(data.resultSummary, undefined);
    } else {
      const result = responseMode === 'full' ? data.result : data.resultSummary;
      assert.ok(result);
      assertSingleCandidatePage(result, batch);
    }
  }

  const thematicCall = await callApi('consultation/thematic/prompt', {
    ...unknownInput,
    methodId: 'bazi',
    topicId: 'career',
    scope: 'natal',
    question: '分析当前候选的事业结构。',
    responseMode: 'summary',
  });
  assert.equal(thematicCall.response.status, 200, JSON.stringify(thematicCall.payload));
  const thematic = thematicCall.payload.data as {
    prompt: string;
    resultSummary: { bazi: BaziChartResult };
    batch: { unknownTimeBatch: BaziUnknownTimeBatchMetadata };
  };
  assertSingleCandidatePage(thematic.resultSummary.bazi, thematic.batch.unknownTimeBatch);
  assert.match(thematic.prompt, /当前时辰候选：第1\//);
});

test('unknownTimeBatch 与明确时辰、范围、岁运、合盘及跨体系入口在计算前互斥', async (t) => {
  const calculate = t.mock.method(BaziCalculator.prototype, 'calculateBazi', () => {
    throw new Error('非法 unknownTimeBatch 不应进入普通排盘');
  });
  const calculateUnknown = t.mock.method(
    BaziCalculator.prototype,
    'calculateBaziUnknownTimeBatch',
    () => {
      throw new Error('非法 unknownTimeBatch 不应进入候选排盘');
    },
  );
  const batch = { startIndex: 0 };
  const cases: Array<[string, Record<string, unknown>]> = [
    ['bazi/calculate', { ...knownInput, unknownTimeBatch: batch }],
    ['bazi/calculate', { ...unknownInput, unknownTimeBatch: batch, rangeBatch: { startIndex: 0 } }],
    [
      'bazi/calculate',
      {
        ...unknownInput,
        unknownTimeBatch: batch,
        birthTimeRange: {
          startTimestamp: '2024-02-04T00:00:00+08:00',
          endTimestampExclusive: '2024-02-04T00:00:01+08:00',
          timezone: 'Asia/Shanghai',
          endExclusive: true,
          pillars: { year: '癸卯', month: '乙丑', day: '戊戌', hour: '壬子' },
        },
      },
    ],
    [
      'bazi/prompt',
      {
        ...unknownInput,
        question: '测试互斥。',
        unknownTimeBatch: batch,
        fortuneBatch: { startIndex: 0 },
      },
    ],
    [
      'bazi/prompt',
      {
        ...unknownInput,
        question: '测试互斥。',
        unknownTimeBatch: batch,
        baziFortuneScope: 'dayun',
      },
    ],
    [
      'bazi/prompt',
      { ...unknownInput, question: '测试互斥。', unknownTimeBatch: batch, scope: 'full' },
    ],
    [
      'bazi/prompt',
      { ...unknownInput, question: '测试互斥。', unknownTimeBatch: batch, promptScope: 'decadal' },
    ],
    [
      'bazi/compatibility',
      { person1: { ...knownInput, unknownTimeBatch: batch }, person2: knownInput },
    ],
    [
      'bazi-ziwei/prompt',
      { ...knownInput, question: '测试互斥。', unknownTimeBatch: batch, promptScope: 'origin' },
    ],
    [
      'consultation/thematic/prompt',
      {
        ...knownInput,
        methodId: 'ziwei',
        topicId: 'career',
        scope: 'natal',
        unknownTimeBatch: batch,
      },
    ],
  ];

  for (const [path, body] of cases) {
    const call = await callApi(path, body);
    assert.equal(call.response.status, 400, `${path}: ${JSON.stringify(call.payload)}`);
  }
  assert.equal(calculate.mock.callCount(), 0);
  assert.equal(calculateUnknown.mock.callCount(), 0);
});
