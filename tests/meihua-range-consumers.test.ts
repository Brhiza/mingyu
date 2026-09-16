import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reverseBaziDates } from 'mingyu-core/calendar';
import { formatMeihuaFacts } from '@core/prompt/meihua-facts';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

function createDraft(): DivinationDraft {
  const candidate = reverseBaziDates({
    pillars: { year: '甲辰', month: '丙寅', day: '己亥', hour: '甲子' },
    startYear: 2024,
    endYear: 2024,
  }).candidates.find((item) => item.start.text === '2024-02-04 23:00:00');
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  return {
    ...defaultDraft,
    method: 'meihua',
    meihuaMethod: 'time',
    question: '合成梅花日期区间验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: candidate.start.text.slice(0, 10),
    customDivinationTime: candidate.start.text.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
}

test('梅花从真实四柱候选进入分段盘面、摘要、分享和完整体用提示词', async () => {
  const session = await generateDivinationSession(createDraft());
  assert.equal(session.meihuaRange?.status, 'conditional');
  assert.deepEqual(
    session.meihuaRange.branches.map(({ data }) => [
      data.calculation?.upperTrigramIndex,
      data.calculation?.lowerTrigramIndex,
      data.movingYao.position,
    ]),
    [
      [1, 2, 6],
      [2, 3, 1],
    ],
  );
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-meihua-board"/g) ?? []).length, 2);
  const summary = getDivinationSessionSummary(session);
  assert.equal(summary.title, '梅花易数分时起卦结果');
  assert.equal(summary.lines.length, 2);
  const share = formatDivinationSessionShareText(session);
  for (const text of [html, share, summary.lines.join('\n'), session.prompt]) {
    for (const boundary of ['23:00:00', '00:00:00', '01:00:00']) assert.ok(text.includes(boundary));
    for (const { data } of session.meihuaRange.branches) {
      for (const name of [
        data.mainHexagram.name,
        data.interHexagram.name,
        data.changedHexagram.name,
      ]) {
        assert.ok(text.includes(name));
      }
    }
  }
  for (const [index, { data }] of session.meihuaRange.branches.entries()) {
    const text = session.prompt.split(`分支${index + 1}：`)[1]?.split(`分支${index + 2}：`)[0];
    assert.ok(text);
    for (const fact of formatMeihuaFacts(data)) assert.ok(text.includes(fact), fact);
  }
  assert.doesNotMatch(session.prompt, /【当前时间】|当前盘面采用区间起点/);
});

test('梅花固定数字与随机起卦跨零点不重复起卦，稳定区间保留日期范围', async () => {
  for (const options of [
    { meihuaMethod: 'number' as const, meihuaNumber: '7' },
    { meihuaMethod: 'random' as const },
  ]) {
    const session = await generateDivinationSession({ ...createDraft(), ...options });
    assert.equal(session.meihuaRange?.status, 'stable');
    assert.equal(session.meihuaRange.branches.length, 1);
    const data = session.meihuaRange.branches[0]!.data;
    assert.equal(data.calculation?.methodKey, options.meihuaMethod);
    const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
    assert.equal(
      (html.match(/class="traditional-board traditional-meihua-board"/g) ?? []).length,
      1,
    );
    assert.doesNotMatch(html, /所选时间范围内卦象有变化/);
    assert.doesNotMatch(session.prompt, /【当前时间】/);
    assert.ok(session.prompt.includes('23:00:00') && session.prompt.includes('01:00:00'));
  }
});

test('梅花分段结果经历史存储恢复后提示词和分享保持一致', async () => {
  const draft = createDraft();
  const session = await generateDivinationSession(draft);
  assert.equal(session.meihuaRange?.branches.length, 2);
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
    assert.deepEqual(restored.session.meihuaRange, JSON.parse(JSON.stringify(session.meihuaRange)));
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

test('梅花旧历史和仅含文本的日期来源兼容单卦', async () => {
  const draft = createDraft();
  const source = draft.divinationReverseSource!;
  const session = await generateDivinationSession({
    ...draft,
    divinationReverseSource: {
      pillars: source.pillars,
      intervalStart: source.intervalStart,
      intervalEnd: source.intervalEnd,
    },
  });
  assert.equal(session.meihuaRange, undefined);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-meihua-board"/g) ?? []).length, 1);
});
