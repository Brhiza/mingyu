import assert from 'node:assert/strict';
import test from 'node:test';

import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const rangeParticipant = {
  id: 'synthetic-range',
  name: '合成参与人甲',
  gender: '男',
  year: 2024,
  month: 2,
  day: 11,
  timeIndex: 8,
  birthHour: 15,
  birthMinute: 0,
  birthSecond: 0,
  dateType: 'solar',
  birthTimeRange: {
    startTimestamp: Date.parse('2024-02-11T15:00:00+08:00'),
    endTimestamp: Date.parse('2024-02-11T17:00:00+08:00'),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
    pillars: { year: '甲辰', month: '丙寅', day: '乙巳', hour: '甲申' },
  },
};

async function callApi(path: string, body?: unknown) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    }),
  );
  return { response, body: JSON.parse(await response.text()) };
}

test('公开 API 黄历参与人透传完整出生区间、来源四柱和条件画像', async () => {
  const { response, body } = await callApi('divination/almanac', {
    topic: 'custom',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    detailMode: 'full',
    participants: [
      rangeParticipant,
      {
        id: 'synthetic-fixed',
        name: '合成参与人乙',
        gender: '女',
        year: 1990,
        month: 1,
        day: 2,
        timeIndex: 4,
        dateType: 'solar',
      },
    ],
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  const ranged = body.data.participants[0];
  assert.equal(ranged.birthTimeRange.status, 'conditional');
  assert.deepEqual(ranged.birthTimeRange.source, rangeParticipant.birthTimeRange);
  assert.deepEqual(
    ranged.birthTimeRange.branches.map(
      (branch: {
        startTimestamp: number;
        endTimestamp: number;
        profile: { usefulGods: string[] };
      }) => [branch.startTimestamp, branch.endTimestamp, branch.profile.usefulGods],
    ),
    [
      [rangeParticipant.birthTimeRange.startTimestamp, 1707640027000, ['土', '火', '金']],
      [1707640027000, rangeParticipant.birthTimeRange.endTimestamp, ['火', '土', '金']],
    ],
  );
  assert.equal(body.data.participants[1].birthTimeRange, undefined);
});

test('公开 API 文档声明黄历参与人完整范围，缺来源四柱时明确拒绝', async () => {
  const openApi = await callApi('openapi.json');
  const participantSchema =
    openApi.body.data.components.schemas.DivinationRequest.properties.participants.items;
  assert.equal(
    participantSchema.properties.birthTimeRange.$ref,
    '#/components/schemas/AlmanacParticipantBirthTimeRange',
  );
  assert.deepEqual(
    openApi.body.data.components.schemas.AlmanacParticipantBirthTimeRange.allOf[1].properties
      .pillars.required,
    ['year', 'month', 'day', 'hour'],
  );

  const { response, body } = await callApi('divination/almanac', {
    topic: 'custom',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    participants: [
      {
        ...rangeParticipant,
        birthTimeRange: { ...rangeParticipant.birthTimeRange, pillars: undefined },
      },
    ],
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
  assert.match(body.error.message, /birthTimeRange\.pillars 必须是对象/u);
});
