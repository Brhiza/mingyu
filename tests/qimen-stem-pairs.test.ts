import test from 'node:test';
import assert from 'node:assert/strict';
import type { QimenJiuGongGe } from '../packages/core/src/types/divination';
import {
  getClassicPatterns,
  getStemRelations,
} from '../packages/core/src/divination/algorithms/qimen/helpers/classic-patterns';
import {
  getNamedStemPairPattern,
  getStemPairPattern,
  listAllStemPairs,
} from '../packages/core/src/divination/algorithms/qimen/helpers/stem-pair-patterns';
import {
  analyzeQimenEvidence,
  generateQimen,
} from '../packages/core/src/divination/algorithms/qimen';

const AUDITED_STEM_PAIRS = [
  { heaven: '戊', earth: '丙', name: '青龙返首', type: 'good' },
  { heaven: '丙', earth: '戊', name: '飞鸟跌穴', type: 'good' },
  { heaven: '乙', earth: '辛', name: '青龙逃走', type: 'bad' },
  { heaven: '辛', earth: '乙', name: '白虎猖狂', type: 'bad' },
  { heaven: '丁', earth: '癸', name: '朱雀投江', type: 'bad' },
  { heaven: '癸', earth: '丁', name: '螣蛇跃蹻', type: 'bad' },
  { heaven: '丙', earth: '庚', name: '荧入太白', type: 'neutral' },
  { heaven: '庚', earth: '丙', name: '太白入荧', type: 'neutral' },
  { heaven: '庚', earth: '癸', name: '大格', type: 'bad' },
  { heaven: '庚', earth: '己', name: '刑格', type: 'bad' },
  { heaven: '庚', earth: '壬', name: '小格', type: 'bad' },
] as const;

function buildPalace(heavenStem: string, earthStem: string): QimenJiuGongGe {
  return {
    gong: 1,
    name: '坎一宫',
    direction: '北',
    element: '水',
    tianPan: { star: '', stem: heavenStem },
    diPan: { stem: earthStem },
    renPan: { door: '' },
    shenPan: { god: '' },
  };
}

test('奇门天地盘十干完整保留81种组合且仅11项作为已校勘固定格', () => {
  const patterns = listAllStemPairs();
  const audited = patterns.filter((pattern) => pattern.auditStatus === '已校勘');
  const structural = patterns.filter((pattern) => pattern.auditStatus === '结构事实');

  assert.equal(patterns.length, 81);
  assert.equal(
    new Set(patterns.map((pattern) => `${pattern.heavenStem}_${pattern.earthStem}`)).size,
    81,
  );
  assert.equal(audited.length, 11);
  assert.equal(structural.length, 70);

  AUDITED_STEM_PAIRS.forEach((expected) => {
    const actual = audited.find(
      (pattern) => pattern.heavenStem === expected.heaven && pattern.earthStem === expected.earth,
    );
    assert.ok(actual);
    assert.equal(actual.name, expected.name);
    assert.equal(actual.type, expected.type);
  });
});

test('奇门未校勘的70种天地盘组合只返回可复算结构事实', () => {
  const structural = listAllStemPairs().filter((pattern) => pattern.auditStatus === '结构事实');

  structural.forEach((pattern) => {
    assert.equal(pattern.type, 'neutral');
    assert.ok(['五行结构事实', '天干五合与五行结构'].includes(pattern.name));
    assert.match(pattern.summary, /天盘/);
    assert.match(pattern.summary, /地盘/);
    assert.match(
      pattern.manifestation,
      /不得仅据此生成吉凶、现实事件、角色关系、成败判断或行动建议/,
    );
    assert.match(pattern.limitation, /不作为传统格局命中/);
    assert.deepEqual(pattern.sources, [{ title: 'mingyu-core 公共天干五行与天干五合入口' }]);
    assert.equal(getNamedStemPairPattern(pattern.heavenStem, pattern.earthStem), null);
  });

  assert.equal(getStemPairPattern('乙', '乙').name, '五行结构事实');
  assert.equal(getStemPairPattern('丙', '辛').name, '天干五合与五行结构');
  assert.notEqual(getStemPairPattern('乙', '庚').name, '日奇受刑');
});

test('奇门天地盘组合复用标准天干五合且不再误报乙己合', () => {
  const expectedPairs = [
    ['乙', '庚'],
    ['庚', '乙'],
    ['丙', '辛'],
    ['辛', '丙'],
    ['丁', '壬'],
    ['壬', '丁'],
    ['戊', '癸'],
    ['癸', '戊'],
  ] as const;

  expectedPairs.forEach(([heaven, earth]) => {
    const pattern = getStemPairPattern(heaven, earth);
    assert.equal(pattern.auditStatus, '结构事实');
    assert.equal(pattern.name, '天干五合与五行结构');
    assert.match(pattern.summary, /标准天干五合/);
  });

  const wrongPair = getStemPairPattern('乙', '己');
  assert.doesNotMatch(wrongPair.summary, /五合/);

  const correctRelations = getStemRelations([buildPalace('乙', '庚')]);
  assert.ok(
    correctRelations.some(
      (relation) => relation.type === '奇仪相合' && relation.note.includes('标准天干五合'),
    ),
  );

  const wrongRelations = getStemRelations([buildPalace('乙', '己')]);
  assert.ok(!wrongRelations.some((relation) => relation.type === '奇仪相合'));
  assert.doesNotMatch(wrongRelations.map((relation) => relation.note).join(''), /乙己合/);
});

test('奇门11项固定格逐项带原文、链接、条件与推断边界', () => {
  AUDITED_STEM_PAIRS.forEach((expected) => {
    const pattern = getNamedStemPairPattern(expected.heaven, expected.earth);
    assert.ok(pattern);
    assert.equal(pattern.name, expected.name);
    assert.equal(pattern.type, expected.type);
    assert.equal(pattern.auditStatus, '已校勘');
    assert.ok(pattern.condition.includes(expected.heaven));
    assert.ok(pattern.condition.includes(expected.earth));
    assert.match(pattern.limitation, /不得脱离原典适用语境扩写/);
    assert.equal(pattern.sources.length, 1);
    assert.match(pattern.sources[0].title, /《遁甲演义》卷[一二]/);
    assert.match(pattern.sources[0].url ?? '', /zh\.wikisource\.org/);
    assert.ok(pattern.sources[0].quote);
  });
});

test('奇门只有11项已校勘天地盘固定格进入经典格局与命名关系', () => {
  const auditedKeys = new Set(AUDITED_STEM_PAIRS.map(({ heaven, earth }) => `${heaven}_${earth}`));

  listAllStemPairs().forEach(({ heavenStem, earthStem }) => {
    const key = `${heavenStem}_${earthStem}`;
    const palace = buildPalace(heavenStem, earthStem);
    const classicPatterns = getClassicPatterns({
      jiuGongGe: [palace],
      zhiFu: '',
      zhiShi: '',
    }).filter((pattern) => pattern.key.startsWith('pattern:stemPair:'));
    const namedRelations = getStemRelations([palace]).filter(
      (relation) => relation.type === '命名格局',
    );

    assert.equal(classicPatterns.length, auditedKeys.has(key) ? 1 : 0, key);
    assert.equal(namedRelations.length, auditedKeys.has(key) ? 1 : 0, key);
  });
});

test('奇门提示词证据声明11项固定格与其余70项结构事实边界', () => {
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const relationRule = analysis.ruleSourceFacts.find((item) => item.key === 'rule:qimen:relations');

  assert.ok(relationRule);
  assert.match(relationRule.rule, /八十一种组合全部保留结构事实/);
  assert.match(relationRule.rule, /十一项固定格/);
  assert.match(relationRule.rule, /其余七十项不作为传统格局/);
  assert.match(relationRule.promptText, /其余七十项不得补造传统名称或现实断语/);
  assert.ok(relationRule.sources.some((source) => source.includes('《遁甲演义》卷一')));
  assert.ok(relationRule.sources.some((source) => source.includes('《遁甲演义》卷二')));
  assert.match(relationRule.limitation, /不等于现代实证验证/);
});
