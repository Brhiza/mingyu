import test from 'node:test';
import assert from 'node:assert/strict';
import type { QimenJiuGongGe } from '../packages/core/src/types/divination';
import { jiazi } from '../packages/core/src/divination/divination-data';
import { getXunHead } from '../packages/core/src/ganzhi';
import {
  AUDITED_QIMEN_CONTEXT_PATTERN_NAMES,
  getClassicPatterns,
  getStemRelations,
} from '../packages/core/src/divination/algorithms/qimen/helpers/classic-patterns';
import {
  getTianPanStemForStar,
  getTianPanStems,
  hasTianPanStar,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils';
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

const SIX_JIA_DUN_STEMS: Readonly<Record<string, string>> = {
  甲子: '戊',
  甲戌: '己',
  甲申: '庚',
  甲午: '辛',
  甲辰: '壬',
  甲寅: '癸',
};

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

test('奇门伏干飞干按60日柱乘81种天地盘组合独立穷举且甲日使用六甲遁干', () => {
  const stemPairs = listAllStemPairs();
  let checked = 0;

  for (const dayGanZhi of jiazi) {
    const dayDunStem = SIX_JIA_DUN_STEMS[dayGanZhi] ?? dayGanZhi.charAt(0);

    for (const { heavenStem, earthStem } of stemPairs) {
      const contextualPatterns = getClassicPatterns({
        jiuGongGe: [buildPalace(heavenStem, earthStem)],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        dayStem: dayGanZhi.charAt(0),
        dayGanZhi,
      }).filter((pattern) =>
        AUDITED_QIMEN_CONTEXT_PATTERN_NAMES.includes(
          pattern.name as (typeof AUDITED_QIMEN_CONTEXT_PATTERN_NAMES)[number],
        ),
      );
      const expectedNames = [
        ...(heavenStem === '庚' && earthStem === dayDunStem ? ['伏干格'] : []),
        ...(heavenStem === dayDunStem && earthStem === '庚' ? ['飞干格'] : []),
      ];

      assert.deepEqual(
        contextualPatterns.map((pattern) => pattern.name),
        expectedNames,
        `${dayGanZhi}日天盘${heavenStem}加地盘${earthStem}`,
      );
      contextualPatterns.forEach((pattern) => {
        assert.equal(pattern.tone, 'neutral');
        assert.match(pattern.summary, new RegExp(`本日日柱${dayGanZhi}`));
        assert.match(pattern.summary, /兵占、出行及主客利弊断语不泛化/);
        assert.doesNotMatch(pattern.summary, /必胜|必败|必遭|宜出|不宜出/);
      });
      checked += 1;
    }
  }

  assert.equal(checked, 60 * 81);
  Object.entries(SIX_JIA_DUN_STEMS).forEach(([dayGanZhi, dayDunStem]) => {
    const names = getClassicPatterns({
      jiuGongGe: [buildPalace('庚', dayDunStem), buildPalace(dayDunStem, '庚')],
      zhiFu: '',
      zhiShi: '',
      scope: 'hour',
      dayGanZhi,
    })
      .filter((pattern) =>
        AUDITED_QIMEN_CONTEXT_PATTERN_NAMES.includes(
          pattern.name as (typeof AUDITED_QIMEN_CONTEXT_PATTERN_NAMES)[number],
        ),
      )
      .map((pattern) => pattern.name);
    assert.ok(names.includes('伏干格'), `${dayGanZhi}应遁${dayDunStem}并命中伏干格`);
    assert.ok(names.includes('飞干格'), `${dayGanZhi}应遁${dayDunStem}并命中飞干格`);
  });
});

test('奇门伏干飞干缺少完整时家日柱、字段矛盾或日柱非法时失败关闭', () => {
  const palace = buildPalace('庚', '戊');
  const contextualNames = (patterns: ReturnType<typeof getClassicPatterns>) =>
    patterns.filter((pattern) =>
      AUDITED_QIMEN_CONTEXT_PATTERN_NAMES.includes(
        pattern.name as (typeof AUDITED_QIMEN_CONTEXT_PATTERN_NAMES)[number],
      ),
    );

  assert.deepEqual(
    contextualNames(getClassicPatterns({ jiuGongGe: [palace], zhiFu: '', zhiShi: '' })),
    [],
  );
  assert.deepEqual(
    contextualNames(
      getClassicPatterns({
        jiuGongGe: [palace],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        dayStem: '甲',
      }),
    ),
    [],
  );
  for (const scope of ['day', 'month', 'year'] as const) {
    assert.deepEqual(
      contextualNames(
        getClassicPatterns({
          jiuGongGe: [palace],
          zhiFu: '',
          zhiShi: '',
          scope,
          dayGanZhi: '甲子',
        }),
      ),
      [],
    );
  }
  assert.deepEqual(
    contextualNames(
      getClassicPatterns({
        jiuGongGe: [palace],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        dayGanZhi: '',
      }),
    ),
    [],
  );
  for (const invalid of ['甲丑', '甲', '甲子额外']) {
    assert.throws(
      () =>
        getClassicPatterns({
          jiuGongGe: [palace],
          zhiFu: '',
          zhiShi: '',
          scope: 'hour',
          dayGanZhi: invalid,
        }),
      /无法识别干支/,
    );
  }
  assert.throws(
    () =>
      getClassicPatterns({
        jiuGongGe: [palace],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        dayStem: '乙',
        dayGanZhi: '甲子',
      }),
    /日干“乙”与完整日柱“甲子”不一致/,
  );
  assert.throws(
    () =>
      getClassicPatterns({
        jiuGongGe: [palace],
        zhiFu: '',
        zhiShi: '',
        scope: '错误' as never,
        dayGanZhi: '甲子',
      }),
    /未知的奇门格局上下文级别/,
  );
});

test('奇门岁格按60年干支乘81种天地盘组合独立穷举且甲年使用六甲遁干', () => {
  const stemPairs = listAllStemPairs();
  let checked = 0;

  for (const yearGanZhi of jiazi) {
    const yearDunStem = SIX_JIA_DUN_STEMS[yearGanZhi] ?? yearGanZhi.charAt(0);

    for (const { heavenStem, earthStem } of stemPairs) {
      const patterns = getClassicPatterns({
        jiuGongGe: [buildPalace(heavenStem, earthStem)],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        yearGanZhi,
      }).filter((pattern) => pattern.name === '岁格');
      const expectedCount = heavenStem === '庚' && earthStem === yearDunStem ? 1 : 0;

      assert.equal(
        patterns.length,
        expectedCount,
        `${yearGanZhi}年天盘${heavenStem}加地盘${earthStem}`,
      );
      patterns.forEach((pattern) => {
        assert.equal(pattern.tone, 'neutral');
        assert.match(pattern.summary, new RegExp(`本年干支${yearGanZhi}`));
        assert.match(pattern.summary, /四书共同条件为“六庚加岁干为岁格”/);
        assert.match(pattern.summary, /兵占、出行和百事断语不泛化/);
        assert.doesNotMatch(pattern.summary, /必胜|必败|必遭|宜出|不宜出/);
      });
      checked += 1;
    }
  }

  assert.equal(checked, 60 * 81);
});

test('奇门岁格缺少完整时家年干支、适用级别不符或年干支非法时失败关闭', () => {
  const palace = buildPalace('庚', '戊');
  const getSuiGe = (context: Parameters<typeof getClassicPatterns>[0]) =>
    getClassicPatterns(context).filter((pattern) => pattern.name === '岁格');

  assert.deepEqual(getSuiGe({ jiuGongGe: [palace], zhiFu: '', zhiShi: '' }), []);
  assert.deepEqual(getSuiGe({ jiuGongGe: [palace], zhiFu: '', zhiShi: '', scope: 'hour' }), []);
  for (const scope of ['day', 'month', 'year'] as const) {
    assert.deepEqual(
      getSuiGe({
        jiuGongGe: [palace],
        zhiFu: '',
        zhiShi: '',
        scope,
        yearGanZhi: '甲子',
      }),
      [],
    );
  }
  for (const invalid of ['甲丑', '甲', '甲子额外']) {
    assert.throws(
      () =>
        getSuiGe({
          jiuGongGe: [palace],
          zhiFu: '',
          zhiShi: '',
          scope: 'hour',
          yearGanZhi: invalid,
        }),
      /无法识别干支/,
    );
  }
});

test('奇门六庚值符格勃按60时柱乘9种值符宫地盘干穷举且不退化为普通庚丙格', () => {
  const earthStems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  let checked = 0;

  for (const hourGanZhi of jiazi) {
    const xunHead = getXunHead(hourGanZhi);
    const valueSymbolStem = SIX_JIA_DUN_STEMS[xunHead];

    for (const earthStem of earthStems) {
      const palace = buildPalace(valueSymbolStem, earthStem);
      palace.tianPan.star = '天蓬';
      const patterns = getClassicPatterns({
        jiuGongGe: [palace],
        zhiFu: '天蓬',
        zhiShi: '休门',
        scope: 'hour',
        hourGanZhi,
      }).filter((pattern) => pattern.name === '格勃');
      const expectedCount = xunHead === '甲申' && earthStem === '丙' ? 1 : 0;

      assert.equal(patterns.length, expectedCount, `${hourGanZhi}时值符临地盘${earthStem}`);
      patterns.forEach((pattern) => {
        assert.equal(pattern.tone, 'neutral');
        assert.match(pattern.summary, /值符星天蓬携旬首所遁六庚/);
        assert.match(pattern.summary, /庚为值符临丙为飞勃，亦为格勃/);
        assert.match(pattern.summary, /不采用原典兵占进退、主客胜负或通用吉凶断语/);
      });
      checked += 1;
    }
  }

  assert.equal(checked, 60 * 9);

  const ordinaryGengOverBing = buildPalace('庚', '丙');
  ordinaryGengOverBing.tianPan.star = '天芮';
  const jiaZiValueSymbol = buildPalace('戊', '戊');
  jiaZiValueSymbol.tianPan.star = '天蓬';
  assert.deepEqual(
    getClassicPatterns({
      jiuGongGe: [ordinaryGengOverBing, jiaZiValueSymbol],
      zhiFu: '天蓬',
      zhiShi: '休门',
      scope: 'hour',
      hourGanZhi: '甲子',
    })
      .filter((pattern) => pattern.name === '格勃')
      .map((pattern) => pattern.name),
    [],
  );
});

test('奇门六庚值符格勃缺少身份字段、时柱非法或值符干矛盾时失败关闭', () => {
  const palace = buildPalace('庚', '丙');
  palace.tianPan.star = '天蓬';
  const base = {
    jiuGongGe: [palace],
    zhiFu: '天蓬',
    zhiShi: '休门',
    scope: 'hour' as const,
  };

  assert.deepEqual(
    getClassicPatterns(base).filter((pattern) => pattern.name === '格勃'),
    [],
  );
  assert.deepEqual(
    getClassicPatterns({ ...base, zhiFu: '', hourGanZhi: '丙戌' }).filter(
      (pattern) => pattern.name === '格勃',
    ),
    [],
  );
  assert.throws(
    () => getClassicPatterns({ ...base, hourGanZhi: '甲丑' }),
    /干支组合无效|无法识别干支/,
  );
  assert.throws(
    () => getClassicPatterns({ ...base, hourGanZhi: '甲子' }),
    /所属甲子旬应由值符携戊，实际为庚/,
  );
  assert.throws(
    () =>
      getClassicPatterns({
        ...base,
        jiuGongGe: [palace, { ...palace, gong: 2, name: '坤二宫' }],
        hourGanZhi: '丙戌',
      }),
    /应恰有一个落宫，实际为2个/,
  );
});

test('奇门伏干飞干进入证据提示词时只保留中性结构、交叉来源与适用边界', () => {
  let sample: ReturnType<typeof generateQimen> | undefined;
  for (let index = 0; index < 60 && !sample; index += 1) {
    const date = new Date('2024-01-01T00:00:00+08:00');
    date.setHours(date.getHours() + index * 2);
    const candidate = generateQimen(date);
    if (
      candidate.classicPatterns?.some(
        (pattern) => pattern.name === '伏干格' || pattern.name === '飞干格',
      )
    ) {
      sample = candidate;
    }
  }

  assert.ok(sample, '连续六十个时辰内应存在可达的伏干格或飞干格样本');
  const analysis = analyzeQimenEvidence(sample);
  const facts = analysis.patternFacts.filter(
    (fact) => fact.name === '伏干格' || fact.name === '飞干格',
  );
  const rule = analysis.ruleSourceFacts.find(
    (fact) => fact.key === 'rule:qimen:day-stem-context-patterns',
  );

  assert.ok(facts.length > 0);
  facts.forEach((fact) => {
    assert.equal(fact.traditionalTone, '中性');
    assert.ok(fact.sources.some((source) => source.includes('《遁甲演义》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门遁甲统宗》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门法窍》')));
    assert.match(fact.promptText, /完整盘面继续核验/);
    assert.match(fact.promptText, /不泛化为通用吉凶、现实结果或行动建议/);
    assert.doesNotMatch(fact.promptText, /必胜|必败|必遭擒|宜出行|不宜出行/);
  });
  assert.ok(rule);
  assert.match(rule.promptText, /甲子遁戊、甲戌遁己、甲申遁庚/);
  assert.match(rule.promptText, /月家、年家不得套用/);
  assert.match(rule.promptText, /不得把原典兵占、出行、主客利弊断语泛化/);
});

test('奇门岁格与六庚值符格勃在真实转盘飞盘中均与独立复算一致', () => {
  const start = new Date('2024-01-01T00:00:00+08:00');
  const reached = new Set<string>();
  let evidenceSample: ReturnType<typeof generateQimen> | undefined;

  for (const method of ['zhuanpan', 'feipan'] as const) {
    for (let hourOffset = 0; hourOffset < 60; hourOffset += 1) {
      const date = new Date(start);
      date.setHours(date.getHours() + hourOffset * 2);
      const chart = generateQimen(date, method);
      const yearDunStem = SIX_JIA_DUN_STEMS[chart.ganzhi.year] ?? chart.ganzhi.year.charAt(0);
      const expectedSuiGePalaces = chart.jiuGongGe
        .filter(
          (palace) => getTianPanStems(palace).includes('庚') && palace.diPan.stem === yearDunStem,
        )
        .map((palace) => palace.gong)
        .sort((a, b) => a - b);
      const actualSuiGePalaces = (chart.classicPatterns ?? [])
        .filter((pattern) => pattern.name === '岁格')
        .flatMap((pattern) => pattern.palaces)
        .sort((a, b) => a - b);
      assert.deepEqual(actualSuiGePalaces, expectedSuiGePalaces, `${method} ${date.toISOString()}`);

      const valueSymbolPalace = chart.jiuGongGe.find((palace) =>
        hasTianPanStar(palace, chart.zhiFu),
      );
      assert.ok(valueSymbolPalace);
      const expectedGeBo =
        getXunHead(chart.ganzhi.hour) === '甲申' &&
        getTianPanStemForStar(valueSymbolPalace, chart.zhiFu) === '庚' &&
        valueSymbolPalace.diPan.stem === '丙';
      const actualGeBo = (chart.classicPatterns ?? []).filter((pattern) => pattern.name === '格勃');
      assert.equal(actualGeBo.length, expectedGeBo ? 1 : 0, `${method} ${date.toISOString()}`);

      if (actualSuiGePalaces.length > 0) reached.add(`${method}:岁格`);
      if (actualGeBo.length > 0) {
        reached.add(`${method}:格勃`);
        evidenceSample ??= chart;
      }
    }
  }

  assert.deepEqual([...reached].sort(), [
    'feipan:岁格',
    'feipan:格勃',
    'zhuanpan:岁格',
    'zhuanpan:格勃',
  ]);
  assert.ok(evidenceSample);
  const analysis = analyzeQimenEvidence(evidenceSample);
  const geBoFact = analysis.patternFacts.find((fact) => fact.name === '格勃');
  const yearRule = analysis.ruleSourceFacts.find(
    (fact) => fact.key === 'rule:qimen:year-stem-context-patterns',
  );
  const geBoRule = analysis.ruleSourceFacts.find(
    (fact) => fact.key === 'rule:qimen:geng-value-symbol-pattern',
  );

  assert.ok(geBoFact);
  assert.equal(geBoFact.traditionalTone, '中性');
  assert.ok(geBoFact.sources.some((source) => source.includes('《奇门遁甲统宗》')));
  assert.ok(geBoFact.sources.some((source) => source.includes('《奇门宝鉴御定》')));
  assert.ok(geBoFact.sources.some((source) => source.includes('《奇门旨归》')));
  assert.match(geBoFact.promptText, /只供 AI 结合完整盘面继续核验/);
  assert.ok(yearRule);
  assert.match(yearRule.promptText, /甲年须按完整年干支确定甲子遁戊/);
  assert.match(yearRule.promptText, /月家、年家不得套用/);
  assert.ok(geBoRule);
  assert.match(geBoRule.promptText, /甲申旬、值符星实际携庚且值符宫天盘庚临地盘丙/);
  assert.match(geBoRule.promptText, /不得把普通庚加丙、普通丙加庚/);
});

test('奇门60日柱乘12时辰的位置索引均按六甲遁干定位日干与时干', () => {
  const start = new Date('2024-01-01T00:00:00+08:00');
  const checkedDayPillars = new Set<string>();
  const checkedHourPillars = new Set<string>();

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    for (let hourIndex = 0; hourIndex < 12; hourIndex += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(hourIndex * 2, 0, 0, 0);
      const chart = generateQimen(date);
      const evidence = analyzeQimenEvidence(chart);
      const expectedBySource = [
        ['日干落宫', SIX_JIA_DUN_STEMS[chart.ganzhi.day] ?? chart.ganzhi.day.charAt(0)],
        ['时干落宫', SIX_JIA_DUN_STEMS[chart.ganzhi.hour] ?? chart.ganzhi.hour.charAt(0)],
      ] as const;

      checkedDayPillars.add(chart.ganzhi.day);
      checkedHourPillars.add(chart.ganzhi.hour);
      for (const [source, stem] of expectedBySource) {
        const expectedPalaces = chart.jiuGongGe
          .filter((palace) => getTianPanStems(palace).includes(stem) || palace.diPan.stem === stem)
          .map((palace) => palace.gong)
          .sort((a, b) => a - b);
        const actualPalaces = evidence.positionIndexes
          .filter((item) => item.indexSources.includes(source))
          .map((item) => item.gong)
          .sort((a, b) => a - b);

        assert.deepEqual(
          actualPalaces,
          expectedPalaces,
          `${chart.ganzhi.day}日${chart.ganzhi.hour}时${source}`,
        );
      }
    }
  }

  assert.equal(checkedDayPillars.size, 60);
  assert.equal(checkedHourPillars.size, 60);
});

test('奇门提示词证据声明11项固定格与其余70项结构事实边界', () => {
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const relationRule = analysis.ruleSourceFacts.find((item) => item.key === 'rule:qimen:relations');

  assert.ok(relationRule);
  assert.match(relationRule.rule, /八十一种组合全部保留结构事实/);
  assert.match(relationRule.rule, /十一项固定格/);
  assert.match(relationRule.rule, /其余七十项不能单凭二元组合命名为传统格局/);
  assert.match(relationRule.promptText, /其余七十项不得单凭二元组合补造传统名称/);
  assert.match(
    relationRule.promptText,
    /时家另按独立上下文规则核验伏干格、飞干格、岁格与六庚值符临丙格勃/,
  );
  assert.ok(relationRule.sources.some((source) => source.includes('《遁甲演义》卷一')));
  assert.ok(relationRule.sources.some((source) => source.includes('《遁甲演义》卷二')));
  assert.match(relationRule.limitation, /不等于现代实证验证/);
});
