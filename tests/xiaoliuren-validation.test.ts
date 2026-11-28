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

test('小六壬支持真太阳时经度校正与防篡改校验', async () => {
  const iso = '2025-05-01T15:30:00Z';
  const beijing = await calculate('xiaoliuren', { question: '寻人', currentTime: iso, xiaoliuren: { rule: 'common', timeStandard: 'beijing' } });
  const kashgar = await calculate('xiaoliuren', { question: '寻人', currentTime: iso, xiaoliuren: { rule: 'common', timeStandard: 'true-solar', longitude: 76 } });
  assert.equal(kashgar.data.timeContext?.standard, 'true-solar');
  assert.notEqual(kashgar.data.hourLabel, beijing.data.hourLabel);
  const next = await reprompt({ method: 'xiaoliuren', result: kashgar, question: '再问方位' });
  assert.match(next.prompt.text, /真太阳时/);
  const tampered = structuredClone(kashgar);
  tampered.data.timeContext!.longitude = 120;
  await assert.rejects(() => reprompt({ method: 'xiaoliuren', result: tampered, question: '篡改经度' }));
  await assert.rejects(() => calculate('xiaoliuren', { question: '缺经度', currentTime: iso, xiaoliuren: { timeStandard: 'true-solar' } }));
});
