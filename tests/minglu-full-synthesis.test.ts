import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('minglu 支持 include.all 全量六体系综合与自定义组合及追问', async () => {
  const fullRes = await calculate('minglu', {
    question: '请综合全量体系看本命特征与事业节奏',
    gender: 'male',
    birth: {
      year: 1990,
      month: 1,
      day: 15,
      timezone: 8,
      clock: { kind: 'exact', hour: 8, minute: 0, second: 0 },
    },
    location: { latitude: 39.9, longitude: 116.4, locationName: '北京' },
    referenceTime: '2026-06-15T12:00:00+08:00',
    include: { all: true },
  });

  const data = fullRes.data as any;
  assert.equal(data.omitted.length, 0, '全量资料齐全时不应有省略项');
  assert.equal(data.sections.length, 6, '全量应包含 6 个体系分节');
  assert.ok(data.qizheng, '应包含七政四余结果');
  assert.ok(data.qimenLifetime, '应包含奇门终身局结果');
  assert.match(fullRes.prompt.text, /五、七政四余资料/);
  assert.match(fullRes.prompt.text, /六、奇门终身局资料/);
  assert.match(fullRes.prompt.text, /七政四余：命宫.+?宫（命主.+?，度主.+?）/);
  assert.match(fullRes.prompt.text, /奇门终身局：[阴阳]遁\d+局（值符[^、]+、值使[^）]+）/);

  const reprompted = await reprompt({
    method: 'minglu',
    result: fullRes,
    question: '重点对比奇门终身局和七政四余',
  });
  assert.match(reprompted.prompt.text, /奇门终身局/);

  // 自定义组合：关闭紫微和八宅，仅保留八字 + 星盘 + 七政 + 奇门终身局
  const customRes = await calculate('minglu', {
    question: '自定义四体系合参',
    gender: 'male',
    birth: {
      year: 1990,
      month: 1,
      day: 15,
      timezone: 8,
      clock: { kind: 'exact', hour: 8, minute: 0, second: 0 },
    },
    location: { latitude: 39.9, longitude: 116.4 },
    include: { ziwei: false, bazhai: false, qizheng: true, qimenLifetime: true },
  });
  const customData = customRes.data as any;
  assert.equal(customData.ziwei, null);
  assert.equal(customData.bazhai, null);
  assert.ok(customData.qizheng);
  assert.ok(customData.qimenLifetime);
  assert.ok(customData.omitted.some((o: any) => o.system === '紫微斗数'));
  assert.ok(customData.omitted.some((o: any) => o.system === '八宅命卦'));
});
