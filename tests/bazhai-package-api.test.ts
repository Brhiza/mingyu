import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeBaZhaiByDoorDegree, getBaZhaiSitFacingFromDoorDegree } from 'mingyu-core/bazhai';

test('mingyu-core/bazhai 应公开入户度数便捷接口和完整类型结果', () => {
  const position = getBaZhaiSitFacingFromDoorDegree(90);
  assert.equal(position.sit.degree, 90);
  assert.equal(position.facing.degree, 270);

  const result = analyzeBaZhaiByDoorDegree({
    birthYear: 1990,
    birthMonth: 6,
    birthDay: 15,
    gender: 'male',
    doorToInteriorDegree: 90,
  });
  assert.equal(result.directionMeasurement.sitMountain, '卯');
  assert.equal(result.directionMeasurement.facingMountain, '酉');
  assert.equal(result.directionMeasurement.method, '站在大门处面向屋内测量');
  assert.ok(result.housePalace);
  assert.equal(result.housePalace?.length, 8);
});
