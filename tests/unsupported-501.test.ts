/**
 * §16 收敛：南半球 501 墙（Commit C1）。
 *
 * 两件事：
 *   1) handleError 把 MingyuCoreError.category === 'unsupported' 映射到 HTTP 501
 *      （此前该分支落进 500 兜底，"尚未实现"被谎报成"服务器炸了"）。
 *   2) 三个真正读取 latitude 的端点在负纬度（南半球）时抛 unsupported：
 *        - calendar/solar-illumination   readNumberLike(必填)
 *        - metaphysics/qizheng/calculate optNumber(可选，可能 undefined)
 *        - divination/astrolabe          readNumber(必填)
 *
 * 🔴 最关键的一条：latitude === undefined 必须放行，绝不能变成 501。
 * 守卫写的是 `latitude < 0` 而不是 `!(latitude >= 0)`——后者会把 undefined 判真，
 * 把所有不传纬度的存量调用全部打成 501。下面 qizheng 不传纬度的用例就是钉死这一点的。
 *
 * 断言打在 handlePublicApiRequest（真实 HTTP 链路）上，而不是直接调内部函数：
 * 只有走完整链路才能证明 501 没有在中途被某个 catch 降级成 400/500。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { handlePublicApiRequest, handleError } from '../src/lib/public-api/handler';
// 🔴 必须与 handler.ts 同源（'@temposoul/core' = dist）。
// 若这里改成 '@core/shared/result'（src），拿到的是另一个 class 对象，
// handler 里的 `error instanceof MingyuCoreError` 会判假，501 会被降级成 500 兜底。
// 这不是假设——本条测试第一版就是这么写的，实测拿到 500。
import { MingyuCoreError } from '@temposoul/core';

async function callApi(path: string, payload: unknown) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// 三个端点的最小合法载荷（纬度之外的字段都必须先过校验，否则测不到 501）。
const ILLUMINATION = { year: 2024, month: 3, day: 15, hour: 12, minute: 0, longitude: 120, timezone: 8 };
const QIZHENG = { year: 2024, month: 3, day: 15, hour: 12, minute: 0, longitude: 120, timezone: 8 };
const ASTROLABE = {
  name: '', gender: '男', year: 2024, month: 3, day: 15, hour: 12, minute: 0,
  longitude: 120, timezone: 8, locationName: '',
};

test('C1-1 handleError 把 unsupported 映射成 501（其余 category 不受影响）', () => {
  const runtime = { service: 'aov.cc', requestId: 'test', startedAt: Date.now() } as never;
  const statusOf = (category: 'validation' | 'boundary' | 'unsupported' | 'calculation') =>
    handleError(
      new MingyuCoreError({ code: 'X', category, message: 'm' }),
      runtime,
    ).status;

  assert.equal(statusOf('unsupported'), 501); // 本次新增分支
  // 回归护栏：原有映射不能被这次改动带偏
  assert.equal(statusOf('validation'), 400);
  assert.equal(statusOf('boundary'), 422);
  assert.equal(statusOf('calculation'), 500);
});

test('C1-2 负纬度（南半球）在三个读取 latitude 的端点上都返回 501', async () => {
  for (const [path, payload] of [
    ['calendar/solar-illumination', ILLUMINATION],
    ['metaphysics/qizheng/calculate', QIZHENG],
    ['divination/astrolabe', ASTROLABE],
  ] as const) {
    const r = await callApi(path, { ...payload, latitude: -33.8 }); // 悉尼
    assert.equal(r.status, 501, `${path} 负纬度应为 501，实际 ${r.status}`);
    assert.equal(r.body.ok, false);
    assert.equal(r.body.error.code, 'SOUTHERN_HEMISPHERE_UNSUPPORTED');
  }
});

test('C1-3 正纬度（北半球）照常放行，不受 501 墙影响', async () => {
  for (const [path, payload] of [
    ['calendar/solar-illumination', ILLUMINATION],
    ['metaphysics/qizheng/calculate', QIZHENG],
    ['divination/astrolabe', ASTROLABE],
  ] as const) {
    const r = await callApi(path, { ...payload, latitude: 39.9 }); // 北京
    assert.notEqual(r.status, 501, `${path} 正纬度不该触发 501`);
    assert.equal(r.status, 200, `${path} 正纬度应正常返回，实际 ${r.status}`);
    assert.equal(r.body.ok, true);
  }
});

test('C1-4 latitude 缺省必须放行：可选纬度端点不传纬度照常 200，绝不 501', async () => {
  // qizheng 走 optNumber，latitude 可缺省 —— 这是最容易被 !(lat>=0) 写法误伤的存量调用。
  const r = await callApi('metaphysics/qizheng/calculate', QIZHENG);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('C1-5 必填纬度端点缺纬度仍是 400 参数错误，而不是被误判成 501', async () => {
  // 边界澄清：undefined 不等于"南半球"。必填端点缺参数属于调用方错误(400)，
  // 与"功能未实现"(501) 是两件事，不能混。
  for (const [path, payload] of [
    ['calendar/solar-illumination', ILLUMINATION],
    ['divination/astrolabe', ASTROLABE],
  ] as const) {
    const r = await callApi(path, payload);
    assert.equal(r.status, 400, `${path} 缺纬度应为 400，实际 ${r.status}`);
    assert.notEqual(r.body.error.code, 'SOUTHERN_HEMISPHERE_UNSUPPORTED');
  }
});

test('C1-6 赤道 latitude=0 放行（边界：0 不是负数）', async () => {
  const r = await callApi('metaphysics/qizheng/calculate', { ...QIZHENG, latitude: 0 });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});
