import test from 'node:test';
import assert from 'node:assert/strict';
import { generateXiaoliuren } from '@core/divination/algorithms/xiaoliuren';
import { formatDetailedDivinationInfo } from '@core/prompt/divination-detail';
import { buildDivinationPrompt as buildCoreDivinationPrompt } from '@core/prompt/divination';
import { generateDivinationSession } from '@core/divination/session';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';

const promptScopeCharts = {
  common: generateXiaoliuren({
    rule: 'common',
    customDate: new Date('2026-05-19T10:30:00+08:00'),
  }),
  duoneng: generateXiaoliuren({
    rule: 'duoneng',
    customDate: new Date('2026-05-19T10:30:00+08:00'),
  }),
};

test('小六壬双口径在原生提示词中绑定起点位置与时宫歌诀', () => {
  for (const rule of ['common', 'duoneng'] as const) {
    const data = structuredClone(promptScopeCharts[rule]);
    const prompt = buildDivinationPrompt('xiaoliuren', '请做整体解读。', data);
    const sparseData = structuredClone(data);
    delete sparseData.palaceOrder[5];
    assert.equal(sparseData.palaceOrder.length, 6);
    assert.equal(Object.hasOwn(sparseData.palaceOrder, 5), false);
    assert.throws(
      () => buildDivinationPrompt('xiaoliuren', '请做整体解读。', sparseData),
      /顺数或占得宫与盘面不一致/u,
    );
    const day = rule === 'common' ? '空亡' : '大安';
    const primary = rule === 'common' ? '小吉' : '空亡';
    const firstDay = rule === 'common' ? '赤口' : '小吉';
    assert.match(prompt, /公历：2026年5月19日 10时30分/);
    assert.doesNotMatch(prompt, /公历占时（北京时间）：2026-05-19 10:30/);
    assert.ok(prompt.includes('起课过程：月、日、时各段起点计为第一位'));
    const dayLine = `  定日宫：从月宫赤口${rule === 'duoneng' ? '下一宫' : ''}起初一（${firstDay}），顺数至3日，落${day}`;
    const hourLine = `  定时宫：从日宫${day}起子时，顺数至巳时`;
    assert.equal(prompt.split(dayLine).length - 1, 1);
    assert.equal(prompt.split(hourLine).length - 1, 1);
    assert.doesNotMatch(prompt, /定位用途：/u);
    const facts = extractDivinationPromptFacts('xiaoliuren', data);
    assert.ok(facts.some((fact) => fact.id === 'xiaoliuren.location'));
    assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);
    const wrongFirstDay = prompt.replace(dayLine, dayLine.replace(`（${firstDay}）`, '（留连）'));
    assert.deepEqual(auditPromptFacts(wrongFirstDay, facts).missing, [
      'xiaoliuren.first-day',
      'xiaoliuren.location',
    ]);
    const wrongHourStart = prompt.replace(hourLine, hourLine.replace(`日宫${day}`, '日宫留连'));
    assert.deepEqual(auditPromptFacts(wrongHourStart, facts).missing, [
      'xiaoliuren.hour',
      'xiaoliuren.location',
    ]);
    const missingHourStart = prompt.replace(hourLine + '\n', '');
    assert.deepEqual(auditPromptFacts(missingHourStart, facts).missing, [
      'xiaoliuren.hour',
      'xiaoliuren.location',
    ]);
    assert.ok(prompt.includes(`占得宫：${primary}`));
    assert.ok(prompt.includes(`歌诀原文：${data.primary.verse}`));
    assert.match(prompt, /总体判断、分项解释与总结保持同一取证范围/);
    assert.doesNotMatch(prompt, /起数对应：|断事主证：|晚子时与早子时/);
    assert.ok(!prompt.includes(data.sequence.month.verse));
    assert.ok(!prompt.includes(data.sequence.day.verse));
    assert.doesNotMatch(prompt, rule === 'common' ? /多能鄙事/ : /通行俗传/);
  }
});

test('小六壬占时与当前时间同分钟时只列一次，历史起课仍保留占时', () => {
  const chartTime = new Date('2026-05-19T10:30:00+08:00');
  const data = generateXiaoliuren({ customDate: chartTime });
  const corePrompt = buildCoreDivinationPrompt({
    method: 'xiaoliuren',
    data,
    question: '请分析进展。',
    currentTime: chartTime,
  });
  assert.doesNotMatch(corePrompt, /公历占时（北京时间）/);

  const sameTimeSession = generateDivinationSession({
    method: 'xiaoliuren',
    question: '请分析进展。',
    divinationTime: chartTime,
    currentTime: chartTime,
  });
  assert.doesNotMatch(sameTimeSession.aiPrompt, /公历占时（北京时间）/);

  const laterTime = new Date('2026-05-20T10:30:00+08:00');
  const historicalSession = generateDivinationSession({
    method: 'xiaoliuren',
    question: '请分析进展。',
    divinationTime: chartTime,
    currentTime: laterTime,
  });
  assert.match(historicalSession.aiPrompt, /公历占时（北京时间）：2026-05-19 10:30/);
});

test('小六壬初一起点随月宫与流派变化，空亡下一宫回到大安', () => {
  const names = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
  const seen = new Set<string>();
  for (let month = 1; month <= 12; month++) {
    for (const rule of ['common', 'duoneng'] as const) {
      const data = generateXiaoliuren({
        rule,
        customDate: new Date(`2026-${String(month).padStart(2, '0')}-19T10:30:00+08:00`),
      });
      const start = names[(data.lunarMonth - 1 + (rule === 'duoneng' ? 1 : 0)) % 6];
      const prompt = buildDivinationPrompt('xiaoliuren', '请做整体解读。', data);
      assert.ok(
        prompt.includes(
          `定日宫：从月宫${data.sequence.month.name}${rule === 'duoneng' ? '下一宫' : ''}起初一（${start}）`,
        ),
      );
      seen.add(`${rule}/${data.sequence.month.name}/${start}`);
    }
  }
  assert.equal(seen.size, 12);
  assert.ok(seen.has('duoneng/空亡/大安'));
});

test('小六壬两种断法在网页与核心提示词中只按时宫歌诀判断', () => {
  for (const rule of ['common', 'duoneng'] as const) {
    const data = structuredClone(promptScopeCharts[rule]);
    for (const prompt of [
      buildDivinationPrompt('xiaoliuren', '请分析进展。', data, undefined, {
        schools: ['shunshu', 'gongjue'],
      }),
      buildCoreDivinationPrompt({
        method: 'xiaoliuren',
        data,
        question: '请分析进展。',
        schools: ['shunshu', 'gongjue'],
      }),
    ]) {
      assert.match(prompt, /按本次起课口径复核农历月、日、时的逐宫顺数，以所得时宫回答问题/);
      assert.match(prompt, /按所问事项选取占得时宫歌诀的对应句义/);
      assert.doesNotMatch(prompt, /递进关系判断过程|三宫的吉凶层次/);
      assert.doesNotMatch(prompt, rule === 'common' ? /多能鄙事/ : /通行俗传/);
    }
    const detail = formatDetailedDivinationInfo('xiaoliuren', data);
    assert.ok(detail.includes(`占得宫歌诀：${data.primary.verse}`));
    assert.ok(!detail.includes(data.sequence.month.verse));
    assert.ok(!detail.includes(data.sequence.day.verse));
  }
});

test('小六壬早晚子时各按民用日期起课，闰月提示与实际农历资料一致', () => {
  for (const [time, day, primary] of [
    ['2026-05-19T23:30:00+08:00', 3, '空亡'],
    ['2026-05-20T00:30:00+08:00', 4, '大安'],
  ] as const) {
    const data = generateXiaoliuren({ customDate: new Date(time) });
    assert.equal(data.lunarDay, day);
    assert.equal(data.primary.name, primary);
    const prompt = buildDivinationPrompt('xiaoliuren', '请做整体解读。', data);
    assert.match(prompt, /东八区民用日零点换日/);
    assert.match(prompt, /晚子时与早子时各按所在民用日的农历日期起课/);
    if (data.hourLabel === '晚子时') {
      assert.match(prompt, /晚子时四柱日干支按子初换日/);
    } else {
      assert.doesNotMatch(prompt, /晚子时四柱日干支按子初换日/);
    }
  }
  const leap = generateXiaoliuren({ customDate: new Date('2025-07-25T08:00:00+08:00') });
  assert.equal(leap.isLeapMonth, true);
  const prompt = buildDivinationPrompt('xiaoliuren', '请做整体解读。', leap);
  assert.match(prompt, /农历闰6月1日/);
  assert.match(prompt, /闰月沿用同名月序/);
});

test('小六壬真太阳时跨民用日期时提示词说明农历日与干支取时口径', () => {
  const data = generateXiaoliuren({
    customDate: new Date('2025-06-29T21:15:00+08:00'),
    termReferenceDate: new Date('2025-06-30T00:20:00+08:00'),
  });
  for (const prompt of [
    buildDivinationPrompt('xiaoliuren', '请分析当前课。', data),
    buildCoreDivinationPrompt({ method: 'xiaoliuren', data, question: '请分析当前课。' }),
  ]) {
    assert.match(prompt, /起课农历月日、节气与年月柱参照实际占时，时辰与日时柱取校正钟表时刻/);
    assert.match(prompt, /公历占时（北京时间）：2025-06-30 00:20/);
    assert.match(prompt, /真太阳时校正时刻：2025-06-29 21:15（用于定亥时）/);
  }
  assert.match(
    buildDivinationPrompt('xiaoliuren', '请分析当前课。', data),
    /农历：乙巳年 六月初六 亥时/,
  );
});
