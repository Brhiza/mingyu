import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQimenLifetimeInputs,
  buildReadingSubject,
  type ReadingSubjectSnapshot,
} from '../src/lib/ai/reading-subject';
import { executeReadingAction, type ReadingAction } from '../src/lib/ai/reading-resources';
import type { QueryInputState, QueryPromptState } from '../src/lib/query-state';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import { calculateQimenLifetime } from 'mingyu-core/divination/qimen';

const input: QueryInputState = {
  analysisMode: 'single',
  chartType: 'bazi',
  name: '甲',
  gender: 'male',
  dateType: 'solar',
  year: '1990',
  month: '5',
  day: '15',
  timeIndex: 8,
  isLeapMonth: false,
  useTrueSolarTime: true,
  birthHour: '10',
  birthMinute: '30',
  birthPlace: '北京',
  birthLongitude: '116.4',
  birthLatitude: '39.9',
  partnerName: '',
  partnerGender: 'female',
  partnerDateType: 'solar',
  partnerYear: '',
  partnerMonth: '',
  partnerDay: '',
  partnerTimeIndex: '',
  partnerIsLeapMonth: false,
  partnerUseTrueSolarTime: false,
  partnerBirthHour: '',
  partnerBirthMinute: '',
  partnerBirthPlace: '',
  partnerBirthLongitude: '',
  partnerBirthLatitude: '',
};

const prompt = { promptSource: 'qimen-lifetime' } as QueryPromptState;
const generatedSubject = buildReadingSubject(input, prompt);

test('终身奇门HTTP计算与提示词拒绝无效主题，避免静默返回空主题资料', async () => {
  for (const endpoint of ['/divination/qimen/lifetime', '/divination/qimen/lifetime/prompt']) {
    for (const topics of [['unknown'], [1], 'career']) {
      const response = await handlePublicApiRequest(
        new Request(`https://aov.cc/api/v1${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            birthDateTime: '1990-05-15T10:30:00+08:00',
            question: '解读事业阶段。',
            topics,
          }),
        }),
      );
      assert.equal(response.status, 400);
      assert.match(await response.text(), /topics/u);
    }
  }
});

const subject: ReadingSubjectSnapshot = {
  ...generatedSubject,
  id: 'qimen-lifetime-real-identity',
};

async function withRealApi(callback: () => Promise<void>, change?: Record<string, unknown>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (inputValue, init) => {
    const request = new Request(new URL(String(inputValue), 'https://aov.cc'), init);
    if (!change) return handlePublicApiRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
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

async function callLifetimeApi(path: string, body: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { response, body: (await response.json()) as Record<string, unknown> };
}

const periodRange = { startDate: '2026-01-01', endDate: '2027-12-31' };
const action: ReadingAction = {
  kind: 'calculate',
  method: 'qimen-lifetime',
  input: {
    periodRange,
    topics: ['career'],
    question: '未来两年的事业变化',
  },
};

test('终身奇门主体快照锁定出生口径且只允许目标区间补算', () => {
  assert.deepEqual(generatedSubject.allowedMethods, ['qimen-lifetime']);
  assert.equal(generatedSubject.lockedInputs.qimen, undefined);
  assert.deepEqual(generatedSubject.lockedInputs['qimen-lifetime'], {
    birthDateTime: '1990-05-15T10:30:00',
    timeZoneId: 'Asia/Shanghai',
    calendarType: 'solar',
    isLeapMonth: false,
    timeStandard: 'trueSolar',
    applyChinaDst: false,
    method: 'zhuanpan',
    juMethod: 'chaibu',
    stagePolicy: {
      model: 'pillarFourLimits',
      anchorRule: 'birthInstant',
      ageSystem: 'fullYears',
      yearsPerStage: 15,
    },
    name: '甲',
    gender: 'male',
    location: { longitude: 116.4, latitude: 39.9, locationName: '北京' },
  });
});

test('终身奇门初始盘与 AI 补算共享历史时区和阶段口径', async () => {
  const historicalDstInput = { ...input, year: '1990', month: '7', day: '1' };
  const lifetimeInput = buildQimenLifetimeInputs(historicalDstInput);
  const requestInput = {
    ...lifetimeInput,
    periodRange,
    topics: ['career'] as const,
  };
  const initial = calculateQimenLifetime(requestInput);
  const historicalSubject = buildReadingSubject(historicalDstInput, prompt);

  assert.equal(lifetimeInput.timeZoneId, 'Asia/Shanghai');
  assert.equal(lifetimeInput.method, 'zhuanpan');
  assert.equal(lifetimeInput.juMethod, 'chaibu');
  assert.deepEqual(lifetimeInput.stagePolicy, {
    model: 'pillarFourLimits',
    anchorRule: 'birthInstant',
    ageSystem: 'fullYears',
    yearsPerStage: 15,
  });
  assert.match(initial.basis.timeZoneUsed, /Asia\/Shanghai \(UTC\+9\)/u);

  await withRealApi(async () => {
    const resource = await executeReadingAction(action, undefined, historicalSubject);
    const remote = resource.structured as Record<string, unknown>;
    const remoteBasis = remote.basis as Record<string, unknown>;
    const remoteChart = remote.baseChart as Record<string, unknown>;
    assert.equal(remoteBasis.timeZoneUsed, initial.basis.timeZoneUsed);
    assert.deepEqual(remoteChart.ganzhi, initial.baseChart.ganzhi);
    assert.deepEqual(remote.input, requestInput);
  });
});

test('终身奇门公共接口拒绝无效或超过31年的目标区间', async () => {
  const baseRequest = {
    ...generatedSubject.lockedInputs['qimen-lifetime'],
    question: '目标区间校验',
  };
  for (const path of ['divination/qimen/lifetime', 'divination/qimen/lifetime/prompt']) {
    const tooLong = await callLifetimeApi(path, {
      ...baseRequest,
      periodRange: { startDate: '2026-01-01', endDate: '2057-01-01' },
    });
    assert.equal(tooLong.response.status, 400, path);
    const tooLongError = tooLong.body.error as Record<string, unknown> | undefined;
    assert.match(String(tooLongError?.message), /连续31个年份/u);

    const invalidDate = await callLifetimeApi(path, {
      ...baseRequest,
      periodRange: { startDate: '2026-02-30', endDate: '2026-12-31' },
    });
    assert.equal(invalidDate.response.status, 400, path);
    const invalidDateError = invalidDate.body.error as Record<string, unknown> | undefined;
    assert.match(String(invalidDateError?.message), /startDate.*有效日期/u);
  }
});

test('终身奇门补算经真实公共 API 返回实际阶段和目标区间动态盘面', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(action, undefined, subject);
    const result = resource.structured as Record<string, unknown>;
    const actualInput = result.input as Record<string, unknown>;
    assert.equal(actualInput.birthDateTime, '1990-05-15T10:30:00');
    assert.equal(actualInput.timeZoneId, 'Asia/Shanghai');
    assert.equal(actualInput.timeStandard, 'trueSolar');
    assert.deepEqual(actualInput.periodRange, periodRange);
    assert.deepEqual(actualInput.topics, ['career']);
    assert.ok(Array.isArray(result.stages) && result.stages.length > 0);
    const clusters = result.eventClusters as Array<Record<string, unknown>>;
    assert.ok(clusters.some((item) => String(item.timeSpan).startsWith('2026年')));
    assert.ok(clusters.some((item) => String(item.timeSpan).startsWith('2027年')));
    assert.match(resource.title, /奇门终身局.*2026-01-01至2027-12-31/u);
    assert.match(resource.text, /2026年/u);
  });
});

test('终身局主体拒绝普通即时奇门和篡改后的出生主体', async () => {
  await assert.rejects(
    executeReadingAction(
      { kind: 'calculate', method: 'qimen', input: { customDate: '2030-01-01T00:00:00+08:00' } },
      undefined,
      subject,
    ),
    /此方法暂不支持自动补算/u,
  );
  await assert.rejects(
    executeReadingAction(
      { kind: 'calculate', method: 'bazi', input: { year: 2030 } },
      undefined,
      subject,
    ),
    /补算方法与当前命盘类型不一致/u,
  );

  await withRealApi(
    async () => {
      await assert.rejects(executeReadingAction(action, undefined, subject), /birthDateTime/u);
    },
    { birthDateTime: '1991-05-15T10:30:00' },
  );
});

test('终身局补算拒绝公共 API 返回的错误目标区间', async () => {
  await withRealApi(
    async () => {
      await assert.rejects(
        executeReadingAction(action, undefined, subject),
        /periodRange\.startDate/u,
      );
    },
    { periodRange: { startDate: '2030-01-01', endDate: '2031-12-31' } },
  );
});

test('终身奇门补算 schema 只暴露目标时段字段', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(
      { kind: 'schema', method: 'qimen-lifetime' },
      undefined,
      subject,
    );
    const schema = JSON.parse(resource.text) as {
      properties: Record<string, unknown>;
      required?: string[];
    };
    assert.ok(schema.properties.periodRange);
    assert.ok(schema.properties.topics);
    assert.ok(schema.properties.question);
    assert.equal(schema.properties.birthDateTime, undefined);
    assert.equal(schema.properties.timeStandard, undefined);
    assert.deepEqual(schema.required, ['question']);
  });
});
