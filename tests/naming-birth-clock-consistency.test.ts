import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  calculateNamingBirthContext,
} from '../packages/core/src/name-number/index.ts';
import { calculateBaziChartFromInput } from '../packages/core/src/bazi/input.ts';
import { handlePublicApiRequest } from '../src/lib/public-api/handler.ts';

async function callApi(path: string, body: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as any };
}

test('命名标准北京时间精确到分并按零秒排盘和展示', () => {
  const birth = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    dateType: 'solar' as const,
    useTrueSolarTime: false,
    timeIndex: '' as const,
    birthHour: 9,
    birthMinute: 30,
  };
  const expected = calculateBaziChartFromInput({ ...birth, birthSecond: 0 });
  const context = calculateNamingBirthContext(birth);
  const expectedSolarDate = `${expected.solarDate.year}-${String(expected.solarDate.month).padStart(2, '0')}-${String(expected.solarDate.day).padStart(2, '0')}`;
  const prompt = buildChineseNameAnalysisPrompt({
    analysis: analyzeChineseName({ fullName: '李清和', birth }),
  });

  assert.equal(context.timeBasis.inputTime, '09:30');
  assert.equal(context.timeBasis.mode, '标准北京时间（精确到分）');
  assert.equal(context.timeBasis.timezone, 8);
  assert.equal(context.timeBasis.timeZoneId, null);
  assert.equal(context.timeBasis.calculatedTime, '09:30');
  assert.equal(context.solarDate, expectedSolarDate);
  assert.deepEqual(
    context.pillars,
    Object.values(expected.pillars).map((pillar) => pillar.ganZhi),
  );
  assert.match(prompt, /出生记录：公历2000年1月1日 09:30/);
  assert.match(prompt, /时间口径：标准北京时间（精确到分）/);
  assert.doesNotMatch(prompt, /时间口径：标准北京时间（精确到分）；时区：/);
  assert.match(prompt, /排盘公历：2000-01-01 09:30/);
  assert.ok(prompt.includes(`四柱：${context.pillars.join(' ')}`));
});

test('命名 IANA 与固定偏移的当地钟表保留真实时区和四柱', () => {
  const birth = {
    gender: 'male' as const,
    year: 2024,
    month: 7,
    day: 1,
    dateType: 'solar' as const,
    timeIndex: '' as const,
    birthHour: 1,
    birthMinute: 30,
  };
  const iana = calculateNamingBirthContext({
    ...birth,
    timezone: -4,
    timeZoneId: 'America/New_York',
  });
  const ianaPrompt = buildChineseNameAnalysisPrompt({
    analysis: analyzeChineseName({
      fullName: '李清和',
      birth: { ...birth, timezone: -4, timeZoneId: 'America/New_York' },
    }),
  });
  assert.deepEqual(iana.pillars, ['甲辰', '庚午', '丙寅', '己丑']);
  assert.equal(iana.timeBasis.inputTime, '01:30');
  assert.equal(iana.timeBasis.mode, '当地钟表时间（精确到分）');
  assert.equal(iana.timeBasis.timezone, -4);
  assert.equal(iana.timeBasis.timeZoneId, 'America/New_York');
  assert.equal(iana.timeBasis.calculatedTime, '01:30');
  assert.match(ianaPrompt, /出生记录：公历2024年7月1日 01:30/);
  assert.match(
    ianaPrompt,
    /时间口径：当地钟表时间（精确到分）；时区：America\/New_York，UTC-04:00/,
  );
  assert.ok(ianaPrompt.includes(`四柱：${iana.pillars.join(' ')}`));
  assert.doesNotMatch(ianaPrompt, /标准北京时间|地点记录：未提供/);

  const ianaWithoutOffset = calculateNamingBirthContext({
    ...birth,
    timeZoneId: 'America/New_York',
  });
  assert.deepEqual(ianaWithoutOffset.pillars, iana.pillars);
  assert.equal(ianaWithoutOffset.timeBasis.timezone, -4);
  assert.equal(ianaWithoutOffset.timeBasis.timeZoneId, 'America/New_York');

  const fixed = calculateNamingBirthContext({ ...birth, timezone: 9 });
  const fixedPrompt = buildChineseNameAnalysisPrompt({
    analysis: analyzeChineseName({ fullName: '李清和', birth: { ...birth, timezone: 9 } }),
  });
  assert.equal(fixed.timeBasis.mode, '当地钟表时间（精确到分）');
  assert.equal(fixed.timeBasis.timezone, 9);
  assert.equal(fixed.timeBasis.timeZoneId, null);
  assert.match(fixedPrompt, /时间口径：当地钟表时间（精确到分）；时区：UTC\+09:00/);
  assert.ok(fixedPrompt.includes(`四柱：${fixed.pillars.join(' ')}`));
});

test('命名标准钟表时间优先于过期时辰索引且保留秒级与分钟级精度', () => {
  const clockInput = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    dateType: 'solar' as const,
    useTrueSolarTime: false,
    timeIndex: '' as const,
    birthHour: 9,
    birthMinute: 30,
    birthSecond: 12,
  };
  const expected = calculateNamingBirthContext(clockInput);
  const staleIndex = calculateNamingBirthContext({ ...clockInput, timeIndex: 6 });
  const minuteInput = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    dateType: 'solar' as const,
    useTrueSolarTime: false,
    timeIndex: '' as const,
    birthHour: 9,
    birthMinute: 30,
  };
  const expectedMinute = calculateNamingBirthContext(minuteInput);
  const staleMinuteIndex = calculateNamingBirthContext({ ...minuteInput, timeIndex: 6 });

  assert.equal(staleIndex.timeBasis.inputTime, '09:30:12');
  assert.equal(staleIndex.timeBasis.mode, '标准北京时间（精确到秒）');
  assert.deepEqual(staleIndex.pillars, expected.pillars);
  assert.equal(staleIndex.solarDate, expected.solarDate);
  assert.equal(staleMinuteIndex.timeBasis.inputTime, '09:30');
  assert.equal(staleMinuteIndex.timeBasis.mode, '标准北京时间（精确到分）');
  assert.deepEqual(staleMinuteIndex.pillars, expectedMinute.pillars);
  assert.equal(staleMinuteIndex.solarDate, expectedMinute.solarDate);
});

test('命名在线接口接受无秒钟表时间并拒绝不完整钟表', async () => {
  const birth = {
    gender: 'male',
    year: 2000,
    month: 1,
    day: 1,
    dateType: 'solar',
    useTrueSolarTime: false,
    birthHour: 9,
    birthMinute: 30,
  };
  const expectedChart = calculateBaziChartFromInput({ ...birth, timeIndex: '', birthSecond: 0 });
  const expectedPillars = `四柱：${Object.values(expectedChart.pillars)
    .map((pillar) => pillar.ganZhi)
    .join(' ')}`;
  const promptResult = await callApi('name/analyze/prompt', { fullName: '李清和', birth });
  assert.equal(promptResult.status, 200);
  assert.match(promptResult.body.data.prompt, /出生记录：公历2000年1月1日 09:30/);
  assert.match(promptResult.body.data.prompt, /标准北京时间（精确到分）/);
  assert.match(promptResult.body.data.prompt, /排盘公历：2000-01-01 09:30/);

  const staleIndexPrompt = await callApi('name/analyze/prompt', {
    fullName: '李清和',
    birth: { ...birth, timeIndex: 6 },
  });
  assert.equal(staleIndexPrompt.status, 200);
  assert.match(staleIndexPrompt.body.data.prompt, /出生记录：公历2000年1月1日 09:30/);
  assert.match(staleIndexPrompt.body.data.prompt, /排盘公历：2000-01-01 09:30/);
  assert.ok(staleIndexPrompt.body.data.prompt.includes(expectedPillars));

  const partialClock = await callApi('name/analyze', {
    fullName: '李清和',
    birth: { ...birth, birthMinute: undefined, timeIndex: 6 },
  });
  assert.equal(partialClock.status, 400);
  assert.match(partialClock.body.error.message, /birthHour 和 birthMinute 必须同时提供/u);
});

test('命名标准北京时间无秒时保留历史夏令时回拨后的日期与钟表事实', () => {
  const birth = {
    gender: 'male' as const,
    year: 1990,
    month: 5,
    day: 15,
    dateType: 'solar' as const,
    timeIndex: '' as const,
    birthHour: 0,
    birthMinute: 20,
    applyChinaDst: true,
  };
  const context = calculateNamingBirthContext(birth);
  const prompt = buildChineseNameAnalysisPrompt({
    analysis: analyzeChineseName({ fullName: '李清和', birth }),
  });

  assert.equal(context.timeBasis.inputTime, '00:20');
  assert.match(context.timeBasis.mode, /已回拨为标准北京时间/u);
  assert.equal(context.timeBasis.timezone, 8);
  assert.equal(context.timeBasis.timeZoneId, null);
  assert.equal(context.timeBasis.calculatedTime, '23:20');
  assert.equal(context.solarDate, '1990-05-14');
  assert.match(prompt, /出生记录：公历1990年5月15日 00:20/u);
  assert.match(prompt, /排盘公历：1990-05-14 23:20/u);
});

test('命名上海 IANA 历史夏令时保留原钟表偏移和回拨后的排盘日', () => {
  const birth = {
    gender: 'male' as const,
    year: 1988,
    month: 6,
    day: 1,
    dateType: 'solar' as const,
    timeIndex: '' as const,
    birthHour: 0,
    birthMinute: 30,
    birthSecond: 42,
    timeZoneId: 'Asia/Shanghai',
  };
  const context = calculateNamingBirthContext(birth);
  const prompt = buildChineseNameAnalysisPrompt({
    analysis: analyzeChineseName({ fullName: '李清和', birth }),
  });
  assert.equal(context.timeBasis.inputTime, '00:30:42');
  assert.equal(context.timeBasis.mode, '中国历史夏令时钟表时间（已回拨为标准北京时间）');
  assert.equal(context.timeBasis.timezone, 9);
  assert.equal(context.timeBasis.timeZoneId, 'Asia/Shanghai');
  assert.equal(context.timeBasis.calculatedTime, '23:30:42');
  assert.equal(context.solarDate, '1988-05-31');
  assert.match(prompt, /出生记录：公历1988年6月1日 00:30:42/);
  assert.match(
    prompt,
    /时间口径：中国历史夏令时钟表时间（已回拨为标准北京时间）；时区：Asia\/Shanghai，UTC\+09:00/,
  );
  assert.match(prompt, /排盘公历：1988-05-31 23:30:42/);
});
