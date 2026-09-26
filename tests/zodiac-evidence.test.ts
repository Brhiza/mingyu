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
  }
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
