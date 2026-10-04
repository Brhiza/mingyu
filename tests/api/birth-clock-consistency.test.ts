import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';
import { assertNoEngineeringPromptText, assertNoPromptPlaceholders } from '../prompt-assertions';

type BirthInput = Record<string, unknown>;

const birth = {
  name: '出生钟表一致性样本',
  gender: 'male',
  dateType: 'solar',
  year: 2024,
  month: 6,
  day: 1,
} as const;

async function callApi(path: string, input: BirthInput) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  const body = await response.json();
  return { status: response.status, body };
}

function assertSuccess(result: Awaited<ReturnType<typeof callApi>>) {
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.data;
}

test('姓名与起名四个HTTP入口保留当地出生钟表和实际时区', async () => {
  for (const clock of [
    { timezone: -4, timeZoneId: 'America/New_York', label: 'America/New_York，UTC-04:00' },
    { timezone: 5.75, timeZoneId: undefined, label: 'UTC+05:45' },
  ]) {
    const input = {
      ...birth,
      month: 7,
      birthHour: 1,
      birthMinute: 30,
      timezone: clock.timezone,
      ...(clock.timeZoneId ? { timeZoneId: clock.timeZoneId } : {}),
    };
    const bazi = assertSuccess(await callApi('bazi/calculate', input));
    const expectedPillars = ['year', 'month', 'day', 'hour'].map((key) => bazi.pillars[key].ganZhi);
    const analyze = assertSuccess(
      await callApi('name/analyze', { fullName: '李清和', birth: input }),
    );
    const analysisPrompt = assertSuccess(
      await callApi('name/analyze/prompt', { fullName: '李清和', birth: input }),
    );
    const generated = assertSuccess(
      await callApi('name/generate', { surname: '李', limit: 1, birth: input }),
    );
    const generationPrompt = assertSuccess(
      await callApi('name/generate/prompt', { surname: '李', limit: 1, birth: input }),
    );
    assert.equal(generated.length, 1);
    assert.equal(generationPrompt.candidates.length, 1);
    for (const context of [
      analyze.birthContext,
      analysisPrompt.analysis.birthContext,
      generated[0].analysis.birthContext,
      generationPrompt.candidates[0].analysis.birthContext,
    ]) {
      assert.equal(context.timeBasis.inputTime, '01:30');
      assert.equal(context.timeBasis.calculatedTime, '01:30');
      assert.equal(context.timeBasis.mode, '当地钟表时间（精确到分）');
      assert.equal(context.timeBasis.timezone, clock.timezone);
      assert.equal(context.timeBasis.timeZoneId, clock.timeZoneId ?? null);
      assert.deepEqual(context.pillars, expectedPillars);
    }
    for (const { prompt } of [analysisPrompt, generationPrompt]) {
      assert.ok(prompt.includes(`时间口径：当地钟表时间（精确到分）；时区：${clock.label}`));
      assert.ok(prompt.includes(`四柱：${expectedPillars.join(' ')}`));
      assert.doesNotMatch(prompt, /标准北京时间|地点记录：未提供|真太阳时校正经度/);
      assertNoPromptPlaceholders(prompt);
      assertNoEngineeringPromptText(prompt);
    }
  }
});

test('无秒钟表按零秒统一八字、紫微单盘与合参时辰', async () => {
  for (const [birthHour, birthMinute] of [
    [0, 5],
    ['0', '5'],
  ]) {
    const input = { ...birth, birthHour, birthMinute, timeIndex: 6 };
    const bazi = assertSuccess(await callApi('bazi/calculate', input));
    const ziwei = assertSuccess(await callApi('ziwei/calculate', input));
    const combined = assertSuccess(
      await callApi('bazi-ziwei/prompt', {
        ...input,
        question: '请核对本命盘。',
        promptScope: 'origin',
        responseMode: 'full',
      }),
    );

    assert.equal(bazi.timeInfo.index, 0);
    assert.equal(bazi.pillars.hour.ganZhi, ziwei.basicInfo.four_pillars.hour_pillar);
    assert.equal(ziwei.basicInfo.birth_time_label, '早子时');
    assert.equal(combined.result.bazi.timeInfo.index, 0);
    assert.equal(combined.result.bazi.pillars.hour.ganZhi, bazi.pillars.hour.ganZhi);
    assert.equal(
      combined.result.ziwei.basicInfo.four_pillars.hour_pillar,
      bazi.pillars.hour.ganZhi,
    );
    assert.equal(combined.result.ziwei.basicInfo.birth_time_label, '早子时');
  }
});

test('仅时分可省略时辰索引，提示词机器身份保留零秒并可重放', async () => {
  const input = { ...birth, birthHour: '0', birthMinute: '5' };
  const bazi = assertSuccess(await callApi('bazi/calculate', input));
  const ziwei = assertSuccess(await callApi('ziwei/calculate', input));
  assert.equal(bazi.timeInfo.index, 0);
  assert.equal(ziwei.basicInfo.birth_time_label, '早子时');

  for (const [path, replayPath] of [
    ['bazi/prompt', 'bazi/calculate'],
    ['ziwei/prompt', 'ziwei/calculate'],
  ]) {
    const prompt = assertSuccess(
      await callApi(path, {
        ...input,
        question: '请核对本命盘。',
        promptScope: 'origin',
        baziFortuneScope: 'natal',
        responseMode: 'full',
      }),
    );
    const identityBirth = prompt.result.calculationIdentity.birth;
    assert.equal(identityBirth.birthHour, 0);
    assert.equal(identityBirth.birthMinute, 5);
    assert.equal(identityBirth.birthSecond, 0);
    assert.equal(identityBirth.timeIndex, undefined);
    const replay = assertSuccess(await callApi(replayPath, identityBirth));
    if (replayPath === 'bazi/calculate') {
      assert.deepEqual(replay.pillars, bazi.pillars);
    } else {
      assert.equal(
        replay.basicInfo.four_pillars.hour_pillar,
        ziwei.basicInfo.four_pillars.hour_pillar,
      );
    }
  }
});

test('紫微 HTTP 单盘与提示词采用同一农历夏令时跨日事实，身份可原样重放', async () => {
  const input = {
    ...birth,
    year: 1990,
    month: 4,
    day: 21,
    dateType: 'lunar',
    birthHour: 0,
    birthMinute: 20,
    birthSecond: 17,
    timeZoneId: 'Asia/Chongqing',
    timezone: 9,
  };
  const calculated = assertSuccess(await callApi('ziwei/calculate', input));
  const prompt = assertSuccess(
    await callApi('ziwei/prompt', {
      ...input,
      question: '请解读本命盘。',
      promptScope: 'origin',
      responseMode: 'full',
    }),
  );
  assert.equal(calculated.basicInfo.solar_date, '1990-05-14');
  assert.equal(calculated.basicInfo.birth_time_label, '晚子时');
  assert.deepEqual(prompt.result.basicInfo.four_pillars, calculated.basicInfo.four_pillars);
  assert.match(prompt.prompt, /1990-05-14/);
  assert.match(prompt.prompt, /晚子时/);
  assertNoEngineeringPromptText(prompt.prompt);
  assertNoPromptPlaceholders(prompt.prompt);
  const identity = prompt.result.calculationIdentity.birth;
  assert.equal(identity.dateType, 'lunar');
  assert.equal(identity.birthSecond, 17);
  assert.equal(identity.timeZoneId, 'Asia/Chongqing');
  const replay = assertSuccess(await callApi('ziwei/calculate', identity));
  assert.deepEqual(replay.basicInfo, calculated.basicInfo);
});

test('紫微 HTTP 普通钟表入口拒绝 IANA 缺口、未消歧回拨与冲突偏移', async () => {
  for (const clock of [
    { month: 3, day: 10, birthHour: 2, birthMinute: 30 },
    { month: 11, day: 3, birthHour: 1, birthMinute: 30 },
    { month: 7, day: 1, birthHour: 12, birthMinute: 0, timezone: -5 },
    { month: 7, day: 1, birthHour: 12, birthMinute: 0, applyChinaDst: true },
  ]) {
    for (const path of ['ziwei/calculate', 'ziwei/prompt']) {
      const result = await callApi(path, {
        ...birth,
        timeZoneId: 'America/New_York',
        ...clock,
        question: '请解读本命盘。',
        promptScope: 'origin',
      });
      assert.equal(result.status, 400, `${path}: ${JSON.stringify(result.body)}`);
      assert.equal(result.body.error.code, 'BAD_REQUEST');
    }
  }
});

test('传统时辰与空表单沿用索引，部分钟表和坏值明确拒绝', async () => {
  const traditional = { ...birth, timeIndex: 6 };
  const bazi = assertSuccess(await callApi('bazi/calculate', traditional));
  const ziwei = assertSuccess(
    await callApi('ziwei/calculate', { ...traditional, birthHour: '', birthMinute: '' }),
  );
  assert.equal(bazi.timeInfo.index, 6);
  assert.match(ziwei.basicInfo.birth_time_range, /11:00~13:00/);
  const unknown = assertSuccess(
    await callApi('bazi/calculate', { ...birth, timeIndex: -1, detailMode: 'full' }),
  );
  assert.equal(unknown.isThreePillars, true);

  for (const invalidClock of [
    { birthHour: 0 },
    { birthMinute: '5' },
    { birthSecond: 1 },
    { birthHour: 'bad', birthMinute: '5' },
    { birthHour: 24, birthMinute: 5 },
  ]) {
    for (const path of ['bazi/calculate', 'ziwei/calculate', 'bazi-ziwei/prompt']) {
      const result = await callApi(path, {
        ...traditional,
        ...invalidClock,
        question: '请核对本命盘。',
      });
      assert.equal(result.status, 400, `${path}: ${JSON.stringify(result.body)}`);
    }
  }
});
