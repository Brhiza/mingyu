import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } as const;
const person1 = { name: '甲', gender: 'female', birth } as const;
const person2 = { name: '乙', gender: 'male', birth: { year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8 } } as const;

test('ziwei includeTimeline 默认关闭，开启后返回十二大限并支持 reprompt 与篡改拒绝', async () => {
  const withoutTimeline = await calculate('ziwei', { question: '大限如何？', birth, gender: 'female' });
  assert.equal(withoutTimeline.data.decadalTimeline, undefined);
  assert.doesNotMatch(withoutTimeline.prompt.text, /【十二大限】/);

  const withTimeline = await calculate('ziwei', { question: '大限如何？', birth, gender: 'female', includeTimeline: true });
  const timeline = withTimeline.data.decadalTimeline;
  assert.equal(timeline.length, 12);
  for (let i = 0; i < timeline.length; i++) {
    const step = timeline[i];
    const palace = withTimeline.data.natal.palaces[step.index];
    assert.equal(step.palaceName, palace.name);
    assert.equal(step.heavenlyStem, palace.heavenlyStem);
    assert.equal(step.earthlyBranch, palace.earthlyBranch);
    assert.deepEqual([step.startAge, step.endAge], palace.decadal.range);
    assert.equal(step.mutagens.length, 4);
    if (i > 0) assert.ok(step.startAge > timeline[i - 1].startAge);
  }
  assert.match(withTimeline.prompt.text, /【十二大限】/);
  assert.match(withTimeline.prompt.text, new RegExp(`${timeline[0].startAge}–${timeline[0].endAge}岁：${timeline[0].palaceName}`));

  const followUp = await reprompt({ method: 'ziwei', result: withTimeline, question: '再看一遍大限' });
  assert.match(followUp.prompt.text, /【十二大限】/);
  assert.match(followUp.prompt.text, /再看一遍大限/);

  const tampered = structuredClone(withTimeline);
  tampered.data.decadalTimeline[0].startAge += 1;
  await assert.rejects(() => reprompt({ method: 'ziwei', result: tampered, question: '篡改大限' }), /不一致/);
});

test('ziwei-synastry 提供 referenceTime 时计算运限合参、渲染提示词并支持 reprompt 与篡改拒绝', async () => {
  const referenceTime = '2025-06-15T08:00:00Z';
  const result = await calculate('ziwei-synastry', {
    question: '今年运限如何？',
    person1,
    person2,
    relationship: 'marriage',
    referenceTime,
  });
  const hc = result.data.horoscopeComparison;
  assert.ok(hc);
  assert.equal(hc.referenceTime, referenceTime);
  for (const key of ['person1', 'person2'] as const) {
    assert.equal(hc[key].decadal.palaceNames.length, 12);
    assert.equal(hc[key].decadal.mutagen.length, 4);
    assert.equal(hc[key].decadal.mutagenPlacements.length, 4);
    assert.equal(hc[key].yearly.palaceNames.length, 12);
    assert.equal(hc[key].yearly.mutagen.length, 4);
    assert.equal(hc[key].yearly.mutagenPlacements.length, 4);
    assert.ok(hc[key].decadal.natalPalace.length > 0);
    assert.ok(hc[key].yearly.natalPalace.length > 0);
  }
  assert.match(result.prompt.text, /【运限合参】/);
  assert.match(result.prompt.text, /大限：/);
  assert.match(result.prompt.text, /流年：/);
  assert.match(result.prompt.text, /运限合参仅含大限与流年/);

  const followUp = await reprompt({ method: 'ziwei-synastry', result, question: '流年呢？' });
  assert.match(followUp.prompt.text, /【运限合参】/);
  assert.match(followUp.prompt.text, /流年呢？/);

  const tampered = structuredClone(result);
  tampered.data.horoscopeComparison.person1.yearly.mutagen[0] = '篡改星';
  await assert.rejects(() => reprompt({ method: 'ziwei-synastry', result: tampered, question: '篡改运限' }), /不一致/);
});

test('ziwei-synastry 不确定出生候选选定后可计算运限合参，未选定时提示待选', async () => {
  const unknownPerson = { ...person1, birth: { ...birth, clock: { kind: 'unknown' } } } as const;
  const referenceTime = '2025-06-15T08:00:00Z';

  const unselected = await calculate('ziwei-synastry', {
    question: '合参',
    person1: unknownPerson,
    person2,
    referenceTime,
  });
  assert.equal(unselected.data.horoscopeComparison, undefined);
  assert.match(unselected.prompt.text, /【运限合参】\n尚未选定双方出生候选/);

  const selected = await calculate('ziwei-synastry', {
    question: '合参',
    person1: { ...unknownPerson, candidateIndex: 0 },
    person2,
    compareCandidates: false,
    referenceTime,
  });
  assert.ok(selected.data.horoscopeComparison);
  assert.match(selected.prompt.text, /【运限合参】\n参考时刻/);

  const followUp = await reprompt({ method: 'ziwei-synastry', result: selected, question: '复核' });
  assert.match(followUp.prompt.text, /【运限合参】\n参考时刻/);
});
