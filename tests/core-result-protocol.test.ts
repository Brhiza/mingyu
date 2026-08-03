import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MINGYU_SCHEMA_VERSION,
  MingyuCoreError,
  createResultMeta,
  hashStableValue,
  serializeCoreResult,
  stableStringify,
} from 'mingyu-core/result';
import { buildRandomTraceFact, createRandomContext } from 'mingyu-core/random';
import { normalizeBirthProfile, BirthProfileError } from 'mingyu-core/profile';
import { drawSpreadCards } from '../packages/core/src/divination/tarot';
import { drawRandomSign } from '../packages/core/src/divination/algorithms/ssgw';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index';
import { generateLiuyao } from '../packages/core/src/divination/algorithms/liuyao';
import { TimeManager } from '../packages/core/src/calendar/timeManager';

const DATE = new Date('2026-07-11T08:00:00+08:00');

test('稳定序列化不受对象键顺序影响并拒绝不可安全存储的数据', () => {
  const first = { b: 2, a: { d: 4, c: 3 }, omitted: undefined };
  const second = { a: { c: 3, d: 4 }, b: 2 };
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(hashStableValue(first), hashStableValue(second));
  assert.equal(
    serializeCoreResult({ date: new Date('2026-01-01T00:00:00Z') }),
    '{"date":"2026-01-01T00:00:00.000Z"}',
  );
  assert.throws(() => stableStringify({ value: Number.NaN }), /不支持 NaN/);
  assert.throws(() => stableStringify({ value: () => 1 }), /不支持 function/);
  assert.throws(() => stableStringify(undefined), /顶层 undefined/);
  assert.throws(() => stableStringify(new Map([['key', 'value']])), /只支持普通对象/);

  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => stableStringify(circular), /循环引用/);
});

test('结果身份在相同输入下保持稳定，计算时间不参与身份', () => {
  assert.equal(MINGYU_SCHEMA_VERSION, '1.0.0');
  const first = createResultMeta({
    algorithm: 'test.algorithm',
    input: { b: 2, a: 1 },
    calculatedAt: '2026-01-01T00:00:00Z',
  });
  const second = createResultMeta({
    algorithm: 'test.algorithm',
    input: { a: 1, b: 2 },
    calculatedAt: '2026-07-11T00:00:00Z',
  });

  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.resultId, second.resultId);
  assert.notEqual(first.calculatedAt, second.calculatedAt);
  assert.match(first.resultId, /^test\.algorithm:[0-9a-f]{16}$/);
  assert.throws(
    () => createResultMeta(undefined as never),
    (error: unknown) =>
      error instanceof MingyuCoreError && error.code === 'RESULT_META_OPTIONS_INVALID',
  );
  assert.throws(
    () =>
      createResultMeta({
        algorithm: 'test.algorithm',
        input: {},
        random: { mode: 'replay', samples: [1] },
      }),
    (error: unknown) =>
      error instanceof MingyuCoreError && error.code === 'RANDOM_TRACE_SAMPLE_INVALID',
  );
});

test('统一错误可结构化输出，出生档案错误继续保持兼容类型', () => {
  let caught: unknown;
  try {
    const profile = normalizeBirthProfile({
      gender: 'female',
      calendarType: 'solar',
      year: 1990,
      month: 5,
      day: 15,
    } as never);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof BirthProfileError);
  assert.ok(caught instanceof MingyuCoreError);
  assert.deepEqual(caught.toJSON(), {
    name: 'BirthProfileError',
    code: 'TIME_REQUIRED',
    category: 'validation',
    message: '请提供明确的出生时辰，或完整的出生小时和分钟。',
    field: 'timeIndex',
    recoverable: true,
    diagnostics: [
      {
        code: 'TIME_REQUIRED',
        level: 'error',
        field: 'timeIndex',
        message: '请提供明确的出生时辰，或完整的出生小时和分钟。',
      },
    ],
    context: undefined,
  });
});

test('随机上下文支持种子记录和原始样本重放', () => {
  const seeded = createRandomContext({ seed: '固定种子' });
  const values = [seeded.random(), seeded.random(), seeded.random()];
  const trace = seeded.getTrace();
  assert.equal(trace.mode, 'seeded');
  assert.equal(trace.seed, '固定种子');
  assert.deepEqual(trace.samples, values);

  const replay = createRandomContext({ replay: trace.samples });
  assert.deepEqual([replay.random(), replay.random(), replay.random()], values);
  assert.equal(replay.getTrace().mode, 'replay');
  assert.throws(
    () => replay.random(),
    (error: unknown) =>
      error instanceof MingyuCoreError && error.code === 'RANDOM_REPLAY_EXHAUSTED',
  );
  assert.throws(() => createRandomContext({ seed: 1, replay: [0.5] }), /只能提供一种/);
});

test('随机轨迹事实应区分可重放、轨迹缺失和不适用', () => {
  const replayable = buildRandomTraceFact({
    key: 'random:test:seeded',
    applicable: true,
    trace: { mode: 'seeded', seed: '结构化样例', samples: [0.1, 0.2] },
    processLabel: '测试生成过程',
    sources: ['测试输入', '随机元数据'],
  });
  assert.equal(replayable.status, '可重放');
  assert.equal(replayable.mode, 'seeded');
  assert.equal(replayable.seed, '结构化样例');
  assert.deepEqual(replayable.samples, [0.1, 0.2]);
  assert.equal(replayable.sampleCount, 2);
  assert.doesNotMatch(replayable.promptText, /结构化样例|0\.1|0\.2/);
  assert.match(replayable.limitation, /不表示可信度或预测有效性/);

  const missing = buildRandomTraceFact({
    key: 'random:test:missing',
    applicable: true,
    processLabel: '测试生成过程',
    sources: ['测试输入'],
  });
  assert.equal(missing.status, '缺少轨迹');
  assert.equal(missing.mode, '未记录');
  assert.equal(missing.sampleCount, 0);
  assert.match(missing.promptText, /无法核验或重放/);

  const notApplicable = buildRandomTraceFact({
    key: 'random:test:manual',
    applicable: false,
    processLabel: '手工录入过程',
    sources: ['手工输入'],
  });
  assert.equal(notApplicable.status, '不适用');
  assert.equal(notApplicable.mode, '不适用');
  assert.match(notApplicable.promptText, /不依赖随机抽样/);
});

test('塔罗、灵签和梅花可由结果元数据完整重放', () => {
  const tarot = drawSpreadCards('three', { seed: '塔罗样例' });
  const tarotReplay = drawSpreadCards('three', { replay: tarot.meta.random?.samples });
  assert.deepEqual(tarotReplay.cards, tarot.cards);
  assert.equal(tarotReplay.meta.resultId, tarot.meta.resultId);

  const sign = drawRandomSign(DATE, { seed: '灵签样例' });
  const signReplay = drawRandomSign(DATE, { replay: sign.meta?.random?.samples });
  assert.equal(signReplay.number, sign.number);
  assert.equal(signReplay.meta?.resultId, sign.meta?.resultId);

  const meihua = generateMeihua(DATE, { method: 'random', seed: '梅花样例' });
  const meihuaReplay = generateMeihua(DATE, {
    method: 'random',
    replay: meihua.meta?.random?.samples,
  });
  assert.deepEqual(meihuaReplay.calculation, meihua.calculation);
  assert.equal(meihuaReplay.meta?.resultId, meihua.meta?.resultId);
});

test('六爻保留时间、手工和模拟三钱三种来源及逐币轨迹', () => {
  const time = generateLiuyao(DATE);
  assert.equal(time.generation.method, 'time');
  assert.equal(time.generation.coinThrows?.length, 6);
  assert.deepEqual(time.yaoArray, TimeManager.generateYaosByTime(DATE.getTime(), 6));

  const manualYaos = [7, 8, 9, 6, 7, 8] as const;
  const manual = generateLiuyao(DATE, { method: 'manual', yaos: manualYaos });
  assert.deepEqual(manual.yaoArray, manualYaos);
  assert.equal(manual.generation.method, 'manual');
  assert.equal(manual.meta.random, undefined);

  const coins = generateLiuyao(DATE, { method: 'coins', seed: '三钱样例' });
  const replay = generateLiuyao(DATE, {
    method: 'coins',
    replay: coins.meta.random?.samples,
  });
  assert.deepEqual(replay.yaoArray, coins.yaoArray);
  assert.deepEqual(replay.generation.coinThrows, coins.generation.coinThrows);
  assert.equal(replay.meta.resultId, coins.meta.resultId);
  assert.equal(coins.generation.coinThrows?.flatMap((item) => item.coins).length, 18);
  const sourceItem = coins.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '起卦来源：模拟三钱起卦',
  );
  const randomItem = coins.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '六爻随机重放记录',
  );
  assert.equal(sourceItem?.level, '辅证');
  assert.match(sourceItem?.detail || '', /第1爻计算样本/);
  assert.match(sourceItem?.detail || '', /只说明卦象如何生成/);
  assert.equal(randomItem?.level, '辅证');
  assert.doesNotMatch(randomItem?.detail || '', /三钱样例/);
  assert.match(randomItem?.detail || '', /不表示可信度或预测有效性/);
  assert.equal(time.evidenceAnalysis?.generationFact.status, '可核验');
  assert.equal(time.evidenceAnalysis?.generationFact.method, 'time');
  assert.equal(time.evidenceAnalysis?.generationFact.recordedLineCount, 6);
  assert.equal(coins.evidenceAnalysis?.generationFact.status, '可核验');
  assert.equal(coins.evidenceAnalysis?.generationFact.coinThrows.length, 6);
  assert.equal(manual.evidenceAnalysis?.generationFact.status, '可核验');
  assert.deepEqual(manual.evidenceAnalysis?.generationFact.yaoValues, [...manualYaos]);
  assert.equal(manual.evidenceAnalysis?.generationFact.coinThrows.length, 0);
  assert.match(manual.evidenceAnalysis?.generationFact.limitation || '', /不证明预测有效性/);
  assert.equal(time.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(time.evidenceAnalysis?.randomFact.sampleCount, 18);
  assert.equal(coins.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(coins.evidenceAnalysis?.randomFact.seed, '三钱样例');
  assert.equal(coins.evidenceAnalysis?.randomFact.sampleCount, 18);
  assert.doesNotMatch(coins.evidenceAnalysis?.randomFact.promptText || '', /三钱样例/);
  assert.equal(manual.evidenceAnalysis?.randomFact.status, '不适用');
  assert.deepEqual(manual.evidenceAnalysis?.randomFacts, []);
  assert.ok(
    !manual.evidenceAnalysis?.evidence.items.some((item) => item.title === '六爻随机重放记录'),
  );

  assert.throws(() => generateLiuyao(DATE, { method: 'manual' }), /必须提供六个爻值/);
  assert.throws(
    () => generateLiuyao(DATE, { method: 'coins', yaos: manualYaos }),
    /不能同时提供手工爻值/,
  );

  const handShakenCoinThrows = [
    { coins: [2, 2, 2], total: 6 },
    { coins: [2, 2, 3], total: 7 },
    { coins: [2, 3, 3], total: 8 },
    { coins: [3, 3, 3], total: 9 },
    { coins: [2, 2, 3], total: 7 },
    { coins: [2, 3, 3], total: 8 },
  ] as const;
  const handShaken = generateLiuyao(DATE, {
    method: 'coins',
    coinThrows: handShakenCoinThrows,
  });
  assert.deepEqual(handShaken.yaoArray, [6, 7, 8, 9, 7, 8]);
  assert.deepEqual(handShaken.generation.coinThrows, handShakenCoinThrows);
  assert.equal(handShaken.meta.random, undefined);
  assert.equal(handShaken.evidenceAnalysis?.generationFact.status, '可核验');
  assert.throws(
    () =>
      generateLiuyao(DATE, {
        method: 'coins',
        coinThrows: handShakenCoinThrows.slice(0, -1),
      }),
    /必须恰好包含 6 爻/,
  );
});

test('非随机起法不得静默忽略随机设置', () => {
  assert.throws(() => generateMeihua(DATE, { method: 'time', seed: '不应忽略' }), /仅随机起卦接受/);
});
