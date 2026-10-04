import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAstrolabeEvidence,
  generateAstrolabe,
  getEssentialDignity,
} from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput, AstrolabeData } from 'mingyu-core/types';
import { resolveTrueSolarBirthTime } from '../packages/core/src/calendar/true-solar-time';
import { formatAstrolabeForPrompt } from '../packages/core/src/prompt/astrolabe';

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

const fixedAstrolabe = generateAstrolabe(validInput);

function cloneFixedAstrolabe(): AstrolabeData {
  return structuredClone(fixedAstrolabe);
}

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
  assert.throws(() => generateAstrolabe({ ...validInput, second: '60' }), /出生秒需在 0-59 之间/);
  assert.throws(
    () => generateAstrolabe({ ...validInput, useTrueSolarTime: 'false' as never }),
    /useTrueSolarTime 必须是布尔值/,
  );
});

test('星盘可选秒数应贯穿现代星历、UTC和光照证据，省略时保持原有分钟口径', () => {
  const withoutSecond = cloneFixedAstrolabe();
  const withSecond = generateAstrolabe({ ...validInput, second: '37' });

  assert.equal(withoutSecond.birth.dateTime, '1995-05-20 12:30');
  assert.equal(withoutSecond.birth.second, undefined);
  assert.equal(withSecond.birth.dateTime, '1995-05-20 12:30:37');
  assert.equal(withSecond.birth.second, 37);
  assert.equal(withSecond.birth.standardDateTime, '1995-05-20 12:30:37');
  assert.equal(withSecond.solarIllumination.referenceLocalDateTime, '1995-05-20 12:30:37');
  assert.notEqual(
    withSecond.planets.find((item) => item.name === 'Sun')?.longitude,
    withoutSecond.planets.find((item) => item.name === 'Sun')?.longitude,
  );
});

test('星盘出生时区证据应以时分秒格式化固定历史偏移', () => {
  const data = cloneFixedAstrolabe();
  data.birth.timezone = 4 + (51 * 60 + 16) / 3600;
  delete data.evidenceAnalysis;

  const evidence = analyzeAstrolabeEvidence(data);
  const inputStep = evidence.calculationFact.steps.find((step) => step.stage === '输入固定');
  const inputEvidence = evidence.evidence.items.find(
    (item) => item.title === '星盘输入与计算链事实',
  );

  assert.match(inputStep?.promptText ?? '', /UTC\+04:51:16/);
  assert.match(inputEvidence?.detail ?? '', /UTC\+04:51:16/);
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
    /timezone 需在 UTC-12 到 UTC\+14 之间/,
  );
  assert.throws(
    () => generateAstrolabe({ ...validInput, locationName: 123 as never }),
    /星盘文本字段必须是字符串/,
  );
});

test('星盘底层算法应保留扩展计算点，不再只返回十大星体', () => {
  const result = cloneFixedAstrolabe();
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

test('星盘格局摘要应按名称去重并保留首次出现顺序', () => {
  const result = cloneFixedAstrolabe();

  assert.deepEqual(result.summary.patterns, [...new Set(result.summary.patterns)]);
  assert.equal(result.summary.patternBasis, 'ten-main-bodies-selected-aspects');
  const legacy = structuredClone(result);
  delete legacy.summary.patternBasis;
  legacy.summary.patterns = ['未经当前相位清单核验的旧格局'];
  const evidence = analyzeAstrolabeEvidence(legacy);
  assert.equal(
    evidence.distributionEvidenceFacts.find((fact) => fact.key === 'distribution:patterns')?.count,
    0,
  );
});

test('星盘真太阳时应保留校正秒数、透传证据并且不改写盘面', () => {
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

  const reference = resolveTrueSolarBirthTime({
    dateType: 'solar',
    year: 1995,
    month: 5,
    day: 20,
    hour: 12,
    minute: 30,
    second: 0,
    longitude: 116.4074,
    timezone: 8,
  });

  assert.notEqual(reference.correctedTime.second, 0);
  assert.equal(result.birth.trueSolarDateTime, reference.correctedDateTime.replace('T', ' '));

  const standard = cloneFixedAstrolabe();

  assert.equal(result.birth.dateTime, standard.birth.dateTime);
  assert.notEqual(result.birth.trueSolarDateTime, standard.birth.dateTime);
  assert.deepEqual(result.planets, standard.planets);
  assert.deepEqual(result.angles, standard.angles);
  assert.deepEqual(result.houses, standard.houses);
  assert.deepEqual(result.aspects, standard.aspects);
});

test('本命盘在线提示词只列盘面与时间事实，不带内部来源说明', () => {
  for (const input of [
    validInput,
    {
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
      useTrueSolarTime: true,
    },
  ]) {
    const evidence = (input === validInput ? cloneFixedAstrolabe() : generateAstrolabe(input))
      .evidenceAnalysis!;
    assert.match(evidence.promptText, /出生时刻太阳高度/);
    assert.doesNotMatch(evidence.promptText, /明御|Caelus|tyme4ts|来源：|计算方法：/);
    assert.ok(evidence.evidence.items.some((item) => item.source?.includes('Caelus')));
  }
});

test('星盘应返回筛选阈值内全部相位，不得只截取最强十二条', () => {
  const result = cloneFixedAstrolabe();

  assert.ok(result.aspects.length > 12);
  assert.equal(result.evidenceAnalysis?.aspectFacts.length, result.aspects.length);
  const selectionLimit = result.evidenceAnalysis?.limitationFacts.find(
    (fact) => fact.key === 'astrolabe:limitation:aspect-selection',
  );
  assert.match(selectionLimit?.promptText ?? '', /通过相位角、容许度与强度筛选的全部相位/);
  assert.doesNotMatch(result.evidenceAnalysis?.promptText ?? '', /只保留.*十二组相位/);
});

test('星盘结构化位置与相位应对应实际盘面', () => {
  const result = cloneFixedAstrolabe();
  const evidence = result.evidenceAnalysis;

  assert.ok(evidence);
  assert.deepEqual(evidence.primaryCoverageFact.actualRoles, ['太阳', '月亮', '上升', '天顶']);
  assert.deepEqual(
    evidence.primaryCoverageFact.primaryFactKeys,
    evidence.primaryPointFacts.map((item) => item.key),
  );
  assert.equal(
    evidence.positionFacts.length,
    result.planets.length + result.angles.length + result.houses.length,
  );
  assert.equal(evidence.aspectFacts.length, result.aspects.length);
  const stepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  const positionKeys = new Set(evidence.positionFacts.map((item) => item.key));
  assert.ok(
    evidence.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        positionKeys.has(item.body1PositionFactKey ?? '') &&
        positionKeys.has(item.body2PositionFactKey ?? '') &&
        item.positionFactKeys.every((key) => positionKeys.has(key)) &&
        typeof item.actualAngle === 'number' &&
        typeof item.exactAngle === 'number' &&
        typeof item.allowedOrb === 'number' &&
        item.allowedOrb > 0 &&
        item.orb <= item.allowedOrb &&
        item.normalizedOrbRatio >= 0 &&
        item.normalizedOrbRatio <= 1,
    ),
  );
  assert.ok(evidence.distributionEvidenceFacts.length > 0);
  assert.ok(
    evidence.distributionEvidenceFacts.every(
      (item) =>
        item.count === item.members.length &&
        item.memberPositionFactKeys.every((key) =>
          evidence.positionFacts.some((position) => position.key === key),
        ),
    ),
  );
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
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(evidence.promptText, /完整星体与计算点位置/);
  assert.match(evidence.promptText, /实际夹角.*精确角.*允许容许度.*距精确角偏差/);
  assert.match(evidence.promptText, /十二宫宫头/);
  assert.match(evidence.promptText, /元素模式与逆行分布/);
  assert.match(evidence.promptText, /出生地点太阳光照背景/);
  assert.doesNotMatch(evidence.promptText, /成功率|吉凶总分|能量分数[：=]\d/);
  assert.doesNotMatch(evidence.promptText, /命语|当前结果|工程|接口|API|MCP/);

  // 缺少等级与归一化比例的合法旧记录，按保留的偏差/容许度分级。
  for (const [deviation, allowedOrb, expected] of [
    [2.6667, 8, '中等'],
    [5.3333, 8, '中等'],
    [0.9999, 3, '紧密'],
    [1, 3, '紧密'],
    [1.0001, 3, '中等'],
    [1.9999, 3, '中等'],
    [2, 3, '中等'],
    [2.0001, 3, '宽松'],
  ] as const) {
    const legacy = cloneFixedAstrolabe();
    delete legacy.evidenceAnalysis;
    legacy.aspects = [
      {
        body1: '太阳',
        body2: '月亮',
        type: '合相',
        symbol: '☌',
        applying: null,
        exactAngle: 0,
        actualAngle: deviation,
        orb: deviation,
        allowedOrb,
      },
    ];
    const before = structuredClone(legacy);
    const restored = analyzeAstrolabeEvidence(legacy);
    assert.equal(restored.aspectFacts[0].closeness, expected, `${deviation}/${allowedOrb}`);
    assert.equal(
      restored.aspectFacts[0].normalizedOrbRatio,
      Number((deviation / allowedOrb).toFixed(4)),
    );
    assert.match(restored.aspectFacts[0].promptText, new RegExp(`${expected}等级`));
    assert.deepEqual(legacy, before);

    // 新本命保存的偏差只有两位、比例四位；缺等级时优先保留四位角的几何信息。
    legacy.aspects[0].orb = Number(deviation.toFixed(2));
    legacy.aspects[0].normalizedOrbRatio = Number((deviation / allowedOrb).toFixed(4));
    const rounded = analyzeAstrolabeEvidence(legacy);
    assert.equal(
      rounded.aspectFacts[0].closeness,
      expected,
      `保存舍入值${deviation}/${allowedOrb}`,
    );
    assert.equal(rounded.aspectFacts[0].normalizedOrbRatio, legacy.aspects[0].normalizedOrbRatio);
  }

  const explicit = cloneFixedAstrolabe();
  explicit.aspects = [
    {
      body1: '太阳',
      body2: '月亮',
      type: '合相',
      symbol: '☌',
      applying: null,
      orb: 0.99,
      allowedOrb: 3,
      normalizedOrbRatio: 0.34,
    },
  ];
  assert.equal(analyzeAstrolabeEvidence(explicit).aspectFacts[0].closeness, '中等');
  explicit.aspects[0].closeness = '宽松';
  explicit.aspects[0].actualAngle = 1;
  explicit.aspects[0].exactAngle = 0;
  assert.equal(analyzeAstrolabeEvidence(explicit).aspectFacts[0].closeness, '宽松');
});

test('旧星盘缺少相位几何量时不得反推伪精确字段', () => {
  const result = cloneFixedAstrolabe();
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
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.ok(evidence.calculationFact.missing.includes('完整相位几何量'));
  assert.equal(evidence.calculationFact.steps[3].status, '缺少记录');
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        item.status === '旧记录缺几何量' &&
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
  assert.equal(incompleteTimeEvidence.summaryFact.status, '证据链有缺口');
  assert.ok(incompleteTimeEvidence.calculationFact.missing.includes('真太阳时校正结果'));
  assert.ok(incompleteTimeEvidence.calculationFact.missing.includes('完整相位几何量'));
  assert.equal(incompleteTimeEvidence.calculationFact.steps[1].status, '缺少记录');
});

test('旧星盘缺少入相出相字段时保持未判定', () => {
  const legacy = cloneFixedAstrolabe();
  delete legacy.evidenceAnalysis;
  delete (legacy.aspects[0] as Partial<AstrolabeData['aspects'][number]>).applying;

  const evidence = analyzeAstrolabeEvidence(legacy);
  assert.equal(evidence.aspectFacts[0].phase, '未判定');
  assert.match(evidence.aspectFacts[0].promptText, /未判定/);
  assert.doesNotMatch(evidence.aspectFacts[0].promptText, /出相/);
});

test('星盘核心位置缺失时应给出覆盖事实且不得补造位置', () => {
  const result = cloneFixedAstrolabe();
  const partial = structuredClone(result) as AstrolabeData;
  delete partial.evidenceAnalysis;
  partial.planets = partial.planets.filter((item) => item.name !== 'Sun');
  partial.angles = partial.angles.filter((item) => item.name !== 'Ascendant');
  const evidence = analyzeAstrolabeEvidence(partial);

  assert.equal(evidence.primaryCoverageFact.status, '部分');
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.deepEqual(evidence.primaryCoverageFact.missingRoles, ['太阳', '上升']);
  assert.equal(evidence.primaryPointFacts.length, 2);
  assert.ok(
    evidence.primaryPointFacts.every((fact) =>
      evidence.positionFacts.some((position) => position.key === fact.positionFactKey),
    ),
  );
  assert.match(evidence.primaryCoverageFact.promptText, /不得补造缺失位置/);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '太阳月亮上升天顶覆盖',
    ),
  );
});

test('星盘缺少太阳光照资料时应保留缺失对象而不反推天文量', () => {
  const result = cloneFixedAstrolabe();
  const legacy = structuredClone(result) as AstrolabeData;
  delete legacy.evidenceAnalysis;
  delete legacy.solarIllumination;
  const evidence = analyzeAstrolabeEvidence(legacy);

  assert.equal(evidence.illuminationFact.status, '缺失');
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.deepEqual(evidence.illuminationFact.crossingFactKeys, []);
  assert.deepEqual(evidence.illuminationFacts, []);
  assert.match(evidence.illuminationFact.promptText, /不能补造太阳高度、方位、赤纬、均时差/);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '出生地点太阳光照背景缺失',
    ),
  );
});

test('星盘无相位、逆行和格局时应输出逐项反证与汇总', () => {
  const result = cloneFixedAstrolabe();
  const empty = structuredClone(result) as AstrolabeData;
  delete empty.evidenceAnalysis;
  empty.aspects = [];
  empty.summary.retrograde = [];
  empty.summary.patterns = [];
  const evidence = analyzeAstrolabeEvidence(empty);

  assert.deepEqual(
    evidence.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['主要相位', '未见'],
      ['逆行', '未见'],
      ['盘面格局', '未见'],
    ],
  );
  assert.equal(evidence.counterSummaryFact.status, '有未见项');
  assert.equal(evidence.counterSummaryFact.factKeys.length, 3);
  assert.deepEqual(evidence.counterEvidence, [
    '当前筛选范围内未见主要相位',
    '未见逆行星体',
    '未列十大星体格局',
  ]);
  assert.match(evidence.counterSummaryFact.promptText, /未见不等于不存在其他关系/);
});

test('星盘时区诊断应转为限制事实，明确固定偏移消歧后保持完整证据链', () => {
  const result = cloneFixedAstrolabe();
  const diagnosed = structuredClone(result) as AstrolabeData;
  delete diagnosed.evidenceAnalysis;
  diagnosed.birth.timezoneDiagnostics = ['历史时区存在回拨歧义，采用较早偏移。'];
  const evidence = analyzeAstrolabeEvidence(diagnosed);
  const timezoneFact = evidence.limitationFacts.find((item) => item.type === '时区诊断');

  assert.ok(timezoneFact);
  assert.equal(timezoneFact.promptText, diagnosed.birth.timezoneDiagnostics[0]);
  assert.deepEqual(timezoneFact.ownerFactKeys, [
    'astrolabe:calculation:input',
    'astrolabe:calculation:time',
  ]);
  assert.ok(timezoneFact.sources.length > 0);
  assert.equal(evidence.limitations[0], diagnosed.birth.timezoneDiagnostics[0]);

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
  assert.equal(ambiguous.birth.timezoneEvidence?.status, 'ambiguous');
  assert.equal(ambiguous.birth.timezoneEvidence?.ambiguityResolvedByFixedOffset, true);
  assert.equal(ambiguous.evidenceAnalysis?.summaryFact.status, '证据链完整');
  assert.equal(
    ambiguous.evidenceAnalysis?.evidence.items.find((item) => item.title === '历史时区映射与诊断')
      ?.level,
    '辅证',
  );
  assert.ok(
    ambiguous.evidenceAnalysis?.summaryFact.factKeys.includes(
      ambiguous.birth.timezoneEvidence?.summaryFact.key ?? '',
    ),
  );
});

test('星盘北交点相位应统一名称并兼容旧节点别名引用', () => {
  const result = cloneFixedAstrolabe();
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

test('星盘行星尊贵力量（Essential Dignities）应准确识别入庙、曜升、落陷与坠落', () => {
  assert.deepEqual(getEssentialDignity('Sun', 'Leo'), { dignity: 'domicile', label: '入庙' });
  assert.deepEqual(getEssentialDignity('Sun', 'Libra'), { dignity: 'fall', label: '坠落' });
  assert.deepEqual(getEssentialDignity('Sun', 'Aquarius'), { dignity: 'detriment', label: '落陷' });
  assert.deepEqual(getEssentialDignity('Sun', 'Aries'), { dignity: 'exaltation', label: '曜升' });
  assert.deepEqual(getEssentialDignity('Moon', 'Taurus'), { dignity: 'exaltation', label: '曜升' });
  assert.deepEqual(getEssentialDignity('Moon', 'Scorpio'), { dignity: 'fall', label: '坠落' });
  assert.deepEqual(getEssentialDignity('Mercury', 'Virgo'), {
    dignity: 'domicile',
    label: '入庙、曜升',
  });
  assert.deepEqual(getEssentialDignity('Mercury', 'Pisces'), {
    dignity: 'detriment',
    label: '落陷、坠落',
  });
  assert.equal(getEssentialDignity('Sun', 'Taurus'), null);

  const result = cloneFixedAstrolabe();
  const sun = result.planets.find((p) => p.name === 'Sun');
  assert.ok(sun);
  assert.ok('dignity' in sun);

  for (const [month, day, sign, dignity, label] of [
    ['2', '25', '双鱼座', 'detriment', '落陷、坠落'],
    ['9', '15', '处女座', 'domicile', '入庙、曜升'],
  ] as const) {
    const chart = generateAstrolabe({ ...validInput, year: '2024', month, day });
    const mercury = chart.planets.find((point) => point.name === 'Mercury');
    assert.ok(mercury);
    assert.equal(mercury.sign, sign);
    assert.equal(mercury.dignity, dignity);
    assert.equal(mercury.dignityLabel, label);
    assert.match(formatAstrolabeForPrompt(chart), new RegExp(`水星${sign}[^\\n]+，${label}`));
  }
});
