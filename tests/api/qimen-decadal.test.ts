import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

test('奇门终身局公开计算与提示词入口均接受十年干支大运并保留精确交运事实', async () => {
  for (const suffix of ['', '/prompt']) {
    const response = await handlePublicApiRequest(
      new Request(`https://aov.cc/api/v1/divination/qimen/lifetime${suffix}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          birthDateTime: '1990-05-15T14:30:00+08:00',
          gender: 'male',
          stagePolicy: { model: 'decadalGanzhi' },
          detailMode: 'compact',
          question: '请解读事业运限。',
        }),
      }),
    );
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, /壬午/);
    assert.match(text, /startDateTime|精确区间/);
    if (!suffix) {
      const data = JSON.parse(text).data;
      assert.equal(data.stages[1].ganzhi, '壬午');
      assert.equal(data.stages[0].endDateTimeExclusive, data.stages[1].startDateTime);
      assert.ok(data.stages[1].associatedMarkers.some((marker: string) => marker.includes('天盘')));
      assert.ok(data.stages[1].associatedMarkers.some((marker: string) => marker.includes('地盘')));
    }
  }
});

test('奇门十年干支大运缺少性别时公开入口返回输入错误', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/divination/qimen/lifetime', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        birthDateTime: '1990-05-15T14:30:00+08:00',
        stagePolicy: { model: 'decadalGanzhi' },
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /性别/);
});

test('奇门九宫巡行公开计算与提示词入口拒绝非正整数跨度', async () => {
  for (const suffix of ['', '/prompt']) {
    for (const yearsPerStage of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const response = await handlePublicApiRequest(
        new Request(`https://aov.cc/api/v1/divination/qimen/lifetime${suffix}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            birthDateTime: '2000-01-01T12:00:00+08:00',
            stagePolicy: { model: 'palaceWalk', yearsPerStage },
            question: '请解读九宫巡行阶段。',
          }),
        }),
      );
      assert.equal(response.status, 400);
      assert.match(await response.text(), /yearsPerStage/);
    }
  }
});
