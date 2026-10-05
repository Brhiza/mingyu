import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { buildMingluArticle } from '../packages/core/src/minglu/builder.ts';
import { MingluPillarsSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPillarsSection.tsx';

test('命录按实盘原始钟表列生辰，跨日校正另列完整日期', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2024,
    month: 5,
    day: 19,
    birthHour: 0,
    birthMinute: 30,
    birthSecond: 42,
    birthPlace: '盘面出生地点',
    birthLongitude: 75,
    timezone: 8,
    timeZoneId: 'Asia/Shanghai',
    useTrueSolarTime: true,
    gender: 'male',
  });
  assert.deepEqual(chart.timing?.standardTime, {
    year: 2024,
    month: 5,
    day: 19,
    hour: 0,
    minute: 30,
    second: 42,
  });
  assert.deepEqual(chart.timing?.correctedTime, {
    year: 2024,
    month: 5,
    day: 18,
    hour: 21,
    minute: 34,
    second: 13,
  });
  assert.deepEqual(chart.solarDate, { year: 2024, month: 5, day: 18 });

  const person = { name: '原始钟表样本' };
  const article = buildMingluArticle({ person, baziResult: chart });
  const metadata = article.metadata;
  assert.equal(metadata.solarDateStr, '2024年5月19日');
  assert.equal(metadata.lunarDateStr, '农历四月十二');
  assert.equal(metadata.exactBirthTime, '00:30:42');
  assert.equal(metadata.birthSecond, 42);
  assert.equal(metadata.isTrueSolarTime, true);
  assert.equal(metadata.trueSolarTimeStr, '2024年5月18日 21时34分13秒');
  assert.equal(metadata.birthPlace, '盘面出生地点');
  assert.equal(metadata.longitude, 75);
  assert.equal(metadata.timezone, 8);
  assert.equal(metadata.timeZoneId, 'Asia/Shanghai');
  assert.equal(metadata.zodiac, '龙');
  assert.equal(metadata.constellation, '金牛');

  const html = renderToStaticMarkup(
    createElement(MingluPillarsSection, {
      data: article.pillarsSection,
      metadata,
      glossaryEntries: [],
      onNavigateGlossary: () => {},
    }),
  );
  assert.match(html, /2024年5月19日 00:30:42/u);
  assert.match(html, /农历四月十二/u);
  assert.match(html, /已校正 \(2024年5月18日 21时34分13秒\)/u);

  const conflictingPerson = {
    ...person,
    birthHour: 5,
    birthMinute: 0,
    birthSecond: 0,
    birthPlace: '非本盘地点',
    birthLongitude: 120,
    birthLatitude: 40,
    timezone: 9,
    timeZoneId: 'Asia/Tokyo',
    useTrueSolarTime: false,
  };
  const actual = buildMingluArticle({ person: conflictingPerson, baziResult: chart }).metadata;
  assert.equal(actual.exactBirthTime, '00:30:42');
  assert.equal(actual.birthSecond, 42);
  assert.equal(actual.birthPlace, '盘面出生地点');
  assert.equal(actual.longitude, 75);
  assert.equal(actual.latitude, 40);
  assert.equal(actual.timezone, 8);
  assert.equal(actual.timeZoneId, 'Asia/Shanghai');
  assert.equal(actual.isTrueSolarTime, true);
});

test('命录原始农历生肖、星座与跨年公历均随同一出生日期', () => {
  const samples = [
    {
      input: {
        year: 2024,
        month: 2,
        day: 10,
        birthHour: 0,
        birthMinute: 30,
        birthSecond: 42,
        birthLongitude: 75,
      },
      corrected: { year: 2024, month: 2, day: 9 },
      solar: '2024年2月10日',
      lunar: '农历正月初一',
      zodiac: '龙',
      constellation: '水瓶',
      correctedText: '2024年2月9日 21时16分32秒',
    },
    {
      input: {
        year: 2023,
        month: 12,
        day: 31,
        birthHour: 23,
        birthMinute: 30,
        birthLongitude: 180,
      },
      corrected: { year: 2024, month: 1, day: 1 },
      solar: '2023年12月31日',
      lunar: '农历十一月十九',
      zodiac: '兔',
      constellation: '摩羯',
      correctedText: '2024年1月1日 3时27分5秒',
    },
    {
      input: { year: 2024, month: 5, day: 21, birthHour: 0, birthMinute: 30, birthLongitude: 75 },
      corrected: { year: 2024, month: 5, day: 20 },
      solar: '2024年5月21日',
      lunar: '农历四月十四',
      zodiac: '龙',
      constellation: '双子',
    },
  ] as const;

  for (const sample of samples) {
    const chart = baziCalculator.calculateBazi({
      ...sample.input,
      timezone: 8,
      useTrueSolarTime: true,
      gender: 'male',
    });
    assert.deepEqual(chart.solarDate, sample.corrected);
    const metadata = buildMingluArticle({
      person: { name: '出生日期样本' },
      baziResult: chart,
    }).metadata;
    assert.equal(metadata.solarDateStr, sample.solar);
    assert.equal(metadata.lunarDateStr, sample.lunar);
    assert.equal(metadata.zodiac, sample.zodiac);
    assert.equal(metadata.constellation, sample.constellation);
    if ('correctedText' in sample) {
      assert.equal(metadata.trueSolarTimeStr, sample.correctedText);
    }
  }
});

test('命录同日校正沿用时分格式，结果中非零秒仍如实列出', () => {
  const input = {
    year: 2024,
    month: 5,
    day: 19,
    birthHour: 12,
    birthMinute: 30,
    timezone: 8,
    useTrueSolarTime: true,
    gender: 'male' as const,
  };
  const minuteChart = baziCalculator.calculateBazi({ ...input, birthLongitude: 75.125 });
  assert.equal(minuteChart.timing?.standardTime.second, 0);
  assert.equal(minuteChart.timing?.correctedTime.second, 0);
  const minuteMetadata = buildMingluArticle({
    person: { name: '分钟样本' },
    baziResult: minuteChart,
  }).metadata;
  assert.equal(minuteMetadata.exactBirthTime, '12:30');
  assert.equal(minuteMetadata.birthSecond, undefined);
  assert.equal(minuteMetadata.trueSolarTimeStr, '9时34分');
  const explicitSecondMetadata = buildMingluArticle({
    person: { name: '明示秒样本', birthSecond: 57 },
    baziResult: minuteChart,
  }).metadata;
  assert.equal(explicitSecondMetadata.exactBirthTime, '12:30:00');
  assert.equal(explicitSecondMetadata.birthSecond, 0);
  assert.equal(explicitSecondMetadata.trueSolarTimeStr, '9时34分0秒');

  const secondChart = baziCalculator.calculateBazi({ ...input, birthLongitude: 75 });
  assert.equal(secondChart.timing?.correctedTime.second, 30);
  const secondMetadata = buildMingluArticle({
    person: { name: '校正秒样本' },
    baziResult: secondChart,
  }).metadata;
  assert.equal(secondMetadata.exactBirthTime, '12:30');
  assert.equal(secondMetadata.birthSecond, undefined);
  assert.equal(secondMetadata.trueSolarTimeStr, '9时33分30秒');
});

test('夏令时两种输入路径均保留校正前原始公历生辰', () => {
  for (const mode of [{ applyChinaDst: true }, { timeZoneId: 'Asia/Shanghai' }]) {
    const chart = baziCalculator.calculateBazi({
      year: 1988,
      month: 6,
      day: 1,
      birthHour: 0,
      birthMinute: 30,
      birthSecond: 42,
      gender: 'male',
      ...mode,
    });
    assert.deepEqual(chart.birthClockTime, {
      year: 1988,
      month: 6,
      day: 1,
      hour: 0,
      minute: 30,
      second: 42,
    });
    assert.deepEqual(chart.solarDate, { year: 1988, month: 5, day: 31 });
    const metadata = buildMingluArticle({
      person: { name: '夏令时出生样本' },
      baziResult: chart,
    }).metadata;
    assert.equal(metadata.solarDateStr, '1988年6月1日');
    assert.equal(metadata.lunarDateStr, '农历四月十七');
    assert.equal(metadata.exactBirthTime, '00:30:42');
    assert.equal(metadata.birthSecond, 42);
    assert.equal(metadata.isTrueSolarTime, false);
    assert.equal(metadata.trueSolarTimeStr, undefined);
  }
});

test('农历精确输入先转原始公历，时辰代表值不冒充出生钟表', () => {
  const lunarChart = baziCalculator.calculateBazi({
    year: 2024,
    month: 4,
    day: 12,
    isLunar: true,
    birthHour: 0,
    birthMinute: 30,
    birthSecond: 42,
    birthLongitude: 75,
    timezone: 8,
    useTrueSolarTime: true,
    gender: 'male',
  });
  assert.deepEqual(lunarChart.birthClockTime, {
    year: 2024,
    month: 5,
    day: 19,
    hour: 0,
    minute: 30,
    second: 42,
  });
  const lunarMetadata = buildMingluArticle({
    person: { name: '农历精确输入' },
    baziResult: lunarChart,
  }).metadata;
  assert.equal(lunarMetadata.solarDateStr, '2024年5月19日');
  assert.equal(lunarMetadata.lunarDateStr, '农历四月十二');
  assert.equal(lunarMetadata.exactBirthTime, '00:30:42');
  assert.equal(lunarMetadata.trueSolarTimeStr, '2024年5月18日 21时34分13秒');

  const indexedChart = baziCalculator.calculateBazi({
    year: 2024,
    month: 5,
    day: 19,
    timeIndex: 1,
    gender: 'male',
  });
  assert.equal(indexedChart.birthClockTime, undefined);
  assert.equal(
    buildMingluArticle({ person: { name: '时辰样本' }, baziResult: indexedChart }).metadata
      .exactBirthTime,
    undefined,
  );
  assert.equal(
    buildMingluArticle({
      person: { name: '旧调用兼容', birthHour: 2, birthMinute: 0 },
      baziResult: indexedChart,
    }).metadata.exactBirthTime,
    '02:00',
  );

  const unknownChart = baziCalculator.calculateBazi({
    year: 2024,
    month: 5,
    day: 19,
    isThreePillars: true,
    timeIndex: -1,
    gender: 'male',
  });
  assert.equal(unknownChart.birthClockTime, undefined);
  const unknownMetadata = buildMingluArticle({
    person: { name: '未知时辰', birthHour: 2, birthMinute: 0, birthSecond: 17 },
    baziResult: unknownChart,
  }).metadata;
  assert.equal(unknownMetadata.exactBirthTime, undefined);
  assert.equal(unknownMetadata.birthSecond, undefined);
});

test('未校正实盘保留原有元信息与 person 明示的秒精度', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2024,
    month: 5,
    day: 19,
    birthHour: 12,
    birthMinute: 30,
    timezone: 8,
    useTrueSolarTime: false,
    gender: 'male',
  });
  assert.equal(chart.timing, undefined);
  const metadata = buildMingluArticle({
    person: {
      name: '未校正样本',
      birthHour: 12,
      birthMinute: 30,
      birthSecond: 0,
      birthPlace: '表单地点',
      birthLongitude: 116.4,
      timezone: 8,
      useTrueSolarTime: true,
    },
    baziResult: chart,
  }).metadata;
  assert.equal(metadata.solarDateStr, '2024年5月19日');
  assert.equal(metadata.lunarDateStr, '农历四月十二');
  assert.equal(metadata.exactBirthTime, '12:30:00');
  assert.equal(metadata.birthSecond, 0);
  assert.equal(metadata.birthPlace, '表单地点');
  assert.equal(metadata.longitude, 116.4);
  assert.equal(metadata.timezone, 8);
  assert.equal(metadata.isTrueSolarTime, false);
  assert.equal(metadata.trueSolarTimeStr, undefined);
});
