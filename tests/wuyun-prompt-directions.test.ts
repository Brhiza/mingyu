import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWuyunLiuqiPrompt,
  calculateWuyunLiuqi,
  formatWuyunLiuqiFacts,
} from '@core/wuyun-liuqi';
import { SIXTY_CYCLE } from '@core/ganzhi';
import {
  buildDivinationPrompt,
  formatDivinationInfo,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';

const annualResults = new Map<string, ReturnType<typeof calculateWuyunLiuqi>>();

function getWuyunResult(yearGanZhi: string) {
  const cached = annualResults.get(yearGanZhi);
  if (cached) return cached;

  const result = calculateWuyunLiuqi({ yearGanZhi });
  annualResults.set(yearGanZhi, result);
  return result;
}

test('五运六气原生正文按六十甲子保留中运与司天实际五行方向', () => {
  const sheng: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ke: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
  const seen = new Set<string>();
  for (const yearGanZhi of SIXTY_CYCLE) {
    const result = getWuyunResult(yearGanZhi);
    const source = result.annualMovement.element;
    const target = result.sitian.element;
    const from = `中运（${source}）`;
    const to = `司天${result.sitian.name}（${target}）`;
    const direction =
      source === target
        ? `${from}与${to}同气`
        : sheng[source] === target
          ? `${from}生${to}`
          : sheng[target] === source
            ? `${to}生${from}`
            : ke[source] === target
              ? `${from}克${to}`
              : `${to}克${from}`;
    const category =
      source === target
        ? '同气'
        : sheng[source] === target
          ? '运生气'
          : sheng[target] === source
            ? '气生运'
            : ke[source] === target
              ? '运克气'
              : '气克运';
    seen.add(category);
    assert.ok(result.prompt.includes(`年度五行作用：${direction}`), yearGanZhi);
  }
  assert.equal(seen.size, 5);
});

test('丙午年保留运克气、客生主与客克主的施受双方', () => {
  const { prompt } = getWuyunResult('丙午');
  assert.match(prompt, /中运（水）克司天少阴君火（火）/);
  assert.match(prompt, /在泉阳明燥金（金）生中运（水）/);
  assert.match(prompt, /客运太羽（水）生主运太角（木）/);
  assert.match(prompt, /客气太阳寒水（水）生主气厥阴风木（木）/);
  assert.match(prompt, /客气少阳相火（火）克主气阳明燥金（金）/);
  assert.doesNotMatch(prompt, /司天少阴君火（火）克中运（水）/);
  assert.match(prompt, /三之气.*主客关系同气；二火加临：君位臣则顺/);
  assert.doesNotMatch(prompt, /主客关系同气（/);

  const baseline = getWuyunResult('丙午');
  const currentTime = new Date('2025-01-01T00:00:00.000Z');
  const question = '本年主客运气如何分层理解？';
  const consumers = (data: typeof baseline) => ({
    facts: formatWuyunLiuqiFacts(data),
    native: buildWuyunLiuqiPrompt(data),
    fullTask: buildDivinationPrompt({ method: 'wuyun', data, question, currentTime }),
    summary: getDivinationSummaryBlocks('wuyun', data),
    formatted: formatDivinationInfo('wuyun', data),
    detailed: formatDetailedDivinationInfo('wuyun', data),
    enhanced: formatEnhancedDivinationInfo('wuyun', data),
  });
  const baselineConsumers = consumers(baseline);
  assert.equal(baselineConsumers.native, prompt);
  assert.deepEqual(consumers(JSON.parse(JSON.stringify(baseline))), baselineConsumers);
  const mutations = [
    {
      mutate: (data: typeof baseline) => {
        data.pathomechanism!.summary = '平气核定：已经确定为平气';
      },
      error: /平气及岁运纪/,
    },
    {
      mutate: (data: typeof baseline) => {
        data.annualRelation.kind = '同气';
      },
      error: /年度气运关系/,
    },
    {
      mutate: (data: typeof baseline) => {
        data.qiSteps[2].guestQi.name = '厥阴风木';
      },
      error: /六步主客气属性/,
    },
  ];
  for (const { mutate, error } of mutations) {
    const bad = structuredClone(baseline);
    mutate(bad);
    assert.notDeepEqual(bad, baseline);
    assert.equal(bad.prompt, prompt);
    for (const consume of [
      () => formatWuyunLiuqiFacts(bad),
      () => buildWuyunLiuqiPrompt(bad),
      () => buildDivinationPrompt({ method: 'wuyun', data: bad, question, currentTime }),
      () => getDivinationSummaryBlocks('wuyun', bad),
      () => formatDivinationInfo('wuyun', bad),
      () => formatDetailedDivinationInfo('wuyun', bad),
      () => formatEnhancedDivinationInfo('wuyun', bad),
    ]) {
      assert.throws(consume, error);
    }
  }
  const legacyConsumers = consumers({ ...baseline, pathomechanism: undefined });
  assert.deepEqual(legacyConsumers, {
    ...baselineConsumers,
    summary: {
      ...baselineConsumers.summary,
      lines: baselineConsumers.summary.lines.filter(
        (line) => line !== baseline.pathomechanism!.summary,
      ),
    },
  });
  const fresh = calculateWuyunLiuqi({ yearGanZhi: '丙午' });
  assert.deepEqual(fresh, baseline);
  assert.deepEqual(consumers(fresh), baselineConsumers);
});

test('丁亥年同气事实只列一次，平气参考条件仍保持独立', () => {
  const result = getWuyunResult('丁亥');
  assert.equal(result.annualRelation.kind, '同气');
  assert.equal(result.movementSteps[0].hostGuestRelation.kind, '同气');
  assert.match(result.prompt, /中运（木）与司天厥阴风木（木）同气；/);
  assert.match(result.prompt, /平气参考条件：厥阴风木司天与木运同气，资助岁运不及/);
  assert.doesNotMatch(result.prompt, /同气（同气）|主客关系同气（/);
});

test('五运六气各事实出口保留实际平气待核及条件成立后的纪名', () => {
  // 《古今医统大全》卷五“论纪运”：平气须按当年辰日时推之，物生脉应合期。
  // 同篇明确木运委和/敷和、水运流衍/静顺、火运赫曦/升明的基准与平气纪。
  // https://www.theqi.com/cmed/oldbook/book85/b85_05.html
  const cases = [
    {
      yearGanZhi: '丁亥',
      baseline: '委和',
      balanced: '敷和',
      status: '具平气条件',
      conditions: ['厥阴风木司天与木运同气，资助岁运不及'],
    },
    {
      yearGanZhi: '丙午',
      baseline: '流衍',
      balanced: '静顺',
      status: '平气待定',
      conditions: [],
    },
    {
      yearGanZhi: '戊辰',
      baseline: '赫曦',
      balanced: '升明',
      status: '具平气条件',
      conditions: ['太阳寒水司天制约火运太过'],
    },
  ];
  for (const expected of cases) {
    const result = getWuyunResult(expected.yearGanZhi);
    assert.equal(result.pathomechanism!.isPingQi, null);
    assert.equal(result.pathomechanism!.pingQiType, expected.status);
    assert.deepEqual(result.pathomechanism!.pingQiConditions, expected.conditions);
    const texts = [
      result.prompt,
      getDivinationSummaryBlocks('wuyun', result).lines.join('\n'),
      formatDivinationInfo('wuyun', result),
      formatDetailedDivinationInfo('wuyun', result),
      formatEnhancedDivinationInfo('wuyun', result),
    ];
    for (const text of texts) {
      assert.ok(
        text.includes(`岁运纪：${expected.baseline}之纪（按年干太过不及推得的基准）`),
        expected.yearGanZhi,
      );
      assert.ok(
        text.includes(`平气核定：${expected.status}，待结合交气日时与气候应期核定`),
        expected.yearGanZhi,
      );
      assert.ok(text.includes(`平气成立时称${expected.balanced}之纪`), expected.yearGanZhi);
      assert.doesNotMatch(text, new RegExp(`岁运纪：${expected.balanced}之纪`));
      for (const condition of expected.conditions) assert.ok(text.includes(condition));
      if (!expected.conditions.length) assert.doesNotMatch(text, /平气参考条件：/);
      for (const other of cases.filter((item) => item.yearGanZhi !== expected.yearGanZhi)) {
        assert.doesNotMatch(text, new RegExp(`平气成立时称${other.balanced}之纪`));
      }
    }
  }
});
