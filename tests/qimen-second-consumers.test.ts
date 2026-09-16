import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDivinationSession } from 'mingyu-core/divination/session';
import type { QimenData } from 'mingyu-core';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

test('奇门统一会话与公开接口在交节秒同步节气、局数和月将', async () => {
  for (const [customDate, solarTerm, juShu, monthLeader] of [
    ['2024-02-19T12:13:11+08:00', '立春', 8, '子'],
    ['2024-02-19T12:13:12+08:00', '雨水', 9, '亥'],
  ] as const) {
    const session = generateDivinationSession({
      method: 'qimen',
      question: '合成节气边界验证',
      divinationTime: customDate,
      currentTime: customDate,
    });
    const response = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/divination/qimen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customDate, detailMode: 'full' }),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    for (const data of [
      session.data,
      JSON.parse(session.serializedResult),
      body.data,
    ] as QimenData[]) {
      assert.equal(data.timeInfo.solarTerm, solarTerm);
      assert.equal(data.timeInfo.juTerm, solarTerm);
      assert.equal(data.seasonality?.currentJieQi, solarTerm);
      assert.equal(data.juShu, juShu);
      assert.ok(
        data.patternCombos
          ?.find((item) => item.name === '天马方')
          ?.summary.includes(`月将${monthLeader}`),
      );
    }
  }
});
