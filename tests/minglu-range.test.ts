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
