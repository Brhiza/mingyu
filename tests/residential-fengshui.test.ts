import test from 'node:test';
import assert from 'node:assert/strict';
import { NINE_STAR_WUXING } from '../packages/core/src/ba_zhai/suppression.ts';
import { MOUNTAIN_PROFILES } from '../packages/core/src/xuan_kong/castle-gate.ts';
import { FLYING_STAR_WUXING } from '../packages/core/src/xuan_kong/period-stars.ts';
import { analyzeBaZhaiByDoorDegree } from '../packages/core/src/ba_zhai/index.ts';
import { PROMPT_GUIDANCE_TEXT } from '../packages/core/src/prompt/guidance.ts';
import { buildMetaphysicsPrompt } from '../packages/core/src/prompt/metaphysics.ts';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';
import { buildResidentialCoreInput } from '../src/lib/residential-fengshui-chart.ts';
import { assertPromptHasSingleRole, assertPromptIsPortableTaskText } from './prompt-assertions.ts';

test('住宅合参显式空命卦与山向必须报错', () => {
  assert.throws(
    () => generateResidentialFengshui({ birthYear: 1990, gender: 'male', mingGua: '' }),
    /八卦无效/,
  );
  for (const orientation of [
    { sitMountain: '', facingMountain: '午' },
    { sitMountain: '子', facingMountain: '' },
  ]) {
    assert.throws(
      () => generateResidentialFengshui({ year: 2024, mingGua: '坎', ...orientation }),
      /有效二十四山/,
    );
  }
});

test('八宅与住宅核心盘及在线包装各保留一份完整任务', () => {
  const measurement = {
    doorToInteriorDegree: 64,
    northReference: 'magnetic' as const,
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  };
  const cases = [
    {
      method: 'bazhai' as const,
      core: analyzeBaZhaiByDoorDegree({ mingGua: '坎', ...measurement }),
    },
    {
      method: 'residential' as const,
      core: generateResidentialFengshui({ mingGua: '坎', year: 2024, ...measurement }),
    },
  ];
  for (const { method, core } of cases) {
    assert.equal(core.prompt.match(/^【任务】$/gm)?.length, 1);
    assert.equal(core.prompt.match(/^【盘面资料】$/gm)?.length, 1);
    assert.equal(core.prompt.match(/^【传统依据】$/gm)?.length, 1);
    const prompt = buildMetaphysicsPrompt(core.prompt, '办公方位怎样安排？', {
      method,
      topicId: 'family',
      subtopicId: 'home',
      scope: 'natal',
    });
    assert.equal(prompt.match(/^【任务】$/gm)?.length, 1);
    assert.equal(prompt.match(/^【传统依据】$/gm)?.length, 1);
    assertPromptHasSingleRole(prompt, PROMPT_GUIDANCE_TEXT[method]);
    assert.match(prompt, /【当前时间】/);
    assert.doesNotMatch(prompt, /【测量换算】/);
    assert.equal(prompt.match(/读数64°/g)?.length, 1);
    assert.equal(prompt.match(/磁偏角1°/g)?.length, 1);
    assert.match(prompt, /【解读选择】[\s\S]*主题细项：家宅与居住/);
    assert.match(prompt, /请围绕【解读选择】所列主题和范围解释本次盘面。请直接回答【问题】。/);
    assert.match(prompt, /【问题】\n办公方位怎样安排？/);
    assert.match(prompt, /候选坐向：寅山申向/);
    assert.match(prompt, /候选震宅八方：/);
    assert.match(prompt, /^命宅五行：宅卦克命卦。$/mu);
    assert.doesNotMatch(prompt, /^命宅关系：|^坐山：/mu);
    assert.equal(prompt.split('命卦：坎（东四命）').length - 1, 1);
    assert.equal(prompt.split('宅卦：艮（西四宅，中心读数）').length - 1, 1);
    assertPromptIsPortableTaskText(prompt);
  }
});

test('住宅统一入口把已知出生时分传给八宅立春年界', () => {
  const input = buildResidentialCoreInput({
    birthData: { year: 2024, month: 2, day: 4, hour: 16, minute: 30, gender: 'male' },
  });
  const result = generateResidentialFengshui(input);
  assert.equal(input.birthHour, 16);
  assert.equal(result.bazhai?.mingGua, '震');
  assert.match(result.prompt, /已按出生时分（UTC\+08:00）与立春瞬时核定/);
  assert.doesNotMatch(result.prompt, /未提供出生时刻/);

  for (const [field, error] of [
    ['birthMonth', /出生月份需在 1-12/u],
    ['birthDay', /出生日期需在 1-29/u],
    ['birthHour', /出生小时需在 0-23/u],
    ['birthMinute', /出生分钟需在 0-59/u],
    ['birthSecond', /出生秒数需在 0-59/u],
    ['birthTimezone', /出生时区需在 UTC-12 至 UTC\+14/u],
  ] as const) {
    assert.throws(
      () => generateResidentialFengshui({ ...input, birthSecond: 0, [field]: null }),
      error,
    );
  }
  for (const birthTimeZoneId of ['', false, 0, null]) {
    assert.throws(
      () =>
        generateResidentialFengshui({
          ...input,
          birthTimeZoneId: birthTimeZoneId as unknown as string,
        }),
      /IANA 时区名不能为空|timeZoneId 必须是 IANA 时区名称/u,
    );
  }
  for (const patch of [
    { birthMonth: null, birthDay: null },
    { birthHour: null, birthMinute: undefined },
    { birthMinute: null },
  ]) {
    assert.throws(
      () => generateResidentialFengshui({ ...input, ...patch } as never),
      /出生月份需在|出生小时需在|出生分钟需在/u,
    );
  }

  const zeroClock = generateResidentialFengshui({
    ...input,
    birthHour: 0,
    birthMinute: 0,
    birthSecond: 0,
    birthTimezone: 0,
  });
  assert.equal(zeroClock.bazhai?.effectiveBirthYear, 2023);
  assert.equal(zeroClock.bazhai?.mingGua, '巽');
  assert.equal(zeroClock.bazhai?.calculationInput.birthTimezone, 0);
  assert.equal(zeroClock.bazhai?.calculationInput.birthHour, 0);
  assert.equal(zeroClock.bazhai?.calculationInput.birthMinute, 0);
  assert.equal(zeroClock.bazhai?.calculationInput.birthSecond, 0);
  assert.match(zeroClock.prompt, /民用时刻0时0分0秒，取时按UTC\+00:00/u);
  assert.equal(
    generateResidentialFengshui({
      ...input,
      mingGua: '坎',
      birthHour: null,
      birthTimeZoneId: '',
    } as never).bazhai?.mingGua,
    '坎',
  );
});

test('住宅合参与在线任务书把原出生钟表和年界候选作为同一居住人事实', () => {
  const cases = [
    {
      birth: {
        birthYear: 2024,
        birthMonth: 2,
        birthDay: 3,
        birthHour: 23,
        birthMinute: 0,
        birthSecond: 0,
        birthTimezone: -12,
        gender: 'male' as const,
      },
      birthFact: '命卦取年资料：男，公历2024年2月3日；民用时刻23时0分0秒，取时按UTC-12:00。',
      year: 2024,
      gua: '震',
      boundary: /出生时刻已过 2024 年立春/,
    },
    {
      birth: {
        birthYear: 2024,
        birthMonth: 2,
        birthDay: 4,
        birthHour: 16,
        birthMinute: 27,
        gender: 'female' as const,
      },
      birthFact:
        '命卦取年资料：女，公历2024年2月4日；民用时刻16时27分（秒数未提供），取时按UTC+08:00。',
      year: 2023,
      gua: '坤',
      boundary: /候选命卦：2023年坤命、2024年震命/,
    },
  ];
  for (const { birth, birthFact, year, gua, boundary } of cases) {
    const result = generateResidentialFengshui({ ...birth, year: 2008, sitMountain: '子' });
    assert.equal(result.bazhai?.effectiveBirthYear, year);
    assert.equal(result.bazhai?.mingGua, gua);
    assert.equal(result.bazhai?.calculationInput.birthDay, birth.birthDay);
    assert.equal(result.bazhai?.calculationInput.birthHour, birth.birthHour);
    const onlinePrompt = buildMetaphysicsPrompt(
      result.prompt,
      '立春附近的命卦与住宅方位如何理解？',
      { method: 'residential' },
    );
    for (const prompt of [result.prompt, onlinePrompt]) {
      assert.equal(prompt.split('\n').filter((line) => line === birthFact).length, 1);
      assert.match(prompt, boundary);
      assert.match(prompt, /玄空完整盘面：[\s\S]*下元8运（2004-2023）/);
      assertPromptIsPortableTaskText(prompt);
    }
  }
});

test('住宅网页输入把已知出生秒数传给八宅立春年界', () => {
  const input = buildResidentialCoreInput({
    birthData: { year: 2024, month: 2, day: 4, hour: 16, minute: 27, second: 8, gender: 'male' },
  });
  const result = generateResidentialFengshui(input);
  assert.equal(input.birthSecond, 8);
  assert.equal(result.bazhai?.birthYearBoundaryStatus, '已核定');
  assert.equal(result.bazhai?.mingGua, '震');
  assert.match(result.prompt, /已按出生时分秒/);
});

test('住宅门向与额外坐向必须描述同一住宅，不能分别用于八宅和玄空', () => {
  for (const mingGua of [undefined, '坎']) {
    for (const extra of [
      { facingDegree: 0 },
      { sitDegree: 180 },
      { sitMountain: '子' },
      { facingMountain: '午' },
    ]) {
      assert.throws(
        () =>
          generateResidentialFengshui({
            mingGua,
            year: 2024,
            doorToInteriorDegree: 90,
            ...extra,
          }),
        /不一致|相差180度/,
      );
    }
  }
});

test('住宅合参保留跨宅卦误差候选测量结果', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    gender: 'male',
    year: 2024,
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.ok(result.bazhai && 'directionMeasurement' in result.bazhai);
  assert.equal(result.bazhai.directionMeasurement.stability, '宅卦不稳定');
  assert.deepEqual(
    result.bazhai.directionMeasurement.candidateDirections.map((item) => [
      item.sitMountain,
      item.houseGua,
      item.housePalace.length,
    ]),
    [
      ['寅', '艮', 8],
      ['甲', '震', 8],
    ],
  );
});

test('测量误差跨东四宅与西四宅时，合参不把中心命宅关系写成定论', () => {
  const result = generateResidentialFengshui({
    mingGua: '坎',
    year: 2024,
    doorToInteriorDegree: 65,
    measurementUncertaintyDegrees: 3,
  });

  assert.equal(result.bazhai?.match, '相冲');
  assert.ok(result.bazhai && 'directionMeasurement' in result.bazhai);
  assert.deepEqual(
    result.bazhai.directionMeasurement.candidateDirections.map((item) => [
      item.houseGua,
      item.match,
    ]),
    [
      ['艮', '相冲'],
      ['震', '相合'],
    ],
  );
  assert.ok(result.agreements.some((item) => item.title === '命宅关系随候选坐向变化'));
  assert.ok(result.agreements.every((item) => item.title !== '命宅不同组需分开说明'));
  assert.match(result.advice.join('\n'), /候选坐向命宅关系相冲或相合/);
  assert.doesNotMatch(result.evidencePromptText, /，命宅关系相冲/);
  assert.match(result.evidencePromptText, /候选命宅关系相冲或相合/);
});

test('缺少宅运年份时仍按已有朝向或坐向独立计算八宅宅卦', () => {
  for (const orientation of [
    { sitMountain: '子' },
    { facingMountain: '午' },
    { sitDegree: 0 },
    { facingDegree: 180 },
  ]) {
    const result = generateResidentialFengshui({ mingGua: '坎', ...orientation });
    assert.equal(result.bazhai?.houseGua, '坎');
    assert.equal(result.bazhai?.match, '相合');
    assert.equal(result.xuankong, null);
    assert.equal(result.inputSummary.hasHouseOrientation, true);
    assert.equal(result.inputSummary.orientationText, '坐子向午');
    assert.match(result.prompt, /宅卦：坎/);
  }
  assert.throws(
    () =>
      generateResidentialFengshui({
        mingGua: '坎',
        sitMountain: '子',
        facingMountain: '酉',
      }),
    /严格相对/,
  );
});

test('住宅坐向度数与等效门向使用相同磁偏角并保留测量候选', () => {
  const input = {
    mingGua: '坎',
    year: 2024,
    northReference: 'magnetic' as const,
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  };
  const door = generateResidentialFengshui({ ...input, doorToInteriorDegree: 21 });
  const facing = generateResidentialFengshui({ ...input, facingDegree: 201 });
  const all = generateResidentialFengshui({
    ...input,
    doorToInteriorDegree: 21,
    sitDegree: 21,
    facingDegree: 201,
  });
  assert.deepEqual(facing.xuankong?.plates, door.xuankong?.plates);
  assert.deepEqual(all.xuankong?.measurement, door.xuankong?.measurement);
  assert.equal(facing.xuankong?.measurement?.sitDegree, 22);
  assert.equal(facing.bazhai?.evidenceAnalysis.measurementFact.status, '宅卦不稳定');
  assert.deepEqual(
    facing.bazhai?.evidenceAnalysis.measurementFact.candidates,
    door.bazhai?.evidenceAnalysis.measurementFact.candidates,
  );
  assert.equal(facing.bazhai?.evidenceAnalysis.measurementFact.method, '按住宅坐山度数换算');
});

test('住宅合参保留各方向完整盘面并只呈现一次', () => {
  const directions = {
    坎: '北',
    艮: '东北',
    震: '东',
    巽: '东南',
    离: '南',
    坤: '西南',
    兑: '西',
    乾: '西北',
  };
  for (const mingGua of Object.keys(directions)) {
    const result = generateResidentialFengshui({ mingGua, year: 2024, sitMountain: '子' });
    const lines = result.prompt.split('\n');
    for (const [gua, direction] of Object.entries(directions)) {
      const palace = result.bazhai!.mingPalace.find((item) => item.gua === gua)!;
      const flying = result.xuankong!.palaces.find((item) => item.name.startsWith(gua))!;
      assert.equal(flying.direction, direction);
      const matching = lines.filter((line) => line.startsWith(`${flying.name}（${direction}）：`));
      assert.equal(matching.length, 1, `${mingGua}命${gua}宫完整飞星只呈现一次`);
      assert.ok(matching[0].includes(`运${flying.yunStar}（`));
      assert.ok(matching[0].includes(`山${flying.shanStar}（`));
      assert.ok(matching[0].includes(`向${flying.xiangStar}（`));
      assert.ok(result.prompt.includes(`${palace.direction}${palace.label}（${palace.luck}`));
    }
    for (const chart of [result.xuankong!, result.bazhai!]) {
      const chartPrompt = chart.prompt.split('【盘面资料】\n')[1];
      const facts = chartPrompt.split('\n').filter((line) => !/^【.+】$/.test(line.trim()));
      for (const fact of facts) assert.ok(result.prompt.includes(fact));
    }
    assert.doesNotMatch(result.prompt, /方位合参：|^玄空：|^八宅：/m);
  }

  const input = {
    year: 2008,
    mingGua: '坎',
    sitMountain: '子',
    facingMountain: '午',
    flowYear: 2025,
    flowMonth: 6,
    flowDay: 15,
  };
  const baseline = generateResidentialFengshui(input);
  const promptOptions = {
    method: 'residential' as const,
    currentTime: new Date('2025-06-15T04:00:00Z'),
  };
  const question = '本宅星宫关系与城门如何解读？';
  const baselineTaskbook = buildMetaphysicsPrompt(baseline.prompt, question, promptOptions);
  assert.match(baseline.prompt, /东南巽宫木：生气贪狼木，星与宫比和。/u);
  assert.match(baseline.prompt, /山向生入：向星6金生山星1水/u);
  assert.match(baseline.prompt, /正城门巽方旺星到位/u);
  assert.equal(
    baseline.bazhai?.gasRegulation?.suppressionLaws.find((fact) => fact.star.startsWith('生气'))
      ?.element,
    '木',
  );
  assert.equal(
    baseline.xuankong?.palaces.find((palace) => palace.gong === 2)?.shanXiangRelation,
    '生入',
  );
  assertPromptIsPortableTaskText(baselineTaskbook);
  assert.match(baselineTaskbook, /【盘面资料】[\s\S]*玄空完整盘面：[\s\S]*八宅完整盘面：/u);
  assert.match(baselineTaskbook, /【传统依据】/u);
  const original = {
    lifeElement: NINE_STAR_WUXING.生气.element,
    flyingElement: FLYING_STAR_WUXING[1],
    facingGong: MOUNTAIN_PROFILES.午.gong,
  };
  try {
    NINE_STAR_WUXING.生气.element = '水';
    FLYING_STAR_WUXING[1] = '火';
    MOUNTAIN_PROFILES.午.gong = 1;
    assert.equal(NINE_STAR_WUXING.生气.element, '水');
    assert.equal(FLYING_STAR_WUXING[1], '火');
    assert.equal(MOUNTAIN_PROFILES.午.gong, 1);
    const fresh = generateResidentialFengshui(input);
    assert.deepEqual(fresh, baseline);
    assert.equal(fresh.prompt, baseline.prompt);
    assert.equal(buildMetaphysicsPrompt(fresh.prompt, question, promptOptions), baselineTaskbook);
  } finally {
    NINE_STAR_WUXING.生气.element = original.lifeElement;
    FLYING_STAR_WUXING[1] = original.flyingElement;
    MOUNTAIN_PROFILES.午.gong = original.facingGong;
  }
});

test('住宅风水保留显式山名并拒绝与坐向度数冲突', () => {
  for (const extra of [{ sitMountain: '卯' }, { facingMountain: '酉' }, { facingDegree: 181 }]) {
    assert.throws(
      () => generateResidentialFengshui({ year: 2024, sitDegree: 0, ...extra }),
      /不一致|相差180度/,
    );
  }
  const result = generateResidentialFengshui({
    year: 2024,
    sitDegree: 0,
    sitMountain: '子',
    facingMountain: '午',
  });
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.xuankong?.facingMountain, '午');
});

test('住宅风水入口传递替卦并保留玄空替星完整盘面', () => {
  const result = generateResidentialFengshui({
    year: 2008,
    sitDegree: 339,
    facingDegree: 159,
    guaType: '替卦',
  });
  assert.equal(result.xuankong?.guaType, '替卦');
  assert.equal(result.xuankong?.replacement?.mountain.referenceMountain, '辰');
  assert.equal(result.xuankong?.replacement?.facing.referenceMountain, '甲');
  assert.match(result.prompt, /玄空完整盘面：[\s\S]*卦型：替卦/);
});

test('添加居住人资料不改变门向测量及玄空候选山向', () => {
  const input = {
    year: 2024,
    doorToInteriorDegree: 64,
    northReference: 'magnetic' as const,
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  };
  const alone = generateResidentialFengshui(input);
  const withPerson = generateResidentialFengshui({ ...input, mingGua: '坎' });
  assert.equal(alone.bazhai, null);
  assert.ok(alone.xuankong);
  assert.equal(alone.xuankong.measurement?.sitDegree, 65);
  assert.equal(alone.xuankong.sitMountain, '寅');
  assert.equal(alone.xuankong.facingMountain, '申');
  assert.ok(alone.xuankong.measurement?.candidateMountains?.length === 2);
  assert.equal(alone.xuankong?.measurement?.stability, '山向边界敏感');
  assert.deepEqual(withPerson.xuankong?.measurement, alone.xuankong?.measurement);
  assert.deepEqual(withPerson.xuankong?.plates, alone.xuankong?.plates);
  for (const result of [alone, withPerson]) {
    const prompt = buildMetaphysicsPrompt(result.prompt, '住宅坐向如何解读？', {
      method: 'residential',
      scope: 'natal',
    });
    assert.equal(prompt.split('读数64°').length - 1, 1);
    assert.equal(prompt.split('磁偏角1°').length - 1, 1);
    assert.match(prompt, /北向基准磁北/);
    assert.match(prompt, /测量资料：坐山65°、朝向245°、误差±3°/);
  }
  assert.match(alone.prompt, /坐向角度已换算为真北/);
  assert.doesNotMatch(withPerson.prompt, /原始测向：/);
  assert.match(withPerson.prompt, /候选山向/);
  assert.match(withPerson.agreements[0].detail, /中心读数盘，待复测核定/);
  assert.match(withPerson.advice[0], /中心读数盘，待复测核定/);
  assert.match(withPerson.evidencePromptText, /中心读数盘，待复测核定/);
  assert.ok(withPerson.agreements.every((item) => item.level !== '一致关注'));
});

test('住宅风水仅有出生信息时可出八宅，不出玄空', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
  });
  assert.equal(result.key, 'residential-fengshui');
  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.match(result.prompt, /八宅/);
  assert.match(result.prompt, /^【任务】\n请依据以下八宅命卦资料/);
  assert.match(result.prompt, /玄空：未排盘/);
  assert.equal(result.inputSummary.xuankongStatus, '缺少山向');
});

test('仅有命卦和住宅年份时提示词将年份标为输入资料而非已排宅运', () => {
  const result = generateResidentialFengshui({ mingGua: '坎', year: 2024 });

  assert.equal(result.xuankong, null);
  assert.equal(result.inputSummary.houseYear, 2024);
  assert.match(result.prompt, /提供的住宅建造年或起运年：2024/);
  assert.doesNotMatch(result.prompt, /宅运年份：2024/);
  assert.match(result.prompt, /玄空：未排盘/);
});

test('住宅风水有居住人与山向但缺少建造或起运年时不得静默套用当前年', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    sitMountain: '子',
  });

  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.equal(result.inputSummary.houseYear, null);
  assert.equal(result.inputSummary.xuankongStatus, '缺少建造年或起运年');
  assert.ok(result.agreements.some((item) => /缺少住宅建造年或起运年/.test(item.detail)));
  assert.ok(result.advice.some((item) => /补充住宅建造年或起运年/.test(item)));
  assert.match(result.prompt, /玄空：未排盘（缺少建造年或起运年）/);
  assert.doesNotMatch(result.prompt, new RegExp(`宅运年份：${new Date().getFullYear()}`));
});

test('住宅风水只有山向却缺少建造或起运年时应明确报错', () => {
  assert.throws(
    () => generateResidentialFengshui({ sitMountain: '子' }),
    /必须提供住宅建造年或起运年/,
  );
});

test('住宅风水仅有山向时可出玄空，不出八宅', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    sitMountain: '子',
  });
  assert.ok(result.xuankong);
  assert.equal(result.bazhai, null);
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.inputSummary.xuankongStatus, '已排盘');
  assert.match(result.prompt, /玄空/);
  assert.match(result.prompt, /^【任务】\n请依据以下玄空宅运盘/);
});

test('住宅风水不得静默忽略已填写但不完整的居住人资料', () => {
  const house = { year: 2024, sitMountain: '子' };
  assert.throws(
    () => generateResidentialFengshui({ ...house, birthYear: 1990 }),
    /居住人资料需提供出生年与性别/,
  );
  assert.throws(
    () => generateResidentialFengshui({ ...house, gender: 'male' }),
    /居住人资料需提供出生年与性别/,
  );
  assert.throws(
    () => generateResidentialFengshui({ mingGua: '坎', year: 0 }),
    /住宅建造年或起运年/,
  );
});

test('住宅风水门向度数会同步八宅与玄空山向', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.ok(result.bazhai?.houseGua);
  assert.ok(result.xuankong);
  assert.ok(result.agreements.length >= 1);
  assert.ok(result.advice.length >= 1);
  assert.ok(result.bazhai && 'directionMeasurement' in result.bazhai);
  assert.equal(result.xuankong?.sitMountain, result.bazhai.directionMeasurement.sitMountain);
  assert.equal(result.xuankong?.facingMountain, result.bazhai.directionMeasurement.facingMountain);
  assert.match(result.prompt, /玄空完整盘面：/);
  assert.match(result.prompt, /三盘九宫：/);
  assert.match(result.prompt, /八宅完整盘面：/);
  assert.match(result.prompt, /命卦八方：/);
  assert.match(result.prompt, /宅卦八方：/);
  assert.match(result.prompt, /^【任务】\n请依据以下玄空宅运盘与八宅人宅盘/);
  assert.equal(result.prompt.match(/【任务】/g)?.length, 1);
  assert.doesNotMatch(result.prompt, /合参要点|命宅相合可提高关注优先级/);
});

test('住宅风水缺少山向与居住人时应报错', () => {
  assert.throws(() => generateResidentialFengshui({}), /至少需要提供山向|出生年/);
});

test('住宅风水仅有门向度数时可出玄空，不依赖出生信息', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.equal(result.bazhai, null);
  assert.ok(result.xuankong);
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.xuankong?.facingMountain, '午');
  assert.match(result.prompt, /仅完成玄空宅运层|玄空/);
  assert.match(result.prompt, /原始测向：站在大门处面向屋内测量，读数0°，北向基准未声明/);
  assert.equal(result.prompt.split('北向基准未声明').length - 1, 1);
  assert.equal(result.prompt.split('按原始读数暂列').length - 1, 1);
  assert.equal(result.prompt.split('补充磁北或真北基准后复核').length - 1, 1);
  assert.doesNotMatch(result.prompt, /玄空角度盘按原始读数暂排/);
  assert.match(result.prompt, /测量资料：坐山0°、朝向180°、误差±0°/);
  for (const [measurement, rawText] of [
    [{ sitDegree: 70 }, '坐山读数70°'],
    [{ facingDegree: 250 }, '朝向读数250°'],
  ] as const) {
    const magnetic = generateResidentialFengshui({
      year: 2008,
      ...measurement,
      northReference: 'magnetic',
      magneticDeclinationDegrees: -20,
    });
    assert.equal(magnetic.bazhai, null);
    assert.equal(magnetic.xuankong?.sitMountain, '艮');
    assert.equal(magnetic.xuankong?.facingMountain, '坤');
    assert.equal(magnetic.xuankong?.measurement?.sitDegree, 50);
    assert.equal(magnetic.xuankong?.measurement?.facingDegree, 230);
    const prompt = buildMetaphysicsPrompt(magnetic.prompt, '住宅坐向如何解读？', {
      method: 'residential',
      scope: 'natal',
    });
    assert.equal(prompt.split(rawText).length - 1, 1);
    assert.equal(prompt.split('磁偏角-20°').length - 1, 1);
    assert.match(prompt, /北向基准磁北[\s\S]*坐向角度已换算为真北/);
    assert.match(prompt, /测量资料：坐山50°、朝向230°、误差±0°/);
  }
});

test('住宅合参未声明北向时将玄空角度盘标为原始读数暂算', () => {
  const result = generateResidentialFengshui({
    mingGua: '坎',
    year: 2024,
    doorToInteriorDegree: 0,
  });

  assert.ok(result.xuankong);
  assert.equal(result.xuankong.sitMountain, '子');
  assert.match(result.prompt, /坐向北向基准未声明；玄空角度盘按原始读数暂排/);
  assert.match(result.evidencePromptText, /坐向角度按原始读数暂排/);
  assert.equal(result.prompt.match(/北向基准未声明/g)?.length, 1);
});

test('住宅风水无居住人时门向测量参数应执行与八宅一致的校验', () => {
  for (const input of [
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'magnetic' as const,
    },
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'true' as const,
      magneticDeclinationDegrees: 1,
    },
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'invalid' as never,
    },
    {
      year: 2024,
      doorToInteriorDegree: 361,
    },
  ]) {
    assert.throws(() => generateResidentialFengshui(input));
  }
});

test('住宅跨公元元年的运期在主提示词和结构化证据中使用可读纪年', () => {
  const result = generateResidentialFengshui({ year: 1, sitMountain: '子' });

  assert.ok(result.xuankong);
  assert.equal(result.xuankong.period.startYear, -17);
  assert.equal(result.xuankong.period.endYear, 3);
  assert.match(result.prompt, /中元6运（公元前17年—公元3年）/);
  assert.match(result.evidencePromptText, /中元6运（公元前17年—公元3年）/);
});
