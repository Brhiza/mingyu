import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildFortuneEvidence } from '../src/systems/bazi/fortune-evidence';

const input = { question: '问题', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 }, gender: 'male', referenceTime: '2026-06-15T04:00:00Z' };
const order = ['dayun', 'year', 'month', 'day', 'hour'] as const;
const labels = ['大运', '流年', '流月', '流日', '流时'];

test('本命和各岁运范围只使用选定层级及上层资料', async () => {
  const original = await calculate('bazi', input);
  const natal = await reprompt({ method: 'bazi', result: original, question: '本命', prompt: { scope: 'natal' } });
  assert.doesNotMatch(natal.prompt.text, /【指定时刻岁运】|【大运】/);
  for (let index = 0; index < order.length; index++) {
    const next = await reprompt({ method: 'bazi', result: original, question: '逐层分析', prompt: { scope: order[index], detailMode: 'full' } });
    const dynamic = next.prompt.text.split('【指定时刻岁运】')[1].split('【主题：')[0];
    assert.doesNotMatch(next.prompt.text, /【大运】/);
    for (let k = 0; k < labels.length; k++) {
      if (k <= index) assert.ok(dynamic.includes(labels[k]), `${order[index]}/${labels[k]}`);
      else assert.ok(!dynamic.includes(labels[k]), `${order[index]}不应出现${labels[k]}`);
    }
    const located = original.data.located, chart = original.data.chart;
    const layers = [{ id: 'dayun' as const, pillar: located.cycle.pillar }, { id: 'year' as const, pillar: located.year }, { id: 'month' as const, pillar: located.month }, { id: 'day' as const, pillar: located.day }, { id: 'hour' as const, pillar: located.hour }].slice(0, index + 1).map((x) => ({ ...x, ganZhi: x.pillar.ganZhi }));
    const evidence = buildFortuneEvidence(chart.pillars, layers);
    for (const formation of evidence.formations) assert.ok(dynamic.includes(`${formation.branches.join('')} ${formation.name}${formation.element}`));
    assert.equal((dynamic.match(/；补全来源：/g) ?? []).length, evidence.formations.length);
  }
});

test('没有参考时刻或出生不精确时不得选择具体岁运；童限不虚构大运', async () => {
  await assert.rejects(() => calculate('bazi', { ...input, referenceTime: undefined, prompt: { scope: 'year' } }), /参考时刻/);
  const uncertain = await calculate('bazi', { question: '问题', birth: { ...input.birth, clock: { kind: 'unknown' } } });
  await assert.rejects(() => reprompt({ method: 'bazi', result: uncertain, question: '继续', prompt: { scope: 'dayun' } }), /参考时刻/);
  const early = await calculate('bazi', { ...input, referenceTime: '1990-05-15T06:30:00Z', prompt: { scope: 'dayun' } });
  assert.match(early.prompt.text, /童限，尚无大运/);
  assert.doesNotMatch(early.prompt.text.split('【指定时刻岁运】')[1].split('【主题：')[0], /流年|流月|流日|流时/);
});
