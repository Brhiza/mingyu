import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import { parseReadingPlan, type ReadingSubjectSnapshot } from '../src/lib/ai/reading-workflow';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';

const baziCompatibilitySubject: ReadingSubjectSnapshot = {
  id: 'partner-target-bazi',
  source: 'bazi',
  lockedInputs: {
    bazi: {
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
    baziPartner: {
      gender: 'female',
      year: 1992,
      month: 6,
      day: 16,
      timeIndex: 2,
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
      timeZoneId: 'Asia/Shanghai',
    },
  },
  allowedMethods: ['bazi'],
  range: {},
};

const ziweiCompatibilitySubject: ReadingSubjectSnapshot = {
  id: 'partner-target-ziwei',
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
    ziweiPartner: {
      name: '乙',
      gender: 'female',
      year: 1992,
      month: 6,
      day: 16,
      timeIndex: 2,
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
      timeZoneId: 'Asia/Shanghai',
    },
  },
  allowedMethods: ['ziwei'],
  range: {},
};

function baziResult(request: Record<string, unknown>, year = request.year) {
  const correctedHour = Number(request.birthHour ?? 0);
  const correctedMinute = Number(request.birthMinute ?? 0);
  return {
    gender: request.gender,
    solarDate: { year: request.year, month: request.month, day: request.day },
    lunarDate: { year: request.year, month: request.month, day: request.day },
    timeInfo: {
      index:
        request.useTrueSolarTime === true
          ? getTimeIndexFromClock(correctedHour, correctedMinute)
          : request.timeIndex,
    },
    ...(request.useTrueSolarTime === true
      ? {
          timing: {
            enabled: true,
            standardTime: {
              year: request.year,
              month: request.month,
              day: request.day,
              hour: correctedHour,
              minute: correctedMinute,
            },
            correctedTime: {
              year: request.year,
              month: request.month,
              day: request.day,
              hour: correctedHour,
              minute: correctedMinute,
            },
            evidence: { key: 'true-solar-time:evidence' },
          },
        }
      : {}),
    calculationIdentity: {
      method: 'bazi',
      birth: {
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
        timeZoneId: request.timeZoneId,
      },
      target: {
        baziFortuneScope: request.baziFortuneScope,
        baziFortuneYear: year,
      },
    },
    fortuneSelection: {
      scope: request.baziFortuneScope,
      year,
    },
  };
}

async function withFullResponse(
  resultFactory: (request: Record<string, unknown>) => Record<string, unknown>,
  callback: (requests: Record<string, unknown>[]) => Promise<void>,
) {
  const original = globalThis.fetch;
  const requests: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(request);
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          result: resultFactory(request),
          prompt: '正文写着另一人的年份，但结构化身份保持当前请求。',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    await callback(requests);
  } finally {
    globalThis.fetch = original;
  }
}

test('补算动作默认主主体并明确拒绝未知目标', () => {
  assert.deepEqual(
    parseReadingPlan(
      JSON.stringify({
        actions: [{ kind: 'calculate', method: 'bazi', input: { baziFortuneScope: 'year' } }],
      }),
    ),
    [
      {
        kind: 'calculate',
        method: 'bazi',
        target: 'primary',
        input: { baziFortuneScope: 'year' },
      },
    ],
  );
  assert.deepEqual(
    parseReadingPlan(
      JSON.stringify({
        actions: [
          {
            kind: 'calculate',
            method: 'bazi',
            target: 'partner',
            input: { baziFortuneScope: 'year' },
          },
        ],
      }),
    )[0],
    {
      kind: 'calculate',
      method: 'bazi',
      target: 'partner',
      input: { baziFortuneScope: 'year' },
    },
  );
  assert.throws(
    () =>
      parseReadingPlan(
        JSON.stringify({
          actions: [{ kind: 'calculate', method: 'bazi', target: 'other', input: {} }],
        }),
      ),
    /目标主体必须是 primary 或 partner/u,
  );
});

test('伴侣八字补算只使用伴侣快照并保留独立目标年份', async () => {
  await withFullResponse(
    (request) => baziResult(request, request.baziFortuneYear),
    async (requests) => {
      const resource = await executeReadingAction(
        {
          kind: 'calculate',
          method: 'bazi',
          target: 'partner',
          input: { baziFortuneScope: 'year', baziFortuneYear: 2031 },
        },
        undefined,
        baziCompatibilitySubject,
      );
      assert.equal(requests.length, 1);
      assert.equal(requests[0].year, 1992);
      assert.equal(requests[0].gender, 'female');
      assert.equal(requests[0].timeIndex, 2);
      assert.equal(requests[0].baziFortuneYear, 2031);
      assert.equal(requests[0].responseMode, 'full');
      assert.equal(resource.title, '第二人·八字2031年');
      const structured = resource.structured as
        { calculationIdentity?: { method?: string } } | undefined;
      assert.equal(structured?.calculationIdentity?.method, 'bazi');
    },
  );
});

test('伴侣紫微补算可使用自己的目标日期和 0 时辰', async () => {
  await withFullResponse(
    (request) => ({
      basicInfo: {
        gender:
          request.gender === 'male' ? '男' : request.gender === 'female' ? '女' : request.gender,
        solar_date: [request.year, request.month, request.day]
          .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
          .join('-'),
      },
      payloadByScope: {
        hourly: {
          active_scope: { scope: 'hourly', solar_date: request.scopeDate },
        },
      },
      fortuneTimeline: {
        targetDateStr: request.scopeDate,
        targetHourIndex: request.scopeHourIndex,
      },
      calculationIdentity: {
        method: 'ziwei',
        birth: {
          name: request.name,
          gender: request.gender,
          year: request.year,
          month: request.month,
          day: request.day,
          dateType: request.dateType,
          isLeapMonth: request.isLeapMonth,
          useTrueSolarTime: request.useTrueSolarTime,
          timeIndex: request.timeIndex,
          timeZoneId: request.timeZoneId,
        },
        target: {
          promptScope: request.promptScope,
          scopeDate: request.scopeDate,
          scopeHourIndex: request.scopeHourIndex,
        },
      },
    }),
    async (requests) => {
      await executeReadingAction(
        {
          kind: 'calculate',
          method: 'ziwei',
          target: 'partner',
          input: { promptScope: 'hourly', scopeDate: '2031-06-16', scopeHourIndex: 0 },
        },
        undefined,
        ziweiCompatibilitySubject,
      );
      assert.equal(requests[0].year, 1992);
      assert.equal(requests[0].name, '乙');
      assert.equal(requests[0].scopeDate, '2031-06-16');
      assert.equal(requests[0].scopeHourIndex, 0);
      assert.equal(requests[0].responseMode, 'full');
    },
  );
});

test('真太阳时补算按原始钟表资料核验，不把校正后的时辰误判为主体不一致', async () => {
  const subject: ReadingSubjectSnapshot = {
    ...baziCompatibilitySubject,
    lockedInputs: {
      bazi: {
        ...baziCompatibilitySubject.lockedInputs.bazi,
        useTrueSolarTime: true,
        birthHour: 10,
        birthMinute: 30,
        birthLongitude: 116.4,
      },
    },
  };
  await withFullResponse(
    (request) => baziResult(request, request.baziFortuneYear),
    async (requests) => {
      await executeReadingAction(
        {
          kind: 'calculate',
          method: 'bazi',
          input: { baziFortuneScope: 'year', baziFortuneYear: 2030 },
        },
        undefined,
        subject,
      );
      assert.equal(requests[0].useTrueSolarTime, true);
      assert.equal(requests[0].birthHour, 10);
      assert.equal(requests[0].birthMinute, 30);
      assert.equal(requests[0].birthLongitude, 116.4);
      assert.equal(requests[0].timeIndex, undefined);
    },
  );
});

test('真太阳时返回缺少标准时间证据时拒绝补算', async () => {
  const subject: ReadingSubjectSnapshot = {
    ...baziCompatibilitySubject,
    lockedInputs: {
      bazi: {
        ...baziCompatibilitySubject.lockedInputs.bazi,
        useTrueSolarTime: true,
        birthHour: 10,
        birthMinute: 30,
        birthLongitude: 116.4,
      },
    },
  };
  await withFullResponse(
    (request) => {
      const result = baziResult(request) as Record<string, unknown>;
      const timing = result.timing as Record<string, unknown>;
      return { ...result, timing: { ...timing, standardTime: undefined } };
    },
    async () => {
      await assert.rejects(
        () =>
          executeReadingAction(
            {
              kind: 'calculate',
              method: 'bazi',
              input: { baziFortuneScope: 'year', baziFortuneYear: 2030 },
            },
            undefined,
            subject,
          ),
        /标准时间/u,
      );
    },
  );
});

test('真太阳时身份回显正确但实际校正时辰串盘时拒绝补算', async () => {
  const subject: ReadingSubjectSnapshot = {
    ...baziCompatibilitySubject,
    lockedInputs: {
      bazi: {
        ...baziCompatibilitySubject.lockedInputs.bazi,
        useTrueSolarTime: true,
        birthHour: 10,
        birthMinute: 30,
        birthLongitude: 116.4,
      },
    },
  };
  await withFullResponse(
    (request) => ({
      ...baziResult(request),
      timeInfo: { index: 8 },
    }),
    async () => {
      await assert.rejects(
        () =>
          executeReadingAction(
            {
              kind: 'calculate',
              method: 'bazi',
              input: { baziFortuneScope: 'year', baziFortuneYear: 2030 },
            },
            undefined,
            subject,
          ),
        /身份核验/u,
      );
    },
  );
});

test('伴侣目标没有快照时拒绝回退主主体，正文内容不能替代结构化身份', async () => {
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
            target: 'partner',
            input: { baziFortuneScope: 'year', baziFortuneYear: 2031 },
          },
          undefined,
          {
            ...baziCompatibilitySubject,
            lockedInputs: { bazi: baziCompatibilitySubject.lockedInputs.bazi },
          },
        ),
      /第二人主体快照/u,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }

  await withFullResponse(
    (request) => ({
      ...baziResult(request),
      calculationIdentity: {
        method: 'bazi',
        birth: {
          gender: 'male',
          year: 1990,
          month: 5,
          day: 15,
          dateType: 'solar',
          isLeapMonth: false,
          useTrueSolarTime: false,
          timeIndex: 8,
          timeZoneId: 'Asia/Shanghai',
        },
        target: { baziFortuneScope: request.baziFortuneScope },
      },
    }),
    async () => {
      await assert.rejects(
        () =>
          executeReadingAction(
            {
              kind: 'calculate',
              method: 'bazi',
              input: { baziFortuneScope: 'year', baziFortuneYear: 2031 },
            },
            undefined,
            baziCompatibilitySubject,
          ),
        /身份核验/u,
      );
    },
  );
});

test('结构化身份回显正确但实际八字结果串盘时拒绝补算', async () => {
  await withFullResponse(
    (request) => ({
      ...baziResult(request),
      gender: 'female',
      solarDate: { year: 1991, month: request.month, day: request.day },
    }),
    async () => {
      await assert.rejects(
        () =>
          executeReadingAction(
            {
              kind: 'calculate',
              method: 'bazi',
              input: { baziFortuneScope: 'year', baziFortuneYear: 2031 },
            },
            undefined,
            baziCompatibilitySubject,
          ),
        /身份核验/u,
      );
    },
  );
});
