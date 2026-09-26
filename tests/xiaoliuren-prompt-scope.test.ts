import test from 'node:test';
import assert from 'node:assert/strict';
import { generateXiaoliuren } from '@core/divination/algorithms/xiaoliuren';
import { formatDetailedDivinationInfo } from '@core/prompt/divination-detail';
import { buildDivinationPrompt as buildCoreDivinationPrompt } from '@core/prompt/divination';
import { buildDivinationPrompt } from '../src/lib/divination/engine';

test('小六壬双口径在原生提示词中分别绑定定位用途与时宫歌诀', () => {
  for (const rule of ['common', 'duoneng'] as const) {
    const data = generateXiaoliuren({ rule, customDate: new Date('2026-05-19T10:30:00+08:00') });
    const prompt = buildDivinationPrompt('xiaoliuren', '请做整体解读。', data);
    const day = rule === 'common' ? '空亡' : '大安';
    const primary = rule === 'common' ? '小吉' : '空亡';
    const firstDay = rule === 'common' ? '赤口' : '小吉';
    assert.ok(prompt.includes('起课过程：月、日、时各段起点计为第一位'));
    assert.ok(
      prompt.includes(
        `定日宫：从月宫赤口${rule === 'duoneng' ? '下一宫' : ''}起初一（${firstDay}），顺数至3日，落${day}`,
      ),
    );
    assert.ok(prompt.includes(`月宫赤口用于确定初一的起数位置；日宫${day}用于确定子时的起数位置`));
    assert.ok(prompt.includes(`占得宫：${primary}`));
    assert.ok(prompt.includes(`歌诀原文：${data.primary.verse}`));
    assert.match(prompt, /总体判断、分项解释与总结保持同一取证范围/);
    assert.doesNotMatch(prompt, /起数对应：|断事主证：|晚子时与早子时/);
    assert.ok(!prompt.includes(data.sequence.month.verse));
    assert.ok(!prompt.includes(data.sequence.day.verse));
    assert.doesNotMatch(prompt, rule === 'common' ? /多能鄙事/ : /通行俗传/);
  }
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
    const data = generateXiaoliuren({ rule, customDate: new Date('2026-05-19T10:30:00+08:00') });
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
  }
  const leap = generateXiaoliuren({ customDate: new Date('2025-07-25T08:00:00+08:00') });
  assert.equal(leap.isLeapMonth, true);
  const prompt = buildDivinationPrompt('xiaoliuren', '请做整体解读。', leap);
  assert.match(prompt, /农历闰6月1日/);
  assert.match(prompt, /闰月沿用同名月序/);
});
