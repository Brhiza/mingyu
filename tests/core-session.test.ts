import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDivinationResult,
  generateDivinationSession,
  serializeDivinationResult,
  validateDivinationRequest,
} from 'mingyu-core/divination/session';
import { createConsumptionView } from 'mingyu-core/consumption';
import type { HuangjiJingshiResult } from 'mingyu-core/huangji-jingshi';

test('统一占法会话应覆盖时间课、摘要、提示词和稳定序列化', () => {
  const session = generateDivinationSession({
    method: 'xiaoliuren',
    question: '这件事接下来如何推进？',
    divinationTime: '2026-08-06T12:30:00+08:00',
    currentTime: '2026-08-06T12:30:00+08:00',
  });

  assert.equal(session.method, 'xiaoliuren');
  assert.equal(session.summary.title, '小六壬起课结果');
  assert.match(session.formattedResult, /占得宫/);
  assert.match(session.formattedResult, /起课过程/);
  assert.match(session.formattedResult, /定日宫：从月宫.+起初一（.+），顺数至.+日，落/u);
  assert.match(session.formattedResult, /定时宫：从日宫.+起子时，顺数至/u);
  assert.doesNotMatch(session.formattedResult, /定位用途：/u);
  assert.ok(
    session.formattedResult.includes(
      `占得宫：${(session.data as import('../packages/core/src/types/divination').XiaoliurenData).primary.name}`,
    ),
  );
  assert.doesNotMatch(session.formattedResult, /mod\s*6|时序\d+/);
  assert.match(session.prompt, /这件事接下来如何推进/);
  assert.match(session.serializedResult, /"primary"/);
  assert.equal(session.serializedResult, serializeDivinationResult(session.data));
  assert.equal(session.formattedResult, formatDivinationResult(session.method, session.data));
  assert.equal(session.displaySummary, session.summary);
  assert.match(session.aiPrompt, /【占卜资料】/);
  assert.match(session.aiPrompt, /这件事接下来如何推进/);
  assert.doesNotMatch(session.aiPrompt, /结构化证据|证据汇总|计算链|古籍依据|资料来源/);
  assert.ok(session.auditEvidence.some((item) => item.field === 'calculation'));
  assert.ok(session.auditEvidence.some((item) => item.field === 'evidenceAnalysis'));
  assert.equal(session.view.kind, 'xiaoliuren');
  assert.equal(session.view.schemaVersion.length > 0, true);
  assert.equal(session.view.raw, session.data);
  assert.equal(session.view.evidence, session.auditEvidence);
  assert.doesNotMatch(session.displaySummary.lines.join('\n'), /证据链|计算链|古籍依据/);
});

test('五种时间课的两种提示词应区分历史起课时刻与当前时间', () => {
  const divinationTime = '2020-01-01T10:30:00+08:00';
  const currentTime = '2026-09-30T10:30:00+08:00';
  for (const method of ['liuyao', 'meihua', 'jinkoujue', 'qimen', 'liuren'] as const) {
    const historical = generateDivinationSession({
      method,
      question: '历史起课时间核对',
      divinationTime,
      currentTime,
    });
    for (const text of [historical.prompt, historical.aiPrompt]) {
      assert.match(text, /【当前时间】\n公历：2026年9月30日 10时30分（UTC\+08:00）/);
      assert.match(text, /【起课时间】\n公历：2020年1月1日 10时30分（UTC\+08:00）/);
      assert.equal((text.match(/【起课时间】/g) ?? []).length, 1);
      assert.doesNotMatch(text, /termReferenceTimestamp|timestamp|API|MCP/);
    }

    const sameTime = generateDivinationSession({
      method,
      question: '同一时点核对',
      divinationTime,
      currentTime: divinationTime,
    });
    assert.doesNotMatch(sameTime.prompt, /【起课时间】/);
    assert.doesNotMatch(sameTime.aiPrompt, /【起课时间】/);
  }
});

test('奇门在线任务书应保留问题对应的复合格局事实', () => {
  const session = generateDivinationSession({
    method: 'qimen',
    question: '何时推进',
    currentTime: '2026-05-01T00:00:00Z',
    divinationTime: '2026-06-15T08:00:00+08:00',
  });
  const combos = (session.data as { patternCombos?: Array<{ key: string }> }).patternCombos;

  assert.ok(combos?.some((item) => item.key === 'combo:zhiFuOpenClose:2'));
  assert.match(session.prompt, /值符开通闭塞（坤二宫）/);
  assert.match(session.aiPrompt, /值符开通闭塞（坤二宫）/);
  assert.match(session.aiPrompt, /符临2宫为闭塞/);
  assert.match(session.aiPrompt, /【当前时间】\n公历：2026年5月1日 8时0分（UTC\+08:00）/);
  assert.match(session.aiPrompt, /【起课时间】\n公历：2026年6月15日 8时0分（UTC\+08:00）/);
  assert.equal((session.aiPrompt.match(/【当前时间】/g) ?? []).length, 1);
  assert.equal((session.aiPrompt.match(/【起课时间】/g) ?? []).length, 1);
  assert.equal((session.aiPrompt.match(/复合格局：/g) ?? []).length, 1);
  assert.match(session.aiPrompt, /【任务】[\s\S]*【问题】\n何时推进/);
});

test('真太阳时起课同时标明原民用占时与校正时刻', () => {
  const session = generateDivinationSession({
    method: 'liuyao',
    question: '真太阳时起课时间核对',
    divinationTime: '2020-01-01T09:30:00+08:00',
    currentTime: '2026-09-30T10:30:00+08:00',
    liuyao: { termReferenceDate: new Date('2020-01-01T10:30:00+08:00') },
  });
  for (const text of [session.prompt, session.aiPrompt]) {
    assert.match(text, /【起课时间】\n公历：2020年1月1日 10时30分（UTC\+08:00）/);
    assert.match(text, /真太阳时校正时刻：2020年1月1日 9时30分（UTC\+08:00）（用于排盘）/);
    assert.doesNotMatch(text, /termReferenceTimestamp|timestamp/);
  }

  const sameCivilTime = generateDivinationSession({
    method: 'liuyao',
    question: '同分钟真太阳时核对',
    divinationTime: '2020-01-01T09:30:00+08:00',
    currentTime: '2020-01-01T10:30:00+08:00',
    liuyao: { termReferenceDate: new Date('2020-01-01T10:30:00+08:00') },
  });
  for (const text of [sameCivilTime.prompt, sameCivilTime.aiPrompt]) {
    assert.match(
      text,
      /【起课时间】\n真太阳时校正时刻：2020年1月1日 9时30分（UTC\+08:00）（用于排盘）/,
    );
    assert.equal((text.match(/公历：2020年1月1日 10时30分（UTC\+08:00）/g) ?? []).length, 1);
  }
});

test('任意核心结果应可投影为统一消费视图并保留原始结果', () => {
  const raw = {
    summary: { label: '简要结果' },
    timing: { date: '2026-08-10' },
    warnings: ['边界提示'],
    chartValue: '盘面值',
    evidenceAnalysis: { source: '审计来源', calculationSteps: ['步骤一'] },
  };
  const view = createConsumptionView({ kind: 'example', input: { value: 1 }, raw });

  assert.equal(view.kind, 'example');
  assert.deepEqual(view.summary, raw.summary);
  assert.deepEqual(view.timing, raw.timing);
  assert.deepEqual(view.warnings, raw.warnings);
  assert.equal((view.chart as { chartValue: string }).chartValue, '盘面值');
  assert.equal(view.evidence[0]?.field, 'evidenceAnalysis');
  assert.equal(view.raw, raw);
});

test('统一占法会话应保留手工六爻输入并支持随机牌阵种子', () => {
  const liuyao = generateDivinationSession({
    method: 'liuyao',
    question: '手工六爻测试',
    liuyao: { method: 'manual', yaos: [7, 8, 9, 6, 7, 8] },
  });
  assert.deepEqual(liuyao.data.yaoArray, [7, 8, 9, 6, 7, 8]);
  assert.doesNotMatch(liuyao.aiPrompt, /；；|、、|世应：、|、$/m);
  assert.match(liuyao.aiPrompt, /^世应：世爻第\d爻.*应爻第\d爻/m);
  assert.match(liuyao.aiPrompt, /六爻全表：/);
  assert.equal((liuyao.aiPrompt.match(/^世应：/gm) ?? []).length, 1);

  const tarot = generateDivinationSession({
    method: 'tarot',
    question: '牌阵测试',
    tarot: { spread: 'three' },
    random: { seed: 'session-test' },
  });
  assert.equal(tarot.data.cards.length, 3);
  assert.match(tarot.prompt, /牌阵/);
});

test('统一占法会话应在计算前拒绝缺少占法问题', () => {
  assert.throws(() => validateDivinationRequest({ method: 'meihua' }), /需要提供问题/);
});

test('统一占法会话应拒绝无时区文本、不存在的日期及隐式转换的时间输入', () => {
  const request = { method: 'meihua' as const, question: '核对起课时刻' };
  for (const value of [
    '2026-02-30T10:30:00+08:00',
    '2026-02-01T10:30:00',
    '2026-02-01',
    true,
    null,
    [],
    { valueOf: () => Date.parse('2026-02-01T10:30:00+08:00') },
    Number.NaN,
    Number.POSITIVE_INFINITY,
    new Date(Number.NaN),
  ]) {
    for (const field of ['divinationTime', 'currentTime'] as const) {
      const input = { ...request, [field]: value } as Parameters<
        typeof generateDivinationSession
      >[0];
      assert.throws(() => validateDivinationRequest(input), /有效日期|有效 ISO/);
      assert.throws(() => generateDivinationSession(input), /有效日期|有效 ISO/);
    }
  }
});

test('统一占法会话的 ISO、Date 与毫秒时间戳应对应同一盘面与提示词', () => {
  const iso = '2026-02-01T10:30:00+08:00';
  const originalDate = new Date(iso);
  const makeSession = (time: Date | string | number) =>
    generateDivinationSession({
      method: 'meihua',
      question: '核对相同时刻',
      divinationTime: time,
      currentTime: time,
    });
  const reference = makeSession(iso);
  for (const input of [originalDate, originalDate.getTime(), originalDate.toISOString()]) {
    const result = makeSession(input);
    assert.deepEqual(result.data, reference.data);
    assert.equal(result.prompt, reference.prompt);
    assert.equal(result.aiPrompt, reference.aiPrompt);
  }
  assert.equal(originalDate.toISOString(), '2026-02-01T02:30:00.000Z');
});

test('随机选择太乙时应根据起课时刻的北京时间年份生成年计盘', () => {
  const session = generateDivinationSession({
    method: 'random',
    question: '核对跨年太乙盘',
    divinationTime: '2024-12-31T18:00:00Z',
    currentTime: '2026-09-30T00:00:00Z',
    random: { replay: [0.65] },
  });
  assert.equal(session.requestedMethod, 'random');
  assert.equal(session.method, 'taiyi');
  const data = session.data as import('../packages/core/src/types/divination').TaiyiResult;
  assert.equal(data.scope, 'year');
  assert.equal(data.dateTime, '2025-07-01 12:00:00');
  assert.match(session.aiPrompt, /2025年/);
});

test('太乙简版任务书应按计式保留目标时间且不输出代表时刻', () => {
  for (const [scope, expectedTime] of [
    ['year', '2025年'],
    ['month', '2025-01月'],
    ['day', '2025-01-01'],
    ['hour', '2025-01-01 02:00:00'],
  ] as const) {
    const session = generateDivinationSession({
      method: 'taiyi',
      question: '核对太乙目标时间',
      divinationTime: '2024-12-31T18:00:00Z',
      currentTime: '2026-09-30T00:00:00Z',
      taiyi: { scope, ...(scope === 'year' ? { year: 2025 } : {}) },
    });
    for (const text of [session.prompt, session.aiPrompt]) {
      assert.ok(text.includes(`起局时间：${expectedTime}`), `${scope}计缺少目标时间`);
      assert.equal((text.match(/起局时间：/g) ?? []).length, 1);
      if (scope === 'year') assert.doesNotMatch(text, /2025-07-01 12:00:00/);
    }
  }
});

test('太乙月日时会话保留传入年份并按实际东八区起局日期核对', () => {
  for (const scope of ['month', 'day', 'hour'] as const) {
    const request = {
      method: 'taiyi' as const,
      question: '核对太乙起局年份。',
      divinationTime: '2025-12-31T16:30:15Z',
      currentTime: '2026-01-01T00:30:15+08:00',
    };
    const omitted = generateDivinationSession({ ...request, taiyi: { scope } });
    const matched = generateDivinationSession({ ...request, taiyi: { scope, year: 2026 } });
    const data = matched.data as import('../packages/core/src/types/divination').TaiyiResult;
    assert.equal(data.scope, scope);
    assert.equal(data.dateTime, '2026-01-01 00:30:15');
    assert.deepEqual(matched.data, omitted.data);
    assert.equal(matched.prompt, omitted.prompt);
    assert.equal(matched.aiPrompt, omitted.aiPrompt);
    for (const year of [2025, 0]) {
      assert.throws(
        () => generateDivinationSession({ ...request, taiyi: { scope, year } }),
        /太乙 year 与 date 的公历年份不一致/u,
        `${scope}计必须核对传入的${year}年`,
      );
    }
  }
});

test('随机占法会话应完整消费重放记录并拒绝剩余样本', () => {
  const request = {
    method: 'random' as const,
    question: '核对随机记录',
    divinationTime: '2026-02-01T10:30:00+08:00',
    currentTime: '2026-02-01T10:30:00+08:00',
  };
  assert.equal(
    generateDivinationSession({ ...request, random: { replay: [0.25] } }).method,
    'xiaoliuren',
  );
  assert.throws(
    () => generateDivinationSession({ ...request, random: { replay: [0.25, 0.3] } }),
    /随机重放样本有剩余/,
  );
});

test('显式占法会话应拒绝未被起课过程使用的重放记录', () => {
  const request = {
    question: '核对随机记录',
    divinationTime: '2026-02-01T10:30:00+08:00',
    currentTime: '2026-02-01T10:30:00+08:00',
    random: { replay: [0.25] },
  };
  for (const method of ['xiaoliuren', 'qimen', 'liuyao'] as const) {
    assert.throws(() => generateDivinationSession({ ...request, method }), /随机重放样本有剩余/);
  }
  assert.throws(
    () =>
      generateDivinationSession({
        ...request,
        method: 'ssgw',
        ssgw: { method: 'manual', number: 1 },
      }),
    /随机重放样本有剩余/,
  );
  const replay = Array(5).fill(0.25);
  const kongming = generateDivinationSession({
    ...request,
    method: 'kongming',
    random: { replay },
  });
  assert.deepEqual(
    (kongming.data as import('../packages/core/src/name-number').KongmingHexagramResult).random
      ?.samples,
    replay,
  );
  assert.throws(
    () =>
      generateDivinationSession({
        ...request,
        method: 'kongming',
        random: { replay: [...replay, 0.25] },
      }),
    /随机重放样本有剩余/,
  );
});

test('三钱与蓍草会话应复用统一种子并支持相同随机样本重放', () => {
  for (const method of ['coins', 'yarrow'] as const) {
    const request = {
      method: 'liuyao' as const,
      question: '核对六爻随机记录',
      divinationTime: '2026-02-01T10:30:00+08:00',
      currentTime: '2026-02-01T10:30:00+08:00',
      liuyao: { method },
      random: { seed: '统一六爻种子' },
    };
    const first = generateDivinationSession(request);
    assert.deepEqual(generateDivinationSession(request).data, first.data);
    const data = first.data as import('../packages/core/src/types/divination').LiuyaoData;
    assert.equal(data.meta?.random?.mode, 'seeded');
    const samples = data.meta?.random?.samples;
    assert.ok(samples?.length);
    const replay = generateDivinationSession({ ...request, random: { replay: samples } });
    const replayData = replay.data as import('../packages/core/src/types/divination').LiuyaoData;
    assert.deepEqual(replayData.yaoArray, data.yaoArray);
    assert.deepEqual(replayData.generation, data.generation);
    assert.equal(replayData.meta?.random?.mode, 'replay');
    assert.deepEqual(replayData.meta?.random?.samples, samples);
  }
});

test('手摇三钱记录应保留原爻值且不消费统一种子', () => {
  const coinThrows = Array.from({ length: 6 }, () => ({
    coins: [2, 2, 3] as const,
    total: 7 as const,
  }));
  const session = generateDivinationSession({
    method: 'liuyao',
    question: '核对手摇记录',
    divinationTime: '2026-02-01T10:30:00+08:00',
    currentTime: '2026-02-01T10:30:00+08:00',
    liuyao: { method: 'coins', coinThrows },
    random: { seed: '统一六爻种子' },
  });
  const data = session.data as import('../packages/core/src/types/divination').LiuyaoData;
  assert.deepEqual(data.yaoArray, [7, 7, 7, 7, 7, 7]);
  assert.deepEqual(data.generation?.coinThrows, coinThrows);
  assert.equal(data.meta?.random, undefined);
});

test('统一占法会话应支持金口诀指定地分并在计算前校验输入', () => {
  const session = generateDivinationSession({
    method: 'jinkoujue',
    question: '这件事接下来如何推进？',
    divinationTime: '2026-07-11T14:35:00+08:00',
    jinkoujue: { method: 'branch', branch: '申' },
  });
  assert.equal(session.data.method, 'branch');
  assert.equal(session.data.diFenBranch, '申');
  assert.match(session.aiPrompt, /地分申/);

  assert.throws(
    () =>
      validateDivinationRequest({
        method: 'jinkoujue',
        question: '测试',
        jinkoujue: { method: 'branch' },
      }),
    /指定地分必须是/,
  );
});

test('黄历 AI 提示词应保留用户时段偏好与已计算候选时辰', () => {
  const makeSession = (preference: 'morning' | 'afternoon') =>
    generateDivinationSession({
      method: 'almanac',
      question: '按所选时段推荐开业时辰。',
      currentTime: '2026-09-15T00:00:00Z',
      almanac: {
        topic: 'opening',
        startDate: '2026-09-15',
        endDate: '2026-09-15',
        timePreferences: [preference],
        participants: [],
      },
    });

  const morning = makeSession('morning');
  const afternoon = makeSession('afternoon');
  assert.notEqual(morning.aiPrompt, afternoon.aiPrompt);
  assert.match(morning.aiPrompt, /时段条件：优先上午/);
  assert.match(afternoon.aiPrompt, /时段条件：优先下午/);
  assert.match(morning.aiPrompt, /候选日期明细：共1日/);
  assert.match(morning.aiPrompt, /辰时07:00-09:00/);
  assert.match(afternoon.aiPrompt, /申时15:00-17:00/);
  assert.doesNotMatch(morning.aiPrompt, /evidenceAnalysis|calculationSteps|候选分类键/);
});

test('黄历在线任务书应覆盖十五日范围的末日事项与时辰事实', () => {
  const session = generateDivinationSession({
    method: 'almanac',
    question: '按所选时段择日开业',
    currentTime: '2026-05-01T00:00:00Z',
    almanac: {
      topic: 'opening',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      timePreferences: ['morning'],
      participants: [],
    },
  });
  const data = session.data as { days: Array<{ date: string }> };
  const promptLines = session.aiPrompt.split('\n');
  const lastDateIndex = promptLines.findIndex((line) => line.includes('第15日：2026-06-15'));

  assert.equal(data.days.length, 15);
  assert.match(session.aiPrompt, /【当前时间】\n公历：2026年5月1日 8时0分（UTC\+08:00）/);
  assert.match(session.aiPrompt, /【任务】[\s\S]*【问题】\n按所选时段择日开业/);
  assert.match(session.aiPrompt, /候选日期明细：共15日/);
  assert.equal((session.aiPrompt.match(/候选日期明细：共15日/g) ?? []).length, 1);
  assert.ok(lastDateIndex >= 0);
  assert.match(promptLines[lastDateIndex + 1] ?? '', /开市/);
  assert.match(promptLines[lastDateIndex + 1] ?? '', /时辰辰时07:00-09:00/);
});

test('统一占法会话应支持皇极经世值年盘', () => {
  const session = generateDivinationSession({
    method: 'huangji',
    question: '这一年的时势主线是什么？',
    huangji: { year: 2026 },
  });

  assert.equal(session.method, 'huangji');
  assert.equal(session.summary.title, '皇极经世结果');
  assert.match(session.formattedResult, /会内统卦：泽风大过/);
  assert.match(session.prompt, /值年卦：天火同人/);
  assert.equal(session.aiPrompt, session.prompt);
  assert.match(session.serializedResult, /"forecast"/);
});

test('统一占法会话应支持皇极经世年月日时盘', () => {
  const session = generateDivinationSession({
    method: 'huangji',
    question: '这个时点的时势主线是什么？',
    divinationTime: '2025-12-25T12:30:00+08:00',
  });

  assert.equal((session.data as HuangjiJingshiResult).input.mode, '年月日时');
  assert.match(
    session.formattedResult,
    /年月日时卦：月经天山遁；旬纬天火同人；日卦雷山小过；时经地山谦/,
  );
  assert.match(session.prompt, /时经卦：地山谦/);
});
