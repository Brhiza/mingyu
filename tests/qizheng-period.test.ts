import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateQizheng,
  palaceIndexByLimitStep,
  resolveQizhengLimitDirection,
  resolveQizhengNominalAge,
  TWELVE_PALACES,
} from '../packages/core/src/qi_zheng/index.ts';

const NATAL = {
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  latitude: 39.9042,
  longitude: 116.4074,
  timezone: 8,
} as const;

test('行限：阳男阴女顺行，阴男阳女逆行，虚岁按流年减出生年加一', () => {
  assert.equal(resolveQizhengLimitDirection('male', '阳'), '顺行');
  assert.equal(resolveQizhengLimitDirection('female', '阴'), '顺行');
  assert.equal(resolveQizhengLimitDirection('male', '阴'), '逆行');
  assert.equal(resolveQizhengLimitDirection('female', '阳'), '逆行');
  assert.equal(resolveQizhengNominalAge(1990, 2024), 35);
  assert.equal(palaceIndexByLimitStep(0, '顺行'), 0);
  assert.equal(palaceIndexByLimitStep(1, '顺行'), 1);
  assert.equal(palaceIndexByLimitStep(1, '逆行'), 11);
  assert.equal(TWELVE_PALACES[palaceIndexByLimitStep(1, '逆行')], '相貌');
});

test('未给流年时七政只排本命静态盘，不冒充阶段资料', () => {
  const natal = generateQizheng(NATAL);
  assert.equal(natal.timeLords, undefined);
  assert.equal(natal.flowingStars, undefined);
  assert.match(natal.prompt, /出生时点静态结构/);
  assert.doesNotMatch(natal.prompt, /【行限】/);
  assert.doesNotMatch(natal.prompt, /【流曜】/);
});

test('给出性别与流年后应同时生成行限和流曜，并叠到本命十二宫', () => {
  const result = generateQizheng({
    ...NATAL,
    gender: 'male',
    flowYear: 2024,
    flowMonth: 3,
    flowDay: 15,
    flowHour: 12,
  });
  assert.ok(result.timeLords);
  assert.equal(result.timeLords?.nominalAge, 35);
  assert.equal(result.timeLords?.currentMajorLimit.startNominalAge, 31);
  assert.equal(result.timeLords?.currentMajorLimit.endNominalAge, 40);
  assert.ok(TWELVE_PALACES.includes(result.timeLords?.currentMajorLimit.palace as string));
  assert.ok(result.flowingStars);
  assert.equal(result.flowingStars?.stars.length, 11);
  for (const star of result.flowingStars?.stars ?? []) {
    const natalPalace = result.twelvePalaces.find((item) => item.signIndex === star.signIndex);
    assert.equal(star.palace, natalPalace?.palace);
  }
  assert.match(result.prompt, /【行限】/);
  assert.match(result.prompt, /【流曜】/);
  assert.match(result.prompt, /【流曜周期】/);
  assert.equal(result.flowingStars?.periodEvents?.mode, 'daily');
  assert.match(result.prompt, /阶段判断只使用上面的行限与流曜资料/);
  assert.doesNotMatch(result.prompt, /只解读根基、落宿、落宫和吊照/);
});

test('只有流年没有性别时只排流曜，不编造行限', () => {
  const result = generateQizheng({
    ...NATAL,
    flowYear: 2024,
  });
  assert.equal(result.timeLords, undefined);
  assert.ok(result.flowingStars);
  assert.match(result.flowingStars?.timestampNote ?? '', /立春/);
  assert.match(result.prompt, /【流曜】/);
  assert.match(result.prompt, /【流曜周期】/);
  assert.equal(result.flowingStars?.periodEvents?.mode, 'yearly');
  assert.ok((result.flowingStars?.periodEvents?.events.length ?? 0) > 0);
  assert.doesNotMatch(result.prompt, /【行限】/);
});
