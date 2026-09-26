import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  calculateNamingBirthContext,
} from '../packages/core/src/name-number/index.ts';

test('起名提示词省略中性水火摘要', () => {
  const birth = { gender: 'male' as const, year: 1995, month: 8, day: 15, timeIndex: 6 };
  const context = calculateNamingBirthContext(birth);
  assert.equal(context.climate?.nature, '未见明显偏向');
  const analysis = analyzeChineseName({ fullName: '李清和', birth });
  assert.doesNotMatch(buildChineseNameAnalysisPrompt({ analysis }), /水火分布参考：|寒暖分布：/);
});
