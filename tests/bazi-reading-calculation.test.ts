import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBaziChartFromInput } from 'mingyu-core/bazi';
import { calculateBaziReading } from '../src/lib/ai/bazi-reading-calculation';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

const baseInput = {
  gender: 'male',
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 8,
  dateType: 'solar',
  isLeapMonth: false,
  useTrueSolarTime: false,
  baziFortuneScope: 'natal',
  promptTopic: 'general',
  promptMode: 'framework',
  question: '请说明这份命盘的整体结构与可执行重点。',
} as const;

test('本地八字计算保留完整事实、问题和结构化主体身份', () => {
  const output = calculateBaziReading(baseInput);

  assert.match(output.prompt, /请说明这份命盘的整体结构与可执行重点。/u);
  assert.equal(output.result.calculationIdentity.method, 'bazi');
  assert.deepEqual(output.result.calculationIdentity.birth, {
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthPlace: '',
    timeIndex: 8,
  });
  assert.equal(output.result.calculationIdentity.target.baziFortuneScope, 'natal');
  assert.ok(output.result.pillars.year.ganZhi);
  assert.ok(output.result.analysis);
  assert.ok(output.result.luckInfo.cycles.length > 0);
});

test('用户选择的八字运限进入提示词和身份目标', () => {
  const chart = calculateBaziChartFromInput({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 8,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const year = chart.luckInfo.cycles[0]?.years[0]?.year;
  assert.equal(typeof year, 'number');

  const output = calculateBaziReading({
    ...baseInput,
    baziFortuneScope: 'year',
    baziFortuneCycleIndex: 0,
    baziFortuneYear: year,
  });

  assert.equal(output.result.calculationIdentity.target.baziFortuneScope, 'year');
  assert.equal(output.result.calculationIdentity.target.baziFortuneCycleIndex, 0);
  assert.equal(output.result.calculationIdentity.target.baziFortuneYear, year);
  assert.equal(output.result.fortuneSelection?.scope, 'year');
  assert.equal(output.result.fortuneSelection?.year, year);
  assert.match(output.prompt, new RegExp(`${year}年`, 'u'));
});

test('精确标准北京时间保留秒数并沿用核心排盘结果', () => {
  const input = {
    ...baseInput,
    timeIndex: '' as const,
    birthHour: 13,
    birthMinute: 5,
    birthSecond: 37,
  };
  const output = calculateBaziReading(input);
  const expected = calculateBaziChartFromInput({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: '',
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: 13,
    birthMinute: 5,
    birthSecond: 37,
  });

  assert.equal(output.result.calculationIdentity.birth.birthHour, 13);
  assert.equal(output.result.calculationIdentity.birth.birthMinute, 5);
  assert.equal(output.result.calculationIdentity.birth.birthSecond, 37);
  assert.deepEqual(output.result.pillars, expected.pillars);
  assert.equal(output.result.timeInfo.index, expected.timeInfo.index);
});

test('取消信号在本地计算开始前直接中止', () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () => calculateBaziReading(baseInput, { signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );
});

async function callPublicBaziPrompt(input: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/bazi/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  const body = (await response.json()) as {
    ok: boolean;
    data?: { prompt?: string; result?: Record<string, unknown> };
    error?: { message?: string };
  };
  assert.equal(response.status, 200, body.error?.message);
  assert.equal(body.ok, true);
  assert.ok(body.data?.prompt);
  assert.ok(body.data?.result);
  return body.data as { prompt: string; result: Record<string, unknown> };
}

function withoutCurrentTime(prompt: string) {
  const start = prompt.indexOf('【当前时间】');
  const end = prompt.indexOf('\n\n【排盘信息】');
  if (start < 0 || end < start) return prompt;
  return `${prompt.slice(0, start)}【当前时间】${prompt.slice(end)}`;
}

test('本地八字提示词与公开 API 在标准秒级输入下保持完整结果一致', async () => {
  const input = {
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    timeIndex: '',
    birthHour: 13,
    birthMinute: 5,
    birthSecond: 37,
    baziFortuneScope: 'natal',
    promptTopic: 'career',
    promptMode: 'framework',
    responseMode: 'full',
    question: '请比较标准秒级输入下的事业结构。',
  };
  const local = calculateBaziReading(input);
  const remote = await callPublicBaziPrompt(input);
  const localResult = JSON.parse(JSON.stringify(local.result)) as Record<string, unknown>;

  assert.deepEqual(remote.result, localResult);
  assert.deepEqual(remote.result.calculationIdentity, localResult.calculationIdentity);
  assert.equal(remote.result.fortuneSelection, undefined);
  assert.equal(withoutCurrentTime(remote.prompt), withoutCurrentTime(local.prompt));
  assert.match(remote.prompt, /标准秒级输入下的事业结构/u);
});

test('本地八字提示词与公开 API 在真太阳时秒级及时区输入下保持一致', async () => {
  const input = {
    gender: 'female',
    year: 1988,
    month: 7,
    day: 18,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: 9,
    birthMinute: 0,
    birthSecond: 37,
    birthLongitude: 121.47,
    timeZoneId: 'Asia/Shanghai',
    baziFortuneScope: 'full',
    school: 'ziping',
    responseMode: 'full',
    question: '请比较真太阳时秒级输入的本命与完整运限。',
  };
  const local = calculateBaziReading(input);
  const remote = await callPublicBaziPrompt(input);
  const localResult = JSON.parse(JSON.stringify(local.result)) as Record<string, unknown>;

  assert.deepEqual(remote.result, localResult);
  assert.deepEqual(remote.result.calculationIdentity, localResult.calculationIdentity);
  assert.equal(remote.result.fortuneSelection, undefined);
  assert.equal(withoutCurrentTime(remote.prompt), withoutCurrentTime(local.prompt));
  assert.match(remote.prompt, /八字流派：子平派/u);
  assert.throws(() => calculateBaziReading({ ...input, timezone: 8 }), /历史偏移不一致/);
});

test('本地八字提示词与公开 API 在农历时辰输入下保持一致', async () => {
  const input = {
    gender: 'male',
    year: 1990,
    month: 4,
    day: 12,
    dateType: 'lunar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    timeIndex: 4,
    baziFortuneScope: 'natal',
    responseMode: 'full',
    question: '请说明农历出生时辰对应的命局重点。',
  };
  const local = calculateBaziReading(input);
  const remote = await callPublicBaziPrompt(input);
  const localResult = JSON.parse(JSON.stringify(local.result)) as Record<string, unknown>;

  assert.deepEqual(remote.result, localResult);
  assert.deepEqual(remote.result.calculationIdentity, localResult.calculationIdentity);
  assert.equal(withoutCurrentTime(remote.prompt), withoutCurrentTime(local.prompt));
});

test('本地八字提示词与公开 API 保持神煞规则、选定大运和流派一致', async () => {
  const input = {
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    timeIndex: 8,
    shenShaScope: 'all',
    shenShaVariants: {
      referenceProfile: 'classical',
      kongWangBasis: 'day-and-year',
      yangRenMode: 'include-yin-ren',
      tongZiScope: 'all-pillars',
    },
    baziFortuneScope: 'dayun',
    baziFortuneCycleIndex: 0,
    school: 'mangpai',
    responseMode: 'full',
    question: '请按指定流派分析当前大运，并保留神煞规则事实。',
  };
  const local = calculateBaziReading(input);
  const remote = await callPublicBaziPrompt(input);
  const localResult = JSON.parse(JSON.stringify(local.result)) as Record<string, unknown>;

  assert.deepEqual(remote.result, localResult);
  assert.deepEqual(remote.result.calculationIdentity, localResult.calculationIdentity);
  assert.deepEqual(remote.result.fortuneSelection, localResult.fortuneSelection);
  assert.equal(remote.result.fortuneSelection && typeof remote.result.fortuneSelection, 'object');
  assert.equal(withoutCurrentTime(remote.prompt), withoutCurrentTime(local.prompt));
  assert.match(remote.prompt, /八字流派：盲派/u);
});
