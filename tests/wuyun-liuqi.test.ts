import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUEST_QI_ORDER,
  HOST_MOVEMENT_ORDER,
  HOST_QI_ORDER,
  MOVEMENT_STEP_BOUNDARIES,
  QI_STEP_SOLAR_TERMS,
  calculateWuyunLiuqi,
  getWuyunLiuqiYearAt,
  getWuyunLiuqiYearGanZhi,
} from '@core/wuyun-liuqi';
import {
  STEM_MOVEMENT,
  QI_PROFILES,
  BRANCH_SITIAN_ZAIQUAN,
  SUIHUI_BRANCH_ELEMENT,
} from '../packages/core/src/wuyun-liuqi/annual-data.ts';
import { SIXTY_CYCLE } from '@core/ganzhi';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const cycleResults = new Map<string, ReturnType<typeof calculateWuyunLiuqi>>();
function getCycleResult(yearGanZhi: string) {
  const cached = cycleResults.get(yearGanZhi);
  if (cached) return cached;
  const result = calculateWuyunLiuqi({ yearGanZhi });
  cycleResults.set(yearGanZhi, result);
  return result;
}

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
    const result = getCycleResult(yearGanZhi);
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
    const result = getCycleResult(yearGanZhi);
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
    const result = getCycleResult(yearGanZhi);
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
    const result = getCycleResult(yearGanZhi);
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
  const result = getCycleResult('丙午');
  assert.deepEqual(
    result.movementSteps.map((step) => step.startBoundary.precision),
    Array(5).fill('传统日期序号'),
  );
  assert.match(result.limitations.join('\n'), /不把.*精确到时分秒/);
});

test('气运相临应在六十甲子中各得十二年同气、顺化、天刑、小逆与不和', () => {
  const counts = new Map<string, number>();
  SIXTY_CYCLE.forEach((yearGanZhi) => {
    const kind = getCycleResult(yearGanZhi).annualRelation.kind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  });
  ['同气', '顺化', '天刑', '小逆', '不和'].forEach((kind) => {
    assert.equal(counts.get(kind), 12, kind);
  });
});

test('天符岁会等五类符会应按通行六十年固定集合核验', () => {
  type ConformityField = 'tianfu' | 'suihui' | 'taiyiTianfu' | 'tongTianfu' | 'tongSuihui';
  const results = new Map(
    SIXTY_CYCLE.map((yearGanZhi) => [yearGanZhi, getCycleResult(yearGanZhi)] as const),
  );
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
      (yearGanZhi) => results.get(yearGanZhi)!.annualConformities[field],
    );
    assert.deepEqual([...actual].sort(), [...years].sort(), field);
  }

  const allConformityYears = SIXTY_CYCLE.filter(
    (yearGanZhi) => results.get(yearGanZhi)!.annualConformities.names.length > 0,
  );
  assert.equal(allConformityYears.length, 26);
  assert.deepEqual(results.get('甲子')!.annualConformities.sourceReconciliation, {
    distinctYearsByListedRules: 26,
    sourceSummaryYears: 28,
    handling:
      '吴谦《运气要诀》逐项名单按六十甲子去重为26年，与原文“二十八年”汇总不一致；计算采用逐项定义和逐年名单，不用汇总数反改规则。',
  });
  assert.deepEqual(results.get('戊午')!.annualConformities.names, ['天符', '岁会', '太乙天符']);
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
  const result = getCycleResult('丙午');
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
  const normalInput = { year: 2026 };
  const originalInput = structuredClone(normalInput);
  const normalResult = calculateWuyunLiuqi(normalInput);
  assert.equal(normalResult.input.yearGanZhi, '丙午');
  assert.deepEqual(normalInput, originalInput);
  assert.throws(
    () => calculateWuyunLiuqi({ year: 2026, yearGanZhi: '乙巳' }),
    /year 与 yearGanZhi 不一致/,
  );
  assert.throws(() => calculateWuyunLiuqi({}), /必须提供 year 或 yearGanZhi/);
  assert.throws(() => calculateWuyunLiuqi({ yearGanZhi: '甲丑' }), /年干支组合无效/);

  const firstYearResult = getCycleResult('甲子');
  let yearReads = 0;
  let ganZhiReads = 0;
  const dynamicResult = calculateWuyunLiuqi({
    get year() {
      yearReads += 1;
      return yearReads === 1 ? undefined : 2025;
    },
    get yearGanZhi() {
      ganZhiReads += 1;
      return ganZhiReads === 1 ? '甲子' : '乙巳';
    },
  });
  assert.equal(yearReads, 1);
  assert.equal(ganZhiReads, 1);
  assert.equal(dynamicResult.input.year, undefined);
  assert.equal(dynamicResult.input.yearGanZhi, '甲子');
  assert.deepEqual(
    [dynamicResult.annualMovement.element, dynamicResult.annualMovement.strength],
    ['土', '太过'],
  );
  assert.deepEqual(
    [dynamicResult.sitian.name, dynamicResult.zaiquan.name],
    ['少阴君火', '阳明燥金'],
  );
  assert.deepEqual(dynamicResult, firstYearResult);
  assert.match(dynamicResult.prompt, /【任务】/);
  assert.match(dynamicResult.prompt, /年干支：甲子/);
  assert.match(dynamicResult.prompt, /土运（太宫），太过/);
  assert.equal(dynamicResult.prompt, firstYearResult.prompt);

  let invalidYearReads = 0;
  assert.throws(
    () =>
      calculateWuyunLiuqi({
        get year() {
          invalidYearReads += 1;
          return invalidYearReads === 1 ? 0 : 2026;
        },
      }),
    /公历年必须是 1-9999 之间的整数/,
  );
  assert.equal(invalidYearReads, 1);
  let invalidGanZhiReads = 0;
  assert.throws(
    () =>
      calculateWuyunLiuqi({
        get yearGanZhi() {
          invalidGanZhiReads += 1;
          return invalidGanZhiReads === 1 ? '' : '甲子';
        },
      }),
    /年干支组合无效/,
  );
  assert.equal(invalidGanZhiReads, 1);
});

test('运气年度在北京时间大寒交节瞬时切换', () => {
  const boundary = calculateWuyunLiuqi({ year: 2026 }).qiSteps[0].boundaryTime?.startTimestamp;
  assert.ok(boundary);
  assert.equal(getWuyunLiuqiYearAt(new Date(boundary - 1)), 2025);
  assert.equal(getWuyunLiuqiYearAt(new Date(boundary)), 2026);
  assert.equal(getWuyunLiuqiYearAt(new Date('2026-01-01T12:00:00+08:00')), 2025);
  assert.equal(getWuyunLiuqiYearAt(new Date('2026-07-01T12:00:00+08:00')), 2026);
});

test('五运六气应修剪显式年干支首尾空白后再校验和计算', () => {
  const result = calculateWuyunLiuqi({ year: 2026, yearGanZhi: ' 丙午 ' });
  assert.equal(result.input.yearGanZhi, '丙午');
  assert.equal(result.annualMovement.name, '水运');
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
  assert.match(prompt, /年度五行作用：中运（水）克司天少阴君火（火）（不和）/);
  assert.doesNotMatch(prompt, /司天与中运：不和/);
  assert.match(prompt, /大寒、立春、雨水、惊蛰/);
  assert.match(prompt, /以年干定岁运太过不及/);
  assert.match(prompt, /以年支定司天在泉/);
  assert.doesNotMatch(prompt, /参考《|《素问·天元纪大论》|《运气要诀》/);
  assert.doesNotMatch(prompt, /mingyu|API|MCP|仓库|内部字段/i);
  assertPromptIsPortableTaskText(prompt);

  const catalogInput = { year: 2024, question: '本年主客运气如何分层理解？' };
  const baseline = calculateWuyunLiuqi(catalogInput);
  assert.equal(baseline.input.yearGanZhi, '甲辰');
  assert.deepEqual(
    [
      baseline.annualMovement.element,
      baseline.annualMovement.toneName,
      baseline.annualMovement.strength,
    ],
    ['土', '太宫', '太过'],
  );
  assert.deepEqual([baseline.sitian.name, baseline.sitian.element], ['太阳寒水', '水']);
  assert.deepEqual([baseline.zaiquan.name, baseline.zaiquan.element], ['太阴湿土', '土']);
  assert.equal(baseline.annualConformities.suihui, true);
  assert.equal(baseline.annualConformities.tongTianfu, true);
  assert.deepEqual(
    baseline.movementSteps.map((step) => step.hostMovement.element),
    ['木', '火', '土', '金', '水'],
  );
  assert.equal(baseline.movementSteps[1].gregorianStart, '2024-04-02');
  assert.deepEqual(baseline.qiSteps[0].solarTerms, ['大寒', '立春', '雨水', '惊蛰']);
  assert.deepEqual(
    baseline.qiSteps.map((step) => step.hostQi.name),
    ['厥阴风木', '少阴君火', '少阳相火', '太阴湿土', '阳明燥金', '太阳寒水'],
  );
  assert.equal(baseline.qiSteps[2].guestQi.name, '太阳寒水');
  assert.match(baseline.prompt, /【任务】/);
  assert.match(baseline.prompt, /本年主客运气如何分层理解？/);
  assert.match(baseline.prompt, /土运（太宫），太过/);
  assert.match(baseline.prompt, /太阳寒水/);
  assertPromptIsPortableTaskText(baseline.prompt);

  // 各公开表按原对象写入并恢复，新年度盘和完整任务书不承接表的临时修改。
  const catalogWrites = [
    [STEM_MOVEMENT.甲, 'element', '木'],
    [QI_PROFILES.太阳寒水, 'element', '火'],
    [BRANCH_SITIAN_ZAIQUAN.辰, 0, '厥阴风木'],
    [SUIHUI_BRANCH_ELEMENT, '辰', '火'],
    [HOST_MOVEMENT_ORDER, 0, '水'],
    [HOST_QI_ORDER, 0, '太阳寒水'],
    [GUEST_QI_ORDER, 0, '太阳寒水'],
    [MOVEMENT_STEP_BOUNDARIES[1], 'offsetDays', 14],
    [QI_STEP_SOLAR_TERMS[0], 1, '清明'],
  ] as const;
  const originalValues = catalogWrites.map(([target, key]) => Reflect.get(target, key));
  try {
    for (const [target, key, value] of catalogWrites) {
      assert.equal(Reflect.set(target, key, value), true);
      assert.equal(Reflect.get(target, key), value);
    }
    const freshCatalog = calculateWuyunLiuqi(catalogInput);
    assert.deepEqual(freshCatalog, baseline);
    assert.equal(freshCatalog.prompt, baseline.prompt);
    assertPromptIsPortableTaskText(freshCatalog.prompt);
  } finally {
    catalogWrites.forEach(([target, key], index) => {
      assert.equal(Reflect.set(target, key, originalValues[index]), true);
      assert.equal(Reflect.get(target, key), originalValues[index]);
    });
  }
});

test('五运六气年度资料列出平气条件，不据年干支确认全年平气', () => {
  const result2026 = getCycleResult('丙午');
  assert.ok(result2026.pathomechanism);
  assert.equal(result2026.pathomechanism.isPingQi, null);
  assert.equal(result2026.pathomechanism.movementRegime, '流衍之纪');
  assert.match(result2026.prompt, /岁运纪：流衍之纪（按年干太过不及推得的基准）/);
  assert.doesNotMatch(result2026.prompt, /平气参考条件：|年度符会：/);
  assert.doesNotMatch(result2026.prompt, /五脏受候|心神亢燥|病机偏胜与平气/);

  // 丁亥具司天同气资助；交司日时逢壬的干德符及实际平气仍须另核。
  const resultDingHai = getCycleResult('丁亥');
  assert.ok(resultDingHai.pathomechanism);
  assert.equal(resultDingHai.pathomechanism.isPingQi, null);
  assert.equal(resultDingHai.pathomechanism.pingQiType, '具平气条件');
  assert.match(resultDingHai.pathomechanism.pingQiConditions.join('；'), /司天与木运同气/);
  assert.match(resultDingHai.prompt, /平气参考条件：/);
  assert.match(resultDingHai.pathomechanism.pingQiBasis, /平气成立时称敷和之纪/);
  assert.match(resultDingHai.pathomechanism.pingQiBasis, /交气日时干德符/);
});

test('具平气条件的年度提示词不把年干太过所对应之纪写成已定的实际气候', () => {
  const result = getCycleResult('庚午');
  assert.equal(result.pathomechanism?.isPingQi, null);
  assert.equal(result.pathomechanism?.movementRegime, '坚成之纪');
  assert.match(result.pathomechanism?.pingQiBasis ?? '', /按年干推得坚成之纪为基准/);
  assert.match(result.prompt, /岁运纪：坚成之纪（按年干太过不及推得的基准）；平气参考条件：/);
});

test('五运六气跨节气精度范围保留完整年度结构并省略计算状态', () => {
  for (const year of [1, 99, 1899, 2200, 9999]) {
    const result = calculateWuyunLiuqi({ year });
    const reference = calculateWuyunLiuqi({ yearGanZhi: getWuyunLiuqiYearGanZhi(year) });
    assert.equal(result.calendarDateStatus, '节令边界');
    assert.deepEqual(result.annualMovement, reference.annualMovement);
    assert.deepEqual(result.movementSteps, reference.movementSteps);
    assert.deepEqual(result.qiSteps, reference.qiSteps);
    assert.equal(result.movementSteps.length, 5);
    assert.equal(result.qiSteps.length, 6);
    assert.ok(
      [...result.movementSteps, ...result.qiSteps].every(
        (step) => step.gregorianStart === undefined && step.gregorianEnd === undefined,
      ),
    );
    assert.match(result.prompt, /运气年度：大寒节令起，至次年大寒节令前/);
    assert.doesNotMatch(result.prompt, /日期口径：/);
  }
  for (const year of [1900, 2199]) {
    const result = calculateWuyunLiuqi({ year });
    assert.equal(result.calendarDateStatus, '公历日期已换算');
    assert.ok(
      [...result.movementSteps, ...result.qiSteps].every(
        (step) => step.gregorianStart && step.gregorianEnd,
      ),
    );
    assert.ok(result.qiSteps[5].gregorianEnd?.startsWith(`${year + 1}-01-`));
    assert.match(result.prompt, /现代节气交节参考（北京时间）/);
  }
});

test('六十甲子二火加临保留君臣顺逆并与五行同气分别表达', () => {
  for (const yearGanZhi of SIXTY_CYCLE) {
    const result = getCycleResult(yearGanZhi);
    for (const step of result.qiSteps) {
      const expected =
        '子午'.includes(yearGanZhi[1]) && step.order === 3
          ? '君位臣则顺'
          : '卯酉'.includes(yearGanZhi[1]) && step.order === 2
            ? '臣位君则逆'
            : undefined;
      assert.equal(step.hostGuestRelation.fireOrder, expected, `${yearGanZhi}${step.label}`);
      if (expected) {
        assert.equal(step.hostGuestRelation.kind, '同气');
        assert.ok(step.hostGuestRelation.basis.includes(expected));
        assert.ok(result.prompt.includes(`二火加临：${expected}`));
      }
    }
  }
});

test('运气要诀六十年正对化与南北政按各自年支年干分类', () => {
  const transformations = [
    '对化',
    '对化',
    '正化',
    '对化',
    '对化',
    '对化',
    '正化',
    '正化',
    '对化',
    '正化',
    '正化',
    '正化',
  ];
  const governance = [
    '南政',
    '北政',
    '北政',
    '北政',
    '北政',
    '南政',
    '北政',
    '北政',
    '北政',
    '北政',
  ];
  for (let index = 0; index < SIXTY_CYCLE.length; index += 1) {
    const result = getCycleResult(SIXTY_CYCLE[index]);
    assert.equal(result.annualClassification.sitianTransformation, transformations[index % 12]);
    assert.equal(result.annualClassification.governance, governance[index % 10]);
    assert.ok(
      result.prompt.includes(
        `司天化令：${transformations[index % 12]}；南北政：${governance[index % 10]}`,
      ),
    );
    assert.equal(result.pathomechanism!.isPingQi, null);
  }
});
