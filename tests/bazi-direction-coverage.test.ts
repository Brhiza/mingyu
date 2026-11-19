import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildDirectionCoverage } from '../src/systems/bazi/direction-coverage';
import type { BaziPillar, PillarName } from '../src/systems/bazi/pillars';
import type { buildUsefulStrategy } from '../src/systems/bazi/useful-strategy';

const pillar = (gan: string, zhi: string, stemElement: string, branchElement: string, hidden: string[]) =>
  ({ gan, zhi, stemElement, branchElement, hiddenStems: hidden.map((stem) => ({ stem, tenGod: '' })) }) as BaziPillar;
const pillars: Record<PillarName, BaziPillar> = {
  year: pillar('甲', '丑', '木', '土', ['己', '癸', '辛']),
  month: pillar('乙', '寅', '木', '木', ['甲', '丙', '戊']),
  day: pillar('丙', '辰', '火', '土', ['戊', '乙', '癸']),
  hour: pillar('丁', '午', '火', '火', ['丁', '己']),
};
const strategy = (changes: Partial<ReturnType<typeof buildUsefulStrategy>>) => ({
  favorable: [], unfavorable: [], conditionalFavorableStems: [], conditionalUnfavorableStems: [], ...changes,
}) as ReturnType<typeof buildUsefulStrategy>;

test('条件层按双方五行与具体天干分别核对，保留全部柱位和藏干来源', () => {
  const value = buildDirectionCoverage(strategy({ favorable: ['木', '金', '木'], unfavorable: ['木', '水'], conditionalFavorableStems: ['甲', '壬'], conditionalUnfavorableStems: ['乙'] }), pillars);
  assert.equal(value.status, '条件候选');
  assert.deepEqual(value.favorable.map((item) => item.element), ['木', '金']);
  assert.deepEqual(value.favorable[0].sources.map((item) => [item.pillar, item.layer, item.value]), [['year', '天干', '甲'], ['month', '天干', '乙'], ['month', '地支', '寅'], ['month', '藏干', '甲'], ['day', '藏干', '乙']]);
  assert.deepEqual(value.favorable[1].sources.map((item) => item.value), ['辛']);
  assert.deepEqual(value.unfavorable[0].sources, value.favorable[0].sources);
  assert.deepEqual(value.favorableStems[0].sources.map((item) => [item.pillar, item.layer, item.value]), [['year', '天干', '甲'], ['month', '藏干', '甲']]);
  assert.deepEqual(value.favorableStems[1].sources, []);
  assert.deepEqual(value.unfavorableStems[0].sources.map((item) => item.value), ['乙', '乙']);
  assert.equal(buildDirectionCoverage(strategy({}), pillars).status, '待判');
  assert.match(value.limitation, /不等同最终喜忌/);
});

test('双盘在提示词展示双向条件来源，追问校验结果', async () => {
  const person1 = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const person2 = { year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8 };
  const result = await calculate('bazi-synastry', { question: '双方如何相处', person1, person2 });
  const { charts, compatibility } = result.data;
  assert.deepEqual(compatibility.directionCoverage.person1FromPerson2, buildDirectionCoverage(charts.person1.usefulStrategy, charts.person2.pillars));
  assert.deepEqual(compatibility.directionCoverage.person2FromPerson1, buildDirectionCoverage(charts.person2.usefulStrategy, charts.person1.pillars));
  assert.equal(compatibility.usefulGodCoverage.status, '待计算');
  assert.match(result.prompt.text, /【双方条件候选与对方盘面】/);
  assert.match(result.prompt.text, /不等同最终喜忌/);
  const saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'bazi-synastry', result: saved, question: '继续问' });
  assert.match(next.prompt.text, /【双方条件候选与对方盘面】/);
  saved.data.compatibility.directionCoverage.person1FromPerson2.status = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: saved, question: '继续问' }), /不一致/);
});
