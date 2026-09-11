import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import {
  buildDivinationReadingSubject,
  type ReadingSubjectSnapshot,
} from '../src/lib/ai/reading-subject';
import { executeReadingAction, type ReadingAction } from '../src/lib/ai/reading-resources';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

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

function buildTimingDraft(overrides: Partial<DivinationDraft>): DivinationDraft {
  return {
    ...defaultDraft,
    method: 'taiyi',
    question: '固定目标时点的趋势如何？',
    divinationTimeMode: 'custom',
    customDivinationDate: '2026-08-24',
    customDivinationTime: '15:30',
    taiyiYear: '2026',
    taiyiScope: 'month',
    ...overrides,
  };
}

const taiyiAction: ReadingAction = {
  kind: 'calculate',
  method: 'taiyi',
  input: {
    scope: 'month',
    year: 2026,
    month: 8,
    day: 24,
    hour: 15,
    minute: 30,
    question: '2026年8月24日15时30分的目标时势如何？',
  },
};

const huangjiAction: ReadingAction = {
  kind: 'calculate',
  method: 'huangji',
  input: {
    customDate: '2026-08-24T15:30:00+08:00',
    question: '这一目标时点的主要变化是什么？',
  },
};

const wuyunAction: ReadingAction = {
  kind: 'calculate',
  method: 'wuyun',
  input: {
    year: 2026,
    question: '2026年的运气与时令结构如何？',
  },
};

test('皇极、太乙和五运六气补算参数表只暴露目标时限输入', async () => {
  await withRealApi(async () => {
    const schemas = await Promise.all(
      (['taiyi', 'huangji', 'wuyun'] as const).map(async (method) => {
        const resource = await executeReadingAction({ kind: 'schema', method });
        return [
          method,
          JSON.parse(resource.text) as {
            properties?: Record<string, unknown>;
            anyOf?: unknown;
            oneOf?: unknown;
          },
        ] as const;
      }),
    );
    const byMethod = Object.fromEntries(schemas);
    assert.ok(byMethod.taiyi.properties?.scope);
    assert.ok(byMethod.taiyi.properties?.year);
    assert.ok(byMethod.taiyi.properties?.month);
    assert.ok(byMethod.huangji.properties?.customDate);
    assert.ok(byMethod.huangji.properties?.epochYear);
    assert.ok(byMethod.huangji.properties?.sixDayDateTime);
    assert.equal(byMethod.huangji.properties?.sixDayEpochDateTime, undefined);
    assert.equal(byMethod.huangji.properties?.calendarModel, undefined);
    assert.deepEqual(byMethod.wuyun.anyOf, [{ required: ['year'] }, { required: ['yearGanZhi'] }]);
    assert.deepEqual(byMethod.huangji.oneOf, [
      {
        required: ['customDate'],
        not: {
          anyOf: [
            { required: ['sixDayDateTime'] },
            { required: ['epochYear'] },
            { required: ['year'] },
            { required: ['elapsedYears'] },
          ],
        },
      },
      {
        required: ['sixDayDateTime'],
        not: {
          anyOf: [
            { required: ['customDate'] },
            { required: ['epochYear'] },
            { required: ['year'] },
            { required: ['elapsedYears'] },
          ],
        },
      },
      {
        required: ['year'],
        not: {
          anyOf: [
            { required: ['elapsedYears'] },
            { required: ['customDate'] },
            { required: ['sixDayDateTime'] },
          ],
        },
      },
      {
        required: ['epochYear', 'elapsedYears'],
        not: {
          anyOf: [
            { required: ['year'] },
            { required: ['customDate'] },
            { required: ['sixDayDateTime'] },
          ],
        },
      },
    ]);
    assert.ok(byMethod.wuyun.properties?.year);
    assert.ok(byMethod.wuyun.properties?.yearGanZhi);
    for (const schema of Object.values(byMethod)) {
      assert.equal(schema.properties?.birthYear, undefined);
      assert.equal(schema.properties?.birthDateTime, undefined);
    }
  });
});

test('太乙补算经真实公开接口保留目标计式、时间与局数事实', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(taiyiAction);
    const result = resource.structured as Record<string, unknown>;
    assert.equal(result.scope, 'month');
    assert.equal(result.dateTime, '2026-08-24 15:30');
    assert.equal(typeof result.bureau, 'number');
    assert.ok(Array.isArray(result.sixteenGods));
    assert.match(resource.title, /本次目标时点·太乙神数month 2026-08-24 15:30/u);
    assert.match(resource.text, /主客定算/u);
  });
});

test('皇极补算经真实公开接口保留年月日时及四层卦事实', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(huangjiAction);
    const result = resource.structured as Record<string, unknown>;
    const input = result.input as Record<string, unknown>;
    const dateTimeForecast = result.dateTimeForecast as Record<string, unknown>;
    const civilTime = dateTimeForecast.civilTime as Record<string, unknown>;
    assert.equal(input.mode, '年月日时');
    assert.equal(civilTime.dateTime, '2026-08-24 15:30:00');
    assert.ok(result.position);
    assert.ok(Array.isArray(result.calculationChain));
    assert.match(resource.title, /本次目标时点·皇极经世2026-08-24 15:30:00/u);
    assert.match(resource.text, /时经卦/u);
  });
});

test('五运六气补算经真实公开接口返回目标年度全年运气事实', async () => {
  await withRealApi(async () => {
    const resource = await executeReadingAction(wuyunAction);
    const result = resource.structured as Record<string, unknown>;
    const input = result.input as Record<string, unknown>;
    assert.equal(input.year, 2026);
    assert.equal(typeof input.yearGanZhi, 'string');
    assert.ok(Array.isArray(result.movementSteps));
    assert.equal((result.movementSteps as unknown[]).length, 5);
    assert.ok(Array.isArray(result.qiSteps));
    assert.equal((result.qiSteps as unknown[]).length, 6);
    assert.match(resource.title, /本次目标年度·五运六气2026年/u);
    assert.match(resource.text, /司天/u);
  });
});

test('非命盘补算必须明确时间目标，且不接受混合皇极模式', async () => {
  await assert.rejects(
    executeReadingAction({ kind: 'calculate', method: 'taiyi', input: { scope: 'month' } }),
    /太乙.*必须明确/u,
  );
  await assert.rejects(
    executeReadingAction({
      kind: 'calculate',
      method: 'huangji',
      input: { customDate: '2026-08-24T15:30:00+08:00', year: 2026 },
    }),
    /皇极.*不得混用|皇极.*只能补算/u,
  );
});

test('网页太乙与皇极会话建立真实目标快照并锁定术式口径', async () => {
  const taiyiDraft = buildTimingDraft({ method: 'taiyi', taiyiScope: 'month' });
  const taiyiSession = await generateDivinationSession(taiyiDraft);
  const taiyiSubject = buildDivinationReadingSubject(taiyiDraft, taiyiSession);
  assert.ok(taiyiSubject);
  assert.deepEqual(taiyiSubject?.allowedMethods, ['taiyi']);
  assert.equal(taiyiSubject?.lockedInputs.taiyi.scope, 'month');
  assert.equal(taiyiSubject?.range.targetKind, 'time-divination');

  const huangjiDraft = buildTimingDraft({ method: 'huangji', taiyiScope: 'year' });
  const huangjiSession = await generateDivinationSession(huangjiDraft);
  const huangjiSubject = buildDivinationReadingSubject(huangjiDraft, huangjiSession);
  assert.ok(huangjiSubject);
  assert.deepEqual(huangjiSubject?.allowedMethods, ['huangji']);
  assert.equal(huangjiSubject?.lockedInputs.huangji._mode, '年月日时');

  await withRealApi(async () => {
    const targetSubject = taiyiSubject as ReadingSubjectSnapshot;
    const targetResource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'taiyi',
        input: { year: 2027, month: 1, day: 5, hour: 9, minute: 0 },
      },
      undefined,
      targetSubject,
    );
    assert.equal((targetResource.structured as Record<string, unknown>).scope, 'month');

    const huangjiResource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'huangji',
        input: { customDate: '2027-01-05T09:00:00+08:00' },
      },
      undefined,
      huangjiSubject,
    );
    const result = huangjiResource.structured as Record<string, unknown>;
    assert.equal((result.input as Record<string, unknown>).mode, '年月日时');
  });
});

test('网页五运六气会话保留固定年度并把同一目标交给 AI 补算', async () => {
  const draft = buildTimingDraft({
    method: 'wuyun',
    question: '2026年全年运气与时令重点是什么？',
    wuyunYear: '2026',
    wuyunYearGanZhi: '丙午',
  });
  const session = await generateDivinationSession(draft);
  assert.equal(session.method, 'wuyun');
  assert.match(session.prompt, /2026年/u);
  assert.match(session.prompt, /丙午/u);
  assert.match(session.prompt, /五步主客运/u);
  assert.match(session.prompt, /年度五行作用/u);
  assert.match(session.prompt, /春分后第13日/u);
  assert.match(session.prompt, /六步主客气/u);
  assert.doesNotMatch(session.prompt, /公历年年中换算|明确年干支/u);
  const subject = buildDivinationReadingSubject(draft, session);
  assert.ok(subject);
  assert.deepEqual(subject?.allowedMethods, ['wuyun']);
  assert.equal(subject?.range.targetKind, 'annual-divination');
  assert.equal(subject?.lockedInputs.wuyun.year, 2026);
  assert.equal(subject?.lockedInputs.wuyun.yearGanZhi, '丙午');

  await withRealApi(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'wuyun',
        input: { year: 2026, yearGanZhi: '丙午', question: draft.question },
      },
      undefined,
      subject,
    );
    const result = resource.structured as Record<string, unknown>;
    const input = result.input as Record<string, unknown>;
    assert.equal(input.year, 2026);
    assert.equal(input.yearGanZhi, '丙午');
    assert.equal((result.movementSteps as unknown[]).length, 5);
    assert.equal((result.qiSteps as unknown[]).length, 6);
    assert.match(resource.text, /司天/u);
  });
});

test('皇极自定义纪元按年坐标核验并在追问时保持原纪元', async () => {
  const subject: ReadingSubjectSnapshot = {
    id: 'huangji-custom-epoch',
    source: 'huangji',
    lockedInputs: { huangji: { _mode: '年坐标', epochYear: 1000 } },
    allowedMethods: ['huangji'],
    range: {},
  };
  await withRealApi(async () => {
    const resource = await executeReadingAction(
      { kind: 'calculate', method: 'huangji', input: { year: 2026 } },
      undefined,
      subject,
    );
    const result = resource.structured as {
      input: { epochYear: number; year: number; mode: string };
    };
    assert.equal(result.input.epochYear, 1000);
    assert.equal(result.input.year, 2026);
    assert.equal(result.input.mode, '年坐标');
    await assert.rejects(
      executeReadingAction(
        { kind: 'calculate', method: 'huangji', input: { epochYear: 1001, year: 2026 } },
        undefined,
        subject,
      ),
      /不得改变当前会话的纪元/u,
    );
  });
});

test('太乙追问可明确补齐另一时间层级并核验实际计式', async () => {
  const subject: ReadingSubjectSnapshot = {
    id: 'taiyi-month-question',
    source: 'taiyi',
    lockedInputs: { taiyi: { scope: 'month' } },
    allowedMethods: ['taiyi'],
    range: {},
  };
  await withRealApi(async () => {
    const resource = await executeReadingAction(
      { kind: 'calculate', method: 'taiyi', input: { scope: 'year', year: 2027 } },
      undefined,
      subject,
    );
    assert.equal((resource.structured as { scope: string }).scope, 'year');
  });
});

test('非命盘补算按结构化目标事实核验返回结果', async () => {
  await withRealApi(
    async () => {
      await assert.rejects(executeReadingAction(wuyunAction), /wuyun\.input\.yearGanZhi/u);
    },
    (body) => {
      const data = body.data as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const input = result.input as Record<string, unknown>;
      input.yearGanZhi = '甲子';
    },
  );
});
