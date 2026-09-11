import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReadingSubject, type ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import { executeReadingAction, type ReadingAction } from '../src/lib/ai/reading-resources';
import {
  createDefaultPromptState,
  defaultInputState,
  type QueryInputState,
  type QueryPromptState,
} from '../src/lib/query-state';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const input: QueryInputState = {
  ...defaultInputState,
  name: '住宅测试',
  gender: 'male',
  dateType: 'solar',
  year: '1990',
  month: '5',
  day: '15',
};

const prompt: QueryPromptState = {
  ...createDefaultPromptState(new Date('2026-09-11T12:00:00+08:00')),
  tab: 'bazhai',
  promptSource: 'bazhai',
  bazhaiFacingDegree: '0',
  residentialHouseYear: '2024',
  residentialFlowYear: '2026',
  residentialFlowMonth: '2',
  residentialFlowDay: '10',
};

const generatedSubject = buildReadingSubject(input, prompt);
const subject: ReadingSubjectSnapshot = {
  ...generatedSubject,
  id: 'residential-real-identity',
};

const measuredSubject: ReadingSubjectSnapshot = {
  ...subject,
  id: 'residential-measured-real-identity',
  lockedInputs: {
    fengshui: {
      ...subject.lockedInputs.fengshui,
      northReference: 'magnetic',
      magneticDeclinationDegrees: 1,
      measurementUncertaintyDegrees: 3,
    },
  },
};

const action: ReadingAction = {
  kind: 'calculate',
  method: 'fengshui',
  input: {
    flowYear: 2026,
    flowMonth: 2,
    flowDay: 10,
    question: '这套住宅在目标日期的宅运如何？',
  },
};

type BodyMutator = (body: Record<string, unknown>) => void;

async function withRealApi(callback: () => Promise<void>, mutate?: BodyMutator) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (inputValue, init) => {
    const request = new Request(new URL(String(inputValue), 'https://aov.cc'), init);
    const response = await handlePublicApiRequest(request);
    if (!mutate) return response;
    const body = (await response.json()) as Record<string, unknown>;
    mutate(body);
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = original;
  }
}

test('住宅 AI 主体快照锁定出生、建造年和门向资料', () => {
  assert.deepEqual(generatedSubject.allowedMethods, ['fengshui']);
  assert.deepEqual(generatedSubject.lockedInputs.fengshui, {
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 15,
    gender: 'male',
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.deepEqual(
    {
      year: generatedSubject.range.residentialFlowYear,
      month: generatedSubject.range.residentialFlowMonth,
      day: generatedSubject.range.residentialFlowDay,
    },
    { year: '2026', month: '2', day: '10' },
  );
});

test('住宅 AI 补算经真实公开接口返回目标流年流月与逐宫飞星', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(action, undefined, subject);
    const result = resource.structured as Record<string, unknown>;
    const xuankong = result.xuankong as Record<string, unknown>;
    const flowStars = xuankong.flowStars as Record<string, unknown>;
    const monthPlate = flowStars.monthPlate as Record<string, unknown>;
    const palaces = xuankong.palaces as Array<Record<string, unknown>>;

    assert.equal(result.key, 'residential-fengshui');
    assert.equal(monthPlate.year, 2026);
    assert.equal(monthPlate.month, 2);
    assert.equal(monthPlate.day, 10);
    assert.equal(palaces.length, 9);
    assert.ok(palaces.every((palace) => typeof palace.yearStar === 'number'));
    assert.ok(palaces.every((palace) => typeof palace.monthStar === 'number'));
    assert.match(resource.title, /住宅风水.*2026年.*2月.*10日/u);
    assert.match(resource.text, /流年飞星/u);
    assert.match(resource.text, /流月飞星/u);
  });
});

test('住宅 AI 补算保留真实北向基准、磁偏角和测量误差', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(action, undefined, measuredSubject);
    const result = resource.structured as Record<string, unknown>;
    const bazhai = result.bazhai as Record<string, unknown>;
    const measurement = bazhai.directionMeasurement as Record<string, unknown>;

    assert.equal(measurement.measuredDegree, 0);
    assert.equal(measurement.northReference, 'magnetic');
    assert.equal(measurement.magneticDeclinationDegrees, 1);
    assert.equal(measurement.measurementUncertaintyDegrees, 3);
  });
});

test('住宅 AI 补算会按实际返回的目标流运资料核验，而非只接受提示词', async () => {
  await withRealApi(
    async () => {
      await assert.rejects(
        executeReadingAction(action, undefined, subject),
        /fengshui\.flowMonth/u,
      );
    },
    (body) => {
      const data = body.data as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const xuankong = result.xuankong as Record<string, unknown>;
      const flowStars = xuankong.flowStars as Record<string, unknown>;
      const monthPlate = flowStars.monthPlate as Record<string, unknown>;
      monthPlate.month = 3;
    },
  );
});

test('住宅 AI 补算拒绝修改已锁定的建造年或门向', async () => {
  await assert.rejects(
    executeReadingAction(
      {
        kind: 'calculate',
        method: 'fengshui',
        input: { year: 2025, question: '修改住宅主体' },
      },
      undefined,
      subject,
    ),
    /补算主体与当前命盘不一致：year/u,
  );

  await assert.rejects(
    executeReadingAction(
      {
        kind: 'calculate',
        method: 'fengshui',
        input: { doorToInteriorDegree: 1, question: '修改住宅主体' },
      },
      undefined,
      subject,
    ),
    /补算主体与当前命盘不一致：doorToInteriorDegree/u,
  );
});
