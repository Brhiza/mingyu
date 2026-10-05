import assert from 'node:assert/strict';
import test from 'node:test';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';

test('从财取用及解释遵循同一主线，不混入普通身弱的水木扶身提示', () => {
  const result = determineUsefulGod(
    '极弱',
    { pattern: '从财格', isSpecial: true },
    '木',
    '未',
    undefined,
    '甲',
  );
  assert.deepEqual(result.favorableWuxing, ['土', '火']);
  assert.deepEqual(result.unfavorableWuxing, ['水', '木']);
  assert.deepEqual(result.decisionEvidence?.climateCandidates, []);
  assert.ok(result.strategyTrace.includes('从财格取财星顺势、食伤生财，忌印比扶身'));
  assert.doesNotMatch(result.strategyTrace.join('；'), /以水木扶助为基础|病药提示/);
  assert.deepEqual(
    result.matchedRules?.map((rule) => rule.id),
    ['follow-wealth'],
  );
});

test('普通甲木未月身弱仍保留水木扶身与丁庚条件提示', () => {
  const result = determineUsefulGod(
    '身弱',
    { pattern: '正财格', isSpecial: false },
    '木',
    '未',
    undefined,
    '甲',
  );
  assert.deepEqual(result.favorableWuxing, ['水', '木']);
  assert.match(result.strategyTrace.join('；'), /身弱时以水木扶助为基础/);
  assert.ok(result.matchedRules?.some((rule) => rule.id === 'wei-month-jia-ding-geng'));
});

test('未知旺衰或缺少规则的特殊格局不能静默生成泄耗克喜忌', () => {
  assert.throws(
    () => determineUsefulGod('未知', { pattern: '正财格', isSpecial: false }, '木'),
    /旺衰状态缺少取用规则/,
  );
  assert.throws(
    () => determineUsefulGod('身弱', { pattern: '未识别特殊格', isSpecial: true }, '木'),
    /特殊格局缺少取用规则/,
  );
  const neutral = determineUsefulGod('中和', { pattern: '正财格', isSpecial: false }, '木');
  assert.equal(neutral.primaryReason, '中和待判');
  assert.equal(neutral.incrementStatus, '待判');
  assert.deepEqual(neutral.favorableWuxing, []);
  assert.deepEqual(neutral.unfavorableWuxing, []);
  assert.ok(neutral.matchedRules?.some((rule) => rule.id === 'balance-neutral'));
});
