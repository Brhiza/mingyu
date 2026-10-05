import assert from 'node:assert/strict';
import test from 'node:test';
import type { QimenJiuGongGe } from '../packages/core/src/types/divination';
import { buildPalaceInsights } from '../packages/core/src/divination/algorithms/qimen/helpers/patterns';

function makePalace(door: string): QimenJiuGongGe {
  return {
    gong: 2,
    name: '坤二宫',
    direction: '西南',
    element: '土',
    tianPan: { star: '天芮', stem: '戊' },
    diPan: { stem: '己' },
    renPan: { door },
    shenPan: { god: '' },
  };
}

test('值使门只标示主事宫，凶门不会因当值被标为有利', () => {
  for (const door of ['伤门', '死门', '惊门']) {
    const insights = buildPalaceInsights({
      jiuGongGe: [makePalace(door)],
      zhiFu: '',
      zhiShi: door,
      patternTags: [],
    });
    assert.ok(
      insights.some((item) => item.level === '关注' && item.summary.includes(`值使（${door}）`)),
    );
    assert.ok(insights.some((item) => item.level === '风险'));
    assert.ok(!insights.some((item) => item.level === '有利'));
  }
});

test('值使临三吉门时保留吉门本身的有利判断', () => {
  const insights = buildPalaceInsights({
    jiuGongGe: [makePalace('生门')],
    zhiFu: '',
    zhiShi: '生门',
    patternTags: [],
  });
  assert.ok(insights.some((item) => item.level === '关注'));
  assert.ok(insights.some((item) => item.level === '有利' && item.summary.includes('生门')));
});
