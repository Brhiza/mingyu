import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUEST_QI_ORDER,
  HOST_QI_ORDER,
  QI_STEP_SOLAR_TERMS,
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

test('气运相临应在六十甲子中各得十二年同气、顺化、天刑、小逆与不和', () => {
  const counts = new Map<string, number>();
  SIXTY_CYCLE.forEach((yearGanZhi) => {
    const kind = calculateWuyunLiuqi({ yearGanZhi }).annualRelation.kind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  });
  ['同气', '顺化', '天刑', '小逆', '不和'].forEach((kind) => {
    assert.equal(counts.get(kind), 12, kind);
  });
});

test('天符岁会等五类符会应按通行六十年固定集合核验', () => {
  type ConformityField = 'tianfu' | 'suihui' | 'taiyiTianfu' | 'tongTianfu' | 'tongSuihui';
  const expected: Record<ConformityField, string[]> = {
    tianfu: [
      '丁巳',
      '丁亥',
      '戊子',
      '戊午',
      '戊寅',
      '戊申',
      '己丑',
      '己未',
      '乙卯',
      '乙酉',
      '丙辰',
      '丙戌',
    ],
    suihui: ['丁卯', '戊午', '乙酉', '丙子', '甲辰', '甲戌', '己丑', '己未'],
    taiyiTianfu: ['己丑', '己未', '乙酉', '戊午'],
    tongTianfu: ['壬寅', '壬申', '甲辰', '甲戌', '庚子', '庚午'],
    tongSuihui: ['辛丑', '辛未', '癸卯', '癸酉', '癸巳', '癸亥'],
  };

  for (const field of Object.keys(expected) as ConformityField[]) {
    const years = expected[field];
    const actual = SIXTY_CYCLE.filter(
      (yearGanZhi) => calculateWuyunLiuqi({ yearGanZhi }).annualConformities[field],
    );
    assert.deepEqual([...actual].sort(), [...years].sort(), field);
  }

  const allConformityYears = SIXTY_CYCLE.filter(
    (yearGanZhi) => calculateWuyunLiuqi({ yearGanZhi }).annualConformities.names.length > 0,
  );
  assert.equal(allConformityYears.length, 26);
  assert.deepEqual(
    calculateWuyunLiuqi({ yearGanZhi: '甲子' }).annualConformities.sourceReconciliation,
    {
      distinctYearsByListedRules: 26,
      sourceSummaryYears: 28,
      handling:
        '吴谦《运气要诀》逐项名单按六十甲子去重为26年，与原文“二十八年”汇总不一致；计算采用逐项定义和逐年名单，不用汇总数反改规则。',
    },
  );
  assert.deepEqual(calculateWuyunLiuqi({ yearGanZhi: '戊午' }).annualConformities.names, [
    '天符',
    '岁会',
    '太乙天符',
  ]);
});

test('六步节令和主客气关系应完整覆盖二十四节气', () => {
  assert.deepEqual(QI_STEP_SOLAR_TERMS, [
    ['大寒', '立春', '雨水', '惊蛰'],
    ['春分', '清明', '谷雨', '立夏'],
    ['小满', '芒种', '夏至', '小暑'],
    ['大暑', '立秋', '处暑', '白露'],
    ['秋分', '寒露', '霜降', '立冬'],
    ['小雪', '大雪', '冬至', '小寒'],
  ]);
  const result = calculateWuyunLiuqi({ yearGanZhi: '丙午' });
  assert.equal(result.qiSteps.flatMap((step) => step.solarTerms).length, 24);
  result.qiSteps.forEach((step) => {
    assert.ok(
      ['同气', '客生主', '主生客', '客克主', '主克客'].includes(step.hostGuestRelation.kind),
    );
    assert.match(step.hostGuestRelation.basis, /主气|客气/);
  });
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
  assert.match(prompt, /司天与中运：不和/);
  assert.match(prompt, /大寒、立春、雨水、惊蛰/);
  assert.match(prompt, /《素问·天元纪大论》/);
  assert.match(prompt, /吴谦《运气要诀》/);
  assert.doesNotMatch(prompt, /mingyu|API|MCP|仓库|内部字段/i);
  assertPromptIsPortableTaskText(prompt);
});
