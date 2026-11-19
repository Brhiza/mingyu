import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import {
  detectZiweiPatterns,
  formatZiweiPatterns,
  ZIWEI_VERIFIED_PATTERN_RULE_COUNT,
  type ZiweiPatternPalace,
  type ZiweiPatternStar,
} from '../src/systems/ziwei-patterns';

const BRANCHES = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'] as const;
const PALACE_NAMES = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '仆役', '官禄', '田宅', '福德', '父母',
] as const;

const star = (name: string, extra?: Partial<ZiweiPatternStar>): ZiweiPatternStar => ({
  name,
  ...extra,
});

function makePalaces(
  soulIndex = 0,
  overrides: Record<number, Partial<ZiweiPatternPalace>> = {},
): ZiweiPatternPalace[] {
  return Array.from({ length: 12 }, (_, index) => {
    const nameIndex = (soulIndex - index + 12) % 12;
    const base: ZiweiPatternPalace = {
      index,
      name: PALACE_NAMES[nameIndex],
      isBodyPalace: index === soulIndex,
      earthlyBranch: BRANCHES[index],
      majorStars: [],
      minorStars: [],
      adjectiveStars: [],
    };
    return { ...base, ...overrides[index] };
  });
}

test('已校勘紫微格局规则数为 55 条，并校验十二宫输入完整性', () => {
  assert.equal(ZIWEI_VERIFIED_PATTERN_RULE_COUNT, 55);
  assert.throws(() => detectZiweiPatterns([]), /12 宫/);
  assert.throws(() => detectZiweiPatterns(makePalaces().slice(0, 11)), /12 宫/);

  const dupIndex = makePalaces();
  dupIndex[1].index = 0;
  assert.throws(() => detectZiweiPatterns(dupIndex), /索引无效或重复/);

  const twoSouls = makePalaces();
  twoSouls[1].name = '命宫';
  assert.throws(() => detectZiweiPatterns(twoSouls), /只能包含一个命宫/);
});

test('本命同宫、夹命、三方与亮度四化格局规则准确命中', () => {
  // 紫府同宫 + 君臣庆会 + 坐贵向贵 + 权禄生逢 + 兼文武 + 禄马交驰 + 文星朝命
  const p1 = makePalaces(0, {
    0: {
      majorStars: [star('紫微', { brightness: '庙', mutagen: '权' }), star('天府'), star('武曲')],
      minorStars: [
        star('左辅'), star('右弼'), star('天魁'), star('文昌'), star('文曲'),
        star('禄存'), star('天马'), star('天刑'),
      ],
      adjectiveStars: [star('廉贞', { brightness: '旺', mutagen: '禄' })],
    },
    6: { minorStars: [star('天钺')] },
  });
  const ids1 = new Set(detectZiweiPatterns(p1).map((item) => item.id));
  for (const id of [
    'ziwei-tianfu-tonggong', 'jun-chen-qing-hui', 'zuo-gui-xiang-gui',
    'quan-lu-sheng-feng', 'jian-wen-wu', 'lu-ma-jiao-chi', 'wen-xing-chao-ming',
  ]) {
    assert.ok(ids1.has(id), `预期命中 ${id}`);
  }

  // 辅弼夹命 + 紫府夹命 + 魁钺夹命 + 火铃夹命 + 空劫夹命
  const p2 = makePalaces(2, {
    1: {
      majorStars: [star('紫微')],
      minorStars: [star('左辅'), star('天魁'), star('火星'), star('地空')],
    },
    2: { majorStars: [star('紫微')] },
    3: {
      majorStars: [star('天府')],
      minorStars: [star('右弼'), star('天钺'), star('铃星'), star('地劫')],
    },
  });
  const ids2 = new Set(detectZiweiPatterns(p2).map((item) => item.id));
  for (const id of ['fu-bi-gong-zhu', 'zi-fu-jia-ming', 'zuo-you-jia-ming', 'kui-yue-jia-ming', 'huo-ling-jia-ming', 'kong-jie-jia-ming']) {
    assert.ok(ids2.has(id), `预期命中 ${id}`);
  }

  // 日月并明（需庙或旺）、阳梁昌禄、巨火擎羊
  const p3 = makePalaces(0, {
    0: { majorStars: [star('太阳', { brightness: '旺' }), star('巨门')] },
    4: { majorStars: [star('太阴', { brightness: '庙' })], minorStars: [star('火星'), star('擎羊')] },
    8: { majorStars: [star('天梁')], minorStars: [star('文昌'), star('禄存'), star('陀罗')] },
  });
  const ids3 = new Set(detectZiweiPatterns(p3).map((item) => item.id));
  assert.ok(ids3.has('ri-yue-bing-ming'));
  assert.ok(ids3.has('yang-liang-chang-lu'));
  assert.ok(ids3.has('ju-huo-qing-yang'));

  // 亮度非庙旺时不应命中日月并明
  const p3Dim = makePalaces(0, {
    0: { majorStars: [star('太阳', { brightness: '陷' })] },
    4: { majorStars: [star('太阴', { brightness: '庙' })] },
  });
  assert.ok(!detectZiweiPatterns(p3Dim).some((item) => item.id === 'ri-yue-bing-ming'));
});

test('特定宫位地支、凶格与生年天干依赖规则准确区分', () => {
  // 巨机居卯：soulIndex=1 对应卯宫；乙辛己丙命中，甲或不传不命中
  const mao = makePalaces(1, { 1: { majorStars: [star('巨门'), star('天机')] } });
  assert.ok(detectZiweiPatterns(mao, '乙').some((item) => item.id === 'ju-ji-ju-mao'));
  assert.ok(!detectZiweiPatterns(mao, '甲').some((item) => item.id === 'ju-ji-ju-mao'));
  assert.ok(!detectZiweiPatterns(mao).some((item) => item.id === 'ju-ji-ju-mao'));

  // 财与囚仇：命身不可同宫
  const samePalace = makePalaces(0, { 0: { majorStars: [star('武曲'), star('廉贞')], isBodyPalace: true } });
  assert.ok(!detectZiweiPatterns(samePalace).some((item) => item.id === 'cai-yu-qiu-chou'));
  const splitPalace = makePalaces(0, {
    0: { majorStars: [star('武曲')], isBodyPalace: false },
    2: { majorStars: [star('廉贞')], isBodyPalace: true },
  });
  assert.ok(detectZiweiPatterns(splitPalace).some((item) => item.id === 'cai-yu-qiu-chou'));

  // 两重华盖 + 羊陀夹忌 + 一生孤贫 + 君子在野 + 生不逢时
  const bad = makePalaces(0, {
    0: {
      majorStars: [star('破军', { brightness: '陷' }), star('廉贞', { mutagen: '忌' })],
      minorStars: [star('禄存'), star('地空'), star('火星', { brightness: '陷' })],
      adjectiveStars: [star('太阳', { mutagen: '禄' }), star('截空')],
    },
    11: { minorStars: [star('擎羊')] },
    1: { minorStars: [star('陀罗')] },
  });
  const badIds = new Set(detectZiweiPatterns(bad).map((item) => item.id));
  for (const id of ['liang-chong-hua-gai', 'yang-tuo-jia-ji', 'yi-sheng-gu-pin', 'jun-zi-zai-ye', 'sheng-bu-feng-shi']) {
    assert.ok(badIds.has(id), `预期命中 ${id}`);
  }

  // 火贵格：仅看同一组三方（+4/+8）且三方无羊陀铃
  const huoGui = makePalaces(0, {
    4: { majorStars: [star('贪狼')] },
    8: { minorStars: [star('火星')] },
  });
  assert.ok(detectZiweiPatterns(huoGui).some((item) => item.id === 'huo-gui'));
  const huoGuiBlocked = makePalaces(0, {
    4: { majorStars: [star('贪狼')], minorStars: [star('铃星')] },
    8: { minorStars: [star('火星')] },
  });
  assert.ok(!detectZiweiPatterns(huoGuiBlocked).some((item) => item.id === 'huo-gui'));
});

test('格局提示词格式化及真实命盘 calculate 与 reprompt 校验', async () => {
  assert.match(formatZiweiPatterns([]), /未命中已登记本命格局/);

  // 1990-05-15 14:30 女命（命宫本命格局挂载、提示词渲染与 reprompt 防篡改校验）
  const input = {
    question: '格局如何？',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'female',
  } as const;
  const result = await calculate('ziwei', input);
  assert.ok(Array.isArray(result.data.natal.patterns));
  assert.match(result.prompt.text, /【本命格局】/);
  if (result.data.natal.patterns.length > 0) {
    assert.ok(result.prompt.text.includes(result.data.natal.patterns[0].name));
  }

  const saved = JSON.parse(JSON.stringify(result));
  const followed = await reprompt({ method: 'ziwei', result: saved, question: '追问格局' });
  assert.match(followed.prompt.text, /【本命格局】/);

  const tampered = structuredClone(saved);
  tampered.data.natal.patterns.push({
    id: 'fake',
    name: '伪造格局',
    kind: 'auspicious',
    description: '伪造',
    palaces: ['命宫'],
    stars: ['紫微'],
    conditions: ['伪造'],
    source: '伪造',
    quote: '伪造',
  });
  await assert.rejects(() => reprompt({ method: 'ziwei', result: tampered, question: '追问格局' }), /不一致/);
});
