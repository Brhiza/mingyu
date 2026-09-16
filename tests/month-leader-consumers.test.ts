import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDivinationSession } from 'mingyu-core/divination/session';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const boundary = Date.parse('2024-02-19T12:13:12+08:00');

for (const method of ['liuren', 'jinkoujue'] as const) {
  test(`${method === 'liuren' ? '大六壬' : '金口诀'}统一会话与公开接口保留中气交接秒的月将`, async () => {
    for (const [timestamp, expected] of [
      [boundary - 1000, '子'],
      [boundary, '亥'],
    ] as const) {
      const dateTime = new Date(timestamp).toISOString();
      const session = generateDivinationSession({
        method,
        question: '合成节气边界验证',
        divinationTime: dateTime,
        currentTime: dateTime,
      });
      assert.equal((session.data as { monthLeader: string }).monthLeader, expected);
      assert.equal(JSON.parse(session.serializedResult).monthLeader, expected);
      if (method === 'liuren') {
        assert.match(session.formattedResult, new RegExp(`月将[：:]?${expected}`, 'u'));
      }

      const response = await handlePublicApiRequest(
        new Request(`https://aov.cc/api/v1/divination/${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ customDate: dateTime }),
        }),
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.data.monthLeader, expected);
    }
  });
}
