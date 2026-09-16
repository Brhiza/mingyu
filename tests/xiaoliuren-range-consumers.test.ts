import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reverseBaziDates } from 'mingyu-core/calendar';
import { getGanZhiFromDate } from 'mingyu-core/ganzhi';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

async function createRangeSession(hour = 23) {
  const pillars = getGanZhiFromDate(new Date(2024, 1, 4, hour));
  const candidate = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 }).candidates.find(
    (item) => item.start.text.startsWith('2024-02-04'),
  );
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  const draft: DivinationDraft = {
    ...defaultDraft,
    method: 'xiaoliuren',
    question: '合成日期分段验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: candidate.start.text.slice(0, 10),
    customDivinationTime: candidate.start.text.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
  return { draft, session: await generateDivinationSession(draft) };
}

test('跨午夜小六壬的页面、摘要与分享同时展示两段事实', async () => {
  const { session } = await createRangeSession();
  assert.equal(session.xiaoliurenRange?.status, 'conditional');
  assert.equal(session.xiaoliurenRange.branches.length, 2);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal(
    (html.match(/class="traditional-board traditional-xiaoliuren-board"/g) ?? []).length,
    2,
  );
  const summary = getDivinationSessionSummary(session);
  assert.equal(summary.title, '小六壬分时起课结果');
  assert.equal(summary.lines.length, 2);
  const share = formatDivinationSessionShareText(session);
  for (const text of [html, share, summary.lines.join('\n')]) {
    assert.match(text, /12月25日/);
    assert.match(text, /12月26日/);
    assert.match(text, /23:00/);
    assert.match(text, /00:00/);
    assert.match(text, /01:00/);
    assert.match(text, /空亡/);
    assert.match(text, /大安/);
  }
});

test('稳定范围与旧单时刻记录保持单课展示', async () => {
  const { session } = await createRangeSession(21);
  assert.equal(session.xiaoliurenRange?.status, 'stable');
  for (const item of [session, { ...session, xiaoliurenRange: undefined }]) {
    const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session: item }));
    assert.equal(
      (html.match(/class="traditional-board traditional-xiaoliuren-board"/g) ?? []).length,
      1,
    );
    assert.doesNotMatch(html, /所选时间范围内课盘有变化/);
    assert.equal(getDivinationSessionSummary(item).title, '小六壬起课结果');
  }
});

test('占问历史保存和重开完整保留分段盘面与解读', async () => {
  const { draft, session } = await createRangeSession();
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
      restored.session.xiaoliurenRange,
      JSON.parse(JSON.stringify(session.xiaoliurenRange)),
    );
    assert.deepEqual(restored.draft.divinationReverseSource, draft.divinationReverseSource);
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
