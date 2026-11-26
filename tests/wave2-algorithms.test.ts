import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { calculateFirdaria } from '../src/systems/astrology/firdaria';
import { buildThreeTierMutagenOverlay, formatThreeTierMutagenOverlay } from '../src/systems/ziwei-flying';
import { extractBirthProfiles } from '../src/router-model/birth-extractor';

test('A2 紫微三代四化叠宫引擎：精准检出双忌叠冲、双禄叠加与禄忌交战并进入紫微运限提示词', async () => {
  // 1. 单元测试纯逻辑：构造包含生年忌 + 大限忌同宫、生年禄 + 流年禄同宫的 12 宫
  const mockPalaces = Array.from({ length: 12 }, (_, idx) => ({
    index: idx,
    name: ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'][idx]!,
    earthlyBranch: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][idx]!,
    majorStars:
      idx === 4
        ? [{ name: '武曲', mutagen: '忌' }]
        : idx === 8
          ? [{ name: '廉贞', mutagen: '禄' }]
          : [{ name: '紫微' }],
    minorStars: [],
  }));
  const decadal = [
    { mutagen: '忌' as const, star: '武曲', targetIndex: 4, natalPalace: '财帛', targetBranch: '辰', scopePalace: '大限迁移' },
    { mutagen: '禄' as const, star: '廉贞', targetIndex: 8, natalPalace: '官禄', targetBranch: '申', scopePalace: '大限财帛' },
  ];
  const yearly = [
    { mutagen: '禄' as const, star: '武曲', targetIndex: 4, natalPalace: '财帛', targetBranch: '辰', scopePalace: '流年命宫' },
  ];
  const overlay = buildThreeTierMutagenOverlay(mockPalaces, decadal, yearly);
  assert.ok(overlay.some((item) => item.kind === 'multi-ji' && item.natalPalace === '财帛' && item.oppositeNatalPalace === '福德'));
  assert.ok(overlay.some((item) => item.kind === 'multi-lu' && item.natalPalace === '官禄'));
  assert.ok(overlay.some((item) => item.kind === 'lu-ji-clash' && item.natalPalace === '财帛'));
  const formatted = formatThreeTierMutagenOverlay(overlay);
  assert.match(formatted, /双忌叠冲.*直冲对宫本命福德/);
  assert.match(formatted, /双禄叠加/);
  assert.match(formatted, /禄忌交战/);

  // 2. 端到端真实紫微排盘（含大限+流年）正常输出无异常
  const res = await calculate('ziwei', {
    question: '看看今年流年事业与财运变化',
    gender: 'male',
    birth: {
      calendar: 'solar',
      year: 1990,
      month: 5,
      day: 15,
      timezone: 8,
      timeStandard: 'civil',
      clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
    },
    referenceTime: '2026-06-15T12:00:00+08:00',
  });
  assert.equal(res.method, 'ziwei');
  assert.ok(res.prompt.text.includes('【运限】'));
});

test('A4 西洋星盘古典法达星限（Firdaria）昼夜盘顺序与副限准确，并自动并入星盘推运提示词', async () => {
  // 昼盘 0–10岁太阳，10–18岁金星，18–31岁水星，31–40岁月亮
  const dayAge35 = calculateFirdaria('1990-05-15T06:30:00Z', '2025-11-15T06:30:00Z', true);
  assert.ok(dayAge35);
  assert.equal(dayAge35.majorRuler, '月亮');
  assert.equal(dayAge35.majorStartAge, 31);
  assert.equal(dayAge35.majorEndAge, 40);
  assert.ok(dayAge35.subRuler !== null);

  // 夜盘 0–9岁月亮，9–20岁土星，20–32岁木星，32–39岁火星
  const nightAge35 = calculateFirdaria('1990-05-15T14:30:00Z', '2025-11-15T14:30:00Z', false);
  assert.ok(nightAge35);
  assert.equal(nightAge35.majorRuler, '火星');
  assert.equal(nightAge35.majorStartAge, 32);
  assert.equal(nightAge35.majorEndAge, 39);

  // 端到端西洋星盘推运包含【古典法达星限（Firdaria）】
  const astroRes = await calculate('astrolabe', {
    question: '看看2026年运势重点',
    birth: {
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: 8,
    },
    flow: { reference: { kind: 'year', year: 2026 } },
  });
  assert.ok(astroRes.prompt.text.includes('【古典法达星限（Firdaria）】'));
});

test('R2 端侧生辰提取：准确分离问事目的地城市与出生地点，避免误把想去上海当成生在上海', () => {
  const destOnly = extractBirthProfiles('1992年5月12日早上10点男，想问今年去上海发展合适吗？');
  assert.equal(destOnly.profiles.length, 1);
  assert.equal(destOnly.profiles[0]!.birthPlace, undefined);

  const bothPlaces = extractBirthProfiles('1992年5月12日早上10点男，出生在成都，今年想去上海发展合适吗？');
  assert.equal(bothPlaces.profiles.length, 1);
  assert.ok(bothPlaces.profiles[0]!.birthPlace?.includes('成都'));

  const fuzzyTime = extractBirthProfiles('1995年8月20日吃完晚饭女，看看下半年感情');
  assert.equal(fuzzyTime.profiles.length, 1);
  assert.equal(fuzzyTime.profiles[0]!.timeIndex, 10);
});
