import test from 'node:test';
import assert from 'node:assert/strict';

import { getNineStarProfile } from '@core/direction';
import {
  assertEarthlyBranch,
  assertGanZhiPair,
  assertHeavenlyStem,
  assertValidGanZhi,
  assertWuxing,
  isEarthlyBranch,
  isGanZhiPair,
  isHeavenlyStem,
  isKe,
  isLiuhe,
  isSanxing,
  isSheng,
  isValidGanZhi,
  isWuxing,
} from '@core/ganzhi';

test('公共干支校验应共用合法值并识别六十甲子配对', () => {
  assert.equal(isHeavenlyStem('甲'), true);
  assert.equal(isHeavenlyStem('子'), false);
  assert.equal(isEarthlyBranch('子'), true);
  assert.equal(isEarthlyBranch('甲'), false);
  assert.equal(isWuxing('木'), true);
  assert.equal(isWuxing('风'), false);
  assert.equal(isValidGanZhi('甲子'), true);
  assert.equal(isValidGanZhi('甲丑'), false);
  assert.equal(isGanZhiPair('甲', '子'), true);
  assert.equal(isGanZhiPair('甲', '丑'), false);

  assert.doesNotThrow(() => assertHeavenlyStem('癸'));
  assert.doesNotThrow(() => assertEarthlyBranch('亥'));
  assert.doesNotThrow(() => assertWuxing('水'));
  assert.doesNotThrow(() => assertValidGanZhi('癸亥'));
  assert.doesNotThrow(() => assertGanZhiPair('癸', '亥'));
});

test('关系判断应拒绝非法五行和地支，不再把输入错误当成关系不成立', () => {
  assert.throws(() => isSheng('风', '木'), /生方五行无效/);
  assert.throws(() => isKe('木', '风'), /受克方五行无效/);
  assert.throws(() => isLiuhe('未知', '子'), /第一个地支无效/);
  assert.throws(() => isSanxing('', '子'), /第一个地支无效/);
});

test('九星索引只接受 0-8 的整数', () => {
  assert.equal(getNineStarProfile(0).number, '一');
  assert.equal(getNineStarProfile(8).number, '九');
  [9, -1, 1.5, Number.NaN].forEach((index) => {
    assert.throws(() => getNineStarProfile(index), /九星索引必须是 0-8 之间的整数/);
  });
});
