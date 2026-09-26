import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDivinationTime, reverseBaziDates } from 'mingyu-core/calendar';
import { formatJinkoujueJudgmentFacts } from 'mingyu-core/prompt';
import { generateDivinationSession as generateCoreSession } from 'mingyu-core/divination/session';
import type { JinkoujueData } from 'mingyu-core/types';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

function createDraft(day = 19): DivinationDraft {
  const dateText = `2024-02-${day}`;
  const timestamp = Date.parse(`${dateText}T12:00:00+08:00`);
  const pillars = getDivinationTime(new Date(timestamp), 480).ganzhi;
  const candidate = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 }).candidates.find(
    (item) => item.start.text.startsWith(dateText),
  );
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  return {
    ...defaultDraft,
    method: 'jinkoujue',
    jinkoujueMethod: 'time',
    question: '合成金口诀区间验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: candidate.start.text.slice(0, 10),
    customDivinationTime: candidate.start.text.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
}

function assertJinkoujuePromptFacts(prompt: string, data: JinkoujueData) {
  assert.ok(prompt.includes(data.methodLabel));
  assert.ok(prompt.includes(data.yinYangUse.rule));
  assert.ok(prompt.includes(data.yinYangUse.usePosition));
  for (const fact of [
    data.calculation.diFenNote,
    data.calculation.monthLeaderRule,
    data.calculation.noblemanRule,
    data.calculation.guiShenRule,
    data.calculation.yuanDunRule,
    data.calculation.dayNightRule,
  ]) {
    assert.ok(prompt.includes(fact));
  }
  assert.match(prompt, new RegExp(`月将[：:]?${data.monthLeader}加占时${data.divinationBranch}`));

  for (const position of Object.values(data.positions)) {
    const compactPosition = `${position.name}${position.stem ?? ''}${position.branch}${position.god ? `乘${position.god}` : ''}（${position.yinYang}${position.element}，月令${position.seasonState}${position.isVoid ? '，空' : ''}）`;
    assert.ok(prompt.includes(position.promptText) || prompt.includes(compactPosition));
    assert.ok(prompt.includes(position.role));
    assert.ok(prompt.includes(`按${position.elementBasis}`));
    if (position.stem && position.stemElement && position.elementBasis !== '人元干') {
      assert.ok(prompt.includes(`${position.stem}属${position.stemElement}`));
    }
  }

  if (data.xunKong.length) assert.ok(prompt.includes(data.xunKong.join('、')));
  for (const movement of data.movements) {
    assert.ok(prompt.includes(movement.name));
    assert.ok(prompt.includes(movement.trigger));
  }
  for (const fact of data.evidenceAnalysis?.counterEvidenceFacts ?? []) {
    assert.ok(prompt.includes(fact.promptText));
  }
}

test('金口诀跨中气页面摘要分享保留两段四位与发用', async () => {
  const session = await generateDivinationSession(createDraft());
  assert.equal(session.jinkoujueRange?.status, 'conditional');
  assert.deepEqual(
    session.jinkoujueRange.branches.map(({ data }) => data.monthLeader),
    ['子', '亥'],
  );
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal(
    (html.match(/class="traditional-board traditional-jinkoujue-board"/g) ?? []).length,
    2,
  );
  const summary = getDivinationSessionSummary(session);
  assert.equal(summary.title, '金口诀分时起课结果');
  assert.equal(summary.lines.length, 2);
  const share = formatDivinationSessionShareText(session);
  for (const text of [html, share, summary.lines.join('\n'), session.prompt]) {
    for (const boundary of ['11:00:00', '12:13:12', '13:00:00']) assert.ok(text.includes(boundary));
    assert.match(text, /月将[：:]?子/);
    assert.match(text, /月将[：:]?亥/);
  }
  for (const [index, { data }] of session.jinkoujueRange.branches.entries()) {
    const branchPrompt = session.prompt
      .split(`分支${index + 1}：`)[1]
      ?.split(`分支${index + 2}：`)[0];
    assert.ok(branchPrompt);
    assertJinkoujuePromptFacts(branchPrompt, data);
    for (const position of Object.values(data.positions)) {
      const stemBranch = `${position.stem ?? ''}${position.branch}`;
      assert.ok(share.includes(stemBranch));
      assert.ok(html.includes(stemBranch));
    }
    assert.ok(share.includes(data.yinYangUse.rule));
    assert.ok(session.prompt.includes(data.yinYangUse.rule));
  }
});

test('金口诀稳定区间与旧历史仍显示一课', async () => {
  const session = await generateDivinationSession(createDraft(20));
  assert.equal(session.jinkoujueRange?.status, 'stable');
  assert.doesNotMatch(session.prompt, /【当前时间】/u);
  for (const item of [session, { ...session, jinkoujueRange: undefined }]) {
    const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session: item }));
    assert.equal(
      (html.match(/class="traditional-board traditional-jinkoujue-board"/g) ?? []).length,
      1,
    );
    assert.doesNotMatch(html, /所选时间范围内课盘有变化/);
  }
});

test('金口诀指定地分和数字起课在整个候选范围保持同一输入', async () => {
  for (const options of [
    { jinkoujueMethod: 'branch' as const, jinkoujueBranch: '午' },
    { jinkoujueMethod: 'number' as const, jinkoujueNumber: '7' },
  ]) {
    const session = await generateDivinationSession({ ...createDraft(), ...options });
    assert.equal(session.jinkoujueRange?.status, 'conditional');
    for (const { data } of session.jinkoujueRange.branches) {
      assert.equal(data.method, options.jinkoujueMethod);
      assert.equal(data.diFenBranch, '午');
    }
  }
});

test('随机金口诀分段历史重开保持同一次随机地分与全部课盘', async () => {
  const draft = { ...createDraft(), jinkoujueMethod: 'random' as const };
  const session = await generateDivinationSession(draft);
  assert.equal(session.jinkoujueRange?.branches.length, 2);
  const first = session.jinkoujueRange.branches[0]!.data;
  assert.ok(first.randomTrace?.samples.length);
  for (const { data } of session.jinkoujueRange.branches) {
    assert.equal(data.method, 'random');
    assert.equal(data.diFenBranch, first.diFenBranch);
    assert.deepEqual(data.randomTrace?.samples, first.randomTrace.samples);
  }
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
      restored.session.jinkoujueRange,
      JSON.parse(JSON.stringify(session.jinkoujueRange)),
    );
    assert.deepEqual(
      (restored.session.data as JinkoujueData).randomTrace,
      JSON.parse(JSON.stringify(first.randomTrace)),
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

test('金口诀普通网页与核心会话使用完整四位判断资料', async () => {
  const draft = {
    ...createDraft(),
    divinationTimeMode: 'custom' as const,
    divinationReverseSource: undefined,
  };
  const web = await generateDivinationSession(draft);
  const core = generateCoreSession({
    method: 'jinkoujue',
    question: '合成四位资料验证',
    divinationTime: '2024-02-19T11:00:00+08:00',
    currentTime: '2024-02-19T11:00:00+08:00',
  });
  for (const [data, prompt] of [
    [web.data, web.prompt],
    [core.data, core.aiPrompt],
    [core.data, core.prompt],
    [core.data, core.formattedResult],
  ] as const) {
    const item = data as JinkoujueData;
    assert.ok(item.evidenceAnalysis?.counterEvidenceFacts.length);
    assertJinkoujuePromptFacts(prompt, item);
    assert.doesNotMatch(prompt, /事态主轴：见|evidenceAnalysis|schemaVersion|randomTrace/);
  }
  for (const fact of formatJinkoujueJudgmentFacts(core.data as JinkoujueData)) {
    assert.ok(core.aiPrompt.includes(fact));
  }
});

test('旧金口诀文本来源仍按代表时刻起课', async () => {
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
  assert.equal(session.jinkoujueRange, undefined);
  assert.match(session.prompt, /当前盘面采用区间起点作为代表时刻/u);
});
