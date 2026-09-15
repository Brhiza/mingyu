import assert from 'node:assert/strict';
import test from 'node:test';
import { detectDiseaseMedicine, detectTongguanNeed } from '@core/bazi/baziEnhancement/useGodRules';

// 《滴天髓·通关》列举的五组相克关系及其中间相生五行。
for (const [controller, controlled, bridge] of [
  ['木', '土', '火'],
  ['火', '金', '土'],
  ['土', '水', '金'],
  ['金', '木', '水'],
  ['水', '火', '木'],
]) {
  test(`${controller}${controlled}通关以${bridge}承接两端，喜忌方向不改变相生路径`, () => {
    for (const [favorable, unfavorable] of [
      [controller, controlled],
      [controlled, controller],
    ]) {
      const result = detectTongguanNeed(
        { [controller]: 30, [controlled]: 30 },
        [favorable],
        [unfavorable],
      );
      assert.equal(result.need, true);
      assert.equal(result.tongguan, bridge);
    }
  });
}

test('相生两端不被当成相克通关', () => {
  for (const [first, second] of [
    ['木', '火'],
    ['火', '土'],
    ['土', '金'],
    ['金', '水'],
    ['水', '木'],
  ]) {
    assert.equal(detectTongguanNeed({ [first]: 30, [second]: 30 }, [first], [second]).need, false);
  }
});

test('过旺规则选择泄化五行时沿相生方向取泄神', () => {
  for (const [element, drain] of [
    ['木', '火'],
    ['火', '土'],
    ['土', '金'],
    ['金', '水'],
    ['水', '木'],
  ]) {
    const result = detectDiseaseMedicine(
      { [element]: 40 },
      { pattern: '普通格局', isSpecial: false },
      '身强',
      element,
    );
    assert.equal(result.medicine, drain);
  }
});

test('原始八字计数与同比放大不改变通关候选，也不冒充已成通关', () => {
  for (const counts of [
    { 土: 3, 水: 2 },
    { 土: 30, 水: 20 },
  ]) {
    const result = detectTongguanNeed(counts, ['水'], ['土']);
    assert.equal(result.need, true);
    assert.equal(result.tongguan, '金');
    assert.equal(result.status, '候选');
    assert.match(result.conditions!, /月令、根气及位置/);
  }
  assert.equal(detectTongguanNeed({ 土: 3, 水: 0 }, ['水'], ['土']).need, false);
});

test('病药对应已判旺衰的日主，不把木少或缺木当成补木依据', () => {
  const pattern = { pattern: '七杀格', isSpecial: false };
  const counts = { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 };
  const missingMaster = detectDiseaseMedicine(counts, pattern, '身弱');
  assert.equal(missingMaster.status, '资料不足');
  assert.equal(missingMaster.hasDisease, false);
  for (const values of [counts, { 木: 0, 火: 10, 土: 20, 金: 10, 水: 20 }]) {
    const result = detectDiseaseMedicine(values, pattern, '身弱', '水');
    assert.equal(result.disease, '水日主身弱');
    assert.equal(result.medicine, '金');
    assert.equal(result.status, '候选');
    assert.match(result.conditions, /受财克制/);
  }
});

test('特殊格局、中和和未判旺衰不套用普通病药', () => {
  const ordinary = { pattern: '正财格', isSpecial: false };
  const special = { pattern: '从财格', isSpecial: true };
  assert.equal(detectDiseaseMedicine({ 木: 0 }, special, '极弱', '木').status, '不适用');
  assert.equal(detectDiseaseMedicine({ 木: 0 }, ordinary, '中和', '木').status, '不适用');
  assert.equal(detectDiseaseMedicine({ 木: 0 }, ordinary, '未知', '木').status, '资料不足');
  assert.throws(() => detectDiseaseMedicine({ 木: 1 }, ordinary, '身弱', '风'), /日主五行无效/);
});
