import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFortuneModalDetailOptionActive,
  isFortuneModalParentOptionActive,
} from '@core/bazi/fortuneModalSelection';

test('本命状态下不应预选任何大运项', () => {
  assert.equal(isFortuneModalDetailOptionActive('dayun', 'natal'), false);
});

test('选择大运时，流年排只能高亮“大运”，不能同时高亮某个流年', () => {
  assert.equal(isFortuneModalParentOptionActive('year', 'dayun'), true);
  assert.equal(isFortuneModalDetailOptionActive('year', 'dayun'), false);
});

test('选择流年时，流月排只能高亮“流年”，不能同时高亮某个流月', () => {
  assert.equal(isFortuneModalParentOptionActive('month', 'year'), true);
  assert.equal(isFortuneModalDetailOptionActive('month', 'year'), false);
});

test('选择流月时，流日排只能高亮“流月”，不能同时高亮某个流日', () => {
  assert.equal(isFortuneModalParentOptionActive('day', 'month'), true);
  assert.equal(isFortuneModalDetailOptionActive('day', 'month'), false);
});
