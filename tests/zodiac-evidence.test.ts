import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeZodiacEvidence } from '../packages/core/src/zodiac/evidence.ts';
import { getZodiacYearFortune } from '../packages/core/src/zodiac/index.ts';

test('生肖证据复验应标记缺失的犯太岁关系', () => {
  const complete = getZodiacYearFortune('子', '丙午');
  const analysis = analyzeZodiacEvidence({ ...complete, conflicts: [] });

  assert.deepEqual(
    complete.conflicts.map((conflict) => conflict.type),
    ['冲太岁'],
  );
  assert.equal(analysis.summaryFact.status, '证据链有缺口');
  assert.match(analysis.summaryFact.promptText, /犯太岁关系重算结果与传入资料不一致/);
  const conflict = analysis.relations.find((relation) => relation.relation === '冲太岁');
  assert.ok(conflict);
  assert.deepEqual(
    conflict.operands.map((operand) => operand.value),
    ['子', '午'],
  );
  assert.doesNotMatch(analysis.promptText, /冲太岁.*流年年支未/);
});

test('生肖证据复验应校验犯太岁关系的流年地支', () => {
  const complete = getZodiacYearFortune('子', '丙午');
  const analysis = analyzeZodiacEvidence({
    ...complete,
    conflicts: complete.conflicts.map((conflict) => ({ ...conflict, with: '未' })),
  });

  assert.equal(analysis.summaryFact.status, '证据链有缺口');
  assert.match(analysis.summaryFact.promptText, /犯太岁关系重算结果与传入资料不一致/);
});

test('生肖证据缺少无命中关系字段时应标明资料不足', () => {
  const complete = getZodiacYearFortune('子', '丙寅');
  const cases = [
    { field: 'conflicts', reason: /犯太岁关系/ },
    { field: 'noble', reason: /六合、三合与贵人关系/ },
    { field: 'meeting', reason: /三会关系/ },
  ];

  for (const { field, reason } of cases) {
    const incomplete = { ...complete } as unknown as Record<string, unknown>;
    delete incomplete[field];
    const analysis = analyzeZodiacEvidence(
      incomplete as Parameters<typeof analyzeZodiacEvidence>[0],
    );

    assert.equal(analysis.summaryFact.status, '证据链有缺口', field);
    assert.match(analysis.summaryFact.promptText, reason);
    assert.match(analysis.summaryFact.promptText, /不能按“未命中”处理/);
  }
});

test('生肖证据缺少已命中的合或三会资料时仍按地支重算并标记缺口', () => {
  const cases = [
    {
      result: getZodiacYearFortune('寅', '丙午'),
      field: 'noble',
      expected: '三合组成员关系（火局）',
    },
    {
      result: getZodiacYearFortune('巳', '丁未'),
      field: 'meeting',
      expected: '三会组成员关系（南方火）',
    },
  ];

  for (const { result, field, expected } of cases) {
    const incomplete = { ...result } as unknown as Record<string, unknown>;
    delete incomplete[field];
    const analysis = analyzeZodiacEvidence(
      incomplete as Parameters<typeof analyzeZodiacEvidence>[0],
    );

    assert.equal(analysis.summaryFact.status, '证据链有缺口', field);
    assert.ok(analysis.relations.some((relation) => relation.relation === expected));
    assert.match(analysis.summaryFact.promptText, /资料缺失/);
  }
});

test('生肖证据复验应校验说明与派生关系列表', () => {
  const complete = getZodiacYearFortune('子', '丙午');
  const cases = [
    {
      data: {
        ...complete,
        conflicts: complete.conflicts.map((conflict) => ({ ...conflict, desc: '自定义关系说明' })),
      },
      reason: /犯太岁关系重算结果与传入资料不一致/,
    },
    {
      data: { ...complete, favorableRelations: ['自定义有利关系'] },
      reason: /有利关系列表重算结果与传入资料不一致/,
    },
    {
      data: { ...complete, riskRelations: ['自定义风险关系'] },
      reason: /风险关系列表重算结果与传入资料不一致/,
    },
    {
      data: { ...complete, actionSignals: ['自定义行动提示'] },
      reason: /行动提示重算结果与传入资料不一致/,
    },
  ];

  for (const { data, reason } of cases) {
    const analysis = analyzeZodiacEvidence(data);
    assert.equal(analysis.summaryFact.status, '证据链有缺口');
    assert.match(analysis.summaryFact.promptText, reason);
  }
});

test('生肖证据复验应核对生肖名称、流年干支拆分与五行关系', () => {
  const complete = getZodiacYearFortune('子', '丙午');
  const cases = [
    {
      data: { ...complete, zodiac: '牛' },
      reason: /生肖名称与出生年支不一致/,
    },
    {
      data: { ...complete, yearGanZhi: '甲子' },
      reason: /流年干支与流年年支不一致/,
    },
    {
      data: {
        ...complete,
        relation: '年干五行与生肖地支本气同类',
        elementRelation: {
          ...complete.elementRelation,
          kind: '同类' as const,
          label: '年干五行与生肖地支本气同类',
          classification: '中性关系' as const,
        },
      },
      reason: /年干与生肖五行关系重算结果与传入资料不一致/,
    },
  ];
  for (const { data, reason } of cases) {
    const analysis = analyzeZodiacEvidence(data);
    assert.equal(analysis.summaryFact.status, '证据链有缺口');
    assert.match(analysis.summaryFact.promptText, reason);
    assert.equal(
      analysis.relations.find((relation) => relation.category === '年干五行')?.relation,
      getZodiacYearFortune(data.zodiacBranch, data.yearGanZhi).elementRelation.label,
    );
    assert.doesNotMatch(analysis.promptText, /结构化类型为同类/);
  }

  const wrongNoble = analyzeZodiacEvidence({
    ...getZodiacYearFortune('寅', '丙午'),
    noble: '六合贵人',
  });
  assert.equal(wrongNoble.summaryFact.status, '证据链有缺口');
  assert.equal(
    wrongNoble.relations.find((relation) => relation.category === '地支成员')?.relation,
    '三合组成员关系（火局）',
  );
  assert.doesNotMatch(wrongNoble.promptText, /六合贵人/);

  const wrongYearBranch = analyzeZodiacEvidence({
    ...getZodiacYearFortune('子', '丙午'),
    yearGanZhi: '甲子',
  });
  assert.equal(wrongYearBranch.summaryFact.status, '证据链有缺口');
  assert.ok(
    wrongYearBranch.relations.some(
      (relation) =>
        relation.relation === '值太岁' &&
        relation.operands.some((operand) => operand.label === '流年年支' && operand.value === '子'),
    ),
  );
  assert.doesNotMatch(wrongYearBranch.promptText, /冲太岁/);
});

test('生肖寅遇丙午只列两支同属火局，不把未核验的三合贵人或合作机会列为既成事实', () => {
  const result = getZodiacYearFortune('寅', '丙午');
  const relation = result.evidenceAnalysis.relations.find((item) => item.category === '地支成员');

  assert.equal(result.noble, '三合组成员关系（火局）');
  assert.equal(relation?.status, '两支同组');
  assert.equal(relation?.relation, '三合组成员关系（火局）');
  assert.match(result.prompt, /三合组成员：生肖年支寅与流年年支午同属火局，当前两支已知/);
  assert.match(result.prompt, /另一成员为戌，三支齐备及成化条件结合完整命盘核验/);
  assert.doesNotMatch(result.prompt, /三合贵人|合作或求助机会/);
  assert.match(result.evidenceAnalysis.promptText, /三合组成员关系（火局）/);
  assert.match(result.evidenceAnalysis.promptText, /当前可见两支；另一成员戌需结合完整四柱核验/);
  assert.doesNotMatch(result.evidenceAnalysis.promptText, /三合贵人/);
  assert.doesNotMatch(result.favorableRelations.join('、'), /三合/);
  assert.doesNotMatch(result.actionSignals.join('、'), /合作或求助机会/);
  assert.match(
    relation?.promptText ?? '',
    /当前可见两支；另一成员戌需结合完整四柱核验三支齐备及成化条件/,
  );
});

test('生肖巳遇丁未只列两支同属南方火三会组，不标为已会局', () => {
  const result = getZodiacYearFortune('巳', '丁未');
  const relation = result.evidenceAnalysis.relations.find(
    (item) => item.relation === '三会组成员关系（南方火）',
  );

  assert.equal(result.meeting, '三会组成员关系（南方火）');
  assert.equal(relation?.category, '地支成员');
  assert.equal(relation?.status, '两支同组');
  assert.match(result.prompt, /三会组成员：巳、午、未为一组，本次可见巳、未两支；另一成员午/);
  assert.doesNotMatch(result.prompt, /三会关系：|完整三会成局|三会贵人/);
  assert.match(result.evidenceAnalysis.promptText, /三会组成员关系（南方火）/);
  assert.match(result.evidenceAnalysis.promptText, /当前可见两支；另一成员午需结合完整四柱核验/);
  assert.doesNotMatch(result.evidenceAnalysis.promptText, /已命中.*三会/);
  assert.doesNotMatch(result.favorableRelations.join('、'), /三会/);
  assert.doesNotMatch(result.actionSignals.join('、'), /合作或求助机会/);
  assert.match(
    relation?.promptText ?? '',
    /同属南方火三会组，当前可见两支；另一成员午需结合完整四柱核验三支齐备及成化条件/,
  );
});

test('生肖五行五类关系的证据复验保持完整', () => {
  for (const [branch, yearGanZhi] of [
    ['子', '庚午'],
    ['子', '甲午'],
    ['寅', '庚午'],
    ['子', '丙午'],
    ['子', '壬午'],
  ]) {
    const result = getZodiacYearFortune(branch, yearGanZhi);
    assert.equal(
      result.evidenceAnalysis.summaryFact.status,
      '证据链完整',
      `${branch}/${yearGanZhi}`,
    );
  }
});
