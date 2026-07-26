import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPatternAnalysis,
  detectPatterns,
  ZIWEI_PATTERN_AUDIT_NOTICE,
} from '@core/ziwei/iztro';
import type { PalaceFact } from '../packages/core/src/types/analysis';

const PALACE_NAMES = [
  '命宫',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '交友',
  '官禄',
  '田宅',
  '福德',
  '父母',
] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function createPalaces(): PalaceFact[] {
  return PALACE_NAMES.map((name, index) => ({
    index,
    name,
    is_body_palace: index === 4,
    is_original_palace: index === 8,
    heavenly_stem: '甲',
    earthly_branch: BRANCHES[index],
    major_stars:
      index === 0
        ? [
            { name: '紫微', kind: 'major' },
            { name: '天府', kind: 'major' },
          ]
        : [],
    minor_stars: [],
    other_stars: [],
    scope_stars: [],
    changsheng12: '长生',
    boshi12: '博士',
    base_jiangqian12: '岁驿',
    base_suiqian12: '岁建',
    decadal_range: [1, 10],
    ages: [],
    scope_hits: [],
    empty_state: index !== 0,
    opposite_palace_index: (index + 6) % 12,
    surrounded_palace_indexes: [index, (index + 4) % 12, (index + 6) % 12, (index + 8) % 12],
    summary_tags: [],
  }));
}

test('紫微格局检测仍应拒绝不完整或索引损坏的十二宫资料', () => {
  assert.throws(() => detectPatterns({ palaces: [] }), /需要完整 12 宫数据/);

  const duplicateIndex = createPalaces();
  duplicateIndex[1].index = 0;
  assert.throws(() => detectPatterns({ palaces: duplicateIndex }), /宫位索引 0 重复/);

  const invalidSurroundedIndex = createPalaces();
  invalidSurroundedIndex[0].surrounded_palace_indexes = [0, 4, 6, 12];
  assert.throws(() => detectPatterns({ palaces: invalidSurroundedIndex }), /三方四正宫位索引无效/);
});

test('未逐条校勘来源的自定义紫微格局不得形成命中事实', () => {
  const palaces = createPalaces();
  const patterns = detectPatterns({ palaces });

  assert.deepEqual(patterns, []);
  assert.match(ZIWEI_PATTERN_AUDIT_NOTICE, /缺少逐条版本、卷页、原文与独立例盘校勘/);
  assert.match(ZIWEI_PATTERN_AUDIT_NOTICE, /不参与排盘、证据或提示词输出/);
});

test('紫微格局证据应明确来源未校勘，不能把空列表解释为无格局', () => {
  const palaces = createPalaces();
  const analysis = buildPatternAnalysis({
    patterns: [],
    palaces,
    skipped: true,
    sourceUnverified: true,
  });

  assert.equal(analysis.status, '未生成');
  assert.equal(analysis.summaryFact.status, '未生成');
  assert.equal(analysis.summaryFact.registeredRuleCount, 0);
  assert.equal(analysis.summaryFact.evaluatedRuleCount, 0);
  assert.equal(analysis.summaryFact.matchedPatternCount, 0);
  assert.match(analysis.promptText, /来源尚未逐条校勘|缺少逐条版本/);
  assert.match(analysis.promptText, /不表示命盘没有传统格局|不得声称任何传统格局/);

  const knownFactKeys = new Set([analysis.summaryFact.key, ...analysis.summaryFact.factKeys]);
  assert.ok(
    [...analysis.counterEvidenceFacts, ...analysis.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => knownFactKeys.has(key)),
    ),
  );
});
