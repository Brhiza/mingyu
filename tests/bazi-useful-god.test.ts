import test from 'node:test'
import assert from 'node:assert/strict'

import { determineUsefulGod } from '../src/utils/bazi/baziUsefulGodStrategy'
import type { PatternAnalysis } from '../src/utils/bazi/baziTypes'

test('普通偏财格但身弱时，喜忌仍先按扶抑取印比', () => {
  const pattern: PatternAnalysis = {
    pattern: '偏财格',
    isSpecial: false
  }

  const result = determineUsefulGod('身弱', pattern, '火')

  assert.deepEqual(result.favorableWuxing, ['木', '火'])
  assert.deepEqual(result.unfavorableWuxing, ['土', '金', '水'])
  assert.equal(result.useful, '正印')
  assert.equal(result.avoid, '食神')
  assert.match(result.strategyTrace?.[0] || '', /普通格局:偏财格，喜忌先按身弱扶抑/)
  assert.ok(result.strategyTrace?.includes('身弱取印比'))
  assert.ok(!result.unfavorable.includes('正印'))
  assert.ok(!result.unfavorable.includes('偏印'))
  assert.ok(!result.unfavorable.includes('比肩'))
  assert.ok(!result.unfavorable.includes('劫财'))
})

test('特殊从格仍按从势规则，不受普通扶抑逻辑干扰', () => {
  const pattern: PatternAnalysis = {
    pattern: '从格',
    isSpecial: true
  }

  const result = determineUsefulGod('极弱', pattern, '火')

  assert.deepEqual(result.favorableWuxing, ['土', '金', '水'])
  assert.deepEqual(result.unfavorableWuxing, ['木', '火'])
  assert.equal(result.useful, '食神')
  assert.equal(result.avoid, '正印')
  assert.ok(result.strategyTrace?.includes('从格从势取用'))
  assert.ok(!result.strategyTrace?.some(trace => trace.includes('普通格局')))
})
