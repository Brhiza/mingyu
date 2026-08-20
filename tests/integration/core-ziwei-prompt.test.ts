import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baziCalculator } from 'mingyu-core/bazi';
import {
  buildBaziZiweiPrompt,
  buildZiweiCompatibilityPrompt,
  buildZiweiTaskBookPrompt,
} from 'mingyu-core/prompt';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei/runtime';

test('npm 提示词入口应覆盖紫微任务书、紫微合盘和八字紫微联合资料', async () => {
  const draft = {
    name: '提示词样例',
    gender: 'female',
    dateType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 4,
    isLeapMonth: false,
  } as const;
  const input = buildZiweiChartInput(draft);
  const first = await calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  });
  const second = await calculateZiweiChart(buildZiweiChartInput({ ...draft, name: '另一人' }), {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  });
  const taskBook = buildZiweiTaskBookPrompt({
    runtime: first,
    topic: 'career-wealth',
    focusPalaceNames: ['命宫', '官禄'],
  });
  const compatibility = buildZiweiCompatibilityPrompt({
    payload1: first.payloadByScope.origin,
    payload2: second.payloadByScope.origin,
    topic: 'relationship',
    schools: ['sanhe', 'feixing', 'sihua'],
  });
  const baziZiwei = buildBaziZiweiPrompt({
    bazi: baziCalculator.calculateBazi({
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 5,
      gender: 'female',
    }),
    ziwei: first,
    topic: '事业财运',
    baziSchools: ['ziping', 'mangpai', 'xinpai'],
    ziweiSchools: ['sanhe', 'feixing', 'sihua'],
  });

  assert.match(taskBook, /【任务】/);
  assert.match(taskBook, /事业财运/);
  assert.match(compatibility, /【双盘关系资料】/);
  assert.match(compatibility, /【多派合参】/);
  assert.match(baziZiwei, /【八字盘面资料】/);
  assert.match(baziZiwei, /【紫微盘面资料】/);
  assert.match(baziZiwei, /【八字多派合参】/);
  assert.match(baziZiwei, /【紫微多派合参】/);
});
