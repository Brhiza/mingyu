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
    northReference: 'true',
  });
  assert.equal(result.directionMeasurement.sitMountain, '卯');
  assert.equal(result.directionMeasurement.facingMountain, '酉');
  assert.equal(result.directionMeasurement.method, '站在大门处面向屋内测量');
  assert.equal(result.directionMeasurement.stability, '稳定');
  assert.equal(result.directionMeasurement.candidateDirections.length, 1);
  assert.equal(result.evidenceAnalysis.evidence.title, '八宅命宅方位与测量结构化证据');
  assert.equal(result.evidenceAnalysis.key, 'bazhai:evidence');
  assert.equal(result.evidenceAnalysis.status, '已计算');
  assert.equal(result.evidenceAnalysis.directionFacts.length, 8);
  assert.ok(
    result.evidenceAnalysis.directionFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.calculationStepKeys.length > 0 &&
        item.sources.length >= 2 &&
        item.calculation.includes('查大游年表') &&
        item.limitation.includes('不证明房间适用性'),
    ),
  );
  assert.match(result.evidenceAnalysis.promptText, /测量误差±0°/);
  assert.equal(result.evidenceAnalysis.counterSummaryFact.status, '未见额外反证');
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '命卦年界')?.status,
    '已核定',
  );
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '北向基准')?.status,
    '已覆盖',
  );
  assert.equal(result.evidenceAnalysis.limitationFacts.length, 6);
  assert.equal(result.evidenceAnalysis.summaryFact.key, 'bazhai:evidence-summary');
  assert.equal(result.evidenceAnalysis.summaryFact.status, '命宅链完整');
  assert.equal(
    result.evidenceAnalysis.summaryFact.directionFactCount,
    result.evidenceAnalysis.directionFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.alignedDirectionCount,
    result.evidenceAnalysis.alignedDirections.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.conflictingDirectionCount,
    result.evidenceAnalysis.conflictingDirections.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.measurementCandidateCount,
    result.evidenceAnalysis.measurementCandidateFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.counterEvidenceCount,
    result.evidenceAnalysis.counterEvidenceFacts.length,
  );
  assert.equal(
    result.evidenceAnalysis.summaryFact.limitationFactCount,
    result.evidenceAnalysis.limitationFacts.length,
  );
  const factKeys = new Set([
    result.evidenceAnalysis.summaryFact.key,
    ...result.evidenceAnalysis.summaryFact.factKeys,
  ]);
  assert.ok(
    result.evidenceAnalysis.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    result.evidenceAnalysis.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(result.evidenceAnalysis.promptText, /证据汇总：[\s\S]*解释限制：/);
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
  assert.deepEqual(
    result.evidenceAnalysis.measurementCandidates.map((item) => item.sitMountain),
    ['寅', '甲'],
  );
  assert.ok(
    result.evidenceAnalysis.evidence.items.some(
      (item) => item.title === '入户坐向测量宅卦不稳定' && item.level === '反证',
    ),
  );
  assert.match(result.evidenceAnalysis.promptText, /候选明细.*寅山申向.*甲山庚向/s);
  assert.match(result.directionMeasurement.promptText, /磁偏角 1°/);
  assert.match(result.directionMeasurement.promptText, /不能只采用单一八宅盘|并列候选盘/);
  assert.ok(
    result.evidenceAnalysis.counterEvidence.some((item) =>
      item.includes('中心读数不能作为唯一宅卦主证'),
    ),
  );
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '山向边界稳定性')
      ?.status,
    '边界敏感',
  );
  assert.equal(
    result.evidenceAnalysis.counterEvidenceFacts.find((item) => item.type === '宅卦边界稳定性')
      ?.status,
    '不稳定',
  );
  assert.equal(result.evidenceAnalysis.counterSummaryFact.status, '存在需保留反证');
  assert.ok(result.evidenceAnalysis.counterSummaryFact.factKeys.length >= 2);
  assert.equal(result.evidenceAnalysis.summaryFact.status, '证据链有缺口');
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
