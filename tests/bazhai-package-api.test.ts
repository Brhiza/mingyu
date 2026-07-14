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
  assert.equal(result.directionMeasurement.stability, '稳定');
  assert.equal(result.directionMeasurement.candidateDirections.length, 1);
  assert.equal(result.evidenceAnalysis.evidence.title, '八宅命宅方位与测量结构化证据');
  assert.match(result.evidenceAnalysis.promptText, /测量误差±0°/);
  assert.ok(result.housePalace);
  assert.equal(result.housePalace?.length, 8);
});

test('八宅测量应换算磁北并识别跨宅卦边界的不稳定候选', () => {
  const result = analyzeBaZhaiByDoorDegree({
    birthYear: 1990,
    gender: 'male',
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.equal(result.directionMeasurement.trueNorthDegree, 65);
  assert.equal(result.directionMeasurement.stability, '宅卦不稳定');
  assert.deepEqual(
    result.directionMeasurement.candidateDirections.map((item) => item.sitMountain),
    ['寅', '甲'],
  );
  assert.deepEqual(
    Array.from(
      new Set(result.directionMeasurement.candidateDirections.map((item) => item.houseGua)),
    ),
    ['艮', '震'],
  );
  assert.ok(
    result.directionMeasurement.candidateDirections.every((item) => item.housePalace.length === 8),
  );
  assert.deepEqual(
    result.directionMeasurement.candidateDirections.map((item) => item.match),
    ['相冲', '相合'],
  );
  assert.match(result.directionMeasurement.promptText, /磁偏角 1°/);
  assert.match(result.directionMeasurement.promptText, /不能只采用单一八宅盘|并列候选盘/);
  assert.ok(
    result.evidenceAnalysis.counterEvidence.some((item) =>
      item.includes('中心读数不能作为唯一宅卦主证'),
    ),
  );
});

test('八宅磁北读数缺少磁偏角时应拒绝生成伪精确坐向', () => {
  assert.throws(
    () =>
      analyzeBaZhaiByDoorDegree({
        birthYear: 1990,
        gender: 'male',
        doorToInteriorDegree: 90,
        northReference: 'magnetic',
      }),
    /必须提供当地磁偏角/,
  );
});
