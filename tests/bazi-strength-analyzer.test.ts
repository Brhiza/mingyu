import test from 'node:test'
import assert from 'node:assert/strict'

import { analyzeDayMasterStrength } from '../src/utils/bazi/baziStrengthAnalyzer'

test('无根失令但仍有帮扶时，不应直接判为极弱', () => {
  const result = analyzeDayMasterStrength(
    { status: '休囚', isTimely: false },
    { roots: [], totalStrength: 0, hasRoot: false, strongRoot: false },
    { supporters: [{ position: 'hour', stem: '丁', strength: 1 }], totalStrength: 1, hasSupport: true }
  )

  assert.equal(result.status, '身弱')
  assert.equal(result.score, 1)
  assert.equal(result.details.supportStrength, 1)
})

test('无根失令且无帮扶时，仍应判为极弱', () => {
  const result = analyzeDayMasterStrength(
    { status: '休囚', isTimely: false },
    { roots: [], totalStrength: 0, hasRoot: false, strongRoot: false },
    { supporters: [], totalStrength: 0, hasSupport: false }
  )

  assert.equal(result.status, '极弱')
  assert.equal(result.score, 0)
})
