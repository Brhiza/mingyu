import test from 'node:test';
import assert from 'node:assert/strict';

import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';
import { BASE_USEFUL_GOD_RULES } from '@core/bazi/baziUsefulGodRules';
import { analyzeUsefulGodPlacement } from '@core/bazi/usefulGodPlacement';
import {
  CLIMATE_RULES,
  STRENGTH_HINT_RULES,
  THERAPEUTIC_PRIORITY_RULES,
} from '@core/bazi/baziTherapeuticRules';
import type { PatternAnalysis } from '@core/bazi/baziTypes';

const expectedPendingResult = {
  favorable: [],
  unfavorable: [],
  primaryFavorable: [],
  secondaryFavorable: [],
  primaryUnfavorable: [],
  secondaryUnfavorable: [],
  useful: '',
  avoid: '',
  favorableWuxing: [],
  unfavorableWuxing: [],
  primaryFavorableWuxing: '',
  secondaryFavorableWuxing: [],
  primaryUnfavorableWuxing: '',
  secondaryUnfavorableWuxing: [],
  primaryUseful: '',
  primaryAvoid: '',
  strategyTrace: ['自动用神规则尚未完成逐条来源、版本与适用边界校勘，底层保留待定'],
  primaryReason: '取用待定',
  matchedRules: [],
};

test('未逐条校勘的用神、调候与病药规则应全部失败关闭', () => {
  assert.deepEqual(BASE_USEFUL_GOD_RULES, []);
  assert.deepEqual(CLIMATE_RULES, []);
  assert.deepEqual(STRENGTH_HINT_RULES, []);
  assert.deepEqual(THERAPEUTIC_PRIORITY_RULES, []);
});

test('用神入口应穷举旺衰、格局、五行、月支与日干并始终保留待定', () => {
  const strengths = ['极强', '身强', '偏强', '中和', '偏弱', '身弱', '极弱', '待综合判断'];
  const patterns: PatternAnalysis[] = [
    { pattern: '正官格', isSpecial: false },
    { pattern: '偏财格', isSpecial: false },
    { pattern: '建禄格', isSpecial: false },
    { pattern: '专旺格', isSpecial: true },
    { pattern: '从财格', isSpecial: true },
    { pattern: '从杀格', isSpecial: true },
    { pattern: '从儿格', isSpecial: true },
  ];
  const wuxings = ['木', '火', '土', '金', '水'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

  let checked = 0;
  for (const strength of strengths) {
    for (const pattern of patterns) {
      for (const wuxing of wuxings) {
        for (const branch of branches) {
          for (const stem of stems) {
            const result = determineUsefulGod(strength, pattern, wuxing, branch, stem, stem, {
              externalPatternEligible: true,
              yearStem: '甲',
              hourBranch: '子',
              currentJieqi: '立春',
              visibleStems: ['甲', '丙'],
              visibleStemSources: [{ pillar: 'year', stem: '甲' }],
              hiddenStems: ['癸'],
              hiddenStemSources: [{ pillar: 'month', branch: '子', stems: ['癸'] }],
              formationWuxings: ['水'],
              wuxingCounts: { 木: 1, 火: 1, 土: 0, 金: 0, 水: 2 },
            });
            assert.deepEqual(result, expectedPendingResult);
            checked += 1;
          }
        }
      }
    }
  }

  assert.equal(checked, 33600);
});

test('用神失败关闭仍应拒绝非法基础资料', () => {
  const pattern: PatternAnalysis = { pattern: '正官格', isSpecial: false };

  assert.throws(() => determineUsefulGod('身弱', pattern, '风'), /日主五行无效/);
  assert.throws(() => determineUsefulGod('身弱', pattern, '木', '不存在'), /月支无效/);
  assert.throws(
    () => determineUsefulGod('身弱', pattern, '木', '寅', '不存在'),
    /月令司权天干无效/,
  );
  assert.throws(
    () => determineUsefulGod('身弱', pattern, '木', '寅', undefined, '不存在'),
    /日主天干无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        externalPatternEligible: '是' as unknown as boolean,
      }),
    /外格资格标记无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        visibleStems: ['不存在'],
      }),
    /明透天干无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        hiddenStemSources: [{ pillar: 'month', branch: '不存在', stems: ['癸'] }],
      }),
    /month柱地支无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        formationWuxings: ['风'],
      }),
    /成局五行无效/,
  );
  assert.throws(
    () =>
      determineUsefulGod('身弱', pattern, '木', '寅', undefined, '甲', {
        wuxingCounts: { 木: Number.NaN },
      }),
    /五行统计数值无效/,
  );
});

test('旧用神落点入口即使收到完整喜忌也必须返回关闭状态', () => {
  const result = analyzeUsefulGodPlacement(
    [
      { gan: '甲', zhi: '子' },
      { gan: '丙', zhi: '寅' },
      { gan: '戊', zhi: '辰' },
      { gan: '庚', zhi: '申' },
    ],
    '戊',
    () => '偏印',
    ['木', '火', '土', '金', '水'],
    ['木', '火', '土', '金', '水'],
  );

  assert.deepEqual(result, {
    items: [],
    favorableCount: 0,
    unfavorableCount: 0,
    summary: '自动用神落点规则已关闭',
  });
});
