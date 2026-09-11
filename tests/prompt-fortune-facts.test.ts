import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import {
  buildFortuneSelectionContext,
  normalizeFortuneSelection,
} from '../packages/core/src/bazi/fortuneSelection';
import {
  buildBaziPromptForResult,
  buildPublicZiweiPromptForRuntime,
} from '../packages/core/src/prompt/public-api';
import { formatBaziFortuneSelection } from '../packages/core/src/prompt/bazi-fortune';
import { calculateZiweiChart } from '../packages/core/src/ziwei/runtime';
import { buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';

const bazi = baziCalculator.calculateBazi({
  gender: 'male',
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 1,
  isLunar: false,
  isLeapMonth: false,
  useTrueSolarTime: false,
});

test('八字指定流年任务书保留已计算的十神与触发事实且各出现一次', () => {
  const context = buildFortuneSelectionContext(
    bazi,
    normalizeFortuneSelection(bazi, { scope: 'year', year: 2026 }),
  );
  assert.ok(context);

  const focus = formatBaziFortuneSelection(context)!.focus;
  const prompt = buildBaziPromptForResult({
    result: bazi,
    question: '请分析2026年事业',
    fortuneScope: 'year',
    fortuneSelectionContext: context,
  });

  const expectedFacts = context.promptPayload.summaryLines.filter(
    (line) => line.startsWith('流年十神：') || line.startsWith('流年触发：'),
  );
  const selectedFacts = context.promptPayload.selectedFacts ?? [];
  assert.equal(expectedFacts.length, 2);
  assert.ok(expectedFacts.every((fact) => selectedFacts.includes(fact)));
  assert.ok(selectedFacts.length >= expectedFacts.length);
  for (const fact of expectedFacts) {
    assert.equal(focus.split(fact).length - 1, 1, fact);
    assert.equal(prompt.split(fact).length - 1, 1, fact);
  }
  assert.match(prompt, /选择日期：2026年/);
  assert.match(prompt, /上层岁运：/);
  assert.match(prompt, /所选干支：丙午/);
});

test('八字完整任务书保留完整大运流年和逐年岁运关系', () => {
  const prompt = buildBaziPromptForResult({
    result: bazi,
    question: '请分析完整事业阶段',
    fortuneScope: 'full',
  });

  assert.match(prompt, /分析对象：本命盘与完整大运流年/);
  assert.match(prompt, /完整大运流年：/);
  assert.match(prompt, /2026年\(37岁\) 丙午｜/);
  assert.match(prompt, /岁运干支关系：/);
});

test('紫微完整任务书只保留一份静态出生资料并覆盖各运限范围', async () => {
  const runtime = await calculateZiweiChart(
    buildZiweiChartInput({
      name: '测试',
      gender: 'female',
      dateType: 'solar',
      year: '1992',
      month: '8',
      day: '21',
      timeIndex: 4,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
    { horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 } },
  );
  const prompt = buildPublicZiweiPromptForRuntime({
    result: runtime,
    scope: 'full',
    question: '请分析整体命局',
  });

  assert.equal(prompt.split('基本资料：').length - 1, 1);
  assert.equal(prompt.split('命身资料：').length - 1, 1);
  assert.equal(prompt.split('四柱：').length - 1, 1);
  for (const label of ['本命', '大限', '流年', '流月', '流日', '流时']) {
    assert.match(prompt, new RegExp(`分析对象：${label}`));
  }
  assert.match(prompt, /完整紫微运限资料：/);

  const representativePayload = Object.values(runtime.payloadByScope).find((item) =>
    item?.palaces.some((palace) => palace.major_stars.length > 0 || palace.scope_stars.length > 0),
  );
  assert.ok(representativePayload);
  const representativePalace = representativePayload.palaces.find(
    (palace) => palace.major_stars.length > 0 || palace.scope_stars.length > 0,
  );
  assert.ok(representativePalace);
  const representativeStar = [
    ...representativePalace.major_stars,
    ...representativePalace.scope_stars,
  ][0];
  assert.ok(representativeStar);
  assert.ok(prompt.includes(representativePalace.name));
  assert.ok(prompt.includes(representativeStar.name));

  const mutagenPayload = Object.values(runtime.payloadByScope).find(
    (item) => item && item.active_scope.scope !== 'origin' && item.active_scope.mutagen_map.length,
  );
  assert.ok(mutagenPayload);
  const representativeMutagen = mutagenPayload.active_scope.mutagen_map[0];
  assert.ok(representativeMutagen);
  assert.ok(prompt.includes(`${representativeMutagen.star}化${representativeMutagen.mutagen}`));

  const evidencePayload = Object.values(runtime.payloadByScope).find(
    (item) => item && item.active_scope.scope !== 'origin' && item.evidence_pool.length,
  );
  assert.ok(evidencePayload);
  const representativeEvidence = evidencePayload.evidence_pool[0];
  const evidenceText = representativeEvidence.promptText || representativeEvidence.description;
  assert.ok(evidenceText);
  assert.ok(prompt.includes(evidenceText));
});
