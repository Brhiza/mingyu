import assert from 'node:assert/strict';
import test from 'node:test';

import type { BaziChartResult, Person } from 'mingyu-core/bazi';
import type { BirthChartPointBundle } from 'mingyu-core/birth';
import type { BirthProfile } from 'mingyu-core/profile';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { BaziRangePage, BaziRangePageSide } from '../src/lib/full-chart-engine/bazi-range';
import {
  buildBaziZiweiRangeReadingSubject,
  buildBaziRangeReadingSubject,
  formatBaziCurrentSampleContext,
  formatCurrentBirthSampleContext,
  selectBaziPromptSample,
} from '../src/pages/ResultPage/bazi-range-prompt';
import { buildBaziZiweiCompatibilityPrompt } from '../src/pages/ResultPage/ResultPage.helpers';
import {
  getZiweiPayloadKey,
  getZiweiRuntimeKey,
} from '../src/pages/ResultPage/utils/ziweiCalculationCache';

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

test('混合范围组合保留仅名称地点、坐标 IANA 时区和固定侧分钟精度', () => {
  const basePage = page(1);
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
    timezone: 8,
    applyChinaDst: false,
  };
  const minutePartner: Person = {
    ...primaryPerson,
    gender: 'male',
    birthSecond: 0,
    birthPlace: '有坐标对方',
    birthLongitude: 121.47,
    timeZoneId: 'Asia/Shanghai',
    timezone: undefined,
  };
  const currentPage: BaziRangePage = {
    ...basePage,
    primary: {
      ...basePage.primary,
      profile: { ...PRIMARY_PROFILE, second: 2 },
      bundle: baziBundle(primaryPerson),
      identity: { birthPlace: '范围主方', timezone: 8 },
    },
    partner: basePage.partner
      ? {
          ...basePage.partner,
          profile: {
            ...PARTNER_PROFILE,
            second: undefined,
            location: {
              name: '有坐标对方',
              longitude: 121.47,
              latitude: 31.23,
              timeZoneId: 'Asia/Shanghai',
            },
          },
          bundle: baziBundle(minutePartner),
          timestamp: undefined,
          identity: { birthPlace: '有坐标对方', timeZoneId: 'Asia/Shanghai' },
        }
      : undefined,
  };
  const subject: ReadingSubjectSnapshot = {
    id: 'mixed-subject-start',
    source: 'bazi',
    lockedInputs: {
      bazi: {
        year: 1990,
        month: 1,
        day: 1,
        birthPlace: '起点主方',
        birthSecond: 0,
        timezone: 8,
      },
      baziPartner: {
        year: 1990,
        month: 1,
        day: 1,
        birthPlace: '起点对方',
        birthSecond: 0,
        timeZoneId: 'Asia/Shanghai',
      },
    },
    allowedMethods: ['bazi'],
    range: {
      source: 'bazi',
      birthTimeRanges: { primary: { startTimestamp: PRIMARY_TIMESTAMP } },
    },
  };

  const currentSubject = buildBaziRangeReadingSubject(subject, true, currentPage);

  assert.ok(currentSubject);
  assert.equal(currentSubject.lockedInputs.bazi?.birthPlace, '范围主方');
  assert.equal(currentSubject.lockedInputs.bazi?.birthSecond, 2);
  assert.equal(currentSubject.lockedInputs.baziPartner?.birthPlace, '有坐标对方');
  assert.equal(currentSubject.lockedInputs.baziPartner?.birthLongitude, 121.47);
  assert.equal(currentSubject.lockedInputs.baziPartner?.birthLatitude, 31.23);
  assert.equal(currentSubject.lockedInputs.baziPartner?.birthSecond, undefined);
  assert.equal(currentSubject.lockedInputs.baziPartner?.timeZoneId, 'Asia/Shanghai');
  const context = formatBaziCurrentSampleContext(currentPage);
  assert.match(context, /出生地：范围主方/u);
  assert.match(context, /出生地：有坐标对方/u);
  assert.match(context, /时区：UTC\+8/u);
  assert.match(context, /时区：Asia\/Shanghai/u);
  assert.match(context, /第一人：.*输入精度：秒/u);
  assert.match(context, /第二人：.*输入精度：分钟/u);
});

test('八字紫微合参当前页同时锁定双方精确秒，并保留固定运限上下文身份', () => {
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
    timezone: 8,
    applyChinaDst: false,
  };
  const partnerPerson: Person = { ...primaryPerson, gender: 'male', birthSecond: 7 };
  const basePage = page(1);
  const currentPage: BaziRangePage = {
    ...basePage,
    primary: {
      ...basePage.primary,
      profile: { ...PRIMARY_PROFILE, second: 2 },
      bundle: baziBundle(primaryPerson),
      timestamp: PRIMARY_TIMESTAMP + 2_000,
    },
    partner: basePage.partner
      ? {
          ...basePage.partner,
          profile: { ...PARTNER_PROFILE, second: 7 },
          bundle: baziBundle(partnerPerson),
          timestamp: PRIMARY_TIMESTAMP + 7_000,
        }
      : undefined,
  };
  const combinedSubject: ReadingSubjectSnapshot = {
    id: 'combined-subject-start',
    source: 'bazi-ziwei',
    lockedInputs: {
      bazi: { year: 1990, month: 1, day: 1, birthSecond: 0, timeIndex: 5 },
      baziPartner: { year: 1990, month: 1, day: 1, birthSecond: 0, timeIndex: 5 },
      ziwei: { year: 1990, month: 1, day: 1, birthSecond: 0, timeIndex: 5 },
      ziweiPartner: { year: 1990, month: 1, day: 1, birthSecond: 0, timeIndex: 5 },
    },
    allowedMethods: ['bazi', 'ziwei'],
    range: {
      source: 'bazi-ziwei',
      birthTimeRanges: { primary: { startTimestamp: PRIMARY_TIMESTAMP } },
    },
  };

  const currentSubject = buildBaziZiweiRangeReadingSubject(combinedSubject, true, currentPage);
  assert.ok(currentSubject);
  assert.equal(currentSubject.lockedInputs.bazi?.birthSecond, 2);
  assert.equal(currentSubject.lockedInputs.baziPartner?.birthSecond, 7);
  assert.equal(currentSubject.lockedInputs.ziwei?.birthSecond, 2);
  assert.equal(currentSubject.lockedInputs.ziweiPartner?.birthSecond, 7);
  assert.equal(currentSubject.range.birthTimeRanges, undefined);
  assert.notEqual(currentSubject.id, combinedSubject.id);
  assert.match(formatCurrentBirthSampleContext(currentPage), /08:00:02/);
  assert.match(formatCurrentBirthSampleContext(currentPage), /08:00:07/);

  const fixedContext = { dateStr: '2025-01-01', hourIndex: 6 } as const;
  const inputKey = JSON.stringify({ year: 1990, month: 1, day: 1, birthSecond: 2 });
  assert.equal(
    getZiweiRuntimeKey(inputKey, { horoscopeContext: fixedContext }),
    getZiweiRuntimeKey(inputKey, { horoscopeContext: fixedContext }),
  );
  assert.equal(
    getZiweiPayloadKey(inputKey, { horoscopeContext: fixedContext }),
    getZiweiPayloadKey(inputKey, { horoscopeContext: fixedContext }),
  );
  assert.notEqual(
    getZiweiRuntimeKey(inputKey, { horoscopeContext: fixedContext }),
    getZiweiRuntimeKey(inputKey, { horoscopeContext: { dateStr: '2025-01-02', hourIndex: 6 } }),
  );
});

test('八字紫微合参提示词只组合当前页双方事实与关系依据', () => {
  const prompt = buildBaziZiweiCompatibilityPrompt({
    primaryBaziText: '第一人八字：1990-01-01 08:00:02。',
    partnerBaziText: '第二人八字：1990-01-01 08:00:07。',
    primaryZiweiText: '第一人紫微：当前固定运限上下文。',
    partnerZiweiText: '第二人紫微：当前固定运限上下文。',
    baziCompatibilityText: '八字关系依据：当前组合证据。',
    ziweiCompatibilityText: '紫微关系依据：当前组合证据。',
    question: '双方合作如何分工？',
    currentSampleContext:
      '当前出生组合样本：第 2/3 条（本次仅解读当前样本）\n第一人：1990-01-01 08:00:02（北京时间）\n第二人：1990-01-01 08:00:07（北京时间）',
  });

  assert.match(prompt, /第一人八字：1990-01-01 08:00:02/);
  assert.match(prompt, /第二人八字：1990-01-01 08:00:07/);
  assert.match(prompt, /第一人紫微：当前固定运限上下文/);
  assert.match(prompt, /八字关系依据：当前组合证据/);
  assert.match(prompt, /当前出生组合样本：第 2\/3 条/);
  assert.doesNotMatch(prompt, /代表时刻|样本索引/u);
});
