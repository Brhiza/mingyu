import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUEST_QI_ORDER,
  HOST_MOVEMENT_ORDER,
  HOST_QI_ORDER,
  MOVEMENT_STEP_BOUNDARIES,
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

test('五步主运应固定木火土金水，并由中运推定五音太少', () => {
  assert.deepEqual(HOST_MOVEMENT_ORDER, ['木', '火', '土', '金', '水']);

  const cases: Array<{
    yearGanZhi: string;
    annualTone: string;
    hostTones: string[];
    guestTones: string[];
  }> = [
    {
      yearGanZhi: '甲子',
      annualTone: '太宫',
      hostTones: ['太角', '少徵', '太宫', '少商', '太羽'],
      guestTones: ['太宫', '少商', '太羽', '少角', '太徵'],
    },
    {
      yearGanZhi: '戊午',
      annualTone: '太徵',
      hostTones: ['少角', '太徵', '少宫', '太商', '少羽'],
      guestTones: ['太徵', '少宫', '太商', '少羽', '太角'],
    },
    {
      yearGanZhi: '丁卯',
      annualTone: '少角',
      hostTones: ['少角', '太徵', '少宫', '太商', '少羽'],
      guestTones: ['少角', '太徵', '少宫', '太商', '少羽'],
    },
    {
      yearGanZhi: '癸亥',
      annualTone: '少徵',
      hostTones: ['太角', '少徵', '太宫', '少商', '太羽'],
      guestTones: ['少徵', '太宫', '少商', '太羽', '少角'],
    },
  ];

  cases.forEach(({ yearGanZhi, annualTone, hostTones, guestTones }) => {
    const result = calculateWuyunLiuqi({ yearGanZhi });
    assert.equal(result.annualMovement.toneName, annualTone);
    assert.deepEqual(
      result.movementSteps.map((step) => step.hostMovement.toneName),
      hostTones,
    );
    assert.deepEqual(
      result.movementSteps.map((step) => step.guestMovement.toneName),
      guestTones,
    );
    assert.equal(result.movementSteps[0].guestRole, '中运起点');
    assert.equal(result.movementSteps[0].guestMovement.toneName, annualTone);
  });
});

test('五步客运应以中运起步相生轮转，并按太少相生逐步交替', () => {
  SIXTY_CYCLE.forEach((yearGanZhi) => {
    const result = calculateWuyunLiuqi({ yearGanZhi });
    assert.equal(result.movementSteps.length, 5);
    assert.deepEqual(
      result.movementSteps.map((step) => step.hostMovement.element),
      HOST_MOVEMENT_ORDER,
    );
    assert.equal(
      result.movementSteps[0].guestMovement.element,
      result.annualMovement.element,
      yearGanZhi,
    );
    result.movementSteps.forEach((step, index) => {
      assert.equal(
        step.guestMovement.toneStrength,
        index % 2 === 0
          ? result.annualMovement.toneStrength
          : result.annualMovement.toneStrength === '太'
            ? '少'
            : '太',
        yearGanZhi,
      );
      assert.ok(
        ['同气', '客生主', '主生客', '客克主', '主克客'].includes(step.hostGuestRelation.kind),
      );
      assert.match(step.hostGuestRelation.basis, /主运|客运/);
    });
  });
});

test('五步交司应保留古籍日期序号，不伪装成精确时刻', () => {
  assert.deepEqual(MOVEMENT_STEP_BOUNDARIES, [
    {
      solarTerm: '大寒',
      offsetDays: 0,
      description: '大寒日起',
      periodRule: '大寒日起，至春分后第12日',
    },
    {
      solarTerm: '春分',
      offsetDays: 13,
      description: '春分后第13日起',
      periodRule: '春分后第13日起，至芒种后第9日',
    },
    {
      solarTerm: '芒种',
      offsetDays: 10,
      description: '芒种后第10日起',
      periodRule: '芒种后第10日起，至处暑后第6日',
    },
    {
      solarTerm: '处暑',
      offsetDays: 7,
      description: '处暑后第7日起',
      periodRule: '处暑后第7日起，至立冬后第3日',
    },
    {
      solarTerm: '立冬',
      offsetDays: 4,
      description: '立冬后第4日起',
      periodRule: '立冬后第4日起，至小寒末日',
    },
  ]);
  const result = calculateWuyunLiuqi({ yearGanZhi: '丙午' });
  assert.deepEqual(
    result.movementSteps.map((step) => step.startBoundary.precision),
    Array(5).fill('传统日期序号'),
  );
  assert.match(result.limitations.join('\n'), /不把.*精确到时分秒/);
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
  assert.match(prompt, /水运（太羽），太过/);
  assert.match(prompt, /五步主客运/);
  assert.match(prompt, /初运（大寒日起，至春分后第12日）/);
  assert.match(prompt, /少阴君火/);
  assert.match(prompt, /司天与中运：不和/);
  assert.match(prompt, /大寒、立春、雨水、惊蛰/);
  assert.match(prompt, /以年干定岁运太过不及/);
  assert.match(prompt, /以年支定司天在泉/);
  assert.doesNotMatch(prompt, /参考《|《素问·天元纪大论》|《运气要诀》/);
  assert.doesNotMatch(prompt, /mingyu|API|MCP|仓库|内部字段/i);
  assertPromptIsPortableTaskText(prompt);
});
