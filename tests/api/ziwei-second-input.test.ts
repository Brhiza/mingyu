import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

test('紫微精准秒输入无需时辰索引，提示词身份保留同一实际出生时刻', async () => {
  const input = {
    name: '公开精准时间样例',
    gender: 'female',
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 21,
    birthHour: 8,
    birthMinute: 23,
    birthSecond: 47,
    timezone: 8,
    applyChinaDst: false,
    question: '分析本命盘。',
    promptScope: 'origin',
    responseMode: 'full',
    scopeDate: '2025-01-01',
    scopeHourIndex: 6,
  };
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/ziwei/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  const birth = body.data.result.calculationIdentity.birth;
  assert.equal(birth.birthHour, 8);
  assert.equal(birth.birthMinute, 23);
  assert.equal(birth.birthSecond, 47);
  assert.equal(birth.timeIndex, undefined);
});
