import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSerializableZiweiResult,
  calculatePublicZiweiChartForScopes,
} from 'mingyu-core/ziwei';
import {
  buildPublicZiweiPromptForRuntime,
  getNextCombinedBatchCursor,
  getZiweiPromptCalculationScopes,
} from 'mingyu-core/prompt/public-api';
import { buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import {
  calculateZiweiReading,
  type ZiweiReadingChunk,
} from '../src/lib/ai/ziwei-reading-calculation';
import { executeZiweiReadingWorker } from '../src/lib/ai/ziwei-reading-worker';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const input = {
  name: '公开合成一致性样本',
  gender: 'female' as const,
  dateType: 'solar' as const,
  year: 1990,
  month: 6,
  day: 14,
  timeIndex: 6,
  birthHour: 12,
  birthMinute: 34,
  birthSecond: 56,
  useTrueSolarTime: false,
  isLeapMonth: false,
  timezone: 8,
  algorithm: 'default' as const,
  scopeDate: '2026-09-18',
  scopeHourIndex: 6,
  question: '分析本命与选定运限。',
  responseMode: 'full',
};

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function stablePrompt(prompt: string) {
  return prompt.replace(/【当前时间】[\s\S]*?(?=\n\n【)/u, '【当前时间】');
}

for (const scope of ['origin', 'decadal'] as const) {
  test(`紫微本地分批补算与公开接口的${scope === 'origin' ? '本命' : '大限'}完整结果一致`, async () => {
    const request = { ...input, promptScope: scope };
    const mutableRequest: Partial<typeof request> = { ...request };
    const chunks: ZiweiReadingChunk[] = [];
    const progress: Array<[number, number]> = [];
    let replacedCallbacks = 0;
    const options = {
      onChunk: (chunk: ZiweiReadingChunk) => chunks.push(structuredClone(chunk)),
      onProgress: (completed: number, total: number) => progress.push([completed, total]),
    };
    const pending = calculateZiweiReading(mutableRequest, options);
    delete mutableRequest.scopeDate;
    delete mutableRequest.scopeHourIndex;
    mutableRequest.question = '等待后变造问题';
    mutableRequest.year = 1999;
    options.onChunk = () => replacedCallbacks++;
    options.onProgress = () => replacedCallbacks++;
    const inputAfterMutation = structuredClone(mutableRequest);
    const local = await pending;
    const response = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/ziwei/prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      }),
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body.error));
    assert.deepEqual(json(local.result), body.data.result);
    assert.equal(stablePrompt(local.prompt), stablePrompt(body.data.prompt));
    assert.deepEqual(local.result.calculationIdentity.target, {
      promptScope: scope,
      scopeDate: '2026-09-18',
      scopeHourIndex: 6,
    });
    assert.equal(replacedCallbacks, 0);
    assert.equal(chunks[0]?.kind, 'base');
    assert.equal(chunks.at(-1)?.kind, 'complete');
    assert.ok(progress.length > 0);
    const [completed, total] = progress.at(-1)!;
    assert.equal(completed, total);
    assert.deepEqual(mutableRequest, inputAfterMutation);

    if (scope === 'origin') {
      const controller = new AbortController();
      const abortOptions: { signal?: AbortSignal } = { signal: controller.signal };
      const abortPending = calculateZiweiReading(request, abortOptions);
      abortOptions.signal = undefined;
      controller.abort();
      await assert.rejects(abortPending, { name: 'AbortError', message: '已停止解读' });
    }
  });
}

test('完整紫微运限逐年龄年拼接与未分页计算的全部事实和提示词一致', async () => {
  const callerScopes = getZiweiPromptCalculationScopes('full');
  assert.deepEqual(callerScopes, ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly']);
  callerScopes.pop();
  assert.deepEqual(callerScopes, ['origin', 'decadal', 'yearly', 'monthly', 'daily']);

  const scopes = getZiweiPromptCalculationScopes('full');
  assert.deepEqual(scopes, ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly']);
  assert.deepEqual(
    getNextCombinedBatchCursor({
      section: 'ziwei-scope',
      startIndex: scopes.length - 1,
      ziweiScopeCount: scopes.length,
    }),
    { section: 'ziwei-fortune', startIndex: 0 },
  );

  const chunks: ZiweiReadingChunk[] = [];
  const progress: Array<[number, number]> = [];
  let replacedCallbacks = 0;
  const options = {
    onChunk: (chunk: ZiweiReadingChunk) => {
      chunks.push(structuredClone(chunk));
      if (chunk.kind === 'base') {
        options.onChunk = () => replacedCallbacks++;
        options.onProgress = () => replacedCallbacks++;
      }
    },
    onProgress: (completed: number, total: number) => progress.push([completed, total]),
  };
  const local = await calculateZiweiReading({ ...input, promptScope: 'full' }, options);
  const horoscopeContext = { dateStr: input.scopeDate, hourIndex: input.scopeHourIndex };
  const runtime = await calculatePublicZiweiChartForScopes(buildZiweiChartInput(input), scopes, {
    horoscopeContext,
    fortuneRange: { scope: 'all', ...horoscopeContext },
  });
  const { calculationIdentity, ...facts } = local.result;
  assert.equal(calculationIdentity.birth.birthSecond, input.birthSecond);
  assert.equal(replacedCallbacks, 0);
  assert.ok(progress.length > 1);
  assert.equal(chunks[0]?.kind, 'base');
  assert.equal(chunks.at(-1)?.kind, 'complete');
  assert.equal(chunks.filter((chunk) => chunk.kind === 'fortune').length, progress.length);
  for (let index = 0; index < progress.length; index += 1) {
    assert.equal(progress[index]![0], index + 1);
    assert.equal(progress[index]![1], progress.length);
  }
  assert.deepEqual(json(facts), json(buildSerializableZiweiResult(runtime)));
  assert.equal(
    stablePrompt(local.prompt),
    stablePrompt(
      buildPublicZiweiPromptForRuntime({
        result: runtime,
        scope: 'full',
        question: input.question,
        mode: 'framework',
      }),
    ),
  );

  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  class ReplayWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage(message: { id: string }) {
      queueMicrotask(() => {
        for (const chunk of chunks) {
          this.onmessage?.({ data: { id: message.id, type: 'chunk', chunk } } as MessageEvent);
        }
        this.onmessage?.({ data: { id: message.id, type: 'complete' } } as MessageEvent);
      });
    }
    terminate() {}
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: ReplayWorker });
  try {
    const assembled = await executeZiweiReadingWorker({ ...input, promptScope: 'full' });
    assert.deepEqual(json(assembled), json(local));
  } finally {
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});
