import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';

const subject: ReadingSubjectSnapshot = {
  id: 'qizheng-real-identity',
  source: 'qizheng',
  allowedMethods: ['qi-zheng'],
  range: {},
  lockedInputs: {
    'qi-zheng': {
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
      minute: 30,
      gender: 'male',
      latitude: 39.9,
      longitude: 116.4,
      timeZoneId: 'Asia/Shanghai',
      useTrueSolarTime: false,
    },
  },
};
const action = {
  kind: 'calculate' as const,
  method: 'qi-zheng',
  input: {
    flowYear: 2030,
    flowMonth: 6,
    flowDay: 16,
    flowHour: 0,
    flowMinute: 0,
    question: '当前阶段变化',
  },
};

async function withRealApi(callback: () => Promise<void>, change?: Record<string, unknown>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const request = new Request(new URL(String(input), 'https://aov.cc'), init);
    if (!change) return handlePublicApiRequest(request);
    const body = await request.json();
    return handlePublicApiRequest(
      new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...change }),
      }),
    );
  }) as typeof fetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = original;
  }
}

for (const useTrueSolarTime of [false, true]) {
  test(`七政真实补算保留出生身份、零时分与${useTrueSolarTime ? '真太阳时' : '民用时间'}口径`, async () => {
    await withRealApi(async () => {
      const actualSubject = {
        ...subject,
        lockedInputs: { 'qi-zheng': { ...subject.lockedInputs['qi-zheng'], useTrueSolarTime } },
      };
      const resource = await executeReadingAction(action, undefined, actualSubject);
      const context = resource.structured?.calculationContext as Record<string, unknown>;
      assert.equal(context.localDateTime, '1990-05-15T10:30:00');
      assert.equal(context.palaceTimeMode, useTrueSolarTime ? '真太阳时混合口径' : '民用时间');
      const flow = resource.structured?.flowingStars as Record<string, unknown>;
      assert.equal(flow.hour, 0);
      assert.equal(flow.minute, 0);
      assert.equal(flow.year, 2030);
    });
  });
}

test('七政相同地点和目标时段但另一出生日期的实际盘面被拒绝', async () => {
  await withRealApi(
    async () => {
      await assert.rejects(
        executeReadingAction(action, undefined, subject),
        /qi-zheng.localDateTime/u,
      );
    },
    { year: 1991 },
  );
});

test('七政相同出生时刻但另一性别的实际行限被拒绝', async () => {
  await withRealApi(
    async () => {
      await assert.rejects(
        executeReadingAction(action, undefined, subject),
        /qi-zheng.timeLords.gender/u,
      );
    },
    { gender: 'female' },
  );
});

test('七政相同钟表日期但另一时区的实际盘面被拒绝', async () => {
  await withRealApi(
    async () => {
      await assert.rejects(
        executeReadingAction(action, undefined, subject),
        /qi-zheng.utcDateTime/u,
      );
    },
    { timeZoneId: 'UTC' },
  );
});
