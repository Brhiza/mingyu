import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

const input = { question: '问题', currentTime: '2025-01-01T00:00:00Z', tarot: { spread: 'three', manualCards: [{ id: 1, reversed: false }, { id: 2, reversed: true }, { id: 3, reversed: false }] } };

test('复用塔罗盘面时核对牌号、名称、牌位、正逆位及牌面资料', async () => {
  const saved = await calculate('tarot', input);
  for (const mutate of [
    (result) => { result.data.spreadName = '伪造'; },
    (result) => { result.data.cards[0].id = result.data.cards[1].id; },
    (result) => { result.data.cards[0].name = '伪造'; },
    (result) => { result.data.cards[0].position = '未来'; },
    (result) => { result.data.cards[0].reversed = '正位'; },
    (result) => { result.data.cards[0].keywords = ['伪造']; },
    (result) => { result.data.cards[0].element = '伪造'; },
  ]) {
    const changed = structuredClone(saved);
    mutate(changed);
    await assert.rejects(() => reprompt({ method: 'tarot', result: changed, question: '新问题' }));
  }
  const changed = structuredClone(saved);
  changed.data.evidenceAnalysis.adjacent = [{ first: '伪造' }];
  const prompt = await reprompt({ method: 'tarot', result: changed, question: '新问题' });
  assert.match(prompt.prompt.text, /新问题/);
  assert.doesNotMatch(prompt.prompt.text, /伪造/);
});

test('修改返回牌面不会污染后续请求的牌面资料', async () => {
  const first = await calculate('tarot', input);
  first.data.cards[0].keywords[0] = '被修改';
  const second = await calculate('tarot', input);
  assert.notEqual(second.data.cards[0].keywords[0], '被修改');
  assert.doesNotMatch(second.prompt.text, /被修改/);
});
