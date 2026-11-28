import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDropdownPosition } from '../src/components/ui/select-utils';

test('computeDropdownPosition 默认向下展开并保持安全宽度与左右留边', () => {
  const pos = computeDropdownPosition(
    { top: 100, bottom: 140, left: 20, width: 180 },
    { width: 1280, height: 800 },
    240,
  );
  assert.equal(pos.placement, 'bottom');
  assert.equal(pos.top, 146);
  assert.equal(pos.left, 20);
  assert.equal(pos.minWidth, 180);
  assert.ok(pos.maxHeight <= 320 && pos.maxHeight >= 120);
});

test('computeDropdownPosition 底部空间不足且上方充足时自动向上翻转', () => {
  const pos = computeDropdownPosition(
    { top: 710, bottom: 750, left: 40, width: 200 },
    { width: 1280, height: 800 },
    260,
  );
  assert.equal(pos.placement, 'top');
  assert.equal(pos.bottom, 800 - 710 + 6);
  assert.equal(pos.top, undefined);
});

test('computeDropdownPosition 窄屏靠近右侧时向左夹紧不超出视口', () => {
  const pos = computeDropdownPosition(
    { top: 120, bottom: 160, left: 300, width: 140 },
    { width: 390, height: 844 },
    220,
  );
  assert.equal(pos.placement, 'bottom');
  assert.ok(pos.left + pos.minWidth <= 390 - 8);
  assert.ok(pos.left >= 8);
});
