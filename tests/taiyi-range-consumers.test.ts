import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDivinationTime, reverseBaziDates } from 'mingyu-core/calendar';
import { generateTaiyi } from 'mingyu-core/taiyi';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

function createDraft(
  startText = '2026-06-21 15:00:00',
  scope: DivinationDraft['taiyiScope'] = 'hour',
): DivinationDraft {
  const date = new Date(`${startText.replace(' ', 'T')}+08:00`);
  const year = Number(startText.slice(0, 4));
  const pillars = getDivinationTime(date, 480).ganzhi;
  const candidate = reverseBaziDates({ pillars, startYear: year, endYear: year }).candidates.find(
    (item) => item.start.text === startText,
  );
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  return {
    ...defaultDraft,
    method: 'taiyi',
    taiyiScope: scope,
    question: '合成太乙日期区间验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: startText.slice(0, 10),
    customDivinationTime: startText.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
}

test('太乙时计在夏至交接保留两局并传给页面、摘要和分享', async () => {
  const session = await generateDivinationSession(createDraft());
  assert.equal(session.taiyiRange?.status, 'conditional');
  assert.equal(session.taiyiRange.branches.length, 2);
  assert.deepEqual(
    session.taiyiRange.branches.map((branch) => branch.data.yinYang),
    ['阳遁', '阴遁'],
  );
  assert.deepEqual(session.data, session.taiyiRange.branches[0]!.data);
  assert.equal(session.selection?.scope, 'hourly');
  const boundary = Date.parse('2026-06-21T16:24:30+08:00');
  assert.equal(session.taiyiRange.branches[0]!.endTimestamp, boundary);
  assert.equal(session.taiyiRange.branches[1]!.startTimestamp, boundary);
  for (const branch of session.taiyiRange.branches) {
    assert.deepEqual(
      branch.data,
      generateTaiyi({ scope: 'hour', date: new Date(branch.startTimestamp) }),
    );
  }
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-taiyi-board"/g) ?? []).length, 2);
  const share = formatDivinationSessionShareText(session);
  for (const text of [
    html,
    share,
    session.prompt,
    getDivinationSessionSummary(session).lines.join('\n'),
  ]) {
    for (const value of ['15:00:00', '16:24:30', '17:00:00', '阳遁', '阴遁'])
      assert.ok(text.includes(value), `缺少${value}`);
  }
  assert.doesNotMatch(session.prompt, /【当前时间】/);
});

test('太乙月日计保留完整稳定区间，旧文本来源保持单盘', async () => {
  for (const scope of ['month', 'day'] as const) {
    const draft = createDraft('2026-06-21 15:00:00', scope);
    const session = await generateDivinationSession(draft);
    assert.equal(session.taiyiRange?.status, 'stable');
    assert.equal(session.taiyiRange.branches.length, 1);
    assert.equal(session.selection?.scope, scope === 'month' ? 'monthly' : 'daily');
    assert.ok(session.prompt.includes('15:00:00') && session.prompt.includes('17:00:00'));
  }
  const draft = createDraft();
  const source = draft.divinationReverseSource!;
  const legacy = await generateDivinationSession({
    ...draft,
    divinationReverseSource: {
      pillars: source.pillars,
      intervalStart: source.intervalStart,
      intervalEnd: source.intervalEnd,
    },
  });
  assert.equal(legacy.taiyiRange, undefined);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session: legacy }));
  assert.equal((html.match(/class="traditional-board traditional-taiyi-board"/g) ?? []).length, 1);
});

test('太乙冬至跨午夜候选完整保留遁局及日期边界', async () => {
  const session = await generateDivinationSession(createDraft('2025-12-21 23:00:00'));
  assert.ok(session.taiyiRange);
  assert.equal(session.taiyiRange.status, 'conditional');
  const range = session.taiyiRange;
  assert.equal(range.branches[0]!.data.yinYang, '阴遁');
  assert.equal(range.branches[1]!.data.yinYang, '阳遁');
  assert.equal(range.branches[0]!.endTimestamp, Date.parse('2025-12-21T23:03:05+08:00'));
  assert.equal(range.branches.at(-1)!.endTimestamp, range.source.endTimestamp);
  for (const text of [session.prompt, formatDivinationSessionShareText(session)]) {
    for (const value of ['2025-12-21 23:00:00', '23:03:05', '2025-12-22 01:00:00'])
      assert.ok(text.includes(value), `缺少${value}`);
  }
});

test('太乙区间历史恢复保留完整双局与分享', async () => {
  const draft = createDraft();
  const session = await generateDivinationSession(draft);
  assert.equal(session.taiyiRange?.branches.length, 2);
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
    assert.deepEqual(restored.session.taiyiRange, JSON.parse(JSON.stringify(session.taiyiRange)));
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
