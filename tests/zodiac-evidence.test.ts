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
