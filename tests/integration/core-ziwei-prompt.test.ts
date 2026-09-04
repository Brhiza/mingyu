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
  assert.match(taskBook, /命身主轴/);
  assert.match(compatibility, /【双盘关系资料】/);
  assert.match(compatibility, /【多派合参】/);
  assert.match(baziZiwei, /【八字盘面资料】/);
  assert.match(baziZiwei, /【紫微盘面资料】/);
  assert.match(baziZiwei, /【八字多派合参】/);
  assert.match(baziZiwei, /【紫微多派合参】/);
});

test('紫微命身复合主轴断诀应准确对应身宫落宫', async () => {
  const { getBodyPalaceAxisSummary } = await import('mingyu-core/ziwei/iztro');
  assert.equal(
    getBodyPalaceAxisSummary('命宫'),
    '命身同宫，主见坚固自主执着，行藏不易受外界动摇，先天宿命与后天作为合一',
  );
  assert.equal(
    getBodyPalaceAxisSummary('迁移'),
    '身在迁移，一生多变动向外拓展，社会人际与外部机运为后天重心',
  );
  assert.equal(
    getBodyPalaceAxisSummary('官禄'),
    '身在官禄，重名位权责与事业成就，责任感深重，后天行藏系于职守',
  );
  assert.equal(
    getBodyPalaceAxisSummary('财帛'),
    '身在财帛，重现实利禄与财富运作，行事讲求实效，以后天求财进退为依归',
  );
  assert.equal(
    getBodyPalaceAxisSummary('夫妻'),
    '身在夫妻，重家庭情感与婚恋归宿，配偶影响深远，易受感情关系牵动',
  );
  assert.equal(
    getBodyPalaceAxisSummary('福德'),
    '身在福德，重精神寄托、情趣与内省体验，好精神享受，后天行藏随心境变化',
  );
});

test('紫微提示词应完整输出夫妻宫主星、辅曜与宫干飞化自化', async () => {
  const draft = {
    name: '婚恋测试',
    gender: 'female',
    dateType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 4,
    isLeapMonth: false,
  } as const;
  const input = buildZiweiChartInput(draft);
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: false,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  });
  const { buildZiweiPrompt } = await import('mingyu-core/prompt');
  const prompt = buildZiweiPrompt({
    runtime,
    topic: 'relationship',
  });
  assert.match(prompt, /夫妻宫/);
  assert.match(prompt, /主星：/);
  assert.match(prompt, /宫干支/);
  assert.match(prompt, /宫干飞化：/);
});
