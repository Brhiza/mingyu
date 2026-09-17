import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const iztroRequire = createRequire(require.resolve('iztro/package.json'));

type SoulAndBody = {
  soulIndex: number;
  bodyIndex: number;
  heavenlyStemOfSoul: string;
  earthlyBranchOfSoul: string;
};

type AstrolabeParam = {
  solarDate: string;
  timeIndex: number;
  gender?: string;
  fixLeap?: boolean;
};

type AnyFunction = (...args: any[]) => any;
type ModuleFunctions = Record<string, AnyFunction>;

const astro = require('iztro/lib/astro/astro.js') as ModuleFunctions;
const palace = require('iztro/lib/astro/palace.js') as ModuleFunctions;
const majorStar = require('iztro/lib/star/majorStar.js') as ModuleFunctions;
const adjectiveStar = require('iztro/lib/star/adjectiveStar.js') as ModuleFunctions;
const decorativeStar = require('iztro/lib/star/decorativeStar.js') as ModuleFunctions;
const location = require('iztro/lib/star/location.js') as ModuleFunctions;
const i18n = require('iztro/lib/i18n/index.js') as {
  default: {
    t: (key: string) => string;
    addResource: (
      language: string,
      namespace: string,
      key: string,
      value: string,
      options?: { silent?: boolean },
    ) => void;
  };
  setLanguage: (language: string) => void;
};
const lunarGanzhi = iztroRequire('lunar-lite/lib/ganzhi.js') as ModuleFunctions;
const lunarConvertor = iztroRequire('lunar-lite/lib/convertor.js') as ModuleFunctions;

const defaultConfig = {
  yearDivide: 'normal',
  horoscopeDivide: 'normal',
  ageDivide: 'normal',
  dayDivide: 'forward',
  algorithm: 'default',
};

function plain(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (key === '_astrolabe' || key === '_palace' || typeof item === 'function') {
        return undefined;
      }
      return item;
    }),
  ) as unknown;
}

function countBySolarCalls(run: () => unknown) {
  const counts = { ganzhi: 0, solar2lunar: 0, soulAndBody: 0 };
  const originalGanzhi = lunarGanzhi.getHeavenlyStemAndEarthlyBranchBySolarDate;
  const originalSolar2lunar = lunarConvertor.solar2lunar;
  const originalSoulAndBody = palace.getSoulAndBody;

  lunarGanzhi.getHeavenlyStemAndEarthlyBranchBySolarDate = (...args: unknown[]) => {
    counts.ganzhi += 1;
    return originalGanzhi(...args);
  };
  lunarConvertor.solar2lunar = (...args: unknown[]) => {
    counts.solar2lunar += 1;
    return originalSolar2lunar(...args);
  };
  palace.getSoulAndBody = (...args: unknown[]) => {
    counts.soulAndBody += 1;
    return originalSoulAndBody(...args);
  };

  try {
    run();
  } finally {
    lunarGanzhi.getHeavenlyStemAndEarthlyBranchBySolarDate = originalGanzhi;
    lunarConvertor.solar2lunar = originalSolar2lunar;
    palace.getSoulAndBody = originalSoulAndBody;
  }
  return counts;
}

test('iztro 基础盘仅计算一次命身宫并复用入口干支对象', () => {
  astro.config(defaultConfig);
  const counts = countBySolarCalls(() => astro.bySolar('1992-08-21', 4, 'female', true, 'zh-CN'));

  assert.deepEqual(counts, {
    ganzhi: 12,
    solar2lunar: 8,
    soulAndBody: 1,
  });
});

test('iztro 地盘与人盘重排继续按 from 独立计算命身宫', () => {
  for (const astroType of ['earth', 'human']) {
    const counts = countBySolarCalls(() =>
      astro.withOptions({
        type: 'solar',
        dateStr: '1992-08-21',
        timeIndex: 4,
        gender: 'female',
        fixLeap: true,
        language: 'zh-CN',
        astroType,
        config: defaultConfig,
      }),
    );
    assert.equal(counts.soulAndBody, 5, astroType);
  }
});

test('iztro 私有命身宫事实只读且公开辅助函数调用保持原行为', () => {
  astro.config({
    yearDivide: 'exact',
    horoscopeDivide: 'normal',
    ageDivide: 'birthday',
    dayDivide: 'current',
    algorithm: 'default',
  });
  i18n.setLanguage('zh-CN');
  const param: AstrolabeParam = {
    solarDate: '2023-04-06',
    timeIndex: 11,
    gender: 'female',
    fixLeap: true,
  };
  const soulAndBody = Object.freeze(palace.getSoulAndBody(param) as SoulAndBody);
  const originalSoulAndBody = { ...soulAndBody };
  const helpers: AnyFunction[] = [
    majorStar.getMajorStar,
    adjectiveStar.getAdjectiveStar,
    decorativeStar.getchangsheng12,
    palace.getHoroscope,
    location.getStartIndex,
    location.getYearlyStarIndex,
  ];

  for (const helper of helpers) {
    assert.deepEqual(plain(helper(param, soulAndBody)), plain(helper(param)));
    assert.equal(helper.length, 1);
  }
  assert.deepEqual(soulAndBody, originalSoulAndBody);
});

test('iztro 六语边界基础盘保留完整日期与十二宫结构', () => {
  const languages = ['en-US', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'vi-VN'];
  const cases = [
    ['1992-08-21', 4, true, 'normal', 'normal', 'forward'],
    ['2024-02-03', 11, true, 'exact', 'exact', 'forward'],
    ['2024-02-04', 0, false, 'normal', 'exact', 'current'],
    ['2024-02-09', 12, true, 'exact', 'normal', 'forward'],
    ['2024-02-10', 12, true, 'normal', 'normal', 'current'],
    ['2023-04-05', 11, true, 'normal', 'exact', 'forward'],
    ['2023-04-06', 11, true, 'exact', 'normal', 'current'],
    ['2023-04-06', 12, false, 'exact', 'exact', 'forward'],
  ] as const;

  for (const language of languages) {
    for (const [dateStr, timeIndex, fixLeap, yearDivide, horoscopeDivide, dayDivide] of cases) {
      const result = astro.withOptions({
        type: 'solar',
        dateStr,
        timeIndex,
        gender: 'female',
        fixLeap,
        language,
        astroType: 'heaven',
        config: {
          yearDivide,
          horoscopeDivide,
          ageDivide: 'birthday',
          dayDivide,
          algorithm: 'default',
        },
      });
      assert.equal(result.palaces.length, 12, `${language}/${dateStr}/${timeIndex}`);
      assert.equal(result.rawDates.chineseDate.toString().split(' ').length, 4);
      assert.ok(result.rawDates.lunarDate.toString(true).length > 0);
      assert.ok(result.chineseDate.length > 0);
      assert.ok(result.lunarDate.length > 0);
      assert.equal(result.rawDates.chineseDate.yearly.length, 2);
      assert.equal(result.rawDates.chineseDate.monthly.length, 2);
      assert.equal(result.rawDates.chineseDate.daily.length, 2);
      assert.equal(result.rawDates.chineseDate.hourly.length, 2);
    }
  }
});

test('iztro 静默词典更新在后续基础盘即时生效且不跨请求复用日期对象', () => {
  const i18next = i18n.default;
  i18n.setLanguage('zh-CN');
  const original = i18next.t('jiaHeavenly');
  try {
    i18next.addResource('zh-CN', 'translation', 'jiaHeavenly', '__mingyu_first__', {
      silent: true,
    });
    const first = astro.bySolar('1992-08-21', 4, 'female', true, 'zh-CN');
    i18next.addResource('zh-CN', 'translation', 'jiaHeavenly', '__mingyu_second__', {
      silent: true,
    });
    const second = astro.bySolar('1992-08-21', 4, 'female', true, 'zh-CN');

    assert.notDeepEqual(plain(second), plain(first));
    assert.notEqual(second.rawDates.chineseDate, first.rawDates.chineseDate);
    assert.notEqual(second.rawDates.chineseDate.yearly, first.rawDates.chineseDate.yearly);
  } finally {
    i18next.addResource('zh-CN', 'translation', 'jiaHeavenly', original, { silent: true });
    i18n.setLanguage('zh-CN');
  }
});
