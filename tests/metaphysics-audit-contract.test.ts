import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYSTEM_CAPABILITY_IDS,
  getCapabilities,
  type SystemCapabilityId,
} from '../packages/core/src/capabilities';
import { SSGW_SIGNS } from '../packages/core/src/divination/ssgw-data';
import { resolveSignByNumber } from '../packages/core/src/divination/algorithms/ssgw';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const AUDITED_SYSTEM_IDS = [
  'bazi',
  'ziwei',
  'bazi-ziwei-synthesis',
  'qimen',
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'liuren',
  'tarot',
  'lenormand',
  'ssgw',
  'almanac',
  'bazhai',
  'zodiac',
  'taiyi',
  'wuyun-liuqi',
  'huangji-jingshi',
  'qizheng',
  'xuankong',
  'residential',
] as const satisfies readonly SystemCapabilityId[];

async function callApi(path: string, body: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() } as const;
}

test('术数抽查清单应覆盖能力表中的全部非星盘体系', () => {
  const expected = SYSTEM_CAPABILITY_IDS.filter(
    (id) => id !== 'astrolabe' && !id.startsWith('calendar.'),
  );
  assert.deepEqual([...AUDITED_SYSTEM_IDS].sort(), [...expected].sort());

  const capabilities = getCapabilities().systems.filter((item) =>
    AUDITED_SYSTEM_IDS.includes(item.id as (typeof AUDITED_SYSTEM_IDS)[number]),
  );
  assert.equal(capabilities.length, AUDITED_SYSTEM_IDS.length);
  capabilities.forEach((capability) => {
    assert.notEqual(capability.available, false, `${capability.name} 当前不可用`);
    assert.ok(capability.inputs.length > 0, `${capability.name} 缺少输入契约`);
    assert.ok(capability.outputs.length > 0, `${capability.name} 缺少输出契约`);
    if (capability.defaultMethod) {
      assert.ok(
        capability.methods?.some((method) => method.value === capability.defaultMethod),
        `${capability.name} 的默认方法不在方法清单中`,
      );
    }
  });
});

test('三山国王九十二签应逐签具备完整原始签谱并能按号无损取回', () => {
  assert.equal(SSGW_SIGNS.length, 92);
  SSGW_SIGNS.forEach((sign, index) => {
    assert.equal(sign.id, index + 1);
    assert.ok(sign.title.trim(), `第${sign.id}签缺签题`);
    assert.ok(sign.qianwen.trim(), `第${sign.id}签缺签诗`);
    assert.ok(sign.story.trim(), `第${sign.id}签缺典故`);
    assert.ok(Object.keys(sign.details).length > 0, `第${sign.id}签缺解签资料`);

    const resolved = resolveSignByNumber(sign.id, new Date('2026-09-01T12:00:00+08:00'));
    assert.equal(resolved.number, sign.id);
    assert.equal(resolved.title, sign.title);
    assert.equal(resolved.poem, sign.qianwen);
  });
});

test('奇门核心计算与公开入口应保持同输入关键盘面一致', async () => {
  const customDate = '2025-01-01T08:00:00+08:00';
  for (const method of ['zhuanpan', 'feipan'] as const) {
    const core = generateQimen(new Date(customDate), method);
    const api = await callApi('divination/qimen', {
      customDate,
      qimenMethod: method,
      detailMode: 'full',
    });
    assert.equal(api.response.status, 200);
    const data = (api.body as { data: typeof core }).data;
    assert.equal(data.method, core.method);
    assert.equal(data.juShu, core.juShu);
    assert.equal(data.yinYangDun, core.yinYangDun);
    assert.deepEqual(
      data.jiuGongGe.map((palace) => ({
        gong: palace.gong,
        stem: palace.tianPan.stem,
        star: palace.tianPan.star,
        door: palace.renPan.door,
      })),
      core.jiuGongGe.map((palace) => ({
        gong: palace.gong,
        stem: palace.tianPan.stem,
        star: palace.tianPan.star,
        door: palace.renPan.door,
      })),
    );
  }
});
