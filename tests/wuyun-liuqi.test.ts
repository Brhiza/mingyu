import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUEST_QI_ORDER,
  HOST_QI_ORDER,
  calculateWuyunLiuqi,
  getWuyunLiuqiYearGanZhi,
} from '@core/wuyun-liuqi';
import { SIXTY_CYCLE } from '@core/ganzhi';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

test('五运六气天干化运与太过不及应覆盖六十甲子', () => {
  const expected: Record<string, readonly [string, string]> = {
    甲: ['土', '太过'],
    乙: ['金', '不及'],
    丙: ['水', '太过'],
    丁: ['木', '不及'],
    戊: ['火', '太过'],
    己: ['土', '不及'],
    庚: ['金', '太过'],
    辛: ['水', '不及'],
    壬: ['木', '太过'],
    癸: ['火', '不及'],
  };

  SIXTY_CYCLE.forEach((yearGanZhi) => {
    const result = calculateWuyunLiuqi({ yearGanZhi });
    assert.deepEqual(
      [result.annualMovement.element, result.annualMovement.strength],
      expected[yearGanZhi[0]],
    );
  });
});

test('五运六气司天在泉应覆盖十二支固定配对', () => {
  const expected: Record<string, readonly [string, string]> = {
    子: ['少阴君火', '阳明燥金'],
    午: ['少阴君火', '阳明燥金'],
    丑: ['太阴湿土', '太阳寒水'],
    未: ['太阴湿土', '太阳寒水'],
    寅: ['少阳相火', '厥阴风木'],
    申: ['少阳相火', '厥阴风木'],
    卯: ['阳明燥金', '少阴君火'],
    酉: ['阳明燥金', '少阴君火'],
    辰: ['太阳寒水', '太阴湿土'],
    戌: ['太阳寒水', '太阴湿土'],
    巳: ['厥阴风木', '少阳相火'],
    亥: ['厥阴风木', '少阳相火'],
  };

  SIXTY_CYCLE.forEach((yearGanZhi) => {
    const result = calculateWuyunLiuqi({ yearGanZhi });
    assert.deepEqual([result.sitian.name, result.zaiquan.name], expected[yearGanZhi[1]]);
    assert.equal(result.qiSteps[2].guestQi.name, result.sitian.name);
    assert.equal(result.qiSteps[2].guestRole, '司天');
    assert.equal(result.qiSteps[5].guestQi.name, result.zaiquan.name);
    assert.equal(result.qiSteps[5].guestRole, '在泉');
  });
});

test('主气和客气应保留各自次序，不混淆少阳与太阴', () => {
  assert.deepEqual(HOST_QI_ORDER, [
    '厥阴风木',
    '少阴君火',
    '少阳相火',
    '太阴湿土',
    '阳明燥金',
    '太阳寒水',
  ]);
  assert.deepEqual(GUEST_QI_ORDER, [
    '厥阴风木',
    '少阴君火',
    '太阴湿土',
    '少阳相火',
    '阳明燥金',
    '太阳寒水',
  ]);
});

test('公历年换算应采用稳定年中口径，并校验显式干支一致性', () => {
  assert.equal(getWuyunLiuqiYearGanZhi(1984), '甲子');
  assert.equal(getWuyunLiuqiYearGanZhi(2024), '甲辰');
  assert.equal(calculateWuyunLiuqi({ year: 2026 }).input.yearGanZhi, '丙午');
  assert.throws(
    () => calculateWuyunLiuqi({ year: 2026, yearGanZhi: '乙巳' }),
    /year 与 yearGanZhi 不一致/,
  );
  assert.throws(() => calculateWuyunLiuqi({}), /必须提供 year 或 yearGanZhi/);
  assert.throws(() => calculateWuyunLiuqi({ yearGanZhi: '甲丑' }), /年干支组合无效/);
});

test('五运六气提示词应是可独立使用的完整任务书', () => {
  const prompt = calculateWuyunLiuqi({
    yearGanZhi: '丙午',
    question: '这一年的气候节律如何？',
  }).prompt;
  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【问题】/);
  assert.match(prompt, /【盘面资料】/);
  assert.match(prompt, /水运，太过/);
  assert.match(prompt, /少阴君火/);
  assert.match(prompt, /《素问·天元纪大论》/);
  assert.doesNotMatch(prompt, /mingyu|API|MCP|仓库|内部字段/i);
  assertPromptIsPortableTaskText(prompt);
});
