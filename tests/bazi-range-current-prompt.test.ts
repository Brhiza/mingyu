import assert from 'node:assert/strict';
import test from 'node:test';

import type { BaziChartResult, Person } from 'mingyu-core/bazi';
import type { BirthChartPointBundle } from 'mingyu-core/birth';
import type { BirthProfile } from 'mingyu-core/profile';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { BaziRangePage, BaziRangePageSide } from '../src/lib/full-chart-engine/bazi-range';
import {
  buildBaziRangeReadingSubject,
  formatBaziCurrentSampleContext,
  selectBaziPromptSample,
} from '../src/pages/ResultPage/bazi-range-prompt';

const PRIMARY_RESULT = { marker: 'primary' } as unknown as BaziChartResult;
const PARTNER_RESULT = { marker: 'partner' } as unknown as BaziChartResult;
const POINT_BUNDLE = {} as BirthChartPointBundle;
const PRIMARY_TIMESTAMP = Date.UTC(1990, 0, 1, 0, 0, 0);
const PARTNER_TIMESTAMP = Date.UTC(1990, 0, 1, 0, 0, 1);

const PRIMARY_PROFILE: BirthProfile = {
  name: '公开合成一',
  gender: 'female',
  calendarType: 'solar',
  year: 1990,
  month: 1,
  day: 1,
  hour: 8,
  minute: 0,
  second: 0,
};

const PARTNER_PROFILE: BirthProfile = {
  name: '公开合成二',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 1,
  day: 1,
  hour: 8,
  minute: 0,
  second: 1,
};

function side(
  index: number,
  profile: BirthProfile,
  result: BaziChartResult,
  timestamp: number,
): BaziRangePageSide {
  return { index, profile, result, bundle: POINT_BUNDLE, timestamp };
}

function baziBundle(person: Person): BirthChartPointBundle {
  return { inputs: { bazi: person } } as unknown as BirthChartPointBundle;
}

function page(index = 0): BaziRangePage {
  return {
    inputKey: 'synthetic-1990-range',
    index,
    total: 3,
    nextIndex: index < 2 ? index + 1 : null,
    primary: side(index, PRIMARY_PROFILE, PRIMARY_RESULT, PRIMARY_TIMESTAMP + index * 1_000),
    partner: side(0, PARTNER_PROFILE, PARTNER_RESULT, PARTNER_TIMESTAMP + index * 1_000),
    compatibility: {
      promptText: '当前合成双方关系证据',
    } as unknown as BaziRangePage['compatibility'],
  };
}

test('范围样本尚未加载时不回落到区间起点代表盘', () => {
  const selection = selectBaziPromptSample(true, null, PRIMARY_RESULT, PARTNER_RESULT);

  assert.equal(selection.primary, null);
  assert.equal(selection.partner, null);
  assert.equal(selection.identity, 'bazi-range:pending');
  assert.equal(formatBaziCurrentSampleContext(selection.page), '');
});

test('提示词只描述当前逐秒样本和当前组合，缓存身份随页变化', () => {
  const currentPage = page(0);
  const nextPage = page(1);
  const selection = selectBaziPromptSample(true, currentPage, PRIMARY_RESULT, PARTNER_RESULT);
  const context = formatBaziCurrentSampleContext(selection.page);

  assert.equal(selection.primary, PRIMARY_RESULT);
  assert.equal(selection.partner, PARTNER_RESULT);
  assert.match(context, /当前八字组合样本：第 1\/3 条（本次仅解读当前样本）/);
  assert.match(context, /第一人：1990-01-01 08:00:00（北京时间）/);
  assert.match(context, /第二人：1990-01-01 08:00:01（北京时间）/);
  assert.match(context, /当前组合关系证据：当前合成双方关系证据/);
  assert.doesNotMatch(context, /样本索引/);
  assert.doesNotMatch(context, /区间起点作为代表时刻/);
  assert.doesNotMatch(context, /bazi-range:/);
  assert.notEqual(
    selection.identity,
    selectBaziPromptSample(true, nextPage, PRIMARY_RESULT, PARTNER_RESULT).identity,
  );
});

test('非范围输入继续使用固定单点结果并不生成范围样本说明', () => {
  const selection = selectBaziPromptSample(false, null, PRIMARY_RESULT, null);

  assert.equal(selection.primary, PRIMARY_RESULT);
  assert.equal(selection.partner, null);
  assert.equal(selection.identity, 'bazi-point');
  assert.equal(formatBaziCurrentSampleContext(selection.page), '');
});

test('AI主体快照锁定当前双方秒和组合索引，并移除旧出生范围', () => {
  const originalSubject: ReadingSubjectSnapshot = {
    id: 'subject-start',
    source: 'bazi',
    lockedInputs: {
      bazi: {
        gender: 'female',
        year: 1990,
        month: 1,
        day: 1,
        dateType: 'solar',
        isLeapMonth: false,
        timeIndex: 5,
        useTrueSolarTime: false,
        birthHour: 8,
        birthMinute: 0,
        birthSecond: 0,
        birthLatitude: 39.9,
        timezone: 8,
        applyChinaDst: false,
      },
      baziPartner: {
        gender: 'male',
        year: 1990,
        month: 1,
        day: 1,
        dateType: 'solar',
        isLeapMonth: false,
        timeIndex: 5,
        useTrueSolarTime: false,
        birthHour: 8,
        birthMinute: 0,
        birthSecond: 0,
        timezone: 8,
        applyChinaDst: false,
      },
    },
    allowedMethods: ['bazi'],
    range: {
      source: 'bazi',
      baziFortuneScope: 'dayun',
      birthTimeRanges: { primary: { startTimestamp: PRIMARY_TIMESTAMP } },
    },
  };
  const primaryPerson: Person = {
    gender: 'female',
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: 8,
    birthMinute: 0,
    birthSecond: 2,
    birthPlace: '北京',
    birthLongitude: 116.4,
    timezone: 8,
    applyChinaDst: false,
  };
  const partnerPerson: Person = {
    ...primaryPerson,
    gender: 'male',
    timeIndex: 7,
    birthSecond: 7,
  };
  const basePage = page(1);
  const currentPage: BaziRangePage = {
    ...basePage,
    primary: { ...basePage.primary, bundle: baziBundle(primaryPerson) },
    partner: basePage.partner
      ? { ...basePage.partner, index: 2, bundle: baziBundle(partnerPerson) }
      : undefined,
  };

  const currentSubject = buildBaziRangeReadingSubject(originalSubject, true, currentPage);

  assert.ok(currentSubject);
  assert.notEqual(currentSubject, originalSubject);
  assert.match(currentSubject.id, /subject-start:bazi-range:synthetic-1990-range:1/u);
  assert.equal(currentSubject.lockedInputs.bazi?.birthSecond, 2);
  assert.equal(currentSubject.lockedInputs.bazi?.timeIndex, 6);
  assert.equal(currentSubject.lockedInputs.bazi?.birthPlace, '北京');
  assert.equal(currentSubject.lockedInputs.baziPartner?.birthSecond, 7);
  assert.equal(currentSubject.lockedInputs.baziPartner?.timeIndex, 7);
  assert.equal(currentSubject.range.birthTimeRanges, undefined);
  assert.equal(originalSubject.lockedInputs.bazi?.birthSecond, 0);

  const singleSubject = {
    ...originalSubject,
    lockedInputs: { bazi: originalSubject.lockedInputs.bazi },
  } satisfies ReadingSubjectSnapshot;
  const singlePage = { ...currentPage, partner: undefined };
  const currentSingleSubject = buildBaziRangeReadingSubject(singleSubject, true, singlePage);
  assert.ok(currentSingleSubject);
  assert.equal(currentSingleSubject.lockedInputs.bazi?.birthSecond, 2);
  assert.equal(currentSingleSubject.lockedInputs.baziPartner, undefined);

  const combinedSubject = {
    ...originalSubject,
    source: 'bazi-ziwei',
  } satisfies ReadingSubjectSnapshot;
  assert.equal(buildBaziRangeReadingSubject(combinedSubject, true, currentPage), combinedSubject);

  assert.equal(buildBaziRangeReadingSubject(originalSubject, true, null), undefined);
  assert.equal(buildBaziRangeReadingSubject(originalSubject, false, null), originalSubject);
});
