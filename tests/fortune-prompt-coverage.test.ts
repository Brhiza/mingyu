import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei';
import { buildCurrentBaziFortuneSelection, buildFortuneSelectionContext } from 'mingyu-core/bazi';
import {
  buildCombinedZiweiPrompt,
  formatBaziFortuneSelection,
  formatBaziFullFortune,
} from 'mingyu-core/prompt';
import { buildZiweiFortunePrompt } from '../src/lib/ziwei-fortune-prompt';

const draft = {
  name: '样本',
  gender: 'male' as const,
  dateType: 'solar' as const,
  year: '1990',
  month: '5',
  day: '15',
  timeIndex: 1,
  isLeapMonth: false,
  useTrueSolarTime: false,
  birthHour: '',
  birthMinute: '',
  birthPlace: '',
  birthLongitude: '',
};
const dateStr = '2026-09-10';

test('八字各层提示词保留全部明细，标题去重，完整范围覆盖每步大运', () => {
  const result = calculateFullBaziChart(buildPersonFromInput(draft));
  const current = buildCurrentBaziFortuneSelection(result, new Date(`${dateStr}T12:00:00+08:00`))!;
  for (const scope of ['dayun', 'year', 'month', 'day'] as const) {
    const context = buildFortuneSelectionContext(result, { ...current, scope })!;
    const text = formatBaziFortuneSelection(context)!.focus;
    for (const group of context.promptPayload.detailGroups ?? []) {
      assert.equal(text.split(group.title).length - 1, 1);
      for (const line of group.lines) assert.ok(text.includes(line), line);
    }
    assert.doesNotMatch(text, /关系取义：/);
  }
  const full = formatBaziFullFortune(result);
  for (const cycle of result.luckInfo!.cycles) {
    assert.ok(full.includes(cycle.ganZhi));
    for (const year of cycle.years) assert.ok(full.includes(`${year.year}年`));
  }
});

test('紫微主题提示词保留十二宫全部星曜和大限范围', async () => {
  const runtime = await calculateZiweiChart(buildZiweiChartInput(draft), {
    horoscopeContext: { dateStr, hourIndex: 6 },
  });
  for (const scope of ['origin', 'decadal', 'yearly', 'monthly'] as const) {
    const payload = runtime.payloadByScope[scope];
    const text = buildCombinedZiweiPrompt(payload, 'career-wealth', '分析事业变化。');
    for (const palace of payload.palaces) {
      for (const star of [
        ...palace.major_stars,
        ...palace.minor_stars,
        ...palace.other_stars,
        ...palace.scope_stars,
      ])
        assert.ok(text.includes(star.name), `${scope} ${palace.name} ${star.name}`);
      assert.ok(text.includes(palace.decadal_range.join('-')), palace.name);
    }
  }
});

test('紫微当前阶段覆盖十年，全部范围覆盖每个虚岁且携带流曜与四化', async () => {
  const input = buildZiweiChartInput(draft);
  const request = { input, dateStr, hourIndex: 6, all: false, key: '验证' };
  const stage = await buildZiweiFortunePrompt(request);
  assert.equal(stage.match(/^\d+岁｜/gm)?.length, 10);
  assert.match(stage, /四化/);
  assert.match(stage, /流羊|流陀|流禄/);
  const full = await buildZiweiFortunePrompt({ ...request, all: true });
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr, hourIndex: 6 },
  });
  const lastAge = Math.max(...runtime.decadalTimeline.map((p) => p.endAge));
  for (let age = 1; age <= lastAge; age += 1)
    assert.equal(full.split(`\n${age}岁｜`).length - 1, 1, `${age}岁`);
});
