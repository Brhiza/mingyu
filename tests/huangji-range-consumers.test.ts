import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDivinationTime, reverseBaziDates } from 'mingyu-core/calendar';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
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
    method: 'huangji',
    huangjiMethod: 'standard',
    question: '合成皇极日期区间验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: startText.slice(0, 10),
    customDivinationTime: startText.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
}

test('皇极同四柱候选内按四小时与交节边界保留三盘并传给全部消费者', async () => {
  const session = await generateDivinationSession(createDraft());
  const range = session.huangjiRange;
  assert.ok(range);
  assert.equal(range.status, 'conditional');
  assert.equal(range.branches.length, 3);
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast!.calendar.hourSegment),
    [3, 4, 4],
  );
  assert.deepEqual(
    range.branches.map((branch) => branch.data.dateTimeForecast!.calendar.activeSolarTerm),
    ['立春', '立春', '雨水'],
  );
  assert.deepEqual(session.data, range.branches[0]!.data);
  for (const branch of range.branches) {
    assert.deepEqual(
      branch.data,
      calculateHuangjiJingshi({
        date: new Date(branch.startTimestamp),
        question: session.question,
      }),
    );
  }
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal(
    (html.match(/class="traditional-board traditional-huangji-board"/g) ?? []).length,
    3,
  );
  for (const text of [
    html,
    session.prompt,
    formatDivinationSessionShareText(session),
    getDivinationSessionSummary(session).lines.join('\n'),
  ]) {
    for (const value of ['11:00:00', '12:00:00', '12:13:12', '13:00:00', '立春', '雨水'])
      assert.ok(text.includes(value), `缺少${value}`);
  }
  assert.doesNotMatch(session.prompt, /【当前时间】/u);
  assert.equal((session.prompt.match(/【任务】/gu) ?? []).length, 1);
});

test('皇极稳定候选保留范围，旧文本来源保持单盘', async () => {
  const draft = createDraft('2024-02-19 09:00:00');
  const session = await generateDivinationSession(draft);
  assert.equal(session.huangjiRange?.status, 'stable');
  assert.equal(session.huangjiRange.branches.length, 1);
  assert.ok(session.prompt.includes('09:00:00') && session.prompt.includes('11:00:00'));
  const source = draft.divinationReverseSource!;
  const legacy = await generateDivinationSession({
    ...draft,
    divinationReverseSource: {
      pillars: source.pillars,
      intervalStart: source.intervalStart,
      intervalEnd: source.intervalEnd,
    },
  });
  assert.equal(legacy.huangjiRange, undefined);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session: legacy }));
  assert.equal(
    (html.match(/class="traditional-board traditional-huangji-board"/g) ?? []).length,
    1,
  );
});

test('皇极六日逐爻继续使用明确目标和历元，不生成标准年月日时区间', async () => {
  const session = await generateDivinationSession({
    ...defaultDraft,
    method: 'huangji',
    huangjiMethod: 'six-day',
    question: '合成六日兼容验证',
    huangjiSixDayCalendarModel: 'six-day-explicit-epoch',
    divinationTimeMode: 'custom',
    customDivinationDate: '2026-08-24',
    customDivinationTime: '15:30',
    huangjiSixDayEpochDate: '2026-08-20',
    huangjiSixDayTimezone: '8',
  });
  assert.equal(session.huangjiRange, undefined);
  assert.equal(
    (session.data as ReturnType<typeof calculateHuangjiJingshi>).input.mode,
    '六日逐爻公历',
  );
});

test('皇极区间历史恢复保留完整三盘及两类分享资料', async () => {
  const draft = createDraft();
  const session = await generateDivinationSession(draft);
  assert.equal(session.huangjiRange?.branches.length, 3);
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
    assert.deepEqual(
      restored.session.huangjiRange,
      JSON.parse(JSON.stringify(session.huangjiRange)),
    );
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
