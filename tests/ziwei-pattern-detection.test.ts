import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPatternAnalysis,
  detectPatterns,
  VERIFIED_ZIWEI_PATTERN_RULE_COUNT,
  ZIWEI_PATTERN_AUDIT_NOTICE,
} from '@core/ziwei/iztro';
import type { PalaceFact, StarFact } from '../packages/core/src/types/analysis';

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
    major_stars: [],
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
    empty_state: true,
    opposite_palace_index: (index + 6) % 12,
    surrounded_palace_indexes: [index, (index + 4) % 12, (index + 6) % 12, (index + 8) % 12],
    summary_tags: [],
  }));
}

function addStar(
  palaces: PalaceFact[],
  palaceIndex: number,
  name: string,
  kind: 'major' | 'minor' | 'other' | 'scope' = 'major',
  extra: Partial<StarFact> = {},
): void {
  const star: StarFact = { name, kind, ...extra };
  const palace = palaces[palaceIndex];
  if (kind === 'major') palace.major_stars.push(star);
  else if (kind === 'minor') palace.minor_stars.push(star);
  else if (kind === 'other') palace.other_stars.push(star);
  else palace.scope_stars.push(star);
  palace.empty_state = palace.major_stars.length === 0;
}

function detectedNames(palaces: PalaceFact[]): string[] {
  return detectPatterns({ palaces }).map((pattern) => pattern.name);
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

test('紫微首批格局登记表应固定为九条逐条校勘规则', () => {
  assert.equal(VERIFIED_ZIWEI_PATTERN_RULE_COUNT, 9);
  assert.match(ZIWEI_PATTERN_AUDIT_NOTICE, /原有84条.*已全部退役/);
  assert.match(ZIWEI_PATTERN_AUDIT_NOTICE, /重新登记9条.*固定版本、卷次、原文/);
});

test('九条已校勘紫微格局应按各自盘面条件命中', () => {
  const cases: Array<{ name: string; arrange: (palaces: PalaceFact[]) => void }> = [
    {
      name: '紫府同宫',
      arrange(palaces) {
        addStar(palaces, 0, '紫微');
        addStar(palaces, 0, '天府');
      },
    },
    {
      name: '辅弼拱主',
      arrange(palaces) {
        addStar(palaces, 0, '紫微');
        addStar(palaces, 4, '左辅', 'minor');
        addStar(palaces, 8, '右弼', 'minor');
      },
    },
    {
      name: '君臣庆会',
      arrange(palaces) {
        addStar(palaces, 0, '紫微');
        addStar(palaces, 0, '左辅', 'minor');
        addStar(palaces, 0, '右弼', 'minor');
      },
    },
    {
      name: '左右夹命',
      arrange(palaces) {
        addStar(palaces, 11, '左辅', 'minor');
        addStar(palaces, 1, '右弼', 'minor');
      },
    },
    {
      name: '坐贵向贵',
      arrange(palaces) {
        addStar(palaces, 0, '天魁', 'minor');
        addStar(palaces, 6, '天钺', 'minor');
      },
    },
    {
      name: '金舆扶驾',
      arrange(palaces) {
        addStar(palaces, 0, '紫微');
        addStar(palaces, 11, '太阳');
        addStar(palaces, 1, '太阴');
      },
    },
    {
      name: '科权禄拱命',
      arrange(palaces) {
        addStar(palaces, 0, '紫微');
        addStar(palaces, 4, '廉贞', 'major', { birth_mutagen: '禄' });
        addStar(palaces, 6, '破军', 'major', { birth_mutagen: '权' });
        addStar(palaces, 8, '武曲', 'major', { birth_mutagen: '科' });
      },
    },
    {
      name: '兼文武',
      arrange(palaces) {
        addStar(palaces, 4, '武曲');
        addStar(palaces, 4, '文曲', 'minor');
      },
    },
    {
      name: '两重华盖',
      arrange(palaces) {
        addStar(palaces, 0, '禄存', 'minor');
        addStar(palaces, 0, '廉贞', 'major', { birth_mutagen: '禄' });
        addStar(palaces, 0, '地空', 'other');
      },
    },
  ];

  cases.forEach(({ name, arrange }) => {
    const palaces = createPalaces();
    arrange(palaces);
    const pattern = detectPatterns({ palaces }).find((item) => item.name === name);
    assert.ok(pattern, `${name}应命中`);
    assert.equal(pattern.status, '已命中');
    assert.match(pattern.stable_key ?? '', /^ziwei:verified-pattern:/);
    assert.ok(pattern.matched_conditions?.length);
    assert.ok(pattern.sources?.[0].includes('《紫微斗数全书》'));
    assert.match(pattern.source ?? '', /oldid=\d+/);
    assert.match(pattern.limitation ?? '', /不得.*现实因果|不得被反向/);
  });
});

test('紫微格局只读取原局星曜和生年四化，不得混入运限星曜', () => {
  const palaces = createPalaces();
  addStar(palaces, 0, '紫微', 'scope');
  addStar(palaces, 0, '天府', 'scope');
  addStar(palaces, 0, '廉贞', 'major', { horoscope_mutagen: '禄' });
  addStar(palaces, 4, '破军', 'major', { active_scope_mutagen: '权' });
  addStar(palaces, 8, '武曲', 'scope', { birth_mutagen: '科' });

  assert.deepEqual(detectPatterns({ palaces }), []);
});

test('辅弼拱主不得把三方拱照与相邻夹命拼成混合条件', () => {
  const mixed = createPalaces();
  addStar(mixed, 0, '紫微');
  addStar(mixed, 4, '左辅', 'minor');
  addStar(mixed, 1, '右弼', 'minor');
  assert.ok(!detectedNames(mixed).includes('辅弼拱主'));

  const flanked = createPalaces();
  addStar(flanked, 0, '紫微');
  addStar(flanked, 11, '左辅', 'minor');
  addStar(flanked, 1, '右弼', 'minor');
  const pattern = detectPatterns({ palaces: flanked }).find((item) => item.name === '辅弼拱主');
  assert.match(pattern?.matched_conditions?.join('；') ?? '', /前后夹命/);
});

test('科权禄拱命不得省略紫微守命、子午宫和三方会照前提', () => {
  const missingZiwei = createPalaces();
  addStar(missingZiwei, 4, '廉贞', 'major', { birth_mutagen: '禄' });
  addStar(missingZiwei, 6, '破军', 'major', { birth_mutagen: '权' });
  addStar(missingZiwei, 8, '武曲', 'major', { birth_mutagen: '科' });
  assert.ok(!detectedNames(missingZiwei).includes('科权禄拱命'));

  const wrongBranch = createPalaces();
  wrongBranch[0].earthly_branch = '丑';
  addStar(wrongBranch, 0, '紫微');
  addStar(wrongBranch, 4, '廉贞', 'major', { birth_mutagen: '禄' });
  addStar(wrongBranch, 6, '破军', 'major', { birth_mutagen: '权' });
  addStar(wrongBranch, 8, '武曲', 'major', { birth_mutagen: '科' });
  assert.ok(!detectedNames(wrongBranch).includes('科权禄拱命'));

  const transformationInSoulPalace = createPalaces();
  addStar(transformationInSoulPalace, 0, '紫微');
  addStar(transformationInSoulPalace, 0, '廉贞', 'major', { birth_mutagen: '禄' });
  addStar(transformationInSoulPalace, 6, '破军', 'major', { birth_mutagen: '权' });
  addStar(transformationInSoulPalace, 8, '武曲', 'major', { birth_mutagen: '科' });
  assert.ok(!detectedNames(transformationInSoulPalace).includes('科权禄拱命'));
});

test('紫微格局证据应汇总登记、命中、未命中与覆盖边界', () => {
  const palaces = createPalaces();
  addStar(palaces, 0, '紫微');
  addStar(palaces, 0, '天府');
  const patterns = detectPatterns({ palaces });
  const analysis = buildPatternAnalysis({ patterns, palaces });

  assert.equal(analysis.status, '已计算');
  assert.equal(analysis.summaryFact.status, '已完成');
  assert.equal(analysis.summaryFact.registeredRuleCount, 9);
  assert.equal(analysis.summaryFact.evaluatedRuleCount, 9);
  assert.equal(analysis.summaryFact.matchedPatternCount, 1);
  assert.equal(analysis.summaryFact.unmatchedRuleCount, 8);
  assert.match(analysis.promptText, /固定古籍版本逐条评估9条登记规则/);
  assert.match(analysis.promptText, /未登记格局不作判断|不代表命盘没有其他传统格局/);

  const knownFactKeys = new Set([analysis.summaryFact.key, ...analysis.summaryFact.factKeys]);
  assert.ok(
    [...analysis.counterEvidenceFacts, ...analysis.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => knownFactKeys.has(key)),
    ),
  );
});

test('旧调用方标记来源未校勘时不得把注入数据纳入格局证据', () => {
  const palaces = createPalaces();
  const analysis = buildPatternAnalysis({
    patterns: [
      {
        id: 'legacy',
        name: '旧规则',
        kind: 'auspicious',
        description: '旧数据',
        palace_indexes: [0],
        palace_names: ['命宫'],
        star_names: ['紫微'],
      },
    ],
    palaces,
    sourceUnverified: true,
  });

  assert.equal(analysis.status, '未生成');
  assert.equal(analysis.summaryFact.registeredRuleCount, 0);
  assert.equal(analysis.summaryFact.matchedPatternCount, 0);
  assert.match(analysis.promptText, /原有84条.*已全部退役/);
  assert.match(analysis.promptText, /不得把空结果解释为没有传统格局/);
});

test('格局证据汇总应主动过滤非登记稳定键', () => {
  const analysis = buildPatternAnalysis({
    patterns: [
      {
        id: 'manual',
        stable_key: 'manual-pattern',
        key: 'manual-pattern',
        status: '已命中',
        name: '手工注入规则',
        kind: 'auspicious',
        description: '未登记数据',
        palace_indexes: [0],
        palace_names: ['命宫'],
        star_names: ['紫微'],
      },
    ],
    palaces: createPalaces(),
  });

  assert.equal(analysis.summaryFact.matchedPatternCount, 0);
  assert.ok(!analysis.summaryFact.factKeys.includes('manual-pattern'));
  assert.doesNotMatch(analysis.promptText, /手工注入规则/);
});

test('格局证据汇总应拒绝伪造登记前缀并按稳定键去重', () => {
  const palaces = createPalaces();
  addStar(palaces, 0, '紫微');
  addStar(palaces, 0, '天府');
  const verified = detectPatterns({ palaces })[0];
  const analysis = buildPatternAnalysis({
    patterns: [
      verified,
      { ...verified, key: 'manual-shadow-key' },
      {
        ...verified,
        id: 'forged',
        stable_key: 'ziwei:verified-pattern:not-registered',
        key: 'ziwei:verified-pattern:not-registered',
        name: '伪造格局',
      },
    ],
    palaces,
  });

  assert.equal(analysis.summaryFact.matchedPatternCount, 1);
  assert.equal(analysis.summaryFact.unmatchedRuleCount, 8);
  assert.ok(!analysis.summaryFact.factKeys.includes('manual-shadow-key'));
  assert.ok(!analysis.summaryFact.factKeys.includes('ziwei:verified-pattern:not-registered'));
  assert.doesNotMatch(analysis.promptText, /伪造格局/);
});

test('格局证据汇总应拒绝冲突键、跳过状态与损坏的十二宫', () => {
  const palaces = createPalaces();
  addStar(palaces, 0, '紫微');
  addStar(palaces, 0, '天府');
  const verified = detectPatterns({ palaces })[0];

  const conflicting = buildPatternAnalysis({
    patterns: [{ ...verified, key: 'manual-shadow-key' }],
    palaces,
  });
  assert.equal(conflicting.summaryFact.matchedPatternCount, 0);

  const skipped = buildPatternAnalysis({ patterns: [verified], palaces, skipped: true });
  assert.equal(skipped.status, '未生成');
  assert.equal(skipped.summaryFact.evaluatedRuleCount, 0);
  assert.equal(skipped.summaryFact.matchedPatternCount, 0);

  const damaged = createPalaces();
  damaged[0].surrounded_palace_indexes = [];
  const insufficient = buildPatternAnalysis({ patterns: [verified], palaces: damaged });
  assert.equal(insufficient.status, '资料不足');
  assert.equal(insufficient.summaryFact.evaluatedRuleCount, 0);
  assert.equal(insufficient.summaryFact.matchedPatternCount, 0);
});
