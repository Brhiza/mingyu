import test from 'node:test';
import assert from 'node:assert/strict';
import { astro } from 'iztro';
import { SolarDay } from 'tyme4ts';

import {
  buildAstrolabeFromInput,
  buildAnalysisPayloadV1,
  buildHoroscope,
  buildHoroscopeFromInput,
  buildVerifiedDecadalTimelineOptions,
  buildZiweiCalculationConfig,
  findCurrentDecadalOption,
  getDefaultHoroscopeContext,
  resolveIztroAstro,
  shiftLocalDate,
  shiftLunarYear,
} from '@core/ziwei/iztro';

const DEFAULT_CHART_INPUT = {
  name: '测试',
  dateType: 'solar' as const,
  birthDate: '1998-08-13',
  birthTimeIndex: 0,
  gender: '女' as const,
  isLeapMonth: false,
  fixLeap: true,
  algorithm: 'default' as const,
  yearDivide: 'normal' as const,
  horoscopeDivide: 'normal' as const,
  ageDivide: 'normal' as const,
  dayDivide: 'forward' as const,
};

test('紫微运行期应兼容 Node、Vite 与 Webpack 的 CommonJS 导出包装', () => {
  assert.equal(resolveIztroAstro({ astro }), astro);
  assert.equal(resolveIztroAstro({ default: { astro } }), astro);
  assert.equal(resolveIztroAstro({ default: astro }), astro);
  assert.equal(resolveIztroAstro({ default: { default: { astro } } }), astro);
  assert.throws(() => resolveIztroAstro({ default: {} }), /未提供可用的紫微排盘入口/);
});

function resetIztroDefaultConfig() {
  astro.config({
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  });
}

function astrolabeSignature(astrolabe: Awaited<ReturnType<typeof buildAstrolabeFromInput>>) {
  return {
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    rawDates: astrolabe.rawDates,
    palaces: astrolabe.palaces.map((palace) => ({
      index: palace.index,
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      majorStars: palace.majorStars.map((star) => ({
        name: star.name,
        brightness: star.brightness,
        mutagen: star.mutagen,
      })),
      minorStars: palace.minorStars.map((star) => ({
        name: star.name,
        brightness: star.brightness,
        mutagen: star.mutagen,
      })),
    })),
  };
}

function getLunarParts(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const lunarDay = SolarDay.fromYmd(year, month, day).getLunarDay();
  const lunarMonth = lunarDay.getLunarMonth();

  return {
    year: lunarMonth.getYear(),
    monthWithLeap: lunarMonth.getMonthWithLeap(),
    day: lunarDay.getDay(),
  };
}

test('紫微运行期日期位移应保持合法日期并处理月底', () => {
  assert.equal(shiftLocalDate('2024-02-29', 1, 'year'), '2025-02-28');
  assert.equal(shiftLocalDate('2024-01-31', 1, 'month'), '2024-02-29');
  assert.equal(shiftLocalDate('2024-02-29', 1, 'day'), '2024-03-01');
  assert.equal(shiftLocalDate('2024-03-31', -1, 'month'), '2024-02-29');
  assert.equal(shiftLocalDate('2024-03-01', -1, 'day'), '2024-02-29');
});

test('紫微运行期日期位移不应因目标年份超过出生日期范围而失败', () => {
  assert.equal(shiftLocalDate('2096-02-29', 5, 'year'), '2101-02-28');
  assert.equal(shiftLocalDate('2098-01-31', 37, 'month'), '2101-02-28');
});

test('紫微运行期日期位移应拒绝非法日期字符串', () => {
  assert.throws(() => shiftLocalDate(20240229 as never, 1, 'year'), /日期格式需为 YYYY-MM-DD/);
  assert.throws(() => shiftLocalDate('2024/02/29', 1, 'year'), /日期格式需为 YYYY-MM-DD/);
  assert.throws(() => shiftLocalDate('2024-02-31', 1, 'year'), /日期需在 1-29 之间/);
  assert.throws(() => shiftLocalDate('1899-01-01', 1, 'year'), /年份需在 1900-2100 之间/);
  assert.throws(() => shiftLocalDate('2024-13-01', 1, 'year'), /月份需在 1-12 之间/);
});

test('紫微默认行运上下文应拒绝无效当前时间', () => {
  assert.throws(() => getDefaultHoroscopeContext(new Date(Number.NaN)), /当前时间不是有效日期/);
});

test('紫微默认行运上下文应按东八区分钟边界换算时辰', () => {
  assert.deepEqual(getDefaultHoroscopeContext(new Date('2024-02-19T14:59:00.000Z')), {
    dateStr: '2024-02-19',
    hourIndex: 11,
  });
  assert.deepEqual(getDefaultHoroscopeContext(new Date('2024-02-19T15:00:00.000Z')), {
    dateStr: '2024-02-19',
    hourIndex: 12,
  });
  assert.deepEqual(getDefaultHoroscopeContext(new Date('2024-02-19T16:00:00.000Z')), {
    dateStr: '2024-02-20',
    hourIndex: 0,
  });
});

test('紫微排盘封装应补齐 iztro 默认配置，避免前一次排盘配置串到后一次', async () => {
  await buildAstrolabeFromInput({
    ...DEFAULT_CHART_INPUT,
    algorithm: 'zhongzhou',
  });

  const implicitDefault = await buildAstrolabeFromInput({
    name: DEFAULT_CHART_INPUT.name,
    dateType: DEFAULT_CHART_INPUT.dateType,
    birthDate: DEFAULT_CHART_INPUT.birthDate,
    birthTimeIndex: DEFAULT_CHART_INPUT.birthTimeIndex,
    gender: DEFAULT_CHART_INPUT.gender,
    isLeapMonth: DEFAULT_CHART_INPUT.isLeapMonth,
    fixLeap: DEFAULT_CHART_INPUT.fixLeap,
  });
  const explicitDefault = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);

  assert.equal(
    JSON.stringify(astrolabeSignature(implicitDefault)),
    JSON.stringify(astrolabeSignature(explicitDefault)),
  );
});

test('紫微排盘封装应拒绝 iztro 会宽松接受的非法出生输入', async () => {
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, birthDate: 19980813 as never }),
    /出生日期必须是文本/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, birthDate: '1998/08/13' }),
    /出生日期格式需为 YYYY-MM-DD/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, birthDate: '1998-02-31' }),
    /日期需在 1-28 之间/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, birthDate: '1998-13-01' }),
    /出生月份需在 1-12 之间/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, birthTimeIndex: -1 }),
    /出生时辰需在 0-12 之间/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, gender: '未知' as '女' }),
    /性别必须是男或女/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, algorithm: 'bad' as 'default' }),
    /紫微排盘算法必须是 default 或 zhongzhou/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, yearDivide: 'bad' as 'normal' }),
    /紫微年分界必须是 normal 或 exact/,
  );
  await assert.rejects(
    () =>
      buildAstrolabeFromInput({
        ...DEFAULT_CHART_INPUT,
        horoscopeDivide: 'bad' as 'normal',
      }),
    /紫微行运分界必须是 normal 或 exact/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, ageDivide: 'bad' as 'normal' }),
    /紫微年龄分界必须是 normal 或 birthday/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, dayDivide: 'bad' as 'forward' }),
    /紫微日期分界必须是 current 或 forward/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, isLeapMonth: 'false' as never }),
    /闰月标志必须是布尔值/,
  );
  await assert.rejects(
    () => buildAstrolabeFromInput({ ...DEFAULT_CHART_INPUT, fixLeap: 'true' as never }),
    /闰月修正配置必须是布尔值/,
  );
  await assert.rejects(
    () =>
      buildAstrolabeFromInput({
        ...DEFAULT_CHART_INPUT,
        dateType: 'lunar',
        birthDate: '2023-02-31',
      }),
    /农历日期需在 1-30 之间/,
  );
});

test('紫微公历排盘封装默认值应与 iztro bySolar 官方入口一致', async () => {
  resetIztroDefaultConfig();
  const direct = astro.bySolar('1998-08-13', 12, '女', true, 'zh-CN');
  const wrapped = await buildAstrolabeFromInput({
    name: '测试',
    dateType: 'solar',
    birthDate: '1998-08-13',
    birthTimeIndex: 12,
    gender: '女',
    isLeapMonth: false,
    fixLeap: true,
  });

  assert.equal(
    JSON.stringify(astrolabeSignature(wrapped)),
    JSON.stringify(astrolabeSignature(direct)),
  );
});

test('紫微农历排盘封装默认值应与 iztro byLunar 官方入口一致', async () => {
  resetIztroDefaultConfig();
  const direct = astro.byLunar('2023-2-4', 6, '男', true, true, 'zh-CN');
  const wrapped = await buildAstrolabeFromInput({
    name: '测试',
    dateType: 'lunar',
    birthDate: '2023-02-04',
    birthTimeIndex: 6,
    gender: '男',
    isLeapMonth: true,
    fixLeap: true,
  });

  assert.equal(
    JSON.stringify(astrolabeSignature(wrapped)),
    JSON.stringify(astrolabeSignature(direct)),
  );
});

test('紫微基础资料应直接读取 iztro 身宫与来因宫原生定位', async () => {
  const astrolabe = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);
  const horoscope = buildHoroscope(astrolabe, '2026-07-27', 6);
  const payload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'origin',
    calculationConfig: buildZiweiCalculationConfig(DEFAULT_CHART_INPUT),
  });
  const bodyPalace = astrolabe.palace('身宫');
  const originalPalace = astrolabe.palace('来因');

  assert.ok(bodyPalace);
  assert.ok(originalPalace);
  assert.equal(payload.basic_info.hidden_palaces?.body_palace_index, bodyPalace.index);
  assert.equal(payload.basic_info.hidden_palaces?.body_palace_name, bodyPalace.name);
  assert.equal(payload.basic_info.hidden_palaces?.original_palace_index, originalPalace.index);
  assert.equal(payload.basic_info.hidden_palaces?.original_palace_name, originalPalace.name);
  assert.equal(payload.palaces.filter((palace) => palace.is_original_palace).length, 1);
});

test('紫微结果应披露实际传给 iztro 的基础排盘口径', () => {
  const config = buildZiweiCalculationConfig(DEFAULT_CHART_INPUT);

  assert.equal(config.engine, 'iztro');
  assert.equal(config.algorithm, 'default');
  assert.match(config.algorithm_basis, /《紫微斗数全书》/);
  assert.equal(config.fix_leap, true);
  assert.match(config.leap_month_rule, /十五日及以前按同名月，十六日起按下月/);
  assert.equal(config.year_divide_rule, '以农历正月初一分年');
  assert.equal(config.horoscope_divide_rule, '运限月份以农历月份分界');
  assert.equal(config.age_divide_rule, '小限年龄只按年份计算');
  assert.equal(config.late_zi_rule, '晚子时按次日干支及次日安星日数排盘');
  assert.match(config.limitation, /解读侧重点，不改变这里的安星算法/);
});

test('紫微晚子时口径应同时影响日柱与按日安置的紫微星', async () => {
  const current = await buildAstrolabeFromInput({
    ...DEFAULT_CHART_INPUT,
    birthDate: '2024-02-10',
    birthTimeIndex: 12,
    gender: '男',
    dayDivide: 'current',
  });
  const forward = await buildAstrolabeFromInput({
    ...DEFAULT_CHART_INPUT,
    birthDate: '2024-02-10',
    birthTimeIndex: 12,
    gender: '男',
    dayDivide: 'forward',
  });

  assert.deepEqual(current.rawDates.chineseDate.daily, ['甲', '辰']);
  assert.deepEqual(forward.rawDates.chineseDate.daily, ['乙', '巳']);
  assert.equal(
    current.palaces.find((palace) => palace.majorStars.some((star) => star.name === '紫微'))
      ?.earthlyBranch,
    '酉',
  );
  assert.equal(
    forward.palaces.find((palace) => palace.majorStars.some((star) => star.name === '紫微'))
      ?.earthlyBranch,
    '午',
  );
});

test('紫微闰月修正应以十五日与十六日为界且不得提前换月', async () => {
  const charts = await Promise.all(
    [15, 16].flatMap((day) =>
      [true, false].map((fixLeap) =>
        buildAstrolabeFromInput({
          ...DEFAULT_CHART_INPUT,
          dateType: 'lunar',
          birthDate: `2023-02-${day}`,
          birthTimeIndex: 1,
          gender: '男',
          isLeapMonth: true,
          fixLeap,
        }),
      ),
    ),
  );
  const [day15Fixed, day15Original, day16Fixed, day16Original] = charts;

  assert.equal(day15Fixed.earthlyBranchOfSoulPalace, '寅');
  assert.equal(day15Original.earthlyBranchOfSoulPalace, '寅');
  assert.equal(day16Fixed.earthlyBranchOfSoulPalace, '卯');
  assert.equal(day16Original.earthlyBranchOfSoulPalace, '寅');
});

test('紫微正月初一分年与立春分年应在两条边界之间产生可见差异', async () => {
  const normal = await buildAstrolabeFromInput({
    ...DEFAULT_CHART_INPUT,
    birthDate: '2024-02-06',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
  });
  const exact = await buildAstrolabeFromInput({
    ...DEFAULT_CHART_INPUT,
    birthDate: '2024-02-06',
    yearDivide: 'exact',
    horoscopeDivide: 'exact',
  });

  assert.deepEqual(normal.rawDates.chineseDate.yearly, ['癸', '卯']);
  assert.deepEqual(exact.rawDates.chineseDate.yearly, ['甲', '辰']);
  assert.deepEqual(normal.rawDates.chineseDate.monthly, ['乙', '丑']);
  assert.deepEqual(exact.rawDates.chineseDate.monthly, ['丙', '寅']);
});

test('紫微行运封装应拒绝 iztro 会宽松接受的非法日期和时辰', async () => {
  const astrolabe = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);

  assert.equal(buildHoroscope(astrolabe, '2101-01-18', 6).solarDate, '2101-1-18');
  assert.throws(
    () => buildHoroscope(astrolabe, 20240229 as never, 6),
    /行运日期格式需为 YYYY-MM-DD/,
  );
  assert.throws(() => buildHoroscope(astrolabe, '2024/02/29', 6), /行运日期格式需为 YYYY-MM-DD/);
  assert.throws(() => buildHoroscope(astrolabe, '2024-02-31', 6), /行运日期需在 1-29 之间/);
  assert.throws(() => buildHoroscope(astrolabe, '2024-13-01', 6), /行运日期月份需在 1-12 之间/);
  assert.throws(() => buildHoroscope(astrolabe, '2024-02-29', -1), /行运时辰需在 0-12 之间/);
  assert.throws(() => buildHoroscope(astrolabe, '2024-02-29', 13), /行运时辰需在 0-12 之间/);
});

test('紫微分析载荷应拒绝非法分析范围和不完整宫位', async () => {
  const astrolabe = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);
  const horoscope = buildHoroscope(astrolabe, '2024-02-29', 6);

  assert.throws(
    () =>
      buildAnalysisPayloadV1({
        astrolabe,
        horoscope,
        currentScope: 'weekly' as never,
      }),
    /紫微分析范围必须是/,
  );

  const incompleteAstrolabe = {
    ...astrolabe,
    palaces: astrolabe.palaces.slice(0, 11),
  } as typeof astrolabe;

  assert.throws(
    () =>
      buildAnalysisPayloadV1({
        astrolabe: incompleteAstrolabe,
        horoscope,
        currentScope: 'origin',
      }),
    /紫微排盘必须包含完整 12 个宫位/,
  );
});

test('紫微分析载荷应评估已登记格局并明确轻量模式未生成状态', async () => {
  const astrolabe = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);
  const horoscope = buildHoroscope(astrolabe, '2024-02-29', 6);
  const payload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'yearly',
  });
  const analysis = payload.evidence_analysis;

  assert.ok(analysis);
  assert.equal(analysis.key, 'ziwei:evidence');
  assert.equal(analysis.calculationSteps.length, 4);
  assert.equal(analysis.summaryFact.evidenceFactCount, payload.evidence_pool.length);
  assert.ok(
    payload.evidence_pool.every(
      (item) =>
        item.key &&
        item.status &&
        item.calculationStepKey &&
        analysis.calculationSteps.some((step) => step.key === item.calculationStepKey),
    ),
  );
  const factKeys = new Set([analysis.summaryFact.key, ...analysis.summaryFact.factKeys]);
  assert.ok(
    [...analysis.counterEvidenceFacts, ...analysis.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  const patternAnalysis = payload.pattern_analysis;
  assert.ok(patternAnalysis);
  assert.equal(patternAnalysis.key, 'ziwei:patterns');
  assert.equal(patternAnalysis.status, payload.patterns?.length ? '已计算' : '未命中');
  assert.equal(patternAnalysis.calculationSteps.length, 4);
  assert.equal(
    patternAnalysis.summaryFact.evaluatedRuleCount,
    patternAnalysis.summaryFact.registeredRuleCount,
  );
  assert.equal(patternAnalysis.summaryFact.matchedPatternCount, payload.patterns?.length ?? 0);
  assert.equal(patternAnalysis.summaryFact.registeredRuleCount, 55);
  assert.match(patternAnalysis.promptText, /固定古籍版本逐条评估55条可复算规则/);
  assert.ok(
    (payload.patterns ?? []).every(
      (item) =>
        item.key?.startsWith('ziwei:verified-pattern:') &&
        item.status === '已命中' &&
        item.calculationStepKey &&
        patternAnalysis.calculationSteps.some((step) => step.key === item.calculationStepKey),
    ),
  );

  const compactPayload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'origin',
    skipAnalysis: true,
  });
  assert.equal(compactPayload.evidence_pool.length, 0);
  assert.equal(compactPayload.evidence_analysis?.status, '未生成');
  assert.equal(compactPayload.evidence_analysis?.summaryFact.status, '未生成');
  assert.match(compactPayload.evidence_analysis?.promptText ?? '', /明确跳过本命证据采集/);
  assert.equal(compactPayload.pattern_analysis?.status, '未生成');
  assert.equal(compactPayload.pattern_analysis?.summaryFact.evaluatedRuleCount, 0);
  assert.match(compactPayload.pattern_analysis?.promptText ?? '', /明确跳过格局规则评估/);
});

test('真实排盘中非命宫化忌被羊陀夹住时不得误报羊陀夹忌', async () => {
  const input = {
    ...DEFAULT_CHART_INPUT,
    name: '羊陀夹忌回归',
    birthDate: '2024-01-06',
    birthTimeIndex: 7,
    gender: '男' as const,
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscope = buildHoroscope(astrolabe, '2026-07-27', 6);
  const payload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'origin',
  });
  const target = payload.palaces.find((palace) => palace.name === '疾厄');
  assert.ok(target);
  const targetStars = [...target.major_stars, ...target.minor_stars, ...target.other_stars];
  assert.ok(targetStars.some((star) => star.name === '贪狼' && star.birth_mutagen === '忌'));
  const neighborStars = payload.palaces
    .filter(
      (palace) =>
        palace.index === (target.index + 11) % 12 || palace.index === (target.index + 1) % 12,
    )
    .flatMap((palace) => [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars])
    .map((star) => star.name);
  assert.ok(neighborStars.includes('擎羊'));
  assert.ok(neighborStars.includes('陀罗'));
  assert.ok(!(payload.patterns ?? []).some((pattern) => pattern.name === '羊陀夹忌'));
});

test('罕见紫微格局应有真实 iztro 排盘回归样本', async () => {
  const cases = [
    { name: '君臣庆会', birthDate: '1984-05-06', birthTimeIndex: 10 },
    { name: '两重华盖', birthDate: '1984-05-07', birthTimeIndex: 3 },
    { name: '皇殿朝班', birthDate: '1984-05-31', birthTimeIndex: 4 },
    { name: '贪火相逢', birthDate: '1984-06-13', birthTimeIndex: 8 },
    { name: '梁昌庙旺', birthDate: '1984-10-08', birthTimeIndex: 9 },
    { name: '风流彩杖', birthDate: '1985-02-22', birthTimeIndex: 0 },
    { name: '泛水桃花', birthDate: '1992-02-10', birthTimeIndex: 2 },
  ] as const;

  for (const item of cases) {
    const astrolabe = await buildAstrolabeFromInput({
      ...DEFAULT_CHART_INPUT,
      name: `${item.name}回归`,
      birthDate: item.birthDate,
      birthTimeIndex: item.birthTimeIndex,
      gender: '男',
    });
    const horoscope = buildHoroscope(astrolabe, item.birthDate, item.birthTimeIndex);
    const payload = buildAnalysisPayloadV1({ astrolabe, horoscope, currentScope: 'origin' });
    assert.ok(
      (payload.patterns ?? []).some((pattern) => pattern.name === item.name),
      `${item.name}应在${item.birthDate}、时辰索引${item.birthTimeIndex}的真实排盘中命中`,
    );
  }
});

test('紫微分析载荷应直接采用 iztro 原生宫位、运限与飞化能力', async () => {
  const astrolabe = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);
  const horoscope = buildHoroscope(astrolabe, '2026-07-27', 6);
  const originPayload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'origin',
    skipAnalysis: true,
  });
  const yearlyPayload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'yearly',
    skipAnalysis: true,
  });

  const nativeSoulPalace = astrolabe.palace('命宫');
  assert.equal(originPayload.active_scope.palace_index, nativeSoulPalace?.index);
  assert.equal(originPayload.active_scope.palace_name, nativeSoulPalace?.name);

  const nativeYearlySoulPalace = horoscope.palace('命宫', 'yearly');
  assert.equal(yearlyPayload.active_scope.palace_index, nativeYearlySoulPalace?.index);
  assert.equal(yearlyPayload.active_scope.palace_name, nativeYearlySoulPalace?.name);

  yearlyPayload.active_scope.mutagen_map.forEach((item) => {
    const nativeStarPalace = astrolabe.star(item.star as never).palace();
    assert.equal(item.palace_index, nativeStarPalace?.index, `${item.star}四化落宫索引不一致`);
    assert.equal(item.palace_name, nativeStarPalace?.name, `${item.star}四化落宫名称不一致`);
    assert.equal(
      item.dynamic_palace_name,
      nativeStarPalace ? horoscope.yearly.palaceNames[nativeStarPalace.index] : undefined,
      `${item.star}流年动态宫名不一致`,
    );
    assert.equal(
      horoscope.hasHoroscopeMutagen(
        item.dynamic_palace_name as never,
        'yearly',
        item.mutagen as never,
      ),
      true,
      `${item.star}应通过 iztro 运限四化检查`,
    );
  });

  yearlyPayload.palaces.forEach((palace) => {
    const nativePalace = astrolabe.palace(palace.index);
    assert.ok(nativePalace, `${palace.name}缺少 iztro 原生宫位`);
    const surrounded = astrolabe.surroundedPalaces(palace.index);
    assert.deepEqual(palace.surrounded_palace_indexes, [
      surrounded.target.index,
      surrounded.opposite.index,
      surrounded.wealth.index,
      surrounded.career.index,
    ]);
    assert.deepEqual(
      palace.mutaged_palaces?.map((item) => item.palace_index),
      nativePalace.mutagedPlaces().map((item) => item?.index),
      `${palace.name}宫干飞化目标不一致`,
    );
    assert.deepEqual(
      palace.self_mutagens,
      (['禄', '权', '科', '忌'] as const).filter((mutagen) => nativePalace.selfMutaged(mutagen)),
      `${palace.name}自化不一致`,
    );
    assert.equal(palace.dynamic_scope_name, horoscope.yearly.palaceNames[palace.index]);
    assert.equal(
      palace.summary_tags.includes('有生年四化'),
      (['禄', '权', '科', '忌'] as const).some((mutagen) => nativePalace.hasMutagen(mutagen)),
      `${palace.name}生年四化标签未直接服从 iztro 宫位判定`,
    );
    assert.equal(
      palace.summary_tags.includes('有当前运限四化'),
      (['禄', '权', '科', '忌'] as const).some((mutagen) =>
        horoscope.hasHoroscopeMutagen(
          horoscope.yearly.palaceNames[palace.index] as never,
          'yearly',
          mutagen,
        ),
      ),
      `${palace.name}运限四化标签未直接服从 iztro 运限判定`,
    );
    assert.deepEqual(
      palace.scope_stars.map((star) => star.name),
      (horoscope.yearly.stars?.[palace.index] ?? []).map((star) => star.name),
      `${palace.name}流年星曜不一致`,
    );
  });
});

test('紫微大限时间轴应按农历年位移，春节前出生者不落入相邻流年', () => {
  // 1995-01-20 出生 = 农历甲戌(1994)年十二月二十；+1 农历年 = 乙亥(1995)年十二月二十
  assert.equal(shiftLunarYear('1995-01-20', 1), '1996-02-08');
  // 1995-02-10 出生 = 农历乙亥(1995)年正月十一；+1 = 丙子(1996)年正月十一
  assert.equal(shiftLunarYear('1995-02-10', 1), '1996-02-29');
  // 位移量为 0 应返回出生日对应公历日期本身
  assert.equal(shiftLunarYear('1995-02-10', 0), '1995-02-10');
});

test('紫微童限与大限时间轴应逐项服从 iztro 运限结果', async () => {
  const astrolabe = await buildAstrolabeFromInput(DEFAULT_CHART_INPUT);
  const options = await buildVerifiedDecadalTimelineOptions(astrolabe, DEFAULT_CHART_INPUT);
  const firstRegularAge = Math.min(...astrolabe.palaces.map((palace) => palace.decadal.range[0]));
  const childhoodOptions = options.filter((option) => option.kind === 'childhood');
  const decadalOptions = options.filter((option) => option.kind === 'decadal');

  assert.deepEqual(
    childhoodOptions.map((option) => option.startAge),
    Array.from({ length: firstRegularAge - 1 }, (_, index) => index + 1),
  );
  assert.ok(childhoodOptions.every((option) => option.startAge === option.endAge));
  assert.equal(decadalOptions.length, 12);
  assert.ok(options.every((option) => option.source === 'iztro-horoscope'));
  assert.ok(options.every((option) => option.endDateStr && option.endDateStr >= option.dateStr));
  assert.ok(
    options.slice(0, -1).every((option, index) => option.endDateStr! < options[index + 1].dateStr),
  );

  for (const option of options) {
    const horoscope = await buildHoroscopeFromInput(
      astrolabe,
      DEFAULT_CHART_INPUT,
      option.dateStr,
      DEFAULT_CHART_INPUT.birthTimeIndex,
    );
    assert.equal(horoscope.age.nominalAge, option.startAge);
    assert.equal(horoscope.decadal.index, option.palaceIndex);
    assert.equal(horoscope.decadal.name, option.label);
    assert.equal(astrolabe.palace(horoscope.decadal.index)?.name, option.palaceName);
    if (option.startAge > 1) {
      const lunarParts = getLunarParts(option.dateStr);
      assert.equal(lunarParts.monthWithLeap, 1);
      assert.equal(lunarParts.day, 1);
      const [year, month, day] = option.dateStr.split('-').map(Number);
      const previousDay = SolarDay.fromYmd(year, month, day).next(-1);
      const previousDate = `${previousDay.getYear()}-${String(previousDay.getMonth()).padStart(2, '0')}-${String(previousDay.getDay()).padStart(2, '0')}`;
      const previousHoroscope = await buildHoroscopeFromInput(
        astrolabe,
        DEFAULT_CHART_INPUT,
        previousDate,
        DEFAULT_CHART_INPUT.birthTimeIndex,
      );
      assert.ok(previousHoroscope.age.nominalAge < option.startAge);
    }
  }
});

test('紫微农历闰月出生的大限时间线应以 iztro 换算后的公历生日为基准', async () => {
  const input = {
    ...DEFAULT_CHART_INPUT,
    dateType: 'lunar' as const,
    birthDate: '2023-02-04',
    isLeapMonth: true,
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  const options = await buildVerifiedDecadalTimelineOptions(astrolabe, input);

  assert.equal(astrolabe.solarDate, '2023-3-25');
  assert.equal(options[0]?.dateStr, '2023-03-25');
  assert.equal(
    (await buildHoroscopeFromInput(astrolabe, input, options[0].dateStr, input.birthTimeIndex)).age
      .nominalAge,
    1,
  );
});

test('紫微按生日换虚岁时应寻找并验证 iztro 实际换岁代表日', async () => {
  const input = { ...DEFAULT_CHART_INPUT, ageDivide: 'birthday' as const };
  const astrolabe = await buildAstrolabeFromInput(input);
  const options = await buildVerifiedDecadalTimelineOptions(astrolabe, input);
  const firstOption = options[0];

  assert.ok(firstOption);
  assert.notEqual(firstOption.dateStr, input.birthDate);
  const horoscope = await buildHoroscopeFromInput(
    astrolabe,
    input,
    firstOption.dateStr,
    input.birthTimeIndex,
  );
  assert.equal(horoscope.age.nominalAge, 1);
  assert.equal(horoscope.decadal.name, '童限');
});

test('紫微当前大限查找失败时不得默认选择第一项', () => {
  const options = [
    {
      kind: 'decadal' as const,
      label: '大限',
      startAge: 6,
      endAge: 15,
      dateStr: '2003-07-21',
      source: 'iztro-horoscope' as const,
    },
  ];

  assert.equal(findCurrentDecadalOption(options, 6), options[0]);
  assert.equal(findCurrentDecadalOption(options, 1), null);
  assert.equal(findCurrentDecadalOption(options, 16), null);
  assert.equal(findCurrentDecadalOption(options, 1.5), null);
});

test('紫微农历年位移应处理闰月与月底回退', () => {
  // 2023-03-25 = 闰二月初四；+1 农历年 2024 无闰二月，回退到普通二月初四
  assert.equal(shiftLunarYear('2023-03-25', 1), '2024-03-13');
  // 2024-03-10 = 甲辰年二月初一；+1 乙巳年二月初一
  assert.equal(shiftLunarYear('2024-03-10', 1), '2025-02-28');
  // 2024-04-08 = 甲辰年二月三十；2025 年二月无三十，回退到二月廿九
  const shifted = shiftLunarYear('2024-04-08', 1);
  assert.equal(shifted, '2025-03-28');
  assert.deepEqual(getLunarParts(shifted), { year: 2025, monthWithLeap: 2, day: 29 });
});

test('紫微农历年位移应支持 2100 年后的大限日期', () => {
  // 2098-01-20 = 农历 2097 年十二月十九；+3 农历年应落到 2100 年十二月十九
  const shifted = shiftLunarYear('2098-01-20', 3);
  assert.equal(shifted, '2101-01-18');
  assert.deepEqual(getLunarParts(shifted), { year: 2100, monthWithLeap: 12, day: 19 });
});

test('紫微农历年位移应拒绝非法输入', () => {
  assert.throws(() => shiftLunarYear(20240310 as never, 1), /日期格式需为 YYYY-MM-DD/);
  assert.throws(() => shiftLunarYear('2024/03/10', 1), /日期格式需为 YYYY-MM-DD/);
  assert.throws(() => shiftLunarYear('2024-03-10', 1.5), /日期位移量必须是整数/);
});
