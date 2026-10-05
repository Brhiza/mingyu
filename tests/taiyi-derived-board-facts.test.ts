import assert from 'node:assert/strict';
import test from 'node:test';

import { generateTaiyi } from '../packages/core/src/taiyi/index.ts';

// 《太乙金镜式经》卷一的宫目循环，卷二的逐宫行算和计神加和德，
// 卷一阴二十七局原例：计神午加和德艮，文昌坤下临卯，主算二十九。
// https://www.kanripo.org/text/KR3g0047/001
// https://www.kanripo.org/text/KR3g0047/002
const POSITIONS = [
  '子',
  '丑',
  '艮',
  '寅',
  '卯',
  '辰',
  '巽',
  '巳',
  '午',
  '未',
  '坤',
  '申',
  '酉',
  '戌',
  '乾',
  '亥',
];
const PALACE_NUMBERS = new Map<string, number>([
  ['乾', 1],
  ['午', 2],
  ['艮', 3],
  ['卯', 4],
  ['酉', 6],
  ['坤', 7],
  ['子', 8],
  ['巽', 9],
]);
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 《武备志》卷一百六十九「求定计目法」：岁合加本计支，文昌下临为定目。
// 庚辰十七局寅起算十六、辛未三十二局午起算二十四，校准转盘方向。
// 《太乙统宗宝鉴》卷二明确年月日时四计沿用同法。
// https://www.shidianguji.com/zh/book/CADAL02092259/chapter/1lb3wzm7f2qzs
// https://www.shidianguji.com/book/CADAL02094393/chapter/1lcppwp45lquq
const HARMONY_PARTNER = new Map<string, string>([
  ['子', '丑'],
  ['丑', '子'],
  ['寅', '亥'],
  ['亥', '寅'],
  ['卯', '戌'],
  ['戌', '卯'],
  ['辰', '酉'],
  ['酉', '辰'],
  ['巳', '申'],
  ['申', '巳'],
  ['午', '未'],
  ['未', '午'],
]);
const YANG_TIANMU = [
  '申',
  '酉',
  '戌',
  '乾',
  '乾',
  '亥',
  '子',
  '丑',
  '艮',
  '寅',
  '卯',
  '辰',
  '巽',
  '巳',
  '午',
  '未',
  '坤',
  '坤',
];
const YIN_TIANMU = [
  '寅',
  '卯',
  '辰',
  '巽',
  '巽',
  '巳',
  '午',
  '未',
  '坤',
  '申',
  '酉',
  '戌',
  '乾',
  '亥',
  '子',
  '丑',
  '艮',
  '艮',
];

function countToTaiyi(origin: string, destination: string): number {
  const start = POSITIONS.indexOf(origin);
  const end = POSITIONS.indexOf(destination);
  let count = PALACE_NUMBERS.get(origin) ?? 1;
  if (start !== end) {
    for (let position = (start + 1) % 16; position !== end; position = (position + 1) % 16) {
      count += PALACE_NUMBERS.get(POSITIONS[position]) ?? 0;
    }
  }
  return count;
}

function generalForCount(count: number): number {
  return count % 10 || count / 10;
}

test('阴阳七十二局的宫目、主客定算及将参符合原典独立推法', () => {
  const palaceOrder = ['乾', '午', '艮', '卯', '酉', '坤', '子', '巽'];
  for (const [yinYang, startTime] of [
    ['阳遁', '2026-01-10T00:30:00+08:00'],
    ['阴遁', '2026-07-10T00:30:00+08:00'],
  ] as const) {
    const seen = new Set<number>();
    for (let hourOffset = 0; hourOffset < 144; hourOffset += 2) {
      const actual = generateTaiyi({
        scope: 'hour',
        date: new Date(Date.parse(startTime) + hourOffset * 3_600_000),
      });
      const bureauIndex = actual.bureau - 1;
      const yin = yinYang === '阴遁';
      const palaceIndex = Math.floor(bureauIndex / 3) % 8;
      const taiyiPosition = palaceOrder[yin ? 7 - palaceIndex : palaceIndex];
      const tianMuPosition = (yin ? YIN_TIANMU : YANG_TIANMU)[bureauIndex % 18];
      const jiShenPosition = BRANCHES[((((yin ? 8 : 2) - bureauIndex) % 12) + 12) % 12];
      const shiJiPosition =
        POSITIONS[
          (POSITIONS.indexOf(tianMuPosition) +
            POSITIONS.indexOf('艮') -
            POSITIONS.indexOf(jiShenPosition) +
            16) %
            16
        ];
      const hostCount = countToTaiyi(tianMuPosition, taiyiPosition);
      const guestCount = countToTaiyi(shiJiPosition, taiyiPosition);
      const branch = BRANCHES[bureauIndex % 12];
      const harmonyPartner = HARMONY_PARTNER.get(branch);
      assert.ok(harmonyPartner, `${yinYang}${actual.bureau}局合神`);
      const setEyePosition =
        POSITIONS[
          (POSITIONS.indexOf(tianMuPosition) +
            POSITIONS.indexOf(branch) -
            POSITIONS.indexOf(harmonyPartner) +
            16) %
            16
        ];
      const setCount = countToTaiyi(setEyePosition, taiyiPosition);
      if (!yin && actual.bureau === 17) {
        assert.equal(setEyePosition, '寅', '《武备志》庚辰十七局的同局定目');
        assert.equal(setCount, 16, '《武备志》庚辰十七局的同局定算');
      }
      if (!yin && actual.bureau === 32) {
        assert.equal(setEyePosition, '午', '《武备志》辛未三十二局的同局定目');
        assert.equal(setCount, 24, '《武备志》辛未三十二局的同局定算');
      }
      const hostGeneral = generalForCount(hostCount);
      const guestGeneral = generalForCount(guestCount);
      const setGeneral = generalForCount(setCount);
      const label = `${yinYang}${actual.bureau}局`;
      assert.equal(actual.yinYang, yinYang, label);
      assert.ok(actual.bureau >= 1 && actual.bureau <= 72, label);
      assert.equal(actual.taiyiPalace, PALACE_NUMBERS.get(taiyiPosition), label);
      assert.equal(actual.wenChangPosition, tianMuPosition, label);
      assert.equal(actual.jiShenPosition, jiShenPosition, label);
      assert.equal(actual.shiJiPosition, shiJiPosition, label);
      assert.equal(actual.ganZhi.slice(-1), branch, label);
      assert.equal(actual.lordCount, hostCount, label);
      assert.equal(actual.guestCount, guestCount, label);
      assert.equal(actual.setCount, setCount, `${label} 定目${setEyePosition}`);
      assert.equal(actual.lordGeneral, hostGeneral, label);
      assert.equal(actual.lordAssistant, (hostGeneral * 3) % 10, label);
      assert.equal(actual.guestGeneral, guestGeneral, label);
      assert.equal(actual.guestAssistant, (guestGeneral * 3) % 10, label);
      assert.equal(actual.setGeneral, setGeneral, label);
      assert.equal(actual.setAssistant, (setGeneral * 3) % 10, label);
      seen.add(actual.bureau);
    }
    assert.equal(seen.size, 72, `${yinYang}实际时计覆盖七十二局`);
  }
});

test('定目法更正的局数跨年、月、日、时计传递定算及将参算性', () => {
  const cases = [
    {
      input: { scope: 'year', year: 1977 },
      bureau: 6,
      count: 32,
      nature: '次和',
      general: 2,
      assistant: 6,
    },
    {
      input: { scope: 'month', date: new Date('2020-05-15T04:00:00Z') },
      bureau: 6,
      count: 32,
      nature: '次和',
      general: 2,
      assistant: 6,
    },
    {
      input: { scope: 'day', date: new Date('2025-01-24T04:00:00Z') },
      bureau: 6,
      count: 32,
      nature: '次和',
      general: 2,
      assistant: 6,
    },
    {
      input: { scope: 'year', year: 1998 },
      bureau: 27,
      count: 24,
      nature: '杂重阴',
      general: 4,
      assistant: 2,
    },
    {
      input: { scope: 'month', date: new Date('2022-02-15T04:00:00Z') },
      bureau: 27,
      count: 24,
      nature: '杂重阴',
      general: 4,
      assistant: 2,
    },
    {
      input: { scope: 'day', date: new Date('2025-02-14T04:00:00Z') },
      bureau: 27,
      count: 24,
      nature: '杂重阴',
      general: 4,
      assistant: 2,
    },
    {
      input: { scope: 'year', year: 1956 },
      bureau: 57,
      count: 1,
      nature: '杂阴',
      general: 1,
      assistant: 3,
    },
    {
      input: { scope: 'year', year: 1957 },
      bureau: 58,
      count: 37,
      nature: '杂重阳',
      general: 7,
      assistant: 1,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-25T02:30:00Z') },
      bureau: 6,
      count: 30,
      nature: undefined,
      general: 3,
      assistant: 9,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-25T16:30:00Z') },
      bureau: 13,
      count: 13,
      nature: '杂重阳',
      general: 3,
      assistant: 9,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-26T20:30:00Z') },
      bureau: 27,
      count: 16,
      nature: '下和',
      general: 6,
      assistant: 8,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-29T14:30:00Z') },
      bureau: 60,
      count: 23,
      nature: '次和',
      general: 3,
      assistant: 9,
    },
  ] as const;

  for (const { input, bureau, count, nature, general, assistant } of cases) {
    const result = generateTaiyi(input);
    const label = `${input.scope}${bureau}局`;
    assert.equal(result.bureau, bureau, label);
    assert.equal(result.setCount, count, label);
    assert.equal(result.countNatures?.set, nature, label);
    assert.equal(result.setGeneral, general, label);
    assert.equal(result.setAssistant, assistant, label);
    const fact = result.evidenceAnalysis.forceFacts.find((item) => item.side === '定');
    assert.ok(fact, `${label}定算证据`);
    assert.deepEqual(
      {
        count: fact.count,
        nature: fact.nature,
        generalPalace: fact.generalPalace,
        assistantPalace: fact.assistantPalace,
      },
      { count, nature, generalPalace: general, assistantPalace: assistant },
      label,
    );
    assert.ok(result.prompt.includes(`定算 ${count}${nature ? `（${nature}）` : ''}`), label);
    assert.ok(
      result.evidenceAnalysis.primaryFacts.some((item) => item.includes(`定算${count}`)),
      label,
    );
  }
});
