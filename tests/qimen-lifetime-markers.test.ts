import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from '../src/systems/qimen/chart';
import { extractPersonalMarkers, buildTopicCandidates, lifetimeTopics } from '../src/systems/qimen/lifetime/markers';

test('筛选主题不改变宫位；性别未知时保留两种婚恋取法', () => {
  const chart = generateQimen(new Date('1990-05-15T04:00:00Z'));
  const all = buildTopicCandidates(chart);
  assert.deepEqual(all.map((item) => item.topic), [...lifetimeTopics]);
  assert.deepEqual(buildTopicCandidates(chart, undefined, ['career', 'marriage']), all.filter((item) => ['career', 'marriage'].includes(item.topic)));
  const unknown = all.find((item) => item.topic === 'marriage')!;
  const male = buildTopicCandidates(chart, 'male').find((item) => item.topic === 'marriage')!;
  const female = buildTopicCandidates(chart, 'female').find((item) => item.topic === 'marriage')!;
  for (const palace of [...male.primaryPalaces, ...female.primaryPalaces]) assert.ok(unknown.primaryPalaces.includes(palace));
  assert.deepEqual(unknown.alternatives, [
    { rule: 'male', primaryPalaces: male.primaryPalaces, secondaryPalaces: male.secondaryPalaces },
    { rule: 'female', primaryPalaces: female.primaryPalaces, secondaryPalaces: female.secondaryPalaces },
  ]);
  assert.match(unknown.basis, /未指定性别/);
});

test('空天盘干不虚构六亲宫位', () => {
  const chart = generateQimen(new Date('2024-01-01T00:00:00Z'), 'zhuanpan');
  const center = chart.jiuGongGe.find((item) => item.gong === 5)!;
  assert.equal(center.tianPan.stem, '');
  const candidates = buildTopicCandidates(chart, 'male');
  assert.ok(candidates.every((item) => !item.primaryPalaces.includes(5)));
});
