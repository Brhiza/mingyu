import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDivinationTime, reverseBaziDates } from 'mingyu-core/calendar';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import {
  TraditionalDivinationBoard,
  formatDivinationSessionShareText,
} from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

function createDraft(hour = '11'): DivinationDraft {
  const startText = `2024-02-19 ${hour}:00:00`;
  const pillars = getDivinationTime(new Date(`${startText.replace(' ', 'T')}+08:00`), 480).ganzhi;
  const candidate = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 }).candidates.find(
    (item) => item.start.text === startText,
  );
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  return {
    ...defaultDraft,
    method: 'qimen',
    question: '合成奇门日期区间验证',
    qimenScope: 'hour',
    qimenJuMethod: 'chaibu',
    divinationTimeMode: 'pillars',
    customDivinationDate: candidate.start.text.slice(0, 10),
    customDivinationTime: candidate.start.text.slice(11),
    divinationReverseSource: selection.source,
    divinationTimeStandard: 'beijing',
  };
}

test('奇门四柱候选在交中气处切盘，页面、摘要、分享和提示词保留各段', async () => {
  const session = await generateDivinationSession(createDraft());
  assert.equal(session.qimenRange?.status, 'conditional');
  assert.deepEqual(
    session.qimenRange.branches.map(({ data }) => data.juShu),
    [8, 9],
  );
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-qimen-board"/g) ?? []).length, 2);
  const summary = getDivinationSessionSummary(session);
  const share = formatDivinationSessionShareText(session);
  const dateHeader = share.split('\n').find((line) => line.startsWith('起局时间：'));
  assert.ok(dateHeader?.includes('11:00:00') && dateHeader.includes('13:00:00'));
  for (const text of [html, share, summary.lines.join('\n'), session.prompt]) {
    for (const value of ['11:00:00', '12:13:12', '13:00:00', '阳遁8局', '阳遁9局', '月相']) {
      assert.ok(text.includes(value), `缺少${value}`);
    }
    for (const { data } of session.qimenRange.branches) {
      assert.ok(text.includes(data.zhiFu));
      assert.ok(text.includes(data.zhiShi));
    }
  }
  assert.doesNotMatch(session.prompt, /【当前时间】|当前盘面采用区间起点/);
});

test('奇门稳定时段仍保留完整范围与起止月相参照', async () => {
  const session = await generateDivinationSession(createDraft('09'));
  assert.equal(session.qimenRange?.status, 'stable');
  assert.equal(session.qimenRange.branches.length, 1);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  for (const text of [html, session.prompt, formatDivinationSessionShareText(session)]) {
    for (const value of ['09:00:00', '10:59:59', '11:00:00', '月相']) {
      assert.ok(text.includes(value), `缺少${value}`);
    }
  }
  assert.equal((html.match(/class="traditional-board traditional-qimen-board"/g) ?? []).length, 1);
});

test('年家和月家奇门区间页面与分享按三元定局且不混入短周期资料', async () => {
  for (const scope of ['year', 'month'] as const) {
    const session = await generateDivinationSession({ ...createDraft(), qimenScope: scope });
    assert.ok(session.qimenRange);
    assert.ok(session.qimenRange.branches.length > 0);

    const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
    const share = formatDivinationSessionShareText(session);
    const summary = getDivinationSessionSummary(session);
    const scopeLabel = scope === 'year' ? '年家' : '月家';

    assert.equal(
      (html.match(/class="traditional-board traditional-qimen-board"/g) ?? []).length,
      session.qimenRange.branches.length,
    );
    assert.ok(html.includes(`${scopeLabel}奇门九宫盘`));
    assert.ok(html.includes('三元'));
    assert.match(session.prompt, /三元定局依据/u);
    assert.doesNotMatch(session.prompt, /标明时刻的月相参照|交节后自然日阶段/u);
    assert.doesNotMatch(summary.lines.join('\n'), /月相|建除|节令阶段/u);
    assert.match(summary.lines.join('\n'), /干支年/u);

    for (const { text, isShare } of [
      { text: html, isShare: false },
      { text: share, isShare: true },
    ]) {
      for (const { data } of session.qimenRange.branches) {
        assert.ok(text.includes(data.timeInfo.solarTerm), `缺少实际节气${data.timeInfo.solarTerm}`);
        const seasonality = data.seasonality;
        const threeYuanBasis = `干支年${data.ganzhi.year}${data.timeInfo.epoch}`;
        assert.ok(
          text.includes(threeYuanBasis) && (!isShare || text.includes(`定局${threeYuanBasis}`)),
          `缺少${scopeLabel}三元定局依据：${data.ganzhi.year}${data.timeInfo.epoch}`,
        );
        assert.ok(text.includes(`${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局`));
        assert.ok(
          isShare
            ? text.includes(`值符：${data.zhiFu}`) && text.includes(`值使：${data.zhiShi}`)
            : text.includes(data.zhiFu) && text.includes(data.zhiShi),
        );
        assert.ok(seasonality);
        assert.ok(
          !text.includes(
            `${seasonality.currentJieQi}，交节后${seasonality.jieQiPhase.phase}阶段；${seasonality.dayStem}${seasonality.seasonRelation}；月相${seasonality.lunarPhaseDetail}；建除${seasonality.dayOfficer}`,
          ),
          '不应显示短周期节令与日干旺衰资料',
        );
      }
      assert.doesNotMatch(text, /暗干|节令阶段|月相|建除/);
    }
  }
});

test('奇门区间按各段九宫保留补充年命的落宫资料', async () => {
  const session = await generateDivinationSession({ ...createDraft(), birthYear: '2000' });
  assert.equal(session.qimenRange?.branches.length, 2);
  assert.equal((session.prompt.match(/年命资料：公历2000年/g) ?? []).length, 2);
  assert.equal((session.prompt.match(/年命落宫（年中口径）/g) ?? []).length, 2);
});

test('奇门分段经历史恢复后保留所有盘面与月相采样', async () => {
  const draft = createDraft();
  const session = await generateDivinationSession(draft);
  assert.equal(session.qimenRange?.branches.length, 2);
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
    assert.deepEqual(restored.session.qimenRange, JSON.parse(JSON.stringify(session.qimenRange)));
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

test('奇门旧文本日期来源继续兼容单盘', async () => {
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
  assert.equal(session.qimenRange, undefined);
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.equal((html.match(/class="traditional-board traditional-qimen-board"/g) ?? []).length, 1);
});
