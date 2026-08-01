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

const PALACE_NAMES = [
  '',
  '坎一宫',
  '坤二宫',
  '震三宫',
  '巽四宫',
  '中五宫',
  '乾六宫',
  '兑七宫',
  '艮八宫',
  '离九宫',
] as const;

function buildPalaceAt(gong: number, heavenStem: string, earthStem = '戊'): QimenJiuGongGe {
  return {
    ...buildPalace(heavenStem, earthStem),
    gong,
    name: PALACE_NAMES[gong] ?? `${gong}宫`,
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

test('奇门三奇升殿按9种天盘奇仪乘9宫共81组独立穷举且仅命中三项共同条件', () => {
  const tianPanStems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  const expectedByPosition = new Map([
    ['乙:3', '乙奇升殿'],
    ['丙:9', '丙奇升殿'],
    ['丁:7', '丁奇升殿'],
  ]);
  let checked = 0;

  for (const heavenStem of tianPanStems) {
    for (let gong = 1; gong <= 9; gong += 1) {
      const patterns = getClassicPatterns({
        jiuGongGe: [buildPalaceAt(gong, heavenStem)],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
      }).filter((pattern) => /奇升殿$/.test(pattern.name));
      const expectedName = expectedByPosition.get(`${heavenStem}:${gong}`);

      assert.deepEqual(
        patterns.map((pattern) => pattern.name),
        expectedName ? [expectedName] : [],
        `天盘${heavenStem}落${gong}宫`,
      );
      patterns.forEach((pattern) => {
        assert.equal(pattern.tone, 'neutral');
        assert.deepEqual(pattern.tokens, [heavenStem]);
        assert.match(pattern.summary, /三奇与宫位的可复算结构/);
        assert.match(pattern.summary, /吉门、门迫与入墓/);
        assert.match(pattern.summary, /不得仅据升殿名称生成吉凶、方位、行动或现实结果/);
        assert.doesNotMatch(pattern.summary, /百事皆吉|百事吉昌|必成|必胜|协商顺利|作品被认可/);
      });
      checked += 1;
    }
  }

  assert.equal(checked, 81);
});

test('奇门三奇升殿缺少时家级别、误用地盘或采用旧乙到巽四条件时失败关闭', () => {
  const getShengDian = (context: Parameters<typeof getClassicPatterns>[0]) =>
    getClassicPatterns(context).filter((pattern) => /奇升殿$/.test(pattern.name));
  const yiAtZhen = buildPalaceAt(3, '乙');

  assert.deepEqual(getShengDian({ jiuGongGe: [yiAtZhen], zhiFu: '', zhiShi: '' }), []);
  for (const scope of ['day', 'month', 'year'] as const) {
    assert.deepEqual(
      getShengDian({ jiuGongGe: [yiAtZhen], zhiFu: '', zhiShi: '', scope }),
      [],
      `${scope}级别不得外推三奇升殿`,
    );
  }
  assert.deepEqual(
    getShengDian({
      jiuGongGe: [buildPalaceAt(3, '戊', '乙')],
      zhiFu: '',
      zhiShi: '',
      scope: 'hour',
    }),
    [],
    '地盘乙在震三而天盘不是乙不得命中',
  );
  assert.deepEqual(
    getShengDian({
      jiuGongGe: [buildPalaceAt(4, '乙')],
      zhiFu: '',
      zhiShi: '',
      scope: 'hour',
    }),
    [],
    '旧实现误收的乙奇到巽四必须关闭',
  );
});

test('奇门三诈按9种天盘奇仪乘8门乘8神共576组独立穷举且仅27组命中', () => {
  const tianPanStems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  const doors = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'] as const;
  const gods = ['值符', '九天', '九地', '玄武', '白虎', '六合', '太阴', '螣蛇'] as const;
  const sanQi = new Set(['乙', '丙', '丁']);
  const sanJiDoors = new Set(['开门', '休门', '生门']);
  const expectedByGod = new Map([
    ['太阴', '真诈'],
    ['九地', '重诈'],
    ['六合', '休诈'],
  ]);
  let checked = 0;
  let matched = 0;

  for (const heavenStem of tianPanStems) {
    for (const door of doors) {
      for (const god of gods) {
        const patterns = getClassicPatterns({
          jiuGongGe: [
            {
              ...buildPalaceAt(1, heavenStem),
              renPan: { door },
              shenPan: { god },
            },
          ],
          zhiFu: '',
          zhiShi: '',
          scope: 'hour',
        }).filter((pattern) => ['真诈', '重诈', '休诈'].includes(pattern.name));
        const expectedName =
          sanQi.has(heavenStem) && sanJiDoors.has(door) ? expectedByGod.get(god) : undefined;

        assert.deepEqual(
          patterns.map((pattern) => pattern.name),
          expectedName ? [expectedName] : [],
          `天盘${heavenStem}/${door}/${god}`,
        );
        patterns.forEach((pattern) => {
          assert.equal(pattern.tone, 'neutral');
          assert.deepEqual(pattern.tokens, [heavenStem]);
          assert.match(pattern.summary, /奇、门、神三层可复算结构/);
          assert.match(pattern.summary, /缺少任一层只保留原始盘面事实/);
          assert.match(pattern.summary, /不得据格名生成吉凶、用途、方位、行动或现实结果/);
          assert.doesNotMatch(pattern.summary, /百事皆吉|万事皆吉|大吉|必成|必胜/);
        });
        checked += 1;
        matched += patterns.length;
      }
    }
  }

  assert.equal(checked, 576);
  assert.equal(matched, 27);
});

test('奇门三诈缺少时家级别、任一同宫层或只在地盘见三奇时失败关闭', () => {
  const getSanZha = (context: Parameters<typeof getClassicPatterns>[0]) =>
    getClassicPatterns(context).filter((pattern) =>
      ['真诈', '重诈', '休诈'].includes(pattern.name),
    );
  const completePalace = {
    ...buildPalaceAt(1, '乙'),
    renPan: { door: '开门' },
    shenPan: { god: '太阴' },
  };

  assert.deepEqual(getSanZha({ jiuGongGe: [completePalace], zhiFu: '', zhiShi: '' }), []);
  for (const scope of ['day', 'month', 'year'] as const) {
    assert.deepEqual(
      getSanZha({ jiuGongGe: [completePalace], zhiFu: '', zhiShi: '', scope }),
      [],
      `${scope}级别不得外推三诈`,
    );
  }
  assert.deepEqual(
    getSanZha({
      jiuGongGe: [
        {
          ...buildPalaceAt(1, '戊', '乙'),
          renPan: { door: '开门' },
          shenPan: { god: '太阴' },
        },
      ],
      zhiFu: '',
      zhiShi: '',
      scope: 'hour',
    }),
    [],
    '地盘乙不得冒充天盘三奇',
  );
  for (const palace of [
    { ...completePalace, renPan: { door: '景门' } },
    { ...completePalace, shenPan: { god: '九天' } },
    { ...completePalace, tianPan: { star: '', stem: '戊' } },
  ]) {
    assert.deepEqual(getSanZha({ jiuGongGe: [palace], zhiFu: '', zhiShi: '', scope: 'hour' }), []);
  }

  const companionStemPattern = getSanZha({
    jiuGongGe: [
      {
        ...completePalace,
        tianPan: { star: '天芮', stem: '戊', companionStar: '天禽', companionStem: '乙' },
      },
    ],
    zhiFu: '',
    zhiShi: '',
    scope: 'hour',
  });
  assert.deepEqual(
    companionStemPattern.map((pattern) => pattern.name),
    ['真诈'],
  );
  assert.deepEqual(companionStemPattern[0]?.tokens, ['乙']);
});

test('奇门三项条件一致五假按9种天盘奇仪乘8门乘8神共576组独立穷举且仅9组命中', () => {
  const tianPanStems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  const doors = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'] as const;
  const gods = ['值符', '九天', '九地', '玄武', '白虎', '六合', '太阴', '螣蛇'] as const;
  const tianJiaStems = new Set(['乙', '丙', '丁']);
  const diGuiJiaStems = new Set(['丁', '己', '癸']);
  let checked = 0;
  let matched = 0;

  for (const heavenStem of tianPanStems) {
    for (const door of doors) {
      for (const god of gods) {
        const patterns = getClassicPatterns({
          jiuGongGe: [
            {
              ...buildPalaceAt(1, heavenStem),
              renPan: { door },
              shenPan: { god },
            },
          ],
          zhiFu: '',
          zhiShi: '',
          scope: 'hour',
        }).filter((pattern) => ['天假', '地假', '鬼假'].includes(pattern.name));
        const expectedNames = [
          ...(tianJiaStems.has(heavenStem) && door === '景门' && god === '九天' ? ['天假'] : []),
          ...(diGuiJiaStems.has(heavenStem) && door === '杜门' && god === '九地' ? ['地假'] : []),
          ...(diGuiJiaStems.has(heavenStem) && door === '死门' && god === '九地' ? ['鬼假'] : []),
        ];

        assert.deepEqual(
          patterns.map((pattern) => pattern.name),
          expectedNames,
          `天盘${heavenStem}/${door}/${god}`,
        );
        patterns.forEach((pattern) => {
          assert.equal(pattern.tone, 'neutral');
          assert.deepEqual(pattern.tokens, [heavenStem]);
          assert.match(pattern.summary, /天盘干、门、神三层可复算结构/);
          assert.match(pattern.summary, /人假、物假、神假以及地假太阴\/六合扩展存在版本冲突/);
          assert.match(pattern.summary, /不得据格名生成吉凶、用途、方位、行动或现实结果/);
          assert.doesNotMatch(pattern.summary, /百事皆吉|万事皆吉|大吉|必成|必胜/);
        });
        checked += 1;
        matched += patterns.length;
      }
    }
  }

  assert.equal(checked, 576);
  assert.equal(matched, 9);
});

test('奇门三项条件一致五假缺时家级别、缺任一同宫层、只见地盘干或采用冲突扩展时失败关闭', () => {
  const getAuditedWuJia = (context: Parameters<typeof getClassicPatterns>[0]) =>
    getClassicPatterns(context).filter((pattern) =>
      ['天假', '地假', '鬼假'].includes(pattern.name),
    );
  const completePalace = {
    ...buildPalaceAt(1, '乙'),
    renPan: { door: '景门' },
    shenPan: { god: '九天' },
  };

  assert.deepEqual(getAuditedWuJia({ jiuGongGe: [completePalace], zhiFu: '', zhiShi: '' }), []);
  for (const scope of ['day', 'month', 'year'] as const) {
    assert.deepEqual(
      getAuditedWuJia({ jiuGongGe: [completePalace], zhiFu: '', zhiShi: '', scope }),
      [],
      `${scope}级别不得外推三项条件一致五假结构`,
    );
  }
  assert.deepEqual(
    getAuditedWuJia({
      jiuGongGe: [
        {
          ...buildPalaceAt(1, '戊', '乙'),
          renPan: { door: '景门' },
          shenPan: { god: '九天' },
        },
      ],
      zhiFu: '',
      zhiShi: '',
      scope: 'hour',
    }),
    [],
    '地盘乙不得冒充天盘乙',
  );
  for (const palace of [
    { ...completePalace, renPan: { door: '' } },
    { ...completePalace, shenPan: { god: '' } },
    { ...completePalace, tianPan: { star: '', stem: '' } },
  ]) {
    assert.deepEqual(
      getAuditedWuJia({ jiuGongGe: [palace], zhiFu: '', zhiShi: '', scope: 'hour' }),
      [],
    );
  }

  const companionStemPattern = getAuditedWuJia({
    jiuGongGe: [
      {
        ...completePalace,
        tianPan: { star: '天芮', stem: '戊', companionStar: '天禽', companionStem: '乙' },
      },
    ],
    zhiFu: '',
    zhiShi: '',
    scope: 'hour',
  });
  assert.deepEqual(
    companionStemPattern.map((pattern) => pattern.name),
    ['天假'],
  );
  assert.deepEqual(companionStemPattern[0]?.tokens, ['乙']);

  const conflictingExpansions = [
    { stem: '丁', door: '惊门', god: '六合' },
    { stem: '丁', door: '惊门', god: '玄武' },
    { stem: '丁', door: '伤门', god: '九天' },
    { stem: '丁', door: '杜门', god: '太阴' },
    { stem: '丁', door: '杜门', god: '六合' },
  ];
  for (const { stem, door, god } of conflictingExpansions) {
    const allPatterns = getClassicPatterns({
      jiuGongGe: [
        {
          ...buildPalaceAt(1, stem),
          renPan: { door },
          shenPan: { god },
        },
      ],
      zhiFu: '',
      zhiShi: '',
      scope: 'hour',
    });
    assert.deepEqual(
      getAuditedWuJia({
        jiuGongGe: [
          {
            ...buildPalaceAt(1, stem),
            renPan: { door },
            shenPan: { god },
          },
        ],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
      }),
      [],
    );
    assert.doesNotMatch(JSON.stringify(allPatterns), /人假|物假|神假/);
  }
});

test('奇门九遁按奇仪门神与宫位四万六千六百五十六种组合穷举失败关闭', () => {
  const stems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  const doors = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'] as const;
  const gods = ['值符', '九天', '九地', '玄武', '白虎', '六合', '太阴', '螣蛇'] as const;
  const forbidden = new Set([
    '天遁',
    '地遁',
    '人遁',
    '神遁',
    '鬼遁',
    '龙遁',
    '虎遁',
    '风遁',
    '云遁',
  ]);
  const palaces: QimenJiuGongGe[] = [];

  for (const heavenStem of stems) {
    for (const earthStem of stems) {
      for (const door of doors) {
        for (const god of gods) {
          for (let gong = 1; gong <= 9; gong += 1) {
            palaces.push({
              ...buildPalaceAt(gong, heavenStem, earthStem),
              renPan: { door },
              shenPan: { god },
            });
          }
        }
      }
    }
  }

  const leaked = getClassicPatterns({
    jiuGongGe: palaces,
    zhiFu: '',
    zhiShi: '开门',
    scope: 'hour',
  }).filter((pattern) => forbidden.has(pattern.name));

  assert.equal(palaces.length, 46_656);
  assert.deepEqual(leaked, []);
});

test('奇门三奇得使按三奇六仪门神宫位和值使八万二千九百四十四种组合穷举失败关闭', () => {
  const sanQi = ['乙', '丙', '丁'] as const;
  const liuYi = ['戊', '己', '庚', '辛', '壬', '癸'] as const;
  const doors = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'] as const;
  const gods = ['值符', '九天', '九地', '玄武', '白虎', '六合', '太阴', '螣蛇'] as const;
  const forbidden = new Set(['三奇得使', '三奇游六仪']);
  const palaces: QimenJiuGongGe[] = [];

  for (const heavenStem of sanQi) {
    for (const earthStem of liuYi) {
      for (const door of doors) {
        for (const god of gods) {
          for (let gong = 1; gong <= 9; gong += 1) {
            palaces.push({
              ...buildPalaceAt(gong, heavenStem, earthStem),
              renPan: { door },
              shenPan: { god },
            });
          }
        }
      }
    }
  }

  for (const zhiShi of doors) {
    const leaked = getClassicPatterns({
      jiuGongGe: palaces,
      zhiFu: '',
      zhiShi,
      scope: 'hour',
    }).filter((pattern) => forbidden.has(pattern.name));

    assert.deepEqual(leaked, [], `值使${zhiShi}`);
  }

  assert.equal(palaces.length * doors.length, 82_944);
});

test('奇门九遁与三奇得使冲突样例只保留原始盘面事实', () => {
  const samples = [
    ['天遁六丁本', '丙', '丁', '生门', '九天', '生门'],
    ['天遁六戊本', '丙', '戊', '生门', '九天', '生门'],
    ['天遁开门扩展', '丙', '丁', '开门', '九天', '开门'],
    ['地遁九地扩展', '乙', '己', '开门', '九地', '开门'],
    ['地遁太阴扩展', '乙', '己', '开门', '太阴', '开门'],
    ['人遁地乙休门本', '丁', '乙', '休门', '太阴', '休门'],
    ['人遁地乙生门扩展', '丁', '乙', '生门', '太阴', '生门'],
    ['三奇得使固定六甲表', '乙', '己', '伤门', '值符', '伤门'],
    ['三奇得使值使门本', '乙', '戊', '开门', '六合', '开门'],
    ['三奇得使并合本', '乙', '己', '开门', '值符', '开门'],
  ] as const;
  const forbidden = /天遁|地遁|人遁|神遁|鬼遁|龙遁|虎遁|风遁|云遁|三奇得使|三奇游六仪/;

  for (const [label, heavenStem, earthStem, door, god, zhiShi] of samples) {
    const palace = {
      ...buildPalaceAt(1, heavenStem, earthStem),
      renPan: { door },
      shenPan: { god },
    };
    const patterns = getClassicPatterns({
      jiuGongGe: [palace],
      zhiFu: '',
      zhiShi,
      scope: 'hour',
    });

    assert.doesNotMatch(patterns.map((pattern) => pattern.name).join('、'), forbidden, label);
    assert.equal(palace.tianPan.stem, heavenStem, `${label}应保留天盘干`);
    assert.equal(palace.diPan.stem, earthStem, `${label}应保留地盘干`);
    assert.equal(palace.renPan.door, door, `${label}应保留门`);
    assert.equal(palace.shenPan.god, god, `${label}应保留神`);
    assert.equal(palace.gong, 1, `${label}应保留宫位`);
  }
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

test('奇门三奇升殿在真实转盘飞盘中与天盘落宫独立复算一致且三项均可达', () => {
  const start = new Date('2024-01-01T00:00:00+08:00');
  const targetByPalace = new Map([
    [3, { stem: '乙', name: '乙奇升殿' }],
    [9, { stem: '丙', name: '丙奇升殿' }],
    [7, { stem: '丁', name: '丁奇升殿' }],
  ]);
  const reached = new Set<string>();
  const evidenceSamples = new Map<string, ReturnType<typeof generateQimen>>();

  for (const method of ['zhuanpan', 'feipan'] as const) {
    for (let hourOffset = 0; hourOffset < 60; hourOffset += 1) {
      const date = new Date(start);
      date.setHours(date.getHours() + hourOffset * 2);
      const chart = generateQimen(date, method);
      const expected = [...targetByPalace.entries()]
        .filter(([gong, config]) => {
          const palace = chart.jiuGongGe.find((item) => item.gong === gong);
          return palace ? getTianPanStems(palace).includes(config.stem) : false;
        })
        .map(([gong, config]) => `${config.name}:${gong}`)
        .sort();
      const actual = (chart.classicPatterns ?? [])
        .filter((pattern) => /奇升殿$/.test(pattern.name))
        .flatMap((pattern) => pattern.palaces.map((gong) => `${pattern.name}:${gong}`))
        .sort();

      assert.deepEqual(actual, expected, `${method} ${date.toISOString()}`);
      for (const value of actual) {
        const name = value.split(':')[0];
        reached.add(`${method}:${name}`);
        evidenceSamples.set(name, chart);
      }
    }
  }

  assert.deepEqual([...reached].sort(), [
    'feipan:丁奇升殿',
    'feipan:丙奇升殿',
    'feipan:乙奇升殿',
    'zhuanpan:丁奇升殿',
    'zhuanpan:丙奇升殿',
    'zhuanpan:乙奇升殿',
  ]);
  for (const name of ['乙奇升殿', '丙奇升殿', '丁奇升殿']) {
    const sample = evidenceSamples.get(name);
    assert.ok(sample, `${name}应有真实生成盘样本`);
    const analysis = analyzeQimenEvidence(sample);
    const fact = analysis.patternFacts.find((item) => item.name === name);
    const rule = analysis.ruleSourceFacts.find(
      (item) => item.key === 'rule:qimen:san-qi-sheng-dian-position',
    );

    assert.ok(fact);
    assert.equal(fact.traditionalTone, '中性');
    assert.ok(fact.sources.some((source) => source.includes('《奇门法窍》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门旨归》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门遁甲秘笈大全》')));
    assert.match(fact.promptText, /只供 AI 结合完整盘面继续核验/);
    assert.match(fact.promptText, /吉门、门迫与入墓/);
    assert.doesNotMatch(fact.promptText, /百事皆吉|百事吉昌|必成|必胜/);
    assert.ok(rule);
    assert.equal(rule.category, '三奇升殿位置规则');
    assert.match(rule.promptText, /乙奇升殿、丙奇升殿或丁奇升殿/);
    assert.match(rule.promptText, /乙到巽四等相邻或异说位置混入/);
    assert.match(rule.promptText, /吉门、门迫与入墓/);
    assert.match(rule.promptText, /月家、年家不得套用/);
  }
});

test('奇门三诈在真实转盘飞盘中与奇门神三层同宫独立复算一致且三项均可达', () => {
  const start = new Date('2024-01-01T00:00:00+08:00');
  const sanQi = new Set(['乙', '丙', '丁']);
  const sanJiDoors = new Set(['开门', '休门', '生门']);
  const nameByGod = new Map([
    ['太阴', '真诈'],
    ['九地', '重诈'],
    ['六合', '休诈'],
  ]);
  const reached = new Set<string>();
  const evidenceSamples = new Map<string, ReturnType<typeof generateQimen>>();

  for (const method of ['zhuanpan', 'feipan'] as const) {
    for (let hourOffset = 0; hourOffset < 60; hourOffset += 1) {
      const date = new Date(start);
      date.setHours(date.getHours() + hourOffset * 2);
      const chart = generateQimen(date, method);
      const expected = chart.jiuGongGe
        .flatMap((palace) => {
          const name = nameByGod.get(palace.shenPan.god);
          const hasSanQi = getTianPanStems(palace).some((stem) => sanQi.has(stem));
          return name && hasSanQi && sanJiDoors.has(palace.renPan.door)
            ? [`${name}:${palace.gong}`]
            : [];
        })
        .sort();
      const actual = (chart.classicPatterns ?? [])
        .filter((pattern) => ['真诈', '重诈', '休诈'].includes(pattern.name))
        .flatMap((pattern) => pattern.palaces.map((gong) => `${pattern.name}:${gong}`))
        .sort();

      assert.deepEqual(actual, expected, `${method} ${date.toISOString()}`);
      for (const value of actual) {
        const name = value.split(':')[0];
        reached.add(`${method}:${name}`);
        evidenceSamples.set(name, chart);
      }
    }
  }

  assert.deepEqual([...reached].sort(), [
    'feipan:休诈',
    'feipan:真诈',
    'feipan:重诈',
    'zhuanpan:休诈',
    'zhuanpan:真诈',
    'zhuanpan:重诈',
  ]);
  for (const name of ['真诈', '重诈', '休诈']) {
    const sample = evidenceSamples.get(name);
    assert.ok(sample, `${name}应有真实生成盘样本`);
    const analysis = analyzeQimenEvidence(sample);
    const fact = analysis.patternFacts.find((item) => item.name === name);
    const rule = analysis.ruleSourceFacts.find(
      (item) => item.key === 'rule:qimen:san-zha-position',
    );

    assert.ok(fact);
    assert.equal(fact.traditionalTone, '中性');
    assert.ok(fact.sources.some((source) => source.includes('《遁甲演义》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门法窍》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门旨归》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门遁甲秘笈大全》')));
    assert.match(fact.promptText, /只供 AI 结合完整盘面继续核验/);
    assert.match(fact.promptText, /奇、门、神三层可复算结构/);
    assert.doesNotMatch(fact.promptText, /百事皆吉|万事皆吉|大吉|必成|必胜/);
    assert.ok(rule);
    assert.equal(rule.category, '三诈位置规则');
    assert.match(rule.promptText, /缺少奇、门、神任一层/);
    assert.match(rule.promptText, /不得据格名生成吉凶、用途、方位、行动或现实结果/);
    assert.match(rule.promptText, /月家、年家不得套用/);
  }
});

test('奇门三项条件一致五假在真实转盘飞盘中与奇仪门神三层同宫独立复算一致且三项均可达', () => {
  const start = new Date('2024-01-01T00:00:00+08:00');
  const reached = new Set<string>();
  const evidenceSamples = new Map<string, ReturnType<typeof generateQimen>>();
  const auditedNames = new Set(['天假', '地假', '鬼假']);
  const expectedConfigs = [
    { name: '天假', stems: new Set(['乙', '丙', '丁']), door: '景门', god: '九天' },
    { name: '地假', stems: new Set(['丁', '己', '癸']), door: '杜门', god: '九地' },
    { name: '鬼假', stems: new Set(['丁', '己', '癸']), door: '死门', god: '九地' },
  ] as const;

  for (const method of ['zhuanpan', 'feipan'] as const) {
    for (let index = 0; index < 180; index += 1) {
      const date = new Date(start);
      date.setHours(date.getHours() + index * 2);
      const chart = generateQimen(date, method);
      const actual = (chart.classicPatterns ?? [])
        .filter((pattern) => auditedNames.has(pattern.name))
        .flatMap((pattern) => pattern.palaces.map((palace) => `${pattern.name}:${palace}`))
        .sort();
      const expected = chart.jiuGongGe
        .flatMap((palace) => {
          const stems = getTianPanStems(palace);
          return expectedConfigs
            .filter(
              (config) =>
                palace.renPan.door === config.door &&
                palace.shenPan.god === config.god &&
                stems.some((stem) => config.stems.has(stem)),
            )
            .map((config) => `${config.name}:${palace.gong}`);
        })
        .sort();

      assert.deepEqual(actual, expected, `${method} ${date.toISOString()}`);
      for (const value of actual) {
        const name = value.split(':')[0];
        reached.add(`${method}:${name}`);
        evidenceSamples.set(name, chart);
      }
    }
  }

  assert.deepEqual([...reached].sort(), [
    'feipan:地假',
    'feipan:天假',
    'feipan:鬼假',
    'zhuanpan:地假',
    'zhuanpan:天假',
    'zhuanpan:鬼假',
  ]);
  for (const name of ['天假', '地假', '鬼假']) {
    const sample = evidenceSamples.get(name);
    assert.ok(sample, `${name}应有真实生成盘样本`);
    const analysis = analyzeQimenEvidence(sample);
    const fact = analysis.patternFacts.find((item) => item.name === name);
    const rule = analysis.ruleSourceFacts.find(
      (item) => item.key === 'rule:qimen:audited-wu-jia-position',
    );

    assert.ok(fact);
    assert.equal(fact.traditionalTone, '中性');
    assert.ok(fact.sources.some((source) => source.includes('《遁甲演义》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门法窍》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门旨归》')));
    assert.ok(fact.sources.some((source) => source.includes('《奇门遁甲秘笈大全》')));
    assert.match(fact.promptText, /只供 AI 结合完整盘面继续核验/);
    assert.match(fact.promptText, /天盘干、门、神三层可复算结构/);
    assert.doesNotMatch(fact.promptText, /百事皆吉|万事皆吉|大吉|必成|必胜/);
    assert.ok(rule);
    assert.equal(rule.category, '条件一致五假位置规则');
    assert.match(rule.promptText, /缺少天盘奇仪、门、神任一层/);
    assert.match(rule.promptText, /人假、物假、神假及地假太阴\/六合扩展存在版本冲突/);
    assert.match(rule.promptText, /不得据格名生成吉凶、用途、方位、行动或现实结果/);
    assert.match(rule.promptText, /月家、年家不得套用/);
  }
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
    /时家另按独立上下文规则核验伏干格、飞干格、岁格、六庚值符临丙格勃、三奇升殿、三诈、天假\/严格地假\/鬼假与玉女守门位置结构/,
  );
  assert.ok(relationRule.sources.some((source) => source.includes('《遁甲演义》卷一')));
  assert.ok(relationRule.sources.some((source) => source.includes('《遁甲演义》卷二')));
  assert.match(relationRule.limitation, /不等于现代实证验证/);
});

test('奇门证据应公开九遁与三奇得使的具体版本冲突及失败关闭边界', () => {
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const nineEscapes = analysis.ruleSourceFacts.find(
    (item) => item.key === 'rule:qimen:nine-escapes-version-boundary',
  );
  const sanQiDeShi = analysis.ruleSourceFacts.find(
    (item) => item.key === 'rule:qimen:san-qi-de-shi-version-boundary',
  );

  assert.ok(nineEscapes);
  assert.equal(nineEscapes.category, '九遁版本冲突边界');
  assert.deepEqual(nineEscapes.appliesTo.slice(0, 3), ['天遁', '地遁', '人遁']);
  assert.ok(nineEscapes.sources.some((source) => source.includes('地盘丁')));
  assert.ok(nineEscapes.sources.some((source) => source.includes('六戊')));
  assert.match(nineEscapes.promptText, /不得从盘面自动补成天遁、地遁、人遁/);
  assert.match(nineEscapes.promptText, /只能引用当前宫天盘干、地盘干、门、神和宫位事实/);
  assert.doesNotMatch(nineEscapes.promptText, /百事皆吉|万事皆吉|必成|必胜/);

  assert.ok(sanQiDeShi);
  assert.equal(sanQiDeShi.category, '三奇得使版本冲突边界');
  assert.ok(sanQiDeShi.sources.some((source) => source.includes('三奇游六仪')));
  assert.ok(sanQiDeShi.sources.some((source) => source.includes('值使')));
  assert.match(sanQiDeShi.promptText, /不得从天盘三奇加地盘六仪/);
  assert.match(sanQiDeShi.promptText, /提示词只引用天盘三奇、地盘六仪、当前门、值使和值符/);
  assert.match(sanQiDeShi.promptText, /不得继承“百事吉”等断语/);
});

test('玉女守门穷举60时柱乘8值使门乘9地盘干仅命中六时临地丁', () => {
  const doors = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'] as const;
  const earthStems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  const expectedHours = new Set(['庚午', '己卯', '戊子', '丁酉', '丙午', '乙卯']);
  let checked = 0;
  let matched = 0;

  for (const hourGanZhi of jiazi) {
    for (const door of doors) {
      for (const earthStem of earthStems) {
        const palace = {
          ...buildPalaceAt(1, '', earthStem),
          renPan: { door },
        };
        const patterns = getClassicPatterns({
          jiuGongGe: [palace],
          zhiFu: '',
          zhiShi: door,
          scope: 'hour',
          hourGanZhi,
        }).filter((pattern) => pattern.name === '玉女守门');
        const expected = expectedHours.has(hourGanZhi) && earthStem === '丁';

        assert.equal(patterns.length, expected ? 1 : 0, `${hourGanZhi}/${door}/地盘${earthStem}`);
        patterns.forEach((pattern) => {
          assert.equal(pattern.tone, 'neutral');
          assert.equal(pattern.palace, 1);
          assert.deepEqual(pattern.tokens, ['丁']);
          assert.match(pattern.summary, /固定时柱、值使门与地盘丁的可复算事实/);
          assert.doesNotMatch(pattern.summary, /大吉|必成|必胜|百事皆吉/);
        });
        checked += 1;
        matched += patterns.length;
      }
    }
  }

  assert.equal(checked, 4_320);
  assert.equal(matched, 48);
});

test('玉女守门缺少唯一值使落宫、非时家或条件不全时失败关闭', () => {
  const valueDoorPalace = {
    ...buildPalaceAt(1, '', '丁'),
    renPan: { door: '休门' },
  };
  const getYuNv = (context: Parameters<typeof getClassicPatterns>[0]) =>
    getClassicPatterns(context).filter((pattern) => pattern.name === '玉女守门');
  const base = {
    jiuGongGe: [valueDoorPalace],
    zhiFu: '',
    zhiShi: '休门',
    scope: 'hour' as const,
    hourGanZhi: '庚午',
  };

  assert.equal(getYuNv(base).length, 1);
  assert.deepEqual(getYuNv({ ...base, zhiShi: '' }), []);
  assert.deepEqual(
    getYuNv({
      ...base,
      jiuGongGe: [valueDoorPalace, { ...buildPalaceAt(2, '', '丁'), renPan: { door: '休门' } }],
    }),
    [],
  );
  assert.deepEqual(getYuNv({ ...base, scope: 'month' }), []);
  assert.deepEqual(getYuNv({ ...base, hourGanZhi: '辛未' }), []);
  assert.deepEqual(
    getYuNv({ ...base, jiuGongGe: [{ ...valueDoorPalace, diPan: { stem: '丙' } }] }),
    [],
  );
});

test('玉女守门在真实转盘飞盘中与六时及值使临地丁独立复算一致', () => {
  const start = new Date('2024-01-01T00:00:00+08:00');
  const expectedHours = new Set(['庚午', '己卯', '戊子', '丁酉', '丙午', '乙卯']);
  const reached = new Set<string>();
  let evidenceSample: ReturnType<typeof generateQimen> | undefined;

  for (const method of ['zhuanpan', 'feipan'] as const) {
    for (let hourOffset = 0; hourOffset < 60; hourOffset += 1) {
      const date = new Date(start);
      date.setHours(date.getHours() + hourOffset * 2);
      const chart = generateQimen(date, method);
      const valueDoorPalaces = chart.jiuGongGe.filter(
        (palace) => palace.renPan.door === chart.zhiShi,
      );
      const expected =
        expectedHours.has(chart.ganzhi.hour) &&
        valueDoorPalaces.length === 1 &&
        valueDoorPalaces[0].diPan.stem === '丁';
      const actual = (chart.classicPatterns ?? []).filter((pattern) => pattern.name === '玉女守门');

      assert.equal(actual.length, expected ? 1 : 0, `${method} ${date.toISOString()}`);
      if (actual.length > 0) {
        reached.add(method);
        evidenceSample ??= chart;
      }
    }
  }

  assert.deepEqual([...reached].sort(), ['feipan', 'zhuanpan']);
  assert.ok(evidenceSample);
  const analysis = analyzeQimenEvidence(evidenceSample);
  const fact = analysis.patternFacts.find((item) => item.name === '玉女守门');
  const rule = analysis.ruleSourceFacts.find((item) => item.key === 'rule:qimen:yu-nv-shou-men');

  assert.ok(fact);
  assert.equal(fact.traditionalTone, '中性');
  assert.ok(fact.sources.some((source) => source.includes('《武经总要》')));
  assert.ok(fact.sources.some((source) => source.includes('《遁甲演义》')));
  assert.ok(fact.sources.some((source) => source.includes('《奇门宝鉴御定》')));
  assert.match(fact.promptText, /只供 AI 结合完整盘面继续核验/);
  assert.doesNotMatch(fact.promptText, /大吉|必成|必胜|百事皆吉/);
  assert.ok(rule);
  assert.equal(rule.category, '玉女守门时家结构规则');
  assert.match(rule.promptText, /值使门在九宫中只有一个落宫/);
  assert.match(rule.promptText, /宴会、阴私、出行或吉凶断语/);
});

test('天辅时120种日干时支组合全部失败关闭并公开版本冲突', () => {
  const dayStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
  const hourBranches = [
    '子',
    '丑',
    '寅',
    '卯',
    '辰',
    '巳',
    '午',
    '未',
    '申',
    '酉',
    '戌',
    '亥',
  ] as const;
  let checked = 0;

  for (const dayStem of dayStems) {
    const dayGanZhi = jiazi.find((item) => item.startsWith(dayStem));
    assert.ok(dayGanZhi);
    for (const hourBranch of hourBranches) {
      const hourGanZhi = jiazi.find((item) => item.endsWith(hourBranch));
      assert.ok(hourGanZhi);
      const patterns = getClassicPatterns({
        jiuGongGe: [buildPalace('', '')],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        dayGanZhi,
        hourGanZhi,
      });

      assert.ok(!patterns.some((pattern) => pattern.name === '天辅时'));
      checked += 1;
    }
  }

  assert.equal(checked, 120);
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const rule = analysis.ruleSourceFacts.find(
    (item) => item.key === 'rule:qimen:tian-fu-hour-version-boundary',
  );

  assert.ok(rule);
  assert.equal(rule.category, '天辅时版本冲突边界');
  assert.match(rule.promptText, /甲己日己巳、乙庚日甲申/);
  assert.match(rule.promptText, /戊癸日申时/);
  assert.match(rule.promptText, /只保留日柱、时柱原始事实/);
  assert.doesNotMatch(rule.promptText, /大吉|必成|必胜|百事皆吉/);
});

test('五合时100种日干时干组合全部不自动命名且保留标准五合事实', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
  const standardPairs = new Set([
    '甲己',
    '己甲',
    '乙庚',
    '庚乙',
    '丙辛',
    '辛丙',
    '丁壬',
    '壬丁',
    '戊癸',
    '癸戊',
  ]);
  let checked = 0;
  let standardCombinationCount = 0;

  for (const dayStem of stems) {
    const dayGanZhi = jiazi.find((item) => item.startsWith(dayStem));
    assert.ok(dayGanZhi);
    for (const hourStem of stems) {
      const hourGanZhi = jiazi.find((item) => item.startsWith(hourStem));
      assert.ok(hourGanZhi);
      const patterns = getClassicPatterns({
        jiuGongGe: [buildPalace('', '')],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        dayGanZhi,
        hourGanZhi,
      });

      assert.ok(!patterns.some((pattern) => ['五合时', '天辅时'].includes(pattern.name)));
      if (standardPairs.has(`${dayStem}${hourStem}`)) standardCombinationCount += 1;
      checked += 1;
    }
  }

  assert.equal(checked, 100);
  assert.equal(standardCombinationCount, 10);
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const rule = analysis.ruleSourceFacts.find(
    (item) => item.key === 'rule:qimen:five-combination-hour-name-boundary',
  );

  assert.ok(rule);
  assert.equal(rule.category, '五合时名称冲突边界');
  assert.match(rule.promptText, /标准天干五合仍作为可复算结构事实保留/);
  assert.match(rule.promptText, /林氏把五合时称为天辅时/);
  assert.match(rule.promptText, /完整日柱、时柱及日干时干五合事实/);
  assert.doesNotMatch(rule.promptText, /大吉|必成|必胜|百事皆吉/);
});

test('天网相关六十时柱乘九落宫条件全部失败关闭并公开版本冲突', () => {
  let checkedTianPanGui = 0;
  let checkedValueSymbolOverGui = 0;

  for (const hourGanZhi of jiazi) {
    for (let gong = 1; gong <= 9; gong += 1) {
      const tianPanGuiPatterns = getClassicPatterns({
        jiuGongGe: [buildPalaceAt(gong, '癸', '戊')],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        hourGanZhi,
      });
      assert.ok(
        !tianPanGuiPatterns.some((pattern) => ['天网', '天网四张'].includes(pattern.name)),
        `${hourGanZhi}时天盘癸落${gong}宫`,
      );
      checkedTianPanGui += 1;

      const valueSymbolStem = SIX_JIA_DUN_STEMS[getXunHead(hourGanZhi)];
      const valueSymbolPalace = buildPalaceAt(gong, valueSymbolStem, '癸');
      valueSymbolPalace.tianPan.star = '天蓬';
      const valueSymbolPatterns = getClassicPatterns({
        jiuGongGe: [valueSymbolPalace],
        zhiFu: '天蓬',
        zhiShi: '',
        scope: 'hour',
        hourGanZhi,
      });
      assert.ok(
        !valueSymbolPatterns.some((pattern) => ['天网', '天网四张'].includes(pattern.name)),
        `${hourGanZhi}时值符临地盘癸于${gong}宫`,
      );
      checkedValueSymbolOverGui += 1;
    }
  }

  assert.equal(checkedTianPanGui, 60 * 9);
  assert.equal(checkedValueSymbolOverGui, 60 * 9);
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const rule = analysis.ruleSourceFacts.find(
    (item) => item.key === 'rule:qimen:heaven-net-version-boundary',
  );

  assert.ok(rule);
  assert.equal(rule.category, '天网版本冲突边界');
  assert.match(rule.promptText, /六癸时、天盘癸落宫、值符或旬首临地盘癸/);
  assert.match(rule.promptText, /癸亥时配阳遁九局、阴遁一局/);
  assert.match(rule.promptText, /只保留完整时柱、阴阳遁局、天盘癸落宫、地盘癸和值符旬首事实/);
  assert.doesNotMatch(rule.promptText, /宜出|必成|必胜|百事皆吉/);
});

test('三奇与时干入墓按九干乘九宫全部关闭并公开版本冲突', () => {
  const stems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
  let checked = 0;

  for (const heavenStem of stems) {
    for (let gong = 1; gong <= 9; gong += 1) {
      const palace = buildPalaceAt(gong, heavenStem);
      const patterns = getClassicPatterns({
        jiuGongGe: [palace],
        zhiFu: '',
        zhiShi: '',
        scope: 'hour',
        hourGanZhi: '甲子',
      });
      const relations = getStemRelations([palace]);

      assert.ok(
        !patterns.some((pattern) => /三奇入墓|时干入墓|十干入墓/.test(pattern.name)),
        `天盘${heavenStem}落${gong}宫不得自动命名入墓`,
      );
      assert.ok(
        !relations.some((relation) => relation.type === '入墓'),
        `天盘${heavenStem}落${gong}宫不得自动标记入墓关系`,
      );
      checked += 1;
    }
  }

  assert.equal(checked, 9 * 9);
  const analysis = analyzeQimenEvidence(generateQimen(new Date('2025-01-01T05:00:00+08:00')));
  const rule = analysis.ruleSourceFacts.find(
    (item) => item.key === 'rule:qimen:tomb-version-boundary',
  );
  const fixedConditions = analysis.calculationEvidenceFacts.find(
    (item) => item.key === 'qimen:calculation:fixed-ganzhi-conditions',
  );

  assert.ok(rule);
  assert.equal(rule.category, '三奇与时干入墓版本冲突边界');
  assert.match(rule.promptText, /天盘位置/);
  assert.match(rule.promptText, /时柱表还附加乙庚日、丙辛日分组/);
  assert.match(rule.promptText, /旧固定时柱表既漏掉日干前提又与原文表项不符/);
  assert.match(rule.promptText, /完整日柱、时柱及天地盘干落宫事实/);
  assert.doesNotMatch(rule.promptText, /百事皆吉|必成|必胜/);
  assert.ok(fixedConditions);
  assert.equal(fixedConditions.result.isShiGanRuMu, false);
  assert.match(fixedConditions.promptText, /三奇与时干入墓因版本冲突不自动标记/);
});
