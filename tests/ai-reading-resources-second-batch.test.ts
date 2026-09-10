import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const baziInputs = {
  gender: 'male',
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 8,
  dateType: 'solar',
  isLeapMonth: false,
  useTrueSolarTime: false,
  timeZoneId: 'Asia/Shanghai',
};

const baziSubject: ReadingSubjectSnapshot = {
  id: 'resources-bazi',
  source: 'bazi',
  lockedInputs: { bazi: baziInputs },
  allowedMethods: ['bazi'],
  range: {},
};

const qizhengSubject: ReadingSubjectSnapshot = {
  id: 'resources-qizheng',
  source: 'qizheng',
  lockedInputs: {
    'qi-zheng': {
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
      minute: 30,
      latitude: 39.9,
      longitude: 116.4,
      timeZoneId: 'Asia/Shanghai',
      useTrueSolarTime: false,
    },
  },
  allowedMethods: ['qi-zheng'],
  range: {},
};

const ziweiSubject: ReadingSubjectSnapshot = {
  id: 'resources-ziwei',
  source: 'ziwei',
  lockedInputs: {
    ziwei: {
      name: '甲',
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 8,
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
      timeZoneId: 'Asia/Shanghai',
    },
  },
  allowedMethods: ['ziwei'],
  range: {},
};

const astrolabeSubject: ReadingSubjectSnapshot = {
  id: 'resources-astrolabe',
  source: 'astrolabe',
  lockedInputs: {
    astrolabe: {
      name: '甲',
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
      minute: 30,
      latitude: 39.9,
      longitude: 116.4,
      timeZoneId: 'Asia/Shanghai',
      locationName: '北京',
      useTrueSolarTime: false,
    },
  },
  allowedMethods: ['astrolabe'],
  range: {},
};

async function withRequestCapture<T>(
  callback: (getRequest: () => Record<string, unknown>) => Promise<T>,
) {
  const original = globalThis.fetch;
  let request: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input, init) => {
    request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const path = String(input);
    let result: Record<string, unknown>;
    if (path.includes('/bazi/prompt')) {
      const birth = {
        gender: request.gender,
        year: request.year,
        month: request.month,
        day: request.day,
        dateType: request.dateType,
        isLeapMonth: request.isLeapMonth,
        useTrueSolarTime: request.useTrueSolarTime,
        ...(request.timeIndex === undefined ? {} : { timeIndex: request.timeIndex }),
        ...(request.birthHour === undefined ? {} : { birthHour: request.birthHour }),
        ...(request.birthMinute === undefined ? {} : { birthMinute: request.birthMinute }),
        ...(request.birthLongitude === undefined ? {} : { birthLongitude: request.birthLongitude }),
        ...(request.birthLatitude === undefined ? {} : { birthLatitude: request.birthLatitude }),
        ...(request.birthPlace === undefined ? {} : { birthPlace: request.birthPlace }),
        ...(request.timezone === undefined ? {} : { timezone: request.timezone }),
        ...(request.timeZoneId === undefined ? {} : { timeZoneId: request.timeZoneId }),
        ...(request.applyChinaDst === undefined ? {} : { applyChinaDst: request.applyChinaDst }),
      };
      const target = Object.fromEntries(
        [
          'baziFortuneScope',
          'baziFortuneCycleIndex',
          'baziFortuneYear',
          'baziFortuneMonth',
          'baziFortuneDay',
        ]
          .filter((key) => request[key] !== undefined)
          .map((key) => [key, request[key]]),
      );
      result = {
        gender: request.gender,
        solarDate: { year: request.year, month: request.month, day: request.day },
        lunarDate: { year: request.year, month: request.month, day: request.day },
        timeInfo: { index: request.timeIndex },
        calculationIdentity: { method: 'bazi', birth, target },
      };
    } else if (path.includes('/ziwei/prompt')) {
      const birth = {
        name: request.name,
        gender: request.gender,
        year: request.year,
        month: request.month,
        day: request.day,
        dateType: request.dateType,
        isLeapMonth: request.isLeapMonth,
        useTrueSolarTime: request.useTrueSolarTime,
        ...(request.timeIndex === undefined ? {} : { timeIndex: request.timeIndex }),
        ...(request.birthHour === undefined ? {} : { birthHour: request.birthHour }),
        ...(request.birthMinute === undefined ? {} : { birthMinute: request.birthMinute }),
        ...(request.birthLongitude === undefined ? {} : { birthLongitude: request.birthLongitude }),
        ...(request.birthLatitude === undefined ? {} : { birthLatitude: request.birthLatitude }),
        ...(request.birthPlace === undefined ? {} : { birthPlace: request.birthPlace }),
        ...(request.timezone === undefined ? {} : { timezone: request.timezone }),
        ...(request.timeZoneId === undefined ? {} : { timeZoneId: request.timeZoneId }),
        ...(request.applyChinaDst === undefined ? {} : { applyChinaDst: request.applyChinaDst }),
        ...(request.algorithm === undefined ? {} : { algorithm: request.algorithm }),
      };
      const target = Object.fromEntries(
        ['promptScope', 'scopeDate', 'scopeHourIndex']
          .filter((key) => request[key] !== undefined)
          .map((key) => [key, request[key]]),
      );
      const promptScope = request.promptScope ?? 'decadal';
      result = {
        basicInfo: {
          gender:
            request.gender === 'male' ? '男' : request.gender === 'female' ? '女' : request.gender,
          solar_date: [request.year, request.month, request.day]
            .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
            .join('-'),
        },
        payloadByScope: {
          [String(promptScope)]: {
            active_scope: {
              scope: promptScope,
              solar_date:
                request.scopeDate ??
                [request.year, request.month, request.day]
                  .map((value, index) =>
                    index === 0 ? String(value) : String(value).padStart(2, '0'),
                  )
                  .join('-'),
            },
          },
        },
        ...(request.useTrueSolarTime === true
          ? { trueSolarEvidence: { key: 'true-solar-time:evidence' } }
          : {}),
        calculationIdentity: { method: 'ziwei', birth, target },
      };
    } else if (path.includes('/astrolabe/prompt')) {
      const month = String(request.month).padStart(2, '0');
      const day = String(request.day).padStart(2, '0');
      const hour = String(request.hour).padStart(2, '0');
      const minute = String(request.minute ?? 0).padStart(2, '0');
      result = {
        birth: {
          name: request.name,
          gender: request.gender,
          latitude: request.latitude,
          longitude: request.longitude,
          timeZoneId: request.timeZoneId,
          isTrueSolarTime: request.useTrueSolarTime,
          standardDateTime: `${request.year}-${month}-${day} ${hour}:${minute}`,
        },
        scopeEvidence: {
          scope: request.astrolabeScope ?? 'natal',
          ...(request.astrolabeScopeDate === undefined
            ? {}
            : { dateStr: request.astrolabeScopeDate }),
        },
      };
    } else {
      result = {
        calculationContext: {
          latitude: request.latitude,
          longitude: request.longitude,
        },
        ...(request.flowYear === undefined
          ? {}
          : {
              flowingStars: {
                year: request.flowYear,
                month: request.flowMonth,
                day: request.flowDay,
                hour: request.flowHour,
                minute: request.flowMinute,
              },
            }),
      };
    }
    return new Response(JSON.stringify({ success: true, data: { result, prompt: '补算盘面' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    return await callback(() => {
      if (!request) throw new Error('未捕获补算请求。');
      return request;
    });
  } finally {
    globalThis.fetch = original;
  }
}

async function withPublicApiFetch<T>(callback: () => Promise<T>) {
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

test('星盘自动补算默认当前年度且实际资料与目标一致，显式本命保留', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2030-06-15T04:00:00Z') });
  await withPublicApiFetch(async () => {
    const current = await executeReadingAction(
      { kind: 'calculate', method: 'astrolabe', input: { question: '当前阶段事业变化' } },
      undefined,
      astrolabeSubject,
    );
    const evidence = current.structured?.scopeEvidence as Record<string, unknown>;
    assert.equal(evidence.scope, 'yearly');
    assert.equal(evidence.dateStr, '2030');
    assert.match(current.title, /2030/u);
    assert.match(current.text, /2030/u);

    const natal = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'astrolabe',
        input: { astrolabeScope: 'natal', question: '本命' },
      },
      undefined,
      astrolabeSubject,
    );
    assert.equal((natal.structured?.scopeEvidence as Record<string, unknown>).scope, 'natal');
  });
});

test('补算经真实公共 API 返回可核验的八字与紫微盘面事实', async () => {
  await withPublicApiFetch(async () => {
    const baziResource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'bazi',
        input: { baziFortuneScope: 'year', baziFortuneYear: 2030, question: '流年事业' },
      },
      undefined,
      baziSubject,
    );
    const bazi = baziResource.structured as Record<string, unknown>;
    assert.equal(bazi.gender, 'male');
    assert.deepEqual(bazi.solarDate, { year: 1990, month: 5, day: 15 });
    assert.equal((bazi.timeInfo as Record<string, unknown>).index, 8);
    assert.equal(
      ((bazi.calculationIdentity as Record<string, unknown>).target as Record<string, unknown>)
        .baziFortuneYear,
      2030,
    );

    const ziweiResource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'ziwei',
        input: {
          promptScope: 'hourly',
          scopeDate: '2030-06-16',
          scopeHourIndex: 0,
          question: '目标时辰',
        },
      },
      undefined,
      ziweiSubject,
    );
    const ziwei = ziweiResource.structured as Record<string, unknown>;
    const basicInfo = ziwei.basicInfo as Record<string, unknown>;
    assert.equal(basicInfo.gender, '男');
    assert.equal(basicInfo.solar_date, '1990-05-15');
    const activeScope = (
      (ziwei.payloadByScope as Record<string, unknown>).hourly as Record<string, unknown>
    ).active_scope as Record<string, unknown>;
    assert.equal(activeScope.scope, 'hourly');
    assert.equal(activeScope.solar_date, '2030-06-16');
    assert.deepEqual(
      ziwei.fortuneTimeline && {
        targetDateStr: (ziwei.fortuneTimeline as Record<string, unknown>).targetDateStr,
        targetHourIndex: (ziwei.fortuneTimeline as Record<string, unknown>).targetHourIndex,
      },
      { targetDateStr: '2030-06-16', targetHourIndex: 0 },
    );

    const { timeIndex: _timeIndex, ...trueSolarBaziInputs } = baziInputs;
    const trueSolarSubject: ReadingSubjectSnapshot = {
      ...baziSubject,
      lockedInputs: {
        bazi: {
          ...trueSolarBaziInputs,
          useTrueSolarTime: true,
          birthHour: 10,
          birthMinute: 30,
          birthLongitude: 116.4,
        },
      },
    };
    const trueSolarResource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'bazi',
        input: { baziFortuneScope: 'year', baziFortuneYear: 2030, question: '真太阳时' },
      },
      undefined,
      trueSolarSubject,
    );
    const trueSolar = trueSolarResource.structured as Record<string, unknown>;
    const timing = trueSolar.timing as Record<string, unknown>;
    assert.equal(timing.enabled, true);
    assert.match(String((timing.evidence as Record<string, unknown>).key), /true-solar|solar/u);
    assert.match(String((timing.correctedTime as Record<string, unknown>).year), /^\d{4}$/u);
  });
});

function assertSchemaHasNoReferences(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertSchemaHasNoReferences(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  assert.equal(Object.hasOwn(record, '$ref'), false, '筛选后的补算 schema 不应保留 $ref');
  for (const item of Object.values(record)) assertSchemaHasNoReferences(item);
}

test('快照缺少出生时辰时拒绝模型新增，且不会发出补算请求', async () => {
  const { timeIndex: _timeIndex, ...withoutTimeIndex } = baziInputs;
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    called = true;
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        executeReadingAction(
          {
            kind: 'calculate',
            method: 'bazi',
            input: { timeIndex: 8, baziFortuneYear: 2026 },
          },
          undefined,
          {
            ...baziSubject,
            lockedInputs: { bazi: withoutTimeIndex },
          },
        ),
      /主体快照缺少不可变参数：timeIndex/u,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('已有主体字段相同值被接受并锁回快照，异值明确拒绝', async () => {
  await withRequestCapture(async (getRequest) => {
    await executeReadingAction(
      {
        kind: 'calculate',
        method: 'bazi',
        input: { year: '1990', timeIndex: '8', baziFortuneYear: 2030, question: '事业' },
      },
      undefined,
      baziSubject,
    );
    const request = getRequest();
    assert.equal(request.year, 1990);
    assert.equal(request.timeIndex, 8);
    assert.equal(request.baziFortuneYear, 2030);
    assert.equal(request.question, '事业');
  });

  await assert.rejects(
    () =>
      executeReadingAction(
        { kind: 'calculate', method: 'bazi', input: { year: 1991, baziFortuneYear: 2030 } },
        undefined,
        baziSubject,
      ),
    /主体与当前命盘不一致：year/u,
  );
});

test('未声明参数拒绝透传', async () => {
  await assert.rejects(
    () =>
      executeReadingAction(
        { kind: 'calculate', method: 'bazi', input: { baziFortuneYear: 2026, invented: true } },
        undefined,
        baziSubject,
      ),
    /参数未声明或不可修改：invented/u,
  );
});

test('各术式保留真实目标时限字段并拒绝改动主体口径', async () => {
  await withRequestCapture(async (getRequest) => {
    await executeReadingAction(
      {
        kind: 'calculate',
        method: 'qi-zheng',
        input: {
          year: 1990,
          flowYear: 2027,
          flowMonth: 3,
          flowDay: 4,
          flowHour: 5,
          flowMinute: 6,
          question: '流年事业',
          promptScope: 'yearly',
        },
      },
      undefined,
      qizhengSubject,
    );
    const request = getRequest();
    assert.equal(request.year, 1990);
    assert.equal(request.hour, 10);
    assert.equal(request.flowYear, 2027);
    assert.equal(request.flowMonth, 3);
    assert.equal(request.flowDay, 4);
    assert.equal(request.flowHour, 5);
    assert.equal(request.flowMinute, 6);
    assert.equal(request.question, '流年事业');
    assert.equal(request.promptScope, 'yearly');
    assert.equal(request.responseMode, 'full');
  });

  await withRequestCapture(async (getRequest) => {
    await executeReadingAction(
      {
        kind: 'calculate',
        method: 'ziwei',
        input: {
          year: 1990,
          promptScope: 'origin',
          scopeDate: '2026-09-11',
          scopeHourIndex: 0,
          question: '本命',
        },
      },
      undefined,
      ziweiSubject,
    );
    const request = getRequest();
    assert.equal(request.year, 1990);
    assert.equal(request.promptScope, 'origin');
    assert.equal(request.scopeDate, '2026-09-11');
    assert.equal(request.scopeHourIndex, 0);
    assert.equal(request.question, '本命');
  });

  await withRequestCapture(async (getRequest) => {
    await executeReadingAction(
      {
        kind: 'calculate',
        method: 'astrolabe',
        input: {
          year: 1990,
          astrolabeScope: 'yearly',
          astrolabeScopeDate: '2026',
          question: '流年',
        },
      },
      undefined,
      astrolabeSubject,
    );
    const request = getRequest();
    assert.equal(request.year, 1990);
    assert.equal(request.hour, 10);
    assert.equal(request.astrolabeScope, 'yearly');
    assert.equal(request.astrolabeScopeDate, '2026');
    assert.equal(request.question, '流年');
  });
});

test('schema 动作只暴露各术式可修改字段并清理公共 OpenAPI 引用', async () => {
  await withPublicApiFetch(async () => {
    const expectedProperties: Record<string, string[]> = {
      bazi: [
        'baziFortuneScope',
        'baziFortuneCycleIndex',
        'baziFortuneYear',
        'baziFortuneMonth',
        'baziFortuneDay',
        'question',
        'topicId',
        'subtopicId',
        'scope',
        'promptTopic',
        'promptMode',
        'school',
        'schools',
      ],
      ziwei: [
        'promptScope',
        'scopeDate',
        'scopeHourIndex',
        'question',
        'topicId',
        'subtopicId',
        'scope',
        'promptTopic',
        'promptMode',
        'school',
        'schools',
      ],
      astrolabe: [
        'astrolabeTopic',
        'astrolabeScope',
        'astrolabeScopeDate',
        'astrolabeScopeText',
        'question',
        'topicId',
        'subtopicId',
        'scope',
        'promptMode',
        'schools',
      ],
      'qi-zheng': [
        'flowYear',
        'flowMonth',
        'flowDay',
        'flowHour',
        'flowMinute',
        'question',
        'topicId',
        'subtopicId',
        'promptScope',
        'promptMode',
        'schools',
      ],
    };
    const expectedRequired: Record<string, string[]> = {
      bazi: ['question'],
      ziwei: ['question'],
      astrolabe: [],
      'qi-zheng': [],
    };
    const forbiddenProperties = new Set([
      'gender',
      'year',
      'month',
      'day',
      'dateType',
      'timeIndex',
      'birthHour',
      'birthMinute',
      'birthLongitude',
      'birthLatitude',
      'birthPlace',
      'hour',
      'minute',
      'latitude',
      'longitude',
      'timezone',
      'timeZoneId',
      'applyChinaDst',
      'algorithm',
      'shenShaScope',
      'shenShaVariants',
      'responseMode',
      'detailMode',
    ]);

    for (const method of Object.keys(expectedProperties)) {
      const resource = await executeReadingAction({ kind: 'schema', method });
      const schema = JSON.parse(resource.text) as {
        description?: unknown;
        properties?: Record<string, unknown>;
        required?: string[];
        additionalProperties?: unknown;
      };
      const properties = schema.properties ?? {};
      assert.match(String(schema.description), /target.*primary.*partner/u, method);
      assert.deepEqual(Object.keys(properties).sort(), expectedProperties[method].sort(), method);
      assert.deepEqual(schema.required ?? [], expectedRequired[method], `${method} required`);
      assert.equal(schema.additionalProperties, false, `${method} additionalProperties`);
      for (const key of Object.keys(properties)) {
        assert.equal(forbiddenProperties.has(key), false, `${method} 暴露了 ${key}`);
      }
      assertSchemaHasNoReferences(schema);
    }
  });
});
