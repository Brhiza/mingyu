import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAstrolabeFromInput, buildHoroscope } from '@core/ziwei/iztro';

const PALACE_NAMES = [
  '命宫',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '仆役',
  '官禄',
  '田宅',
  '福德',
  '父母',
] as const;
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MAJOR_STARS = [
  '紫微',
  '天机',
  '太阳',
  '武曲',
  '天同',
  '廉贞',
  '天府',
  '太阴',
  '贪狼',
  '巨门',
  '天相',
  '天梁',
  '七杀',
  '破军',
] as const;
const FIVE_ELEMENTS_CLASSES = ['水二局', '木三局', '金四局', '土五局', '火六局'];

function sorted(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

function assertPermutation(actual: readonly string[], expected: readonly string[], label: string) {
  assert.equal(actual.length, expected.length, `${label}数量不完整`);
  assert.deepEqual(sorted(actual), sorted(expected), `${label}不是完整排列`);
}

function assertHoroscopeItem(
  item: {
    index: number;
    palaceNames: string[];
    mutagen: string[];
    stars?: unknown[][];
  },
  label: string,
) {
  assert.ok(
    Number.isInteger(item.index) && item.index >= 0 && item.index < 12,
    `${label}宫位索引越界`,
  );
  assertPermutation(item.palaceNames, PALACE_NAMES, `${label}十二宫`);
  assert.equal(item.mutagen.length, 4, `${label}四化数量错误`);
  assert.equal(new Set(item.mutagen).size, 4, `${label}四化星不应重复`);
  if (item.stars) {
    assert.equal(item.stars.length, 12, `${label}流耀宫位数量错误`);
  }
}

test('紫微跨世纪、性别、时辰与算法组合应保持完整盘面结构', async () => {
  const dates = Array.from({ length: 6 }, (_, index) => 1900 + index * 40).flatMap((year) => [
    `${year}-01-15`,
    `${year}-07-15`,
  ]);
  let chartCount = 0;

  for (const birthDate of dates) {
    for (const gender of ['男', '女'] as const) {
      for (const algorithm of ['default', 'zhongzhou'] as const) {
        for (let birthTimeIndex = 0; birthTimeIndex <= 12; birthTimeIndex += 1) {
          const astrolabe = await buildAstrolabeFromInput({
            name: '结构审查',
            dateType: 'solar',
            birthDate,
            birthTimeIndex,
            gender,
            isLeapMonth: false,
            algorithm,
          });
          const label = `${birthDate} ${gender} ${algorithm} 时辰${birthTimeIndex}`;
          const palaces = astrolabe.palaces;

          assert.equal(palaces.length, 12, `${label}：宫位数量错误`);
          assert.deepEqual(
            palaces.map((palace) => palace.index),
            Array.from({ length: 12 }, (_, index) => index),
            `${label}：宫位索引错误`,
          );
          assertPermutation(
            palaces.map((palace) => palace.name),
            PALACE_NAMES,
            `${label}：宫名`,
          );
          assertPermutation(
            palaces.map((palace) => palace.earthlyBranch),
            EARTHLY_BRANCHES,
            `${label}：地支`,
          );
          assertPermutation(
            palaces.flatMap((palace) => palace.majorStars.map((star) => star.name)),
            MAJOR_STARS,
            `${label}：十四主星`,
          );
          assert.ok(
            FIVE_ELEMENTS_CLASSES.includes(astrolabe.fiveElementsClass),
            `${label}：五行局非法`,
          );

          const soulPalace = palaces.find((palace) => palace.name === '命宫');
          const bodyPalaces = palaces.filter((palace) => palace.isBodyPalace);
          assert.equal(
            soulPalace?.earthlyBranch,
            astrolabe.earthlyBranchOfSoulPalace,
            `${label}：命宫错位`,
          );
          assert.equal(bodyPalaces.length, 1, `${label}：身宫数量错误`);
          assert.equal(
            bodyPalaces[0]?.earthlyBranch,
            astrolabe.earthlyBranchOfBodyPalace,
            `${label}：身宫错位`,
          );

          assertPermutation(
            palaces.flatMap((palace) => palace.ages.map(String)),
            Array.from({ length: 120 }, (_, index) => String(index + 1)),
            `${label}：一至一百二十岁小限`,
          );
          for (const palace of palaces) {
            assert.equal(
              palace.decadal.range[1] - palace.decadal.range[0],
              9,
              `${label}：大限不是十年`,
            );
          }

          const targetYear = Math.min(Number(birthDate.slice(0, 4)) + 25, 2100);
          const horoscope = buildHoroscope(astrolabe, `${targetYear}-02-15`, birthTimeIndex);
          assertHoroscopeItem(horoscope.decadal, `${label}：大限`);
          assertHoroscopeItem(horoscope.age, `${label}：小限`);
          assertHoroscopeItem(horoscope.yearly, `${label}：流年`);
          assertHoroscopeItem(horoscope.monthly, `${label}：流月`);
          assertHoroscopeItem(horoscope.daily, `${label}：流日`);
          assertHoroscopeItem(horoscope.hourly, `${label}：流时`);
          chartCount += 1;
        }
      }
    }
  }

  assert.equal(chartCount, 624);
});

test('紫微连续排盘与行运调用不应反向改写既有结果', async () => {
  const first = await buildAstrolabeFromInput({
    name: '首盘',
    dateType: 'solar',
    birthDate: '1984-02-04',
    birthTimeIndex: 0,
    gender: '男',
    algorithm: 'default',
  });
  const firstHoroscope = buildHoroscope(first, '2024-02-04', 0);
  const signature = JSON.stringify({
    palaces: first.palaces,
    decadal: firstHoroscope.decadal,
    yearly: firstHoroscope.yearly,
    monthly: firstHoroscope.monthly,
    daily: firstHoroscope.daily,
    hourly: firstHoroscope.hourly,
  });

  const second = await buildAstrolabeFromInput({
    name: '后盘',
    dateType: 'solar',
    birthDate: '2000-07-07',
    birthTimeIndex: 12,
    gender: '女',
    algorithm: 'zhongzhou',
  });
  buildHoroscope(second, '2035-12-31', 12);

  assert.equal(
    JSON.stringify({
      palaces: first.palaces,
      decadal: firstHoroscope.decadal,
      yearly: firstHoroscope.yearly,
      monthly: firstHoroscope.monthly,
      daily: firstHoroscope.daily,
      hourly: firstHoroscope.hourly,
    }),
    signature,
  );
});
