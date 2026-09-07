import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import { detectQimenPatternCombos } from '../packages/core/src/divination/algorithms/qimen/helpers/pattern-combos';
import { resolveNumberMethod } from '../packages/core/src/divination/algorithms/meihua/helpers/methods';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';
import { analyzeLiurenEvidence } from '../packages/core/src/divination/liuren-evidence';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import { getTaiyiGeneralClassic } from '../packages/core/src/classics/taiyi-classics';

test('太乙五将属性按金镜式经文昌土、始击火、主将金、客将水', () => {
  for (const [name, element] of [
    ['文昌', '土'],
    ['始击', '火'],
    ['主将', '金'],
    ['客将', '水'],
  ]) {
    const entry = getTaiyiGeneralClassic(name);
    assert.equal(entry?.wuxing, element);
    assert.ok(entry?.verse.includes(`受${element}德之正气`));
    assert.equal(entry?.sourceBook, '太乙金镜式经·卷一·推五将所主法');
  }
});

test('梅花数字加时辰的安全边界应覆盖十二时辰', () => {
  for (const [index, branch] of [...'子丑寅卯辰巳午未申酉戌亥'].entries()) {
    const largest = Number.MAX_SAFE_INTEGER - index - 1;
    const result = resolveNumberMethod(largest, branch);
    assert.equal(result.calculation.totalWithTime, Number.MAX_SAFE_INTEGER);
    assert.equal(result.lowerTrigramIndex, 7);
    assert.equal(result.movingYaoIndex, 1);
    assert.throws(() => resolveNumberMethod(largest + 1, branch), /之和必须在安全整数范围/);
  }
});

test('奇门月将按十二中气换将，节不换将且不能用局气代替真实节气', () => {
  const chart = generateQimen(new Date('2026-02-10T12:00:00+08:00'));
  const groups = [
    ['大寒', '立春', '子'],
    ['雨水', '惊蛰', '亥'],
    ['春分', '清明', '戌'],
    ['谷雨', '立夏', '酉'],
    ['小满', '芒种', '申'],
    ['夏至', '小暑', '未'],
    ['大暑', '立秋', '午'],
    ['处暑', '白露', '巳'],
    ['秋分', '寒露', '辰'],
    ['霜降', '立冬', '卯'],
    ['小雪', '大雪', '寅'],
    ['冬至', '小寒', '丑'],
  ];
  for (const [zhongqi, jie, expected] of groups) {
    for (const actualSolarTerm of [zhongqi, jie]) {
      const combos = detectQimenPatternCombos({
        jiuGongGe: chart.jiuGongGe,
        monthBranch: '寅',
        hourBranch: '午',
        dayGanZhi: '甲辰',
        solarTerm: '夏至',
        actualSolarTerm,
      });
      for (const name of ['天马方', '天罡时', '天三门地四户', '地私门', '亭亭白奸']) {
        const combo = combos.find((item) => item.name === name);
        assert.ok(combo, `${actualSolarTerm}缺少${name}`);
        assert.ok(
          combo.summary.includes(`月将${expected}`),
          `${actualSolarTerm}：${combo.summary}`,
        );
      }
    }
  }
  for (const actualSolarTerm of [undefined, '无效节气']) {
    const combos = detectQimenPatternCombos({
      jiuGongGe: chart.jiuGongGe,
      monthBranch: '寅',
      hourBranch: '午',
      ...(actualSolarTerm ? { actualSolarTerm } : {}),
    });
    assert.ok(!combos.some((item) => item.name === '天马方'));
  }
});

test('奇门真实排盘与公开接口在雨水前后采用不同月将', async () => {
  for (const [customDate, expected] of [
    ['2026-02-10T12:00:00+08:00', '子'],
    ['2026-02-25T12:00:00+08:00', '亥'],
  ]) {
    const data = generateQimen(new Date(customDate));
    assert.ok(
      data.patternCombos
        ?.find((item) => item.name === '天马方')
        ?.summary.includes(`月将${expected}`),
    );
    const response = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/divination/qimen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDate, detailMode: 'full' }),
      }),
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { data: typeof data };
    assert.deepEqual(json.data.patternCombos, JSON.parse(JSON.stringify(data.patternCombos)));
  }
});

test('六壬天将乘神以天盘地支对日干判断，不以天将固有五行替代', () => {
  const data = generateLiuren(new Date('2026-02-10T12:00:00+08:00'));
  data.ganzhi.day = '甲子';
  const examples = [
    ['亥', '水', '乘神生日'],
    ['申', '金', '乘神克日'],
    ['巳', '火', '日生乘神'],
    ['辰', '土', '日克乘神'],
    ['寅', '木', '乘神日干比和'],
  ];
  for (const [branch, element, relation] of examples) {
    data.threeTransmissions[0] = { ...data.threeTransmissions[0], god: '贵人', branch };
    const evidence = analyzeLiurenEvidence(data);
    const fact = evidence.traditionalFacts.find((item) => item.kind === '天将乘神');
    assert.equal(fact?.riding?.element, element);
    assert.equal(fact?.riding?.relation, relation);
    assert.ok(
      evidence.evidence.items.some((item) => item.detail.includes(`贵人乘天盘${branch}${element}`)),
    );
  }
});
