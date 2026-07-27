import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPatternAnalysis,
  detectPatterns,
  VERIFIED_ZIWEI_PATTERN_RULE_COUNT,
  ZIWEI_PATTERN_AUDIT_NOTICE,
  ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES,
  ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT,
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

test('紫微传统格局目录应完整区分可复算规则与原典边界', () => {
  assert.equal(VERIFIED_ZIWEI_PATTERN_RULE_COUNT, 55);
  assert.equal(ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length, 32);
  assert.equal(ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT, 87);
  assert.match(ZIWEI_PATTERN_AUDIT_NOTICE, /原有84条.*已全部退役/);
  assert.match(ZIWEI_PATTERN_AUDIT_NOTICE, /传统目录现登记87项.*55条.*32项/);
  assert.ok(
    ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.every(
      (item) => item.name && item.quote && item.reason && /oldid=\d+/.test(item.source),
    ),
  );
  const boundaryNames = new Set(ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.map((item) => item.name));
  [
    '昌曲夹命',
    '日月夹命',
    '羊刃入庙',
    '左辅文昌',
    '贪铃并守',
    '廉杀巳亥',
    '日月反背',
    '日照雷门',
    '金舆扶驾',
    '科权禄拱命',
    '荫印拱身',
    '财印夹禄',
    '马头带剑',
    '紫禄同宫',
    '廉杀庙旺',
  ].forEach((name) => assert.ok(boundaryNames.has(name), `${name}应登记为原典边界`));
});

test('原有仍可复算的紫微格局应按各自盘面条件命中', () => {
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
    {
      name: '月朗天门',
      arrange(palaces) {
        palaces[0].earthly_branch = '亥';
        addStar(palaces, 0, '太阴');
      },
    },
    {
      name: '月生沧海',
      arrange(palaces) {
        palaces[9].earthly_branch = '子';
        addStar(palaces, 9, '太阴');
      },
    },
    {
      name: '金灿光辉',
      arrange(palaces) {
        palaces[0].earthly_branch = '午';
        addStar(palaces, 0, '太阳');
      },
    },
    {
      name: '日出扶桑',
      arrange(palaces) {
        palaces[8].earthly_branch = '卯';
        addStar(palaces, 8, '太阳');
      },
    },
    {
      name: '皇殿朝班',
      arrange(palaces) {
        addStar(palaces, 8, '太阳');
        addStar(palaces, 8, '文昌', 'minor');
      },
    },
    {
      name: '禄马交驰',
      arrange(palaces) {
        addStar(palaces, 4, '禄存', 'minor');
        addStar(palaces, 4, '天马', 'other');
      },
    },
    {
      name: '财禄夹马',
      arrange(palaces) {
        addStar(palaces, 0, '天马', 'other');
        addStar(palaces, 11, '武曲');
        addStar(palaces, 1, '禄存', 'minor');
      },
    },
    {
      name: '日月照璧',
      arrange(palaces) {
        addStar(palaces, 9, '太阳');
        addStar(palaces, 9, '太阴');
      },
    },
    {
      name: '石中隐玉',
      arrange(palaces) {
        addStar(palaces, 0, '巨门');
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
    assert.equal(pattern.calculationStepKey, 'ziwei:pattern:calculation:matched-facts');
    assert.deepEqual(pattern.dependsOnStepKeys, ['ziwei:pattern:calculation:rule-evaluation']);
    assert.ok(pattern.sources?.[0].includes('《紫微斗数全书》'));
    assert.match(pattern.source ?? '', /oldid=\d+/);
    assert.match(pattern.limitation ?? '', /不得.*现实因果|不得被反向/);
  });
});

test('新增仍可复算的传统格局应逐条满足完整原文条件', () => {
  const cases: Array<{
    name: string;
    arrange: (palaces: PalaceFact[]) => void;
    params?: Omit<Parameters<typeof detectPatterns>[0], 'palaces'>;
  }> = [
    {
      name: '紫府夹命',
      arrange(palaces) {
        addStar(palaces, 11, '紫微');
        addStar(palaces, 1, '天府');
      },
    },
    {
      name: '机月同梁',
      arrange(palaces) {
        palaces[0].earthly_branch = '寅';
        addStar(palaces, 0, '天机');
        addStar(palaces, 4, '太阴');
        addStar(palaces, 6, '天同');
        addStar(palaces, 8, '天梁');
      },
    },
    {
      name: '府相朝垣',
      arrange(palaces) {
        palaces[0].earthly_branch = '申';
        addStar(palaces, 4, '天府');
        addStar(palaces, 8, '天相');
      },
    },
    {
      name: '魁钺夹命',
      arrange(palaces) {
        addStar(palaces, 11, '天魁', 'minor');
        addStar(palaces, 1, '天钺', 'minor');
      },
    },
    {
      name: '玉袖天香',
      arrange(palaces) {
        addStar(palaces, 10, '文昌', 'minor');
        addStar(palaces, 10, '文曲', 'minor');
      },
    },
    {
      name: '蟾宫折桂',
      arrange(palaces) {
        addStar(palaces, 2, '太阴');
        addStar(palaces, 2, '文曲', 'minor');
      },
    },
    {
      name: '日月并明',
      arrange(palaces) {
        addStar(palaces, 4, '太阳', 'major', { brightness: '庙' });
        addStar(palaces, 8, '太阴', 'major', { brightness: '旺' });
      },
    },
    {
      name: '左右朝垣',
      arrange(palaces) {
        addStar(palaces, 4, '左辅', 'minor');
        addStar(palaces, 8, '右弼', 'minor');
      },
    },
    {
      name: '文星朝命',
      arrange(palaces) {
        addStar(palaces, 0, '文昌', 'minor');
        addStar(palaces, 0, '文曲', 'minor');
      },
    },
    {
      name: '对面朝斗',
      arrange(palaces) {
        palaces[6].earthly_branch = '午';
        addStar(palaces, 6, '禄存', 'minor');
      },
    },
    {
      name: '日月夹财',
      arrange(palaces) {
        addStar(palaces, 0, '武曲');
        addStar(palaces, 11, '太阳');
        addStar(palaces, 1, '太阴');
      },
    },
    {
      name: '七杀朝斗',
      arrange(palaces) {
        addStar(palaces, 0, '七杀');
      },
    },
    {
      name: '贪火相逢',
      arrange(palaces) {
        addStar(palaces, 0, '贪狼', 'major', { brightness: '庙' });
        addStar(palaces, 0, '火星', 'other', { brightness: '旺' });
      },
    },
    {
      name: '武曲守垣',
      arrange(palaces) {
        palaces[0].earthly_branch = '卯';
        addStar(palaces, 0, '武曲');
      },
    },
    {
      name: '权禄生逢',
      arrange(palaces) {
        addStar(palaces, 0, '破军', 'major', { birth_mutagen: '权', brightness: '庙' });
        addStar(palaces, 0, '廉贞', 'major', { birth_mutagen: '禄', brightness: '旺' });
      },
    },
    {
      name: '刑囚夹印',
      arrange(palaces) {
        addStar(palaces, 4, '天刑', 'other');
        addStar(palaces, 4, '廉贞');
      },
    },
    {
      name: '雄宿朝元',
      arrange(palaces) {
        palaces[0].earthly_branch = '申';
        addStar(palaces, 0, '廉贞');
      },
    },
    {
      name: '破军子午',
      arrange(palaces) {
        addStar(palaces, 0, '破军');
      },
    },
    {
      name: '生不逢时',
      arrange(palaces) {
        addStar(palaces, 0, '廉贞');
        addStar(palaces, 0, '空亡', 'other');
      },
    },
    {
      name: '禄逢两杀',
      arrange(palaces) {
        addStar(palaces, 4, '禄存', 'minor');
        addStar(palaces, 4, '空亡', 'other');
        addStar(palaces, 4, '地空', 'other');
      },
    },
    {
      name: '马落空亡',
      arrange(palaces) {
        addStar(palaces, 4, '天马', 'other');
        addStar(palaces, 4, '旬空', 'other');
      },
    },
    {
      name: '日月藏辉',
      arrange(palaces) {
        palaces[4].earthly_branch = '戌';
        palaces[8].earthly_branch = '辰';
        addStar(palaces, 4, '太阳');
        addStar(palaces, 8, '太阴');
        addStar(palaces, 6, '巨门');
      },
    },
    {
      name: '财与囚仇',
      arrange(palaces) {
        addStar(palaces, 0, '武曲');
        addStar(palaces, 4, '廉贞');
      },
    },
    {
      name: '一生孤贫',
      arrange(palaces) {
        addStar(palaces, 0, '破军', 'major', { brightness: '陷' });
      },
    },
    {
      name: '君子在野',
      arrange(palaces) {
        addStar(palaces, 4, '火星', 'other', { brightness: '陷' });
      },
    },
    {
      name: '羊陀夹忌',
      arrange(palaces) {
        addStar(palaces, 0, '廉贞', 'major', { birth_mutagen: '忌' });
        addStar(palaces, 11, '擎羊', 'minor');
        addStar(palaces, 1, '陀罗', 'minor');
      },
    },
    {
      name: '火铃夹命',
      arrange(palaces) {
        addStar(palaces, 11, '火星', 'other');
        addStar(palaces, 1, '铃星', 'other');
      },
    },
    {
      name: '空劫夹命',
      arrange(palaces) {
        addStar(palaces, 11, '地空', 'other');
        addStar(palaces, 1, '地劫', 'other');
      },
    },
    {
      name: '泛水桃花',
      arrange(palaces) {
        palaces[0].earthly_branch = '亥';
        addStar(palaces, 0, '贪狼');
        addStar(palaces, 0, '陀罗', 'minor');
      },
    },
    {
      name: '水澄桂萼',
      arrange(palaces) {
        addStar(palaces, 0, '太阴');
      },
    },
    {
      name: '天梁居午',
      arrange(palaces) {
        palaces[0].earthly_branch = '午';
        addStar(palaces, 0, '天梁');
      },
    },
    {
      name: '梁昌庙旺',
      arrange(palaces) {
        addStar(palaces, 0, '天梁', 'major', { brightness: '庙' });
        addStar(palaces, 0, '文昌', 'minor', { brightness: '旺' });
      },
    },
    {
      name: '阳梁昌禄',
      arrange(palaces) {
        addStar(palaces, 0, '太阳');
        addStar(palaces, 4, '天梁');
        addStar(palaces, 6, '文昌', 'minor');
        addStar(palaces, 8, '禄存', 'minor');
      },
    },
    {
      name: '巨日同宫',
      arrange(palaces) {
        addStar(palaces, 0, '巨门');
        addStar(palaces, 0, '太阳');
      },
    },
    {
      name: '巨火擎羊',
      arrange(palaces) {
        addStar(palaces, 0, '巨门');
        addStar(palaces, 4, '火星', 'other');
        addStar(palaces, 6, '擎羊', 'minor');
        addStar(palaces, 8, '陀罗', 'minor');
      },
    },
    {
      name: '武贪同行',
      arrange(palaces) {
        addStar(palaces, 0, '武曲');
        addStar(palaces, 0, '贪狼');
      },
    },
    {
      name: '火贵格',
      arrange(palaces) {
        addStar(palaces, 4, '贪狼');
        addStar(palaces, 8, '火星', 'other');
      },
    },
    {
      name: '风流彩杖',
      arrange(palaces) {
        palaces[0].earthly_branch = '寅';
        addStar(palaces, 0, '贪狼');
        addStar(palaces, 0, '陀罗', 'minor');
      },
    },
    {
      name: '巨机居卯',
      arrange(palaces) {
        palaces[0].earthly_branch = '卯';
        addStar(palaces, 0, '巨门');
        addStar(palaces, 0, '天机');
      },
      params: { birthYearHeavenlyStem: '乙' },
    },
  ];

  assert.equal(cases.length, VERIFIED_ZIWEI_PATTERN_RULE_COUNT - 16);
  assert.equal(new Set(cases.map((item) => item.name)).size, cases.length);

  cases.forEach(({ name, arrange, params }) => {
    const palaces = createPalaces();
    arrange(palaces);
    const pattern = detectPatterns({ palaces, ...params }).find((item) => item.name === name);
    assert.ok(pattern, `${name}应命中`);
    assert.ok(pattern.matched_conditions?.length, `${name}应登记实际命中条件`);
    assert.match(pattern.source ?? '', /oldid=\d+/, `${name}应固定古籍版本`);
    assert.ok(pattern.calculation, `${name}应说明可复算步骤`);
    assert.equal(pattern.calculationStepKey, 'ziwei:pattern:calculation:matched-facts');

    const essentialStar = pattern.star_names[0]?.replace(/化[禄权科忌]$/, '');
    assert.ok(essentialStar, `${name}应登记必要星曜`);
    palaces.forEach((palace) => {
      palace.major_stars = palace.major_stars.filter((star) => star.name !== essentialStar);
      palace.minor_stars = palace.minor_stars.filter((star) => star.name !== essentialStar);
      palace.other_stars = palace.other_stars.filter((star) => star.name !== essentialStar);
    });
    assert.ok(
      !detectPatterns({ palaces, ...params }).some((item) => item.name === name),
      `${name}缺少必要星曜${essentialStar}时不应命中`,
    );
  });
});

test('条件不闭合或当前安星体系不可达的格局不得用人工拼盘伪造成可执行规则', () => {
  const palaces = createPalaces();
  palaces[0].earthly_branch = '巳';
  addStar(palaces, 0, '廉贞');
  addStar(palaces, 0, '七杀');
  addStar(palaces, 0, '左辅', 'minor');
  addStar(palaces, 0, '文昌', 'minor');
  addStar(palaces, 11, '太阳');
  addStar(palaces, 1, '太阴');

  const names = detectedNames(palaces);
  ['廉杀巳亥', '左辅文昌', '日月夹命'].forEach((name) => {
    assert.ok(!names.includes(name), `${name}只应保留在原典边界目录`);
  });
});

test('羊陀夹忌只核对命宫，不得把其他宫位化忌误识别为夹忌', () => {
  const palaces = createPalaces();
  addStar(palaces, 5, '贪狼', 'major', { birth_mutagen: '忌' });
  addStar(palaces, 4, '擎羊', 'minor');
  addStar(palaces, 6, '陀罗', 'minor');

  assert.ok(!detectedNames(palaces).includes('羊陀夹忌'));
});

test('火贵格应分别核对命宫与身宫三方，不得跨目标拼接条件', () => {
  const bodyMatch = createPalaces();
  addStar(bodyMatch, 8, '贪狼');
  addStar(bodyMatch, 10, '火星', 'other');
  const pattern = detectPatterns({ palaces: bodyMatch }).find((item) => item.name === '火贵格');
  assert.ok(pattern);
  assert.ok(pattern.palace_indexes.includes(4));
  assert.match(pattern.matched_conditions?.join('；') ?? '', /身宫/);

  const crossTarget = createPalaces();
  addStar(crossTarget, 4, '贪狼');
  addStar(crossTarget, 10, '火星', 'other');
  assert.ok(!detectedNames(crossTarget).includes('火贵格'));
});

test('带有吉曜转化条件的传统结构不得固定标为纯凶格', () => {
  const fireBell = createPalaces();
  addStar(fireBell, 11, '火星', 'other');
  addStar(fireBell, 1, '铃星', 'other');
  assert.equal(
    detectPatterns({ palaces: fireBell }).find((item) => item.name === '火铃夹命')?.kind,
    'neutral',
  );

  const peach = createPalaces();
  peach[0].earthly_branch = '亥';
  addStar(peach, 0, '贪狼');
  addStar(peach, 0, '陀罗', 'minor');
  assert.equal(
    detectPatterns({ palaces: peach }).find((item) => item.name === '泛水桃花')?.kind,
    'neutral',
  );
});

test('紫微第二批九条格局不得省略宫位、地支、单守、同宫或夹宫条件', () => {
  const nearMisses: Array<{ name: string; arrange: (palaces: PalaceFact[]) => void }> = [
    {
      name: '月朗天门',
      arrange(palaces) {
        palaces[0].earthly_branch = '戌';
        addStar(palaces, 0, '太阴');
      },
    },
    {
      name: '月生沧海',
      arrange(palaces) {
        palaces[9].earthly_branch = '丑';
        addStar(palaces, 9, '太阴');
      },
    },
    {
      name: '金灿光辉',
      arrange(palaces) {
        palaces[0].earthly_branch = '午';
        addStar(palaces, 0, '太阳');
        addStar(palaces, 0, '武曲');
      },
    },
    {
      name: '日出扶桑',
      arrange(palaces) {
        palaces[4].earthly_branch = '卯';
        addStar(palaces, 4, '太阳');
      },
    },
    {
      name: '皇殿朝班',
      arrange(palaces) {
        addStar(palaces, 8, '太阳');
        addStar(palaces, 0, '文昌', 'minor');
      },
    },
    {
      name: '禄马交驰',
      arrange(palaces) {
        addStar(palaces, 0, '天马', 'other');
        addStar(palaces, 1, '禄存', 'minor');
      },
    },
    {
      name: '财禄夹马',
      arrange(palaces) {
        addStar(palaces, 0, '天马', 'other');
        addStar(palaces, 1, '武曲');
        addStar(palaces, 1, '禄存', 'minor');
      },
    },
    {
      name: '日月照璧',
      arrange(palaces) {
        addStar(palaces, 9, '太阳');
        addStar(palaces, 0, '太阴');
      },
    },
    {
      name: '石中隐玉',
      arrange(palaces) {
        palaces[0].earthly_branch = '丑';
        addStar(palaces, 0, '巨门');
      },
    },
  ];

  nearMisses.forEach(({ name, arrange }) => {
    const palaces = createPalaces();
    arrange(palaces);
    assert.ok(!detectedNames(palaces).includes(name), `${name}不应因近似条件误命中`);
  });
});

test('禄马交驰应同时登记命宫与身宫的实际命中', () => {
  const palaces = createPalaces();
  addStar(palaces, 0, '禄存', 'minor');
  addStar(palaces, 0, '天马', 'other');
  palaces[4].is_body_palace = true;
  addStar(palaces, 4, '禄存', 'minor');
  addStar(palaces, 4, '天马', 'other');

  const pattern = detectPatterns({ palaces }).find((item) => item.name === '禄马交驰');
  assert.ok(pattern);
  assert.deepEqual(pattern.palace_names, ['命宫', '财帛']);
  assert.deepEqual(pattern.matched_conditions, ['禄存与天马同坐命宫', '禄存与天马同坐身宫']);
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

test('生年天干条件应贯穿格局检测、证据重建与评估覆盖统计', () => {
  const yearStem = createPalaces();
  yearStem[0].earthly_branch = '卯';
  addStar(yearStem, 0, '巨门');
  addStar(yearStem, 0, '天机');
  const yearStemPatterns = detectPatterns({ palaces: yearStem, birthYearHeavenlyStem: '乙' });
  assert.ok(yearStemPatterns.some((item) => item.name === '巨机居卯'));
  assert.ok(
    !detectPatterns({ palaces: yearStem, birthYearHeavenlyStem: '甲' }).some(
      (item) => item.name === '巨机居卯',
    ),
  );
  assert.equal(
    buildPatternAnalysis({
      patterns: yearStemPatterns,
      palaces: yearStem,
      birthYearHeavenlyStem: '乙',
    }).summaryFact.matchedPatternCount,
    yearStemPatterns.length,
  );

  const missingInput = buildPatternAnalysis({
    patterns: detectPatterns({ palaces: yearStem }),
    palaces: yearStem,
  });
  assert.equal(missingInput.summaryFact.registeredRuleCount, 55);
  assert.equal(missingInput.summaryFact.evaluatedRuleCount, 54);
  assert.equal(missingInput.summaryFact.unevaluatedRuleCount, 1);
  assert.equal(missingInput.status, '资料不足');
  assert.equal(missingInput.summaryFact.status, '资料不足');
  assert.equal(
    missingInput.calculationSteps.find((step) => step.stage === '格局规则评估')?.status,
    '资料不足',
  );
  assert.match(missingInput.promptText, /1条因必要输入不足未评估/);

  const completeInput = buildPatternAnalysis({
    patterns: yearStemPatterns,
    palaces: yearStem,
    birthYearHeavenlyStem: '乙',
  });
  assert.equal(completeInput.summaryFact.evaluatedRuleCount, 55);
  assert.equal(completeInput.summaryFact.unevaluatedRuleCount, 0);
});

test('紫微格局证据应汇总登记、命中、未命中与覆盖边界', () => {
  const palaces = createPalaces();
  addStar(palaces, 0, '紫微');
  addStar(palaces, 0, '天府');
  const patterns = detectPatterns({ palaces, birthYearHeavenlyStem: '甲' });
  const analysis = buildPatternAnalysis({ patterns, palaces, birthYearHeavenlyStem: '甲' });

  assert.equal(analysis.status, '已计算');
  assert.equal(analysis.summaryFact.status, '已完成');
  assert.equal(analysis.summaryFact.registeredRuleCount, 55);
  assert.equal(analysis.summaryFact.evaluatedRuleCount, 55);
  assert.equal(analysis.summaryFact.unevaluatedRuleCount, 0);
  assert.equal(analysis.summaryFact.matchedPatternCount, 1);
  assert.equal(analysis.summaryFact.unmatchedRuleCount, 54);
  assert.match(analysis.promptText, /固定古籍版本逐条评估55条可复算规则/);
  assert.match(analysis.promptText, /32项.*边界|不代表命盘没有其他传统格局/);

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
    birthYearHeavenlyStem: '甲',
  });

  assert.equal(analysis.summaryFact.matchedPatternCount, 1);
  assert.equal(analysis.summaryFact.unmatchedRuleCount, 54);
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
