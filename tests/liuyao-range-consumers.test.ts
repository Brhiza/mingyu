import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDivinationTime, reverseBaziDates } from 'mingyu-core/calendar';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

function createDraft(startText = '2024-02-19 11:00:00'): DivinationDraft {
  const pillars = getDivinationTime(new Date(`${startText.replace(' ', 'T')}+08:00`), 480).ganzhi;
  const candidate = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 }).candidates.find(
    (item) => item.start.text === startText,
  );
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  return {
    ...defaultDraft,
    method: 'liuyao',
    liuyaoMethod: 'manual',
    liuyaoYaos: [7, 8, 9, 6, 7, 8],
    question: '合成六爻日期区间验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: candidate.start.text.slice(0, 10),
    customDivinationTime: candidate.start.text.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
}

test('六爻四柱日期模式在交中气处展示各段背景并保持一次卦象', async () => {
  const session = await generateDivinationSession(createDraft());
  assert.equal(session.liuyaoRange?.status, 'conditional');
  assert.equal(session.liuyaoRange.branches.length, 2);
  const first = session.liuyaoRange.branches[0]!.data;
  assert.deepEqual(first.yaoArray, [7, 8, 9, 6, 7, 8]);
  for (const branch of session.liuyaoRange.branches) assert.deepEqual(branch.data, first);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-liuyao-board"/g) ?? []).length, 2);
  const share = formatDivinationSessionShareText(session);
  const header = share.split('\n').find((line) => line.startsWith('起卦时间：'));
  assert.ok(header?.includes('11:00:00') && header.includes('13:00:00'));
  for (const text of [
    html,
    share,
    getDivinationSessionSummary(session).lines.join('\n'),
    session.prompt,
  ]) {
    for (const value of ['11:00:00', '12:13:12', '13:00:00', '立春', '雨水', first.originalName]) {
      assert.ok(text.includes(value), `缺少${value}`);
    }
  }
  assert.doesNotMatch(session.prompt, /【当前时间】/);
});

test('时间起卦保留候选起点产生的原始结果并明确一次起卦来源', async () => {
  const draft = { ...createDraft(), liuyaoMethod: 'time' as const };
  const session = await generateDivinationSession(draft);
  const expected = generateLiuyao(new Date(draft.divinationReverseSource!.startTimestamp!), {
    method: 'time',
  });
  assert.ok(session.liuyaoRange);
  for (const branch of session.liuyaoRange.branches) {
    assert.deepEqual(branch.data, expected);
    assert.equal(branch.data.generation?.method, 'time');
  }
  for (const text of [session.prompt, formatDivinationSessionShareText(session)]) {
    assert.match(text, /时间起卦/);
    assert.match(text, /起点/);
    assert.match(text, /本次卦象/);
  }
});

test('六爻四种起法跨民用零点沿用同一记录并显示两天背景', async () => {
  const coinThrows: NonNullable<DivinationDraft['liuyaoCoinThrows']> = [
    { coins: [2, 2, 3], total: 7 },
    { coins: [2, 3, 3], total: 8 },
    { coins: [3, 3, 3], total: 9 },
    { coins: [2, 2, 2], total: 6 },
    { coins: [2, 2, 3], total: 7 },
    { coins: [2, 3, 3], total: 8 },
  ];
  for (const method of ['time', 'manual', 'coins', 'yarrow'] as const) {
    const session = await generateDivinationSession({
      ...createDraft('2024-02-04 23:00:00'),
      liuyaoMethod: method,
      liuyaoCoinThrows: coinThrows,
    });
    assert.equal(session.liuyaoRange?.status, 'conditional');
    assert.equal(session.liuyaoRange.branches.length, 2);
    const first = session.liuyaoRange.branches[0]!.data;
    for (const branch of session.liuyaoRange.branches) {
      assert.deepEqual(branch.data, first);
      assert.equal(branch.data.generation?.method, method);
    }
    if (method === 'coins') assert.deepEqual(first.generation?.coinThrows, coinThrows);
    if (method === 'yarrow') assert.equal(first.generation?.yarrow?.lines.length, 6);
    for (const text of [session.prompt, formatDivinationSessionShareText(session)]) {
      for (const value of ['2024-02-04', '2024-02-05', '00:00:00', '农历'])
        assert.ok(text.includes(value));
    }
  }
});

test('六爻稳定范围保留完整日期，旧文本来源仍兼容单盘', async () => {
  const draft = createDraft('2024-02-19 09:00:00');
  const stable = await generateDivinationSession(draft);
  assert.equal(stable.liuyaoRange?.status, 'stable');
  assert.equal(stable.liuyaoRange.branches.length, 1);
  assert.ok(stable.prompt.includes('09:00:00') && stable.prompt.includes('11:00:00'));
  const source = draft.divinationReverseSource!;
  const legacy = await generateDivinationSession({
    ...draft,
    divinationReverseSource: {
      pillars: source.pillars,
      intervalStart: source.intervalStart,
      intervalEnd: source.intervalEnd,
    },
  });
  assert.equal(legacy.liuyaoRange, undefined);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session: legacy }));
  assert.equal((html.match(/class="traditional-board traditional-liuyao-board"/g) ?? []).length, 1);
});

test('蓍草区间历史恢复保留十八变原始记录、全部背景和分享', async () => {
  const draft = { ...createDraft(), liuyaoMethod: 'yarrow' as const };
  const session = await generateDivinationSession(draft);
  assert.equal(session.liuyaoRange?.branches.length, 2);
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      dispatchEvent: () => true,
    },
  });
  try {
    const saved = addDivinationHistory(draft, session);
    assert.ok(saved);
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    assert.deepEqual(restored.session.liuyaoRange, JSON.parse(JSON.stringify(session.liuyaoRange)));
    assert.equal(restored.session.prompt, session.prompt);
    assert.equal(
      formatDivinationSessionShareText(restored.session),
      formatDivinationSessionShareText(session),
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
