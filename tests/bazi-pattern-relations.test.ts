import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/calculate.ts';

async function calcByPillars(pillars: { year: string; month: string; day: string; hour: string }, gender: 'male' | 'female' = 'male') {
  const rev = await calculate('bazi-reverse', { pillars, startYear: 1900, endYear: 2050 });
  const start = rev.data?.candidates?.[0]?.start;
  assert.ok(start, `应能反推出四柱 ${JSON.stringify(pillars)}`);
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)!;
  return calculate('bazi', {
    birth: { year: +m[1], month: +m[2], day: +m[3], clock: { kind: 'exact', hour: +m[4], minute: +m[5] + 15, second: 0 }, timezone: 8 },
    gender,
    question: '格局与关系核查',
  });
}

test('bazi-pattern-relations: 土重金埋（印重身强）自动剔除生印官杀火，并输出印重成病救应链', async () => {
  const res = await calcByPillars({ year: '己巳', month: '戊辰', day: '辛酉', hour: '己亥' });
  const ug = res.data.chart!.usefulGod;
  assert.ok(!ug.favorableWuxing.includes('火'), '土重金埋绝不可把生土之火列为喜用');
  assert.ok(ug.unfavorableWuxing.includes('火'));
  assert.match(res.prompt.text, /【格局组合与互制关系】/);
  assert.match(res.prompt.text, /印重成病/);
});

test('bazi-pattern-relations: 偏印格显性枭神夺食自动剔除生枭官杀水、优先金财制枭', async () => {
  const res = await calcByPillars({ year: '乙亥', month: '己卯', day: '丁巳', hour: '乙巳' });
  const ug = res.data.chart!.usefulGod;
  assert.equal(ug.favorableWuxing[0], '金', '枭神夺食第一救命药神必为金财');
  assert.ok(!ug.favorableWuxing.includes('水'), '重枭夺食不可把生木之水列为喜用');
  assert.match(res.prompt.text, /「枭神夺食」→ 病灶/);
});

test('bazi-pattern-relations: 丙寅日主自坐本气长生印根不误判从儿格，回归伤官格佩印', async () => {
  const res = await calcByPillars({ year: '己丑', month: '辛未', day: '丙寅', hour: '己丑' });
  assert.equal(res.data.chart!.patternOverview.pattern, '伤官格');
  assert.ok(res.data.chart!.usefulGod.favorableWuxing.includes('木'));
  assert.ok(res.data.chart!.usefulGod.favorableWuxing.includes('火'));
  assert.match(res.prompt.text, /「伤官佩印」\[成格协同\]/);
});

test('bazi-pattern-relations: 曲直专旺格识别食伤顺势泄秀协同关系，不把食伤判作反向气机', async () => {
  const res = await calcByPillars({ year: '甲寅', month: '丁卯', day: '甲辰', hour: '丙寅' });
  assert.equal(res.data.chart!.patternOverview.pattern, '曲直格');
  assert.match(res.prompt.text, /「曲直格·食伤顺势泄秀」\[成格协同\]/);
  const syn = res.data.chart!.usefulGod.tradeoffAnalysis?.synthesis || '';
  assert.equal(syn.includes('丁伤官'), false, '专旺格不可把丁火伤官误标为反向气机');
  assert.equal(syn.includes('丙食神'), false, '专旺格不可把丙火食神误标为反向气机');
});
