import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMountainFromDegree,
  getSitFacingFromFacingDegree,
} from '../packages/core/src/direction/index.ts';

test('罗盘朝向度数应自动换算二十四山坐向', () => {
  assert.equal(getMountainFromDegree(0).mountain, '子');
  assert.equal(getMountainFromDegree(360).mountain, '子');
  assert.equal(getMountainFromDegree(90).mountain, '卯');
  assert.equal(getMountainFromDegree(225).mountain, '坤');

  const southFacing = getSitFacingFromFacingDegree(180);
  assert.equal(southFacing.facing.mountain, '午');
  assert.equal(southFacing.sit.mountain, '子');
  assert.equal(southFacing.label, '子山午向');
});

test('罗盘二十四山分界线应明确标记，不得静默当成普通度数', () => {
  const boundary = getMountainFromDegree(7.5);
  assert.equal(boundary.isBoundary, true);
  assert.deepEqual(boundary.boundaryMountains, ['子', '癸']);
  assert.equal(getMountainFromDegree(7.49).mountain, '子');
  assert.equal(getMountainFromDegree(7.51).mountain, '癸');
});

test('罗盘度数应拒绝越界和非有限数字', () => {
  assert.throws(() => getMountainFromDegree(-0.1), /罗盘度数需在 0 到 360 之间/);
  assert.throws(() => getMountainFromDegree(360.1), /罗盘度数需在 0 到 360 之间/);
  assert.throws(() => getMountainFromDegree(Number.NaN), /罗盘度数需在 0 到 360 之间/);
});
