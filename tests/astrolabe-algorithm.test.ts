import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAstrolabeEvidence, generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput, AstrolabeData } from 'mingyu-core/types';

const validInput: AstrolabeBirthInput = {
  name: '本人',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

test('星盘底层算法应拒绝无效出生日期和时间', () => {
  assert.throws(
    () => generateAstrolabe({ ...validInput, year: ' ' }),
    /星盘需要填写有效的出生年份/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, year: 1995 as never }),
    /星盘需要填写有效的出生年份/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, hour: ' ' }),
    /星盘需要填写有效的出生小时/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, year: '1899' }),
    /出生年份需在 1900-2100 之间/,
  );
  assert.throws(() => generateAstrolabe({ ...validInput, month: '13' }), /出生月份需在 1-12 之间/);
  assert.throws(
    () => generateAstrolabe({ ...validInput, day: '31', month: '2' }),
    /日期需在 1-28 之间/,
  );
  assert.throws(() => generateAstrolabe({ ...validInput, hour: '24' }), /出生小时需在 0-23 之间/);
  assert.throws(() => generateAstrolabe({ ...validInput, minute: '60' }), /出生分钟需在 0-59 之间/);
});

test('星盘底层算法应拒绝越界经纬度和时区', () => {
  assert.throws(
    () => generateAstrolabe({ ...validInput, latitude: '100' }),
    /出生地纬度需在 -90 到 90 之间/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, longitude: '181' }),
    /出生地经度需在 -180 到 180 之间/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, timezone: '15' }),
    /时区需在 -12 到 14 之间/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, locationName: 123 as never }),
    /星盘文本字段必须是字符串/,
  );
});

test('星盘底层算法应保留扩展计算点，不再只返回十大星体', () => {
  const result = generateAstrolabe(validInput);
  const labels = result.planets.map((item) => item.label);

  assert.ok(result.planets.length > 10);
  assert.ok(labels.includes('凯龙星'));
  assert.ok(labels.includes('谷神星'));
  assert.ok(labels.includes('智神星'));
  assert.ok(labels.includes('婚神星'));
  assert.ok(labels.includes('灶神星'));
  assert.ok(labels.includes('北交点'));
  assert.ok(labels.includes('南交点'));
  assert.ok(labels.includes('莉莉丝'));
  assert.ok(labels.includes('福点'));
  assert.ok(labels.includes('精神点'));
});

test('星盘应返回可复用的位置、相位、计算链与限制证据', () => {
  const result = generateAstrolabe(validInput);
  const evidence = result.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.evidence.title, '西方星盘位置与相位结构化证据');
  assert.equal(evidence.calculationFact.status, '完整');
  assert.equal(evidence.calculationFact.steps.length, 5);
  assert.deepEqual(
    evidence.calculationFact.steps.map((item) => item.stage),
    ['输入固定', '时间处理', '盘面计算', '相位筛选', '分布汇总'],
  );
  assert.ok(
    evidence.calculationFact.steps.every(
      (item) => item.key && item.promptText && item.sources.length > 0,
    ),
  );
  assert.match(evidence.calculationFact.limitation, /不证明占星解释有效性/);
  assert.ok(evidence.calculationChain.some((item) => item.includes('Placidus')));
  assert.ok(evidence.primaryFacts.some((item) => item.includes('太阳')));
  assert.equal(
    evidence.positionFacts.length,
    result.planets.length + result.angles.length + result.houses.length,
  );
  assert.equal(evidence.aspectFacts.length, result.aspects.length);
  assert.ok(
    evidence.positionFacts.every(
      (item) =>
        item.promptText && item.sources.length >= 2 && item.limitation.includes('不单独证明人格'),
    ),
  );
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        typeof item.actualAngle === 'number' &&
        typeof item.exactAngle === 'number' &&
        typeof item.allowedOrb === 'number' &&
        item.allowedOrb > 0 &&
        item.orb <= item.allowedOrb &&
        item.normalizedOrbRatio >= 0 &&
        item.normalizedOrbRatio <= 1 &&
        item.promptText.includes('实际夹角') &&
        item.limitation.includes('不代表事件概率'),
    ),
  );
  assert.equal(evidence.planetFacts.length, result.planets.length);
  assert.equal(evidence.angleFacts.length, 4);
  assert.equal(evidence.houseFacts.length, 12);
  assert.equal(
    evidence.distributionEvidenceFacts.length,
    Object.keys(result.summary.elements).length + Object.keys(result.summary.modalities).length + 2,
  );
  assert.ok(
    evidence.distributionEvidenceFacts.every(
      (item) =>
        item.key.startsWith('distribution:') &&
        item.count === item.members.length &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不代表能量分数'),
    ),
  );
  assert.ok(evidence.distributionFacts.some((item) => item.includes('逆行点')));
  assert.ok(evidence.illuminationFacts.some((item) => item.includes('太阳高度')));
  assert.ok(evidence.supportingFacts.length > 0);
  assert.ok(evidence.limitations.some((item) => item.includes('不代表事件概率')));
  assert.ok(evidence.methodology.some((item) => item.includes('输入精度边界')));
  assert.ok(evidence.methodology.some((item) => item.includes('不生成候选出生时间')));
  assert.ok(evidence.methodology.every((item) => !item.includes('输入敏感性')));
  assert.match(evidence.promptText, /【西方星盘位置与相位结构化证据】/);
  assert.match(evidence.promptText, /完整星体与计算点位置/);
  assert.match(evidence.promptText, /实际夹角.*精确角.*允许容许度.*距精确角偏差/);
  assert.match(evidence.promptText, /十二宫宫头/);
  assert.match(evidence.promptText, /元素模式与逆行分布/);
  assert.match(evidence.promptText, /出生地点太阳光照背景/);
  assert.doesNotMatch(evidence.promptText, /成功率|吉凶总分|能量分数[：=]\d/);
});

test('旧星盘缺少相位几何量时不得反推伪精确字段', () => {
  const result = generateAstrolabe(validInput);
  const legacy = structuredClone(result) as AstrolabeData;
  delete legacy.evidenceAnalysis;
  for (const aspect of legacy.aspects) {
    delete aspect.actualAngle;
    delete aspect.exactAngle;
    delete aspect.allowedOrb;
    delete aspect.isOutOfSign;
  }

  const evidence = analyzeAstrolabeEvidence(legacy);
  assert.equal(evidence.calculationFact.status, '部分');
  assert.ok(evidence.calculationFact.missing.includes('完整相位几何量'));
  assert.equal(evidence.calculationFact.steps[3].status, '缺少记录');
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        item.actualAngle === undefined &&
        item.exactAngle === undefined &&
        item.allowedOrb === undefined &&
        item.promptText.includes('旧结果未记录实际夹角、精确角或允许容许度'),
    ),
  );
  legacy.birth.isTrueSolarTime = true;
  delete legacy.birth.trueSolarDateTime;
  const incompleteTimeEvidence = analyzeAstrolabeEvidence(legacy);
  assert.equal(incompleteTimeEvidence.calculationFact.status, '部分');
  assert.ok(incompleteTimeEvidence.calculationFact.missing.includes('真太阳时校正结果'));
  assert.ok(incompleteTimeEvidence.calculationFact.missing.includes('完整相位几何量'));
  assert.equal(incompleteTimeEvidence.calculationFact.steps[1].status, '缺少记录');
});
