import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { setDefaultPromptGuidanceProvider } from '../src/prompt-guidance';
import { runCalculateInBackground } from '../src/workers/calc-runner';

test('runCalculateInBackground 在非 Worker 环境下计算四柱反推、命录与 agent 档位与 calculate 一致', async () => {
  const reversePayload = {
    pillars: { year: '庚午', month: '辛巳', day: '壬申', hour: '丁未' },
    startYear: 1985,
    endYear: 1995,
    currentTime: '2026-06-15T04:00:00Z',
  };
  const directReverse = await calculate('bazi-reverse', reversePayload);
  const bgReverse = await runCalculateInBackground('bazi-reverse', reversePayload);
  assert.deepEqual(bgReverse, directReverse);

  const mingluPayload = {
    question: '事业运势如何',
    gender: 'male' as const,
    birth: {
      year: 1990,
      month: 5,
      day: 15,
      clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 },
      timezone: 8,
    },
    currentTime: '2026-06-15T04:00:00Z',
  };
  const baziPayload = {
    ...mingluPayload,
    question: '今年事业怎么看',
  };
  setDefaultPromptGuidanceProvider(() => ({ enableContract: true, replyStyle: 'concise' }));
  try {
    const directMinglu = await calculate('minglu', mingluPayload);
    const bgMinglu = await runCalculateInBackground('minglu', mingluPayload, {
      promptGuidance: { enableContract: true, replyStyle: 'concise' },
    });
    assert.deepEqual(bgMinglu, directMinglu);

    const directAgent = await calculate('bazi', baziPayload, { promptProfile: 'agent' });
    const bgAgent = await runCalculateInBackground('bazi', baziPayload, {
      promptGuidance: { enableContract: true, replyStyle: 'concise' },
      promptProfile: 'agent',
    });
    assert.deepEqual(bgAgent, directAgent);
  } finally {
    setDefaultPromptGuidanceProvider(null);
  }
});
