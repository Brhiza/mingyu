import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reverseBaziDates } from 'mingyu-core/calendar';
import { getGanZhiFromDate } from 'mingyu-core/ganzhi';
import { buildLiurenTemplateText } from 'mingyu-core/divination/engine/liuren-template';
import { formatLiurenJudgmentFacts } from 'mingyu-core/prompt';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

async function createRangeSession(day = 19) {
  const pillars = getGanZhiFromDate(new Date(2024, 1, day, 12));
  const dateText = `2024-02-${day}`;
  const candidate = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 }).candidates.find(
    (item) => item.start.text.startsWith(dateText),
  );
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  const draft: DivinationDraft = {
    ...defaultDraft,
    method: 'liuren',
    question: '合成中气区间验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: candidate.start.text.slice(0, 10),
    customDivinationTime: candidate.start.text.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
  return { draft, session: await generateDivinationSession(draft) };
}

test('跨中气的大六壬页面、摘要与分享保留两套月将四课三传', async () => {
  const { session } = await createRangeSession();
  assert.equal(session.liurenRange?.status, 'conditional');
  assert.deepEqual(
    session.liurenRange.branches.map(({ data }) => data.monthLeader),
    ['子', '亥'],
  );
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-liuren-board"/g) ?? []).length, 2);
  const summary = getDivinationSessionSummary(session);
  assert.equal(summary.title, '大六壬分时起课结果');
  assert.equal(summary.lines.length, 2);
  const share = formatDivinationSessionShareText(session);
  for (const text of [html, share, summary.lines.join('\n'), session.prompt]) {
    assert.match(text, /11:00:00/);
    assert.match(text, /12:13:12/);
    assert.match(text, /13:00:00/);
    assert.match(text, /月将[：:]?子/);
    assert.match(text, /月将[：:]?亥/);
  }
  for (const [index, { data }] of session.liurenRange.branches.entries()) {
    const branchPrompt = session.prompt
      .split(`分支${index + 1}：`)[1]
      ?.split(`分支${index + 2}：`)[0];
    assert.ok(branchPrompt);
    for (const fact of formatLiurenJudgmentFacts(data, { chartFactsIncluded: true })) {
      assert.ok(branchPrompt.includes(fact), '每段提示词都应保留自己的判断条件与反证');
    }
    for (const lesson of data.fourLessons) {
      assert.ok(share.includes(`${lesson.name}${lesson.upper}临${lesson.lower}`));
    }
    for (const transmission of data.threeTransmissions) {
      assert.ok(share.includes(`${transmission.stage}【${transmission.branch}】`));
    }
  }
});

test('不跨中气的区间和旧大六壬记录仍以单课展示', async () => {
  const { session } = await createRangeSession(20);
  assert.equal(session.liurenRange?.status, 'stable');
  for (const item of [session, { ...session, liurenRange: undefined }]) {
    const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session: item }));
    assert.equal(
      (html.match(/class="traditional-board traditional-liuren-board"/g) ?? []).length,
      1,
    );
    assert.doesNotMatch(html, /所选时间范围内课盘有变化/);
    assert.doesNotMatch(getDivinationSessionSummary(item).title, /分时/);
  }
});

test('大六壬区间历史重开保留全部分段和提问资料', async () => {
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
    assert.deepEqual(restored.session.liurenRange, JSON.parse(JSON.stringify(session.liurenRange)));
    assert.equal(restored.session.prompt, session.prompt);
    assert.deepEqual(restored.draft.divinationReverseSource, draft.divinationReverseSource);
    assert.equal(
      formatDivinationSessionShareText(restored.session),
      formatDivinationSessionShareText(session),
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('稳定区间与普通单时刻大六壬提示词保留取传条件与反证', async () => {
  const { draft, session } = await createRangeSession(20);
  const ordinary = await generateDivinationSession({
    ...draft,
    divinationTimeMode: 'custom',
    divinationReverseSource: undefined,
  });
  for (const item of [session, ordinary]) {
    const facts = formatLiurenJudgmentFacts(item.data as import('mingyu-core/types').LiurenData, {
      chartFactsIncluded: true,
    });
    assert.ok(facts.some((fact) => fact.startsWith('课传反证：')));
    for (const fact of facts) assert.ok(item.prompt.includes(fact));
  }
});

test('大六壬感情事业财运主题按各时间分支定位类神', async () => {
  const { draft } = await createRangeSession();
  for (const liurenTemplate of ['ganqing', 'shiye', 'caifu'] as const) {
    const session = await generateDivinationSession({ ...draft, liurenTemplate });
    const section = session.prompt.split('【问题范围】')[1]?.split('【任务】')[0];
    assert.ok(section);
    assert.equal(session.liurenRange?.branches.length, 2);
    for (const [index, branch] of session.liurenRange!.branches.entries()) {
      const branchText = section.split(`分支${index + 1}：`)[1]?.split(`分支${index + 2}：`)[0];
      assert.ok(branchText);
      assert.ok(branchText.includes(buildLiurenTemplateText(liurenTemplate, branch.data)));
    }
  }
});
