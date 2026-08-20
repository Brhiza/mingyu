import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectDiseaseMedicine,
  detectTongguanNeed,
  getDrainWuxing,
} from '@core/bazi/baziEnhancement/useGodRules';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';
import type { PatternAnalysis } from '@core/bazi/baziTypes';

test('普通格局与特殊从格应走各自取用主线', () => {
  const regular = determineUsefulGod('身弱', { pattern: '偏财格', isSpecial: false }, '火');
  assert.deepEqual(regular.favorableWuxing, ['木', '火']);
  assert.deepEqual(regular.unfavorableWuxing, ['土', '金', '水']);
  assert.equal(regular.useful, '印星');

  const special = determineUsefulGod('极弱', { pattern: '从格', isSpecial: true }, '火');
  assert.deepEqual(special.favorableWuxing, ['土', '金', '水']);
  assert.deepEqual(special.unfavorableWuxing, ['木', '火']);
  assert.equal(special.useful, '食伤');
});

test('日干月令专用调候规则应优先于泛化扶抑', () => {
  const result = determineUsefulGod(
    '身弱',
    { pattern: '正官格', isSpecial: false },
    '木',
    '酉',
    undefined,
    '甲',
  );

  assert.equal(result.favorableWuxing?.[0], '火');
  assert.equal(result.primaryReason, '调候');
  assert.ok(result.matchedRules?.some((rule) => rule.id === 'you-month-jia-fire-forge'));
});

test('用神策略应拒绝非法五行和干支', () => {
  const pattern: PatternAnalysis = { pattern: '正官格', isSpecial: false };

  assert.throws(() => determineUsefulGod('身弱', pattern, '风'), /日主五行无效/);
  assert.throws(() => determineUsefulGod('身弱', pattern, '木', '不存在'), /月支无效/);
  assert.throws(
    () => determineUsefulGod('身弱', pattern, '木', '寅', '不存在'),
    /月令司权天干无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        visibleStems: ['甲', '不存在'],
      }),
    /明透天干无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        wuxingCounts: { 木: 1, 未知: 1 },
      }),
    /五行统计五行无效/,
  );
});

test('病药与通关规则应拒绝非法五行', () => {
  const pattern: PatternAnalysis = { pattern: '正官格', isSpecial: false };

  assert.equal(getDrainWuxing('土'), '金');
  assert.throws(() => getDrainWuxing('风'), /泄化五行无效/);
  assert.throws(
    () => detectDiseaseMedicine({ 木: 45, 风: 1 }, pattern, '身强'),
    /五行统计五行无效/,
  );
  assert.throws(() => detectTongguanNeed({ 木: 30, 金: 30 }, ['木'], ['风']), /忌用五行无效/);
});
