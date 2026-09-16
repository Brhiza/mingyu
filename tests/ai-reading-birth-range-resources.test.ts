import assert from 'node:assert/strict';
import test from 'node:test';

import { getGanZhiFromDate } from 'mingyu-core/ganzhi';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function beijingTimestamp(value: string) {
  const [dateText, timeText] = value.split(' ');
  const [year, month, day] = dateText!.split('-').map(Number);
  const [hour, minute, second] = timeText!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day, hour, minute, second) - BEIJING_OFFSET_MS;
}

function createPublicSource(intervalStart: string, intervalEnd: string) {
  return {
    // getGanZhiFromDate 读取 Date 的本地字段；用公共墙钟文本构造，避免 NAS UTC 将四柱整体前移。
    pillars: getGanZhiFromDate(new Date(intervalStart.replace(' ', 'T'))),
    intervalStart,
    intervalEnd,
    startTimestamp: beijingTimestamp(intervalStart),
    endTimestamp: beijingTimestamp(intervalEnd),
    endExclusive: true as const,
    timezone: 'Asia/Shanghai' as const,
    offsetHours: 8 as const,
  };
}

const primarySource = createPublicSource('2032-03-01 10:30:00', '2032-03-01 10:45:00');
const partnerSource = createPublicSource('2031-09-12 08:00:00', '2031-09-12 08:20:00');

const astrolabeInputs = {
  name: '甲',
  gender: 'male',
  year: 2032,
  month: 3,
  day: 1,
  hour: 10,
  minute: 30,
  second: 0,
  latitude: 39.9,
  longitude: 116.4,
  timeZoneId: 'Asia/Shanghai',
  locationName: '北京',
  useTrueSolarTime: false,
};

const qizhengInputs = {
  gender: 'male',
  year: 2032,
  month: 3,
  day: 1,
  hour: 10,
  minute: 30,
  second: 0,
  latitude: 39.9,
  longitude: 116.4,
  timeZoneId: 'Asia/Shanghai',
  useTrueSolarTime: false,
};

function createAstrolabeSubject(
  range: Record<string, unknown> = { primary: primarySource },
): ReadingSubjectSnapshot {
  return {
    id: `birth-range-astrolabe-${Object.keys(range).join('-') || 'none'}`,
    source: 'astrolabe',
    lockedInputs: { astrolabe: astrolabeInputs },
    allowedMethods: ['astrolabe'],
    range: { birthTimeRanges: range },
  };
}

function createLegacyAstrolabeSubject(): ReadingSubjectSnapshot {
  return {
    ...createAstrolabeSubject({}),
    range: {},
  };
}

function createCompatibilityAstrolabeSubject(): ReadingSubjectSnapshot {
  return {
    id: 'birth-range-astrolabe-compatibility',
    source: 'astrolabe',
    lockedInputs: {
      astrolabe: astrolabeInputs,
      astrolabePartner: {
        ...astrolabeInputs,
        name: '乙',
        year: 2031,
        month: 9,
        day: 12,
        hour: 8,
        minute: 0,
      },
    },
    allowedMethods: ['astrolabe'],
    range: { birthTimeRanges: { primary: primarySource, partner: partnerSource } },
  };
}

function createQizhengSubject(
  range: Record<string, unknown> = { primary: primarySource },
): ReadingSubjectSnapshot {
  return {
    id: `birth-range-qizheng-${Object.keys(range).join('-') || 'none'}`,
    source: 'qizheng',
    lockedInputs: { 'qi-zheng': qizhengInputs },
    allowedMethods: ['qi-zheng'],
    range: { birthTimeRanges: range },
  };
}

async function withPublicApi<T>(callback: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) =>
    handlePublicApiRequest(
      new Request(new URL(String(input), 'https://aov.cc'), init),
    )) as typeof fetch;
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}

test('星盘补算资源保留代表时刻、出生区间文本与结构化范围', async () => {
  await withPublicApi(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'astrolabe',
        input: { astrolabeScope: 'natal', question: '本命结构' },
      },
      undefined,
      createAstrolabeSubject(),
    );

    assert.match(resource.text, /【出生时间范围】/u);
    assert.match(resource.text, /2032-03-01 10:30:00 至 2032-03-01 10:45:00/u);
    assert.deepEqual(resource.structured?.birthTimeRange, primarySource);
    const birth = resource.structured?.birth as Record<string, unknown>;
    assert.match(String(birth.standardDateTime ?? birth.dateTime), /2032-03-01 10:30/u);
  });
});

test('七政补算资源保留代表时刻、出生区间文本与结构化范围', async () => {
  await withPublicApi(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'qi-zheng',
        input: { flowYear: 2035, flowMonth: 3, flowDay: 1, question: '流年结构' },
      },
      undefined,
      createQizhengSubject(),
    );

    assert.match(resource.text, /【出生时间范围】/u);
    assert.match(resource.text, /2032-03-01 10:30:00 至 2032-03-01 10:45:00/u);
    assert.deepEqual(resource.structured?.birthTimeRange, primarySource);
    const context = resource.structured?.calculationContext as Record<string, unknown>;
    assert.equal(context.localDateTime, '2032-03-01T10:30:00');
  });
});

test('合盘补算只消费目标对象的出生区间，不能串用本人来源', async () => {
  await withPublicApi(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'astrolabe',
        target: 'partner',
        input: { astrolabeScope: 'natal', question: '对方本命' },
      },
      undefined,
      createCompatibilityAstrolabeSubject(),
    );

    assert.match(resource.text, /对方出生时间范围/u);
    assert.match(resource.text, /2031-09-12 08:00:00 至 2031-09-12 08:20:00/u);
    assert.doesNotMatch(resource.text, /2032-03-01 10:30:00 至 2032-03-01 10:45:00/u);
    assert.deepEqual(resource.structured?.birthTimeRange, partnerSource);
    const birth = resource.structured?.birth as Record<string, unknown>;
    assert.match(String(birth.standardDateTime ?? birth.dateTime), /2031-09-12 08:00/u);
  });
});

test('旧主体没有出生区间时补算资源保持原文本和结构化形状', async () => {
  await withPublicApi(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'astrolabe',
        input: { astrolabeScope: 'natal', question: '旧记录' },
      },
      undefined,
      createLegacyAstrolabeSubject(),
    );

    assert.doesNotMatch(resource.text, /【出生时间范围】/u);
    assert.equal('birthTimeRange' in (resource.structured ?? {}), false);
    const birth = resource.structured?.birth as Record<string, unknown>;
    assert.match(String(birth.standardDateTime ?? birth.dateTime), /2032-03-01 10:30/u);
  });
});

test('补算请求不能改写锁定的出生代表时刻', async () => {
  await withPublicApi(async () => {
    await assert.rejects(
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'qi-zheng',
          input: { year: 2033, flowYear: 2035, question: '篡改出生年份' },
        },
        undefined,
        createQizhengSubject(),
      ),
      /主体与当前命盘不一致：year/u,
    );
  });
});
