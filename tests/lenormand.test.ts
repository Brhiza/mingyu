import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import reference from '../src/systems/lenormand-data.json';

const now = '2025-01-01T00:00:00Z';
const base = { question: '如何理解当前情况？', currentTime: now };
const clean = (value: unknown) => JSON.parse(JSON.stringify(value));

test('全部固定组合可识别；有先后含义的组合不能倒序套用', async () => {
  const directional = new Set(['骑士+心', '月亮+太阳', '星星+月亮', '锚+星星', '船+鹳']);
  for (const [key, facts] of Object.entries(reference.fixed)) {
    const [first, second] = key.split('+').map((name) => reference.cards.find((card) => card.name === name)!.id);
    const filler = reference.cards.find((card) => card.id !== first && card.id !== second)!.id;
    for (const reversed of [false, true]) {
      const ids = reversed ? [second, first, filler] : [first, second, filler];
      const result = await calculate('lenormand', { ...base, lenormand: { spread: 'three', manualCardIds: ids } });
      const firstPair = result.data.combinations[0];
      if (reversed && directional.has(key)) assert.equal(firstPair.source, '相邻牌义合读', key);
      else {
        assert.equal(firstPair.source, '固定组合', key);
        assert.equal(firstPair.meaning, facts.raw);
        assert.ok(result.prompt.text.includes(facts.conditioned), key);
      }
    }
  }
});

test('选择牌阵分支互不拼接，九宫和大桌保留实际空间关系', async () => {
  const decision = await calculate('lenormand', { ...base, lenormand: { spread: 'decision', manualCardIds: [1, 2, 3, 4, 5, 6] } });
  assert.ok(!decision.data.combinations.some((item) => item.position1 === '选择A走向' && item.position2 === '选择B'));
  const nine = await calculate('lenormand', { ...base, lenormand: { spread: 'nine', manualCardIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] } });
  assert.equal(nine.data.evidenceAnalysis.layout.length, 9);
  assert.ok(nine.prompt.text.includes('中心位置为树'));
  assert.ok(nine.prompt.text.includes('左上至右下对角线'));
  const grand = await calculate('lenormand', { ...base, lenormand: { spread: 'grandTableau', manualCardIds: Array.from({ length: 36 }, (_, index) => index + 1) } });
  assert.equal(grand.data.cards.length, 36);
  assert.deepEqual([grand.data.cards[8].row, grand.data.cards[8].column, grand.data.cards[9].row, grand.data.cards[9].column], [1, 9, 2, 1]);
  assert.ok(!grand.data.combinations.some((item) => item.card1 === grand.data.cards[8].name && item.card2 === grand.data.cards[9].name));
  assert.equal(grand.data.evidenceAnalysis.layout.filter((item) => item.kind === '人物牌近身').length, 2);
  assert.equal(grand.data.evidenceAnalysis.placements.length, 36);
  assert.equal(grand.data.evidenceAnalysis.layout.find((item) => item.kind === '归宫牌')?.cards.length, 36);
  assert.match(grand.prompt.text, /归宫牌/);
});

test('复用盘面时核对牌号、牌位及牌义，并重新计算组合', async () => {
  const result = await calculate('lenormand', { ...base, lenormand: { spread: 'three', manualCardIds: [24, 25, 4] } });
  assert.ok(result.prompt.text.includes('关系承诺、契约或婚约议题'));
  assert.doesNotMatch(result.prompt.text, /已经订婚|已经结婚/);
  const saved = clean(result);
  const regenerated = await reprompt({ method: 'lenormand', result: saved, question: '新问题' });
  assert.match(regenerated.prompt.text, /新问题/);
  assert.ok(regenerated.prompt.text.includes('关系承诺、契约或婚约议题'));
  saved.data.combinations = [{ card1: '伪造', meaning: '伪造组合' }];
  saved.data.evidenceAnalysis = { fixedCombinations: [{ meaning: '伪造证据' }] };
  const rebuilt = await reprompt({ method: 'lenormand', result: saved, question: '新问题' });
  assert.doesNotMatch(rebuilt.prompt.text, /伪造/);
  saved.data.cards[0].name = '伪造';
  await assert.rejects(() => reprompt({ method: 'lenormand', result: saved, question: '新问题' }));
  const duplicate = clean(result);
  duplicate.data.cards[1].id = duplicate.data.cards[0].id;
  await assert.rejects(() => reprompt({ method: 'lenormand', result: duplicate, question: '新问题' }));
});
