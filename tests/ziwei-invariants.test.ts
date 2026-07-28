import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabeFromInput,
  buildHoroscope,
  buildHoroscopeFromInput,
} from '@core/ziwei/iztro';
import type { ChartInput } from '../packages/core/src/types/chart';

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
const BUREAU_NUMBERS: Record<string, number> = {
  水二局: 2,
  木三局: 3,
  金四局: 4,
  土五局: 5,
  火六局: 6,
};
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const MUTAGEN_TABLE: Record<string, [string, string, string, string]> = {
  甲: ['廉贞', '破军', '武曲', '太阳'],
  乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'],
  丁: ['太阴', '天同', '天机', '巨门'],
  戊: ['贪狼', '太阴', '右弼', '天机'],
  己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'],
  辛: ['巨门', '太阳', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左辅', '武曲'],
  癸: ['破军', '巨门', '太阴', '贪狼'],
};

function mod(value: number, divisor = 12) {
  return ((value % divisor) + divisor) % divisor;
}

function expectedFiveElementsClass(stemIndex: number, branchIndex: number) {
  const stemNumber = Math.floor(stemIndex / 2) + 1;
  const branchNumber = Math.floor((branchIndex % 6) / 2) + 1;
  const value = ((stemNumber + branchNumber - 1) % 5) + 1;
  return ['木三局', '金四局', '水二局', '火六局', '土五局'][value - 1];
}

function expectedZiweiBranch(day: number, bureau: number) {
  let offset = 0;
  while ((day + offset) % bureau !== 0) offset += 1;
  const quotient = (day + offset) / bureau;
  const internalIndex = mod(quotient - 1 + (offset % 2 === 0 ? offset : -offset));
  return EARTHLY_BRANCHES[mod(internalIndex + 2)];
}

function starBranch(
  astrolabe: Awaited<ReturnType<typeof buildAstrolabeFromInput>>,
  starName: string,
) {
  return astrolabe.palaces.find((palace) =>
    [...palace.majorStars, ...palace.minorStars].some((star) => star.name === starName),
  )?.earthlyBranch;
}

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

test('紫微默认安星应通过命身宫、五行局、十四主星与十干四化独立反算', async () => {
  const timeIndexes = [0, 1, 6, 11];
  let checkedCharts = 0;

  for (let year = 1984; year <= 1993; year += 1) {
    const yearStemIndex = mod(year - 4, 10);
    const yearStem = HEAVENLY_STEMS[yearStemIndex];
    const tigerStemIndex = mod((yearStemIndex % 5) * 2 + 2, 10);

    for (let month = 1; month <= 12; month += 1) {
      for (const day of [1, 13, 27]) {
        for (const birthTimeIndex of timeIndexes) {
          const astrolabe = await buildAstrolabeFromInput({
            name: '独立反算',
            dateType: 'lunar',
            birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            birthTimeIndex,
            gender: '男',
            isLeapMonth: false,
            fixLeap: true,
            algorithm: 'default',
            yearDivide: 'normal',
            horoscopeDivide: 'normal',
            ageDivide: 'normal',
            dayDivide: 'forward',
          });
          const label = `${year}年${month}月${day}日时辰${birthTimeIndex}`;
          const soulInternalIndex = mod(month - 1 - birthTimeIndex);
          const bodyInternalIndex = mod(month - 1 + birthTimeIndex);
          const soulBranchIndex = mod(soulInternalIndex + 2);
          const bodyBranchIndex = mod(bodyInternalIndex + 2);
          const soulStemIndex = mod(tigerStemIndex + soulInternalIndex, 10);
          const bureau = expectedFiveElementsClass(soulStemIndex, soulBranchIndex);
          const bureauNumber = BUREAU_NUMBERS[bureau];

          assert.equal(
            astrolabe.earthlyBranchOfSoulPalace,
            EARTHLY_BRANCHES[soulBranchIndex],
            `${label}命宫反算不一致`,
          );
          assert.equal(
            astrolabe.earthlyBranchOfBodyPalace,
            EARTHLY_BRANCHES[bodyBranchIndex],
            `${label}身宫反算不一致`,
          );
          assert.equal(astrolabe.fiveElementsClass, bureau, `${label}五行局反算不一致`);

          const ziweiBranch = expectedZiweiBranch(day, bureauNumber);
          const ziweiIndex = EARTHLY_BRANCHES.indexOf(ziweiBranch);
          const tianfuIndex = mod(4 - ziweiIndex);
          const expectedMajorStarBranches: Record<string, string> = {
            紫微: ziweiBranch,
            天机: EARTHLY_BRANCHES[mod(ziweiIndex - 1)],
            太阳: EARTHLY_BRANCHES[mod(ziweiIndex - 3)],
            武曲: EARTHLY_BRANCHES[mod(ziweiIndex - 4)],
            天同: EARTHLY_BRANCHES[mod(ziweiIndex - 5)],
            廉贞: EARTHLY_BRANCHES[mod(ziweiIndex - 8)],
            天府: EARTHLY_BRANCHES[tianfuIndex],
            太阴: EARTHLY_BRANCHES[mod(tianfuIndex + 1)],
            贪狼: EARTHLY_BRANCHES[mod(tianfuIndex + 2)],
            巨门: EARTHLY_BRANCHES[mod(tianfuIndex + 3)],
            天相: EARTHLY_BRANCHES[mod(tianfuIndex + 4)],
            天梁: EARTHLY_BRANCHES[mod(tianfuIndex + 5)],
            七杀: EARTHLY_BRANCHES[mod(tianfuIndex + 6)],
            破军: EARTHLY_BRANCHES[mod(tianfuIndex + 10)],
          };
          Object.entries(expectedMajorStarBranches).forEach(([star, branch]) => {
            assert.equal(starBranch(astrolabe, star), branch, `${label}${star}反算不一致`);
          });

          const actualMutagens = new Map<string, string>();
          astrolabe.palaces.forEach((palace) => {
            [...palace.majorStars, ...palace.minorStars].forEach((star) => {
              if (star.mutagen) actualMutagens.set(star.mutagen, star.name);
            });
          });
          ['禄', '权', '科', '忌'].forEach((mutagen, index) => {
            assert.equal(
              actualMutagens.get(mutagen),
              MUTAGEN_TABLE[yearStem][index],
              `${label}生年化${mutagen}反算不一致`,
            );
          });
          checkedCharts += 1;
        }
      }
    }
  }

  assert.equal(checkedCharts, 1440);
});

test('紫微取运限时应恢复本盘配置，避免 iztro 全局设置串盘', async () => {
  const defaultInput: ChartInput = {
    name: '默认盘',
    dateType: 'solar',
    birthDate: '1998-08-13',
    birthTimeIndex: 0,
    gender: '女',
    fixLeap: true,
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  };
  const astrolabe = await buildAstrolabeFromInput(defaultInput);

  await buildAstrolabeFromInput({
    ...defaultInput,
    name: '另一口径',
    algorithm: 'zhongzhou',
    yearDivide: 'exact',
    horoscopeDivide: 'exact',
    ageDivide: 'birthday',
    dayDivide: 'current',
  });

  const contaminated = buildHoroscope(astrolabe, '2024-02-06', 12);
  const restored = await buildHoroscopeFromInput(astrolabe, defaultInput, '2024-02-06', 12);

  assert.equal(contaminated.yearly.heavenlyStem, '甲');
  assert.equal(contaminated.yearly.earthlyBranch, '辰');
  assert.equal(restored.yearly.heavenlyStem, '癸');
  assert.equal(restored.yearly.earthlyBranch, '卯');
});
