import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAstrolabeEvidence,
  generateAstrolabe,
  rebuildAuditedAstrolabeData,
} from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput, AstrolabeData } from 'mingyu-core/types';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

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
  assert.throws(() => generateAstrolabe(null as never), /星盘生成参数必须是对象/);
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
  assert.throws(
    () => generateAstrolabe({ ...validInput, gender: '未知' as never }),
    /星盘性别只能是男、女或空字符串/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, timeZoneId: 8 as never }),
    /星盘文本字段必须是字符串/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, useTrueSolarTime: 'false' as never }),
    /星盘真太阳时开关必须是布尔值/,
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

test('星盘真太阳时应透传统一校正证据并纳入总汇总', () => {
  const result = generateAstrolabe({ ...validInput, useTrueSolarTime: true });
  const evidence = result.birth.trueSolarEvidence;

  assert.ok(evidence);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.calculationChain.length, evidence.calculationSteps.length);
  assert.equal(result.evidenceAnalysis?.trueSolarTimeFact?.key, evidence.key);
  assert.ok(result.evidenceAnalysis?.summaryFact.factKeys.includes(evidence.summaryFact.key));
  assert.match(result.evidenceAnalysis?.promptText ?? '', /真太阳时校正证据/);
  assert.match(
    result.evidenceAnalysis?.promptText ?? '',
    /民用出生时间.*进入现代星历.*仅作为传统时间参考/,
  );
  assert.doesNotMatch(result.evidenceAnalysis?.promptText ?? '', /真太阳时.*进入星盘计算/);
});

test('现代星盘不得用真太阳时改写实际出生瞬间和盘面', () => {
  const standard = generateAstrolabe(validInput);
  const withTrueSolarEvidence = generateAstrolabe({ ...validInput, useTrueSolarTime: true });

  assert.equal(withTrueSolarEvidence.birth.dateTime, standard.birth.dateTime);
  assert.notEqual(withTrueSolarEvidence.birth.trueSolarDateTime, standard.birth.dateTime);
  assert.deepEqual(withTrueSolarEvidence.planets, standard.planets);
  assert.deepEqual(withTrueSolarEvidence.angles, standard.angles);
  assert.deepEqual(withTrueSolarEvidence.houses, standard.houses);
  assert.deepEqual(withTrueSolarEvidence.aspects, standard.aspects);
});

test('星盘应完整穷举全部选定点对，不按派生强度筛选或截断', () => {
  const result = generateAstrolabe(validInput);
  const calculation = result.aspectCalculation;
  const boundaryAspect = result.aspects.find(
    (item) => item.body1 === '太阳' && item.body2 === '土星' && item.type === '六合',
  );

  assert.ok(calculation);
  assert.equal(calculation.enumeration, '完整穷举');
  assert.equal(calculation.selectedPointNames.length, 24);
  assert.equal(calculation.aspectDefinitions.length, 10);
  assert.equal(calculation.evaluatedPairCount, 276);
  assert.equal(calculation.matchedAspectCount, result.aspects.length);
  assert.ok(result.aspects.length > 12);
  assert.equal(result.evidenceAnalysis?.aspectFacts.length, result.aspects.length);
  assert.ok(boundaryAspect);
  assert.equal(boundaryAspect.actualAngle, 65.7523);
  assert.equal(boundaryAspect.orb, 5.75);
  assert.equal(boundaryAspect.allowedOrb, 6);
  assert.ok(
    result.aspects.every(
      (item) => !('strength' in item) && !('closeness' in item) && !('normalizedOrbRatio' in item),
    ),
  );
  assert.match(
    result.evidenceAnalysis?.promptText ?? '',
    /穷举276组无序点对.*不按派生强度筛选或截断/,
  );
  assert.ok(
    (result.evidenceAnalysis?.promptText ?? '').includes(
      result.evidenceAnalysis?.aspectFacts.at(-1)?.promptText ?? '不会命中',
    ),
  );
});

test('星盘应返回可复用的位置、相位、计算链与限制证据', () => {
  const result = generateAstrolabe(validInput);
  const evidence = result.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'astrolabe:evidence');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.evidence.title, '西方星盘位置与相位结构化证据');
  assert.equal(evidence.calculationFact.status, '完整');
  assert.equal(evidence.calculationFact.steps.length, 5);
  assert.strictEqual(evidence.calculationSteps, evidence.calculationFact.steps);
  assert.deepEqual(
    evidence.calculationFact.steps.map((item) => item.stage),
    ['输入固定', '时间处理', '盘面计算', '相位筛选', '分布汇总'],
  );
  assert.ok(
    evidence.calculationFact.steps.every(
      (item) =>
        item.key &&
        item.promptText &&
        item.sources.length > 0 &&
        Array.isArray(item.dependsOnStepKeys) &&
        item.limitation.includes('单个计算步骤'),
    ),
  );
  assert.match(evidence.calculationFact.limitation, /不证明占星解释有效性/);
  assert.ok(evidence.calculationChain.some((item) => item.includes('Placidus')));
  assert.ok(evidence.primaryFacts.some((item) => item.includes('太阳')));
  assert.equal(evidence.primaryCoverageFact.status, '完整');
  assert.deepEqual(evidence.primaryCoverageFact.actualRoles, ['太阳', '月亮', '上升', '天顶']);
  assert.equal(evidence.primaryPointFacts.length, 4);
  assert.deepEqual(
    evidence.primaryCoverageFact.primaryFactKeys,
    evidence.primaryPointFacts.map((item) => item.key),
  );
  assert.equal(
    evidence.positionFacts.length,
    result.planets.length + result.angles.length + result.houses.length,
  );
  assert.equal(evidence.aspectFacts.length, result.aspects.length);
  assert.ok(
    evidence.positionFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.promptText &&
        item.sources.length >= 2 &&
        item.limitation.includes('不单独证明人格'),
    ),
  );
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        item.status === '几何完整' &&
        item.body1PositionFactKey &&
        item.body2PositionFactKey &&
        item.positionFactKeys.length >= 2 &&
        item.sources.length >= 2 &&
        typeof item.actualAngle === 'number' &&
        typeof item.exactAngle === 'number' &&
        typeof item.allowedOrb === 'number' &&
        item.allowedOrb > 0 &&
        item.orb <= item.allowedOrb &&
        !('closeness' in item) &&
        !('normalizedOrbRatio' in item) &&
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
        item.memberPositionFactKeys.every((key) =>
          evidence.positionFacts.some((position) => position.key === key),
        ) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不代表能量分数'),
    ),
  );
  assert.ok(evidence.distributionFacts.some((item) => item.includes('逆行点')));
  assert.ok(evidence.illuminationFacts.some((item) => item.includes('太阳高度')));
  assert.equal(evidence.illuminationFact.status, '可用');
  assert.equal(evidence.illuminationFact.crossingFactKeys.length, 4);
  assert.equal(evidence.counterEvidenceFacts.length, 3);
  assert.ok(['有未见项', '全部有可列资料'].includes(evidence.counterSummaryFact.status));
  assert.ok(evidence.supportingFacts.length > 0);
  assert.ok(evidence.limitations.some((item) => item.includes('不代表事件概率')));
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.ok(evidence.limitationFacts.length >= 5);
  assert.equal(evidence.summaryFact.key, 'astrolabe:evidence-summary');
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.primaryFactCount, evidence.primaryPointFacts.length);
  assert.equal(evidence.summaryFact.positionFactCount, evidence.positionFacts.length);
  assert.equal(evidence.summaryFact.aspectFactCount, evidence.aspectFacts.length);
  assert.equal(
    evidence.summaryFact.distributionFactCount,
    evidence.distributionEvidenceFacts.length,
  );
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.key &&
        item.status === '适用' &&
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.sources.length > 0 &&
        item.promptText,
    ),
  );
  assert.ok(evidence.methodology.some((item) => item.includes('输入精度边界')));
  assert.ok(evidence.methodology.some((item) => item.includes('不生成候选出生时间')));
  assert.ok(evidence.methodology.every((item) => !item.includes('输入敏感性')));
  assert.match(evidence.promptText, /【西方星盘位置与相位结构化证据】/);
  assert.match(evidence.promptText, /完整星体与计算点位置/);
  assert.match(evidence.promptText, /实际夹角.*精确角.*采用容许度.*距精确角偏差/);
  assert.match(evidence.promptText, /十二宫宫头/);
  assert.match(evidence.promptText, /元素模式与逆行分布/);
  assert.match(evidence.promptText, /出生地点太阳光照背景/);
  assert.match(evidence.promptText, /证据汇总：[\s\S]*解释限制（方法限制）：/);
  assert.doesNotMatch(evidence.promptText, /成功率|吉凶总分|能量分数[：=]\d/);
  assert.doesNotMatch(evidence.promptText, /紧密等级|中等等级|宽松等级|归一化容许度/);
  assert.doesNotMatch(evidence.promptText, /命语|当前结果|工程|接口|API|MCP/);
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('星盘公开证据与重建应忽略全部派生盘面污染', () => {
  const result = generateAstrolabe(validInput);
  const polluted = structuredClone(result) as AstrolabeData;
  polluted.birth.name = '污染姓名';
  polluted.birth.dateTime = '2099-12-31 23:59';
  polluted.birth.timezone = -12;
  polluted.birth.timezoneDiagnostics = ['注入诊断'];
  polluted.planets = [];
  polluted.angles = [];
  polluted.houses = [];
  polluted.aspects = [];
  polluted.aspectCalculation = undefined;
  polluted.solarIllumination = undefined;
  polluted.summary = { elements: {}, modalities: {}, retrograde: [], patterns: [] };
  polluted.timestamp = 0;
  polluted.evidenceAnalysis = undefined;

  assert.deepEqual(rebuildAuditedAstrolabeData(polluted), result);
  assert.deepEqual(analyzeAstrolabeEvidence(polluted), result.evidenceAnalysis);
});

test('星盘旧结果缺少可信来源或来源非法时应失败关闭', () => {
  const legacy = structuredClone(generateAstrolabe(validInput)) as Partial<AstrolabeData>;
  delete legacy.generation;
  assert.throws(() => rebuildAuditedAstrolabeData(legacy as AstrolabeData), /缺少可信原始出生输入/);
  assert.throws(() => analyzeAstrolabeEvidence(legacy as AstrolabeData), /缺少可信原始出生输入/);

  const invalidTimestamp = generateAstrolabe(validInput);
  invalidTimestamp.generation.timestamp = -1;
  assert.throws(() => rebuildAuditedAstrolabeData(invalidTimestamp), /有效的非负毫秒时间戳/);

  const invalidBoolean = generateAstrolabe(validInput);
  invalidBoolean.generation.input.useTrueSolarTime = 'false' as never;
  assert.throws(() => rebuildAuditedAstrolabeData(invalidBoolean), /必须是布尔值/);
});

test('星盘应保存原始固定时区与 IANA 时区供历史偏移重算', () => {
  const ambiguous = generateAstrolabe({
    ...validInput,
    year: '2024',
    month: '11',
    day: '3',
    hour: '1',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.006',
    timezone: '-4',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });

  assert.equal(ambiguous.generation.input.timezone, '-4');
  assert.equal(ambiguous.generation.input.timeZoneId, 'America/New_York');
  assert.equal(ambiguous.birth.timezoneEvidence?.status, 'ambiguous');
  assert.equal(ambiguous.evidenceAnalysis?.summaryFact.status, '证据链有缺口');
  assert.ok(
    ambiguous.evidenceAnalysis?.summaryFact.factKeys.includes(
      ambiguous.birth.timezoneEvidence?.summaryFact.key ?? '',
    ),
  );
});

test('星盘北交点相位应统一名称并兼容旧节点别名引用', () => {
  const result = generateAstrolabe(validInput);
  assert.ok(result.aspects.every((item) => !/True|Mean/.test(`${item.body1}${item.body2}`)));
  const nodeAspectIndex = result.aspects.findIndex(
    (item) => item.body1 === '北交点' || item.body2 === '北交点',
  );
  assert.notEqual(nodeAspectIndex, -1);

  const legacy = structuredClone(result) as AstrolabeData;
  delete legacy.evidenceAnalysis;
  if (legacy.aspects[nodeAspectIndex].body1 === '北交点') {
    legacy.aspects[nodeAspectIndex].body1 = 'True North Node';
  } else {
    legacy.aspects[nodeAspectIndex].body2 = 'True North Node';
  }
  const evidence = analyzeAstrolabeEvidence(legacy);
  const fact = evidence.aspectFacts[nodeAspectIndex];

  assert.ok(fact.positionFactKeys.includes('星体与计算点:North Node'));
  assert.ok(fact.body1PositionFactKey || fact.body2PositionFactKey);
});
