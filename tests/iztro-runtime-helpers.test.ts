import test from 'node:test';
import assert from 'node:assert/strict';
import { astro } from 'iztro';
import { SolarDay } from 'tyme4ts';

import {
  buildAstrolabeFromInput,
  buildAnalysisPayloadV1,
  buildHoroscope,
  getDefaultHoroscopeContext,
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

test('紫微大限时间轴应按农历年位移，春节前出生者不落入相邻流年', () => {
  // 1995-01-20 出生 = 农历甲戌(1994)年十二月二十；+1 农历年 = 乙亥(1995)年十二月二十
  assert.equal(shiftLunarYear('1995-01-20', 1), '1996-02-08');
  // 1995-02-10 出生 = 农历乙亥(1995)年正月十一；+1 = 丙子(1996)年正月十一
  assert.equal(shiftLunarYear('1995-02-10', 1), '1996-02-29');
  // 位移量为 0 应返回出生日对应公历日期本身
  assert.equal(shiftLunarYear('1995-02-10', 0), '1995-02-10');
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
