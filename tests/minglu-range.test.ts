import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMingluArticle } from '../packages/core/src/minglu/builder.ts';
import { calculateBirthChartBundle } from 'mingyu-core/birth';
import { birthProfileToAstrolabeInput, type BirthProfile } from 'mingyu-core/profile';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import {
  buildMingluPersonFromBirthProfile,
  calculateMingluRangePageFacts,
  type MingluRangeCalculationRequest,
} from '../src/lib/full-chart-engine/minglu-range.ts';

const PROFILE: BirthProfile = {
  id: 'minglu-range-sample',
  name: '范围命录样例',
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30,
  second: 42,
  location: {
    name: '北京市东城区',
    longitude: 116.416334,
    latitude: 39.928359,
    timezone: 8,
  },
  useTrueSolarTime: false,
};

async function requestFor(
  overrides: Partial<MingluRangeCalculationRequest> = {},
): Promise<MingluRangeCalculationRequest> {
  const bundle = await calculateBirthChartBundle(PROFILE, { systems: ['bazi'] });
  if (bundle.range || !bundle.bazi) throw new Error('测试预期得到单点八字 Bundle。');
  return {
    inputKey: 'range-input:sample',
    pageIndex: 7,
    timestamp: 674_000_042_000,
    primary: {
      profile: bundle.profile,
      baziResult: bundle.bazi,
    },
    astrolabeRequested: true,
    ...overrides,
  };
}

test('范围命录应以当前秒八字事实补齐同页星盘并保留秒级元数据', async () => {
  const request = await requestFor();
  const facts = await calculateMingluRangePageFacts(request);

  assert.equal(facts.inputKey, request.inputKey);
  assert.equal(facts.pageIndex, request.pageIndex);
  assert.equal(facts.profile.second, 42);
  assert.ok(facts.astrolabeData);
  assert.equal(facts.astrolabeData.birth.second, 42);

  const person = buildMingluPersonFromBirthProfile(facts.profile, facts.baziResult);
  const article = buildMingluArticle({
    person,
    baziResult: facts.baziResult,
    astrolabeData: facts.astrolabeData,
  });

  assert.equal(person.birthSecond, 42);
  assert.equal(article.metadata.exactBirthTime, '10:30:42');
  assert.equal(article.metadata.birthSecond, 42);
  assert.ok(article.astrolabeSection);
  assert.ok(article.tableOfContents.some((item) => item.id === 'section-astrolabe'));
  const careerEvidence = article.crossSynthesisSection?.find(
    (theme) => theme.themeId === 'career-wealth',
  );
  const midheaven = article.astrolabeSection.angles.find((angle) => angle.name === 'Midheaven');
  assert.ok(midheaven);
  assert.ok(careerEvidence?.astrolabeEvidence?.includes(`天顶位于${midheaven.sign}`));
  for (const houseNumber of [2, 10]) {
    const house = article.astrolabeSection.houses.find((item) => item.house === houseNumber);
    assert.ok(house);
    assert.ok(
      careerEvidence?.astrolabeEvidence?.includes(`第${houseNumber}宫宫头位于${house.sign}`),
    );
  }
  const timing = article.crossSynthesisSection?.find((theme) => theme.themeId === 'timing-cycles');
  assert.deepEqual(timing?.ziweiEvidence, []);
  assert.equal(timing?.astrolabeEvidence, undefined);
});

test('范围命录应优先复用同页已有星盘，不计算七政或改写已有事实', async () => {
  const directAstrolabe = generateAstrolabe(birthProfileToAstrolabeInput(PROFILE));
  const request = await requestFor({
    primary: {
      ...(await requestFor()).primary,
      astrolabeData: directAstrolabe,
    },
  });
  const facts = await calculateMingluRangePageFacts(request);

  assert.strictEqual(facts.astrolabeData, directAstrolabe);
  assert.equal(facts.astrolabeData?.birth.second, 42);
});

test('未请求星盘章节时应只返回当前页八字事实', async () => {
  const request = await requestFor({
    astrolabeRequested: false,
    primary: {
      profile: {
        ...PROFILE,
        location: undefined,
      },
      baziResult: (await requestFor()).primary.baziResult,
    },
  });
  const facts = await calculateMingluRangePageFacts(request);

  assert.equal(facts.astrolabeData, null);
  assert.equal(facts.profile.location, undefined);
});

test('取消范围命录补算应在启动星盘前明确终止', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    calculateMingluRangePageFacts(await requestFor(), controller.signal),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );
});

test('未传出生秒时命录仍保持旧的时分格式', async () => {
  const bundle = await calculateBirthChartBundle(
    { ...PROFILE, second: undefined },
    { systems: ['bazi'] },
  );
  if (bundle.range || !bundle.bazi) throw new Error('测试预期得到单点八字 Bundle。');
  const article = buildMingluArticle({
    person: buildMingluPersonFromBirthProfile(bundle.profile, bundle.bazi),
    baziResult: bundle.bazi,
  });

  assert.equal(article.metadata.exactBirthTime, '10:30');
  assert.equal(article.metadata.birthSecond, undefined);
});

test('当前页命录的生辰保留原始钟表日，校正跨日与农历输入使用同一档案', async () => {
  const examples: Array<{
    profile: BirthProfile;
    original: [number, number, number];
    calculated: { year: number; month: number; day: number };
    dateText: string;
  }> = [
    {
      profile: {
        ...PROFILE,
        year: 1988,
        month: 6,
        day: 1,
        hour: 0,
        minute: 30,
        applyChinaDst: true,
      },
      original: [1988, 6, 1],
      calculated: { year: 1988, month: 5, day: 31 },
      dateText: '1988年6月1日',
    },
    {
      profile: {
        ...PROFILE,
        calendarType: 'lunar',
        year: 2024,
        month: 4,
        day: 12,
        hour: 0,
        minute: 30,
        location: { longitude: 75, timezone: 8 },
        useTrueSolarTime: true,
      },
      original: [2024, 5, 19],
      calculated: { year: 2024, month: 5, day: 18 },
      dateText: '2024年5月19日',
    },
  ];

  for (const example of examples) {
    const bundle = await calculateBirthChartBundle(example.profile, { systems: ['bazi'] });
    if (bundle.range || !bundle.bazi) throw new Error('测试预期得到单点八字 Bundle。');
    assert.deepEqual(bundle.bazi.solarDate, example.calculated);
    const person = buildMingluPersonFromBirthProfile(bundle.profile, bundle.bazi);
    assert.deepEqual([person.birthYear, person.birthMonth, person.birthDay], example.original);
    assert.equal(person.birthHour, 0);
    assert.equal(person.birthMinute, 30);
    const metadata = buildMingluArticle({ person, baziResult: bundle.bazi }).metadata;
    assert.equal(metadata.solarDateStr, example.dateText);
    assert.equal(metadata.exactBirthTime, '00:30:42');
  }

  const shichen = await calculateBirthChartBundle(
    { ...PROFILE, hour: undefined, minute: undefined, second: undefined, timeIndex: 1 },
    { systems: ['bazi'] },
  );
  if (shichen.range || !shichen.bazi) throw new Error('测试预期得到单点八字 Bundle。');
  const person = buildMingluPersonFromBirthProfile(shichen.profile, shichen.bazi);
  assert.equal(person.birthHour, undefined);
  assert.equal(person.birthMinute, undefined);
  assert.equal(
    buildMingluArticle({ person, baziResult: shichen.bazi }).metadata.exactBirthTime,
    undefined,
  );
});
