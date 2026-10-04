import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';
import { assertPromptIsPortableTaskText } from '../prompt-assertions';

test('七政HTTP排盘和完整任务书接受当地支持年两端的UTC跨年', async () => {
  for (const sample of [
    {
      year: 1900,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timezone: 14,
      utc: '1899-12-31T10:00:00.000Z',
    },
    {
      year: 2200,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
      timezone: -12,
      utc: '2201-01-01T11:59:59.000Z',
    },
  ]) {
    const { utc, ...clock } = sample;
    for (const endpoint of ['calculate', 'prompt']) {
      const response = await handlePublicApiRequest(
        new Request(`https://example.test/api/v1/metaphysics/qizheng/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...clock,
            latitude: 0,
            longitude: 180,
            detailMode: 'full',
            responseMode: 'full',
            question: '请解读本命盘。',
          }),
        }),
      );
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      const result = endpoint === 'prompt' ? body.data.result : body.data;
      assert.equal(result.calculationContext.utcDateTime, utc);
      assert.equal(result.calculationContext.moonPhase.utcDateTime, utc);
      assert.equal(
        result.calculationContext.solarIllumination.astronomicalTime.unixMilliseconds,
        Date.parse(utc),
      );
      assert.equal(result.stars.length, 11);
      if (endpoint === 'prompt') {
        const prompt = body.data.prompt as string;
        assert.ok(prompt.includes(`出生时间：${clock.year}年${clock.month}月${clock.day}日`));
        for (const star of result.stars.filter((item: { name: string }) =>
          ['太阳', '太阴'].includes(item.name),
        )) {
          assert.ok(
            prompt.includes(
              `${star.name}：在${star.xiu}宿${star.xiuDegree.toFixed(2)}度，落${star.signBranch}宫${star.palace}`,
            ),
          );
        }
        assertPromptIsPortableTaskText(prompt);
      }
    }
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/v1/calendar/moon-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utcDateTime: utc }),
      }),
    );
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /支持 1900-2200 年/);
  }
});
