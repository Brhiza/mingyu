import assert from 'node:assert/strict';
import test from 'node:test';

import { generateJinkoujue } from '../packages/core/src/divination/algorithms/jinkoujue.ts';
import { formatDivinationInfo } from '../packages/core/src/prompt/divination.ts';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';

const formatters = [
  formatDivinationInfo,
  formatDetailedDivinationInfo,
  formatEnhancedDivinationInfo,
];

test('金口诀三种提示资料均保留兄弟动的实际双方而非凭名称补判', () => {
  const data = generateJinkoujue({
    customDate: new Date('2026-05-19T10:30:00+08:00'),
    method: 'time',
  });
  assert.equal(data.positions.renYuan.element, '火');
  assert.equal(data.positions.diFen.element, '火');
  assert.equal(data.positions.jiangShen.element, '金');
  for (const format of formatters) {
    const text = format('jinkoujue', data);
    assert.match(text, /兄弟动（人元火比和地分火）/);
    assert.match(text, /人元火与地分火比和/);
    assert.match(text, /地分火克将神金/);
    assert.match(text, /三动取法：地分生人元为父母动；人元生地分为子孙动；人元与地分比和为兄弟动/);
    assert.match(
      text,
      /五动取法：人元克地分为妻动；贵神克人元为官动；贵神克将神为贼动；将神克贵神为财动；地分克人元为鬼动/,
    );
    assert.doesNotMatch(text, /贵人被生|将神金与地分火比和/);
  }
});

test('金口诀古本算例关系沿用人元干与贵神本属并明确被生的施受方向', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 9,
    customDate: new Date('2020-03-24T12:00:00+08:00'),
  });
  assert.equal(data.positions.renYuan.branch, '申');
  assert.equal(data.positions.renYuan.element, '火');
  assert.equal(data.positions.guiShen.stem, '戊');
  assert.equal(data.positions.guiShen.element, '水');
  for (const format of formatters) {
    const text = format('jinkoujue', data);
    assert.match(text, /贵神水与将神水比和/);
    assert.match(text, /贵神水克人元火/);
    assert.match(text, /地分金生将神水/);
    assert.match(text, /人元火克地分金/);
    assert.match(text, /地分金生贵神水/);
    assert.match(text, /妻动（人元火克地分金）/);
    assert.match(text, /官动（贵神水克人元火）/);
  }
});
