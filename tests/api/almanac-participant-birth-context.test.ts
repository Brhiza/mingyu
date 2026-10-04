import assert from 'node:assert/strict';
import test from 'node:test';

import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const selection = { topic: 'custom', startDate: '2026-06-01', endDate: '2026-06-01' };
const participant = {
  id: 'birth-context',
  name: '合成参与人',
  year: 1990,
  month: 1,
  day: 2,
  birthHour: 0,
  birthMinute: 30,
  dateType: 'solar',
  birthPlace: '测试地点',
  birthLongitude: 75,
  timezone: 8,
  useTrueSolarTime: true,
};

async function callApi(path: string, input?: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      ...(input === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }),
    }),
  );
  return { response, body: await response.json() };
}

const facts = [
  {
    label: '真太阳时跨日前后日柱和时柱',
    input: participant,
    solarDate: '1990-01-01',
    pillars: { year: '己巳', month: '丙子', day: '丙寅', hour: '己亥' },
  },
  {
    label: '固定 UTC 偏移参与真太阳时校正',
    input: { ...participant, timezone: 9, birthLongitude: 120 },
    solarDate: '1990-01-01',
    pillars: { year: '己巳', month: '丙子', day: '丁卯', hour: '庚子' },
  },
  {
    label: 'IANA 历史时区参与真太阳时校正',
    input: {
      ...participant,
      year: 2024,
      month: 7,
      day: 1,
      birthHour: 1,
      birthLongitude: -74,
      timezone: undefined,
      timeZoneId: 'America/New_York',
    },
    solarDate: '2024-07-01',
    pillars: { year: '甲辰', month: '庚午', day: '丙寅', hour: '戊子' },
  },
];

for (const fixture of facts) {
  test(`HTTP 黄历排盘和任务书一致保留${fixture.label}`, async () => {
    for (const path of ['divination/almanac', 'divination/almanac/prompt']) {
      const { response, body } = await callApi(path, {
        ...selection,
        detailMode: 'full',
        responseMode: 'full',
        participants: [fixture.input],
      });
      assert.equal(response.status, 200, JSON.stringify(body.error));
      assert.equal(body.ok, true);
      const profile = (body.data.result ?? body.data).participants[0];
      assert.equal(profile.solarDate, fixture.solarDate);
      assert.deepEqual(profile.pillars, fixture.pillars);
      if (path.endsWith('/prompt')) {
        assert.ok(body.data.prompt.includes(fixture.input.name));
        for (const pillar of Object.values(fixture.pillars)) {
          assert.ok(body.data.prompt.includes(pillar), `${fixture.label}：${pillar}`);
        }
      }
    }
  });
}

test('HTTP 黄历完整出生钟表省略秒等同零秒，传统仅时辰仍按标准时间排盘', async () => {
  const implicit = await callApi('divination/almanac', {
    ...selection,
    detailMode: 'full',
    participants: [participant],
  });
  const explicit = await callApi('divination/almanac', {
    ...selection,
    detailMode: 'full',
    participants: [{ ...participant, timeIndex: 0, birthSecond: 0 }],
  });
  assert.equal(implicit.response.status, 200);
  assert.equal(explicit.response.status, 200);
  assert.deepEqual(implicit.body.data.participants, explicit.body.data.participants);

  const traditional = await callApi('divination/almanac', {
    ...selection,
    detailMode: 'full',
    participants: [
      {
        ...participant,
        timeIndex: 0,
        birthHour: undefined,
        birthMinute: undefined,
        useTrueSolarTime: false,
      },
    ],
  });
  assert.equal(traditional.response.status, 200);
  assert.equal(traditional.body.data.participants[0].solarDate, '1990-01-02');
  assert.equal(traditional.body.data.participants[0].pillars.day, '丁卯');
  assert.equal(traditional.body.data.participants[0].pillars.hour, '庚子');
});

test('HTTP 黄历出生上下文缺资料、矛盾或无效时区不能被忽略', async () => {
  const invalid = [
    { ...participant, birthLongitude: undefined },
    { ...participant, timeZoneId: 'Invalid/Zone', useTrueSolarTime: false },
    { ...participant, timeIndex: 1 },
    { ...participant, birthMinute: undefined },
    { ...participant, birthHour: undefined, birthMinute: undefined, useTrueSolarTime: false },
    { ...participant, timezone: 15 },
    {
      ...participant,
      timeIndex: 0,
      birthSecond: 0,
      birthTimeRange: {
        startTimestamp: Date.parse('1990-01-02T00:30:00+08:00'),
        endTimestamp: Date.parse('1990-01-02T00:30:01+08:00'),
        endExclusive: true,
        timezone: 'Asia/Shanghai',
        offsetHours: 8,
        pillars: { year: '己巳', month: '丙子', day: '丁卯', hour: '庚子' },
      },
    },
  ];
  for (const input of invalid) {
    const { response, body } = await callApi('divination/almanac', {
      ...selection,
      participants: [input],
    });
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'BAD_REQUEST');
  }
});

test('公开文档声明黄历参与人实际支持的出生地点、时区和钟表输入', async () => {
  const { response, body } = await callApi('openapi.json');
  assert.equal(response.status, 200);
  const schema = body.data.components.schemas.DivinationRequest.properties.participants.items;
  for (const field of [
    'birthPlace',
    'birthLongitude',
    'timezone',
    'timeZoneId',
    'useTrueSolarTime',
  ]) {
    assert.ok(schema.properties[field], `${field} 应可由调用方发现`);
  }
  assert.deepEqual(schema.anyOf, [
    { required: ['timeIndex'] },
    { required: ['birthHour', 'birthMinute'] },
  ]);
  assert.equal(schema.properties.birthSecond.default, 0);
});
