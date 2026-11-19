import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('复用小六壬盘面时按起课时间和口径核对历法及宫位', async () => {
  const saved = await calculate('xiaoliuren', { question: '问题', currentTime: '2025-01-01T00:00:00Z', xiaoliuren: { rule: 'duoneng' } });
  for (const mutate of [
    (result) => { result.data.rule = 'common'; },
    (result) => { result.data.timestamp += 24 * 60 * 60 * 1000; },
    (result) => { result.data.primary.name = '伪造'; },
    (result) => { result.data.sequence.day.verse = '伪造'; },
    (result) => { result.data.ganzhi.day = '伪造'; },
    (result) => { result.data.calculation.dayCount += 1; },
  ]) {
    const changed = structuredClone(saved);
    mutate(changed);
    await assert.rejects(() => reprompt({ method: 'xiaoliuren', result: changed, question: '新问题' }));
  }
  const changed = structuredClone(saved);
  changed.data.evidenceAnalysis.source = '伪造';
  changed.data.ganzhi = Object.fromEntries(Object.entries(changed.data.ganzhi).reverse());
  const prompt = await reprompt({ method: 'xiaoliuren', result: changed, question: '新问题' });
  assert.match(prompt.prompt.text, /新问题/);
  assert.doesNotMatch(prompt.prompt.text, /伪造/);
});
