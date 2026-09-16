import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
import type { HuangjiJingshiResult } from 'mingyu-core/huangji-jingshi';
import type { DivinationDraft, DivinationSession } from '../src/lib/divination/engine';
import {
  buildDivinationReadingSubject,
  normalizeReadingSubject,
} from '../src/lib/ai/reading-subject';
import { formatHuangjiRangeInterval } from '../src/lib/divination/huangji-range';
import { getDivinationSessionSummary } from '../src/lib/divination/summary';

const emptyDraft = {} as DivinationDraft;

function buildHuangjiSession(withRange = true) {
  const first = calculateHuangjiJingshi({
    date: new Date('2026-06-20T15:00:00+08:00'),
    question: '公共历法皇极区间夹具',
  });
  const second = calculateHuangjiJingshi({
    date: new Date('2026-06-20T16:00:00+08:00'),
    question: '公共历法皇极区间夹具',
  });
  const startTimestamp = Date.parse('2026-06-20T15:00:00+08:00');
  const boundaryTimestamp = Date.parse('2026-06-20T16:00:00+08:00');
  const endTimestamp = Date.parse('2026-06-20T17:00:00+08:00');
  const session = {
    method: 'huangji',
    requestedMethod: 'huangji',
    question: '公共历法皇极区间夹具',
    prompt: '皇极区间事实',
    data: first,
    ...(withRange
      ? {
          huangjiRange: {
            source: {
              startTimestamp,
              endTimestamp,
              endExclusive: true as const,
              timezone: 'Asia/Shanghai' as const,
              offsetHours: 8 as const,
            },
            status: 'conditional' as const,
            branches: [
              {
                startTimestamp,
                endTimestamp: boundaryTimestamp,
                endExclusive: true as const,
                data: first,
              },
              {
                startTimestamp: boundaryTimestamp,
                endTimestamp,
                endExclusive: true as const,
                data: second,
              },
            ],
          },
        }
      : {}),
  } as DivinationSession;
  return { session, first, second };
}

test('皇极区间主题传递完整分支，摘要列出每段皇极层级', () => {
  const { session } = buildHuangjiSession();
  const subject = buildDivinationReadingSubject(emptyDraft, session);
  assert.ok(subject);
  assert.equal(subject.range.huangjiMode, '年月日时');
  assert.equal(subject.range.huangjiDateTime, undefined);
  assert.equal(subject.range.huangjiInput, undefined);

  const snapshot = subject.range.huangjiRange as {
    source: { startTimestamp: number; endTimestamp: number; endExclusive: true };
    status: string;
    branches: Array<{
      startTimestamp: number;
      endTimestamp: number;
      endExclusive: true;
      data: HuangjiJingshiResult;
    }>;
  };
  assert.deepEqual(snapshot.source, session.huangjiRange!.source);
  assert.equal(snapshot.status, 'conditional');
  assert.equal(snapshot.branches.length, 2);

  const summary = getDivinationSessionSummary(session);
  assert.equal(summary.title, '皇极经世时段排盘结果');
  assert.equal(summary.lines.length, 2);
  const summaryText = [...summary.tags, ...summary.lines].join('\n');
  for (const branch of session.huangjiRange!.branches) {
    const data = branch.data;
    const dateTimeForecast = data.dateTimeForecast;
    const annual = data.forecast?.hexagrams.annual;
    assert.ok(dateTimeForecast);
    assert.ok(annual);
    assert.ok(
      summaryText.includes(formatHuangjiRangeInterval(branch.startTimestamp, branch.endTimestamp)),
    );
    assert.ok(summaryText.includes(dateTimeForecast.calendar.activeSolarTerm));
    assert.ok(summaryText.includes(String(dateTimeForecast.calendar.actualDayInSolarTerm)));
    assert.ok(summaryText.includes(String(dateTimeForecast.calendar.dayOfYear)));
    assert.ok(summaryText.includes(dateTimeForecast.hexagrams.monthJing.name));
    assert.ok(summaryText.includes(dateTimeForecast.hexagrams.xunWei.name));
    assert.ok(summaryText.includes(dateTimeForecast.hexagrams.daily.name));
    assert.ok(summaryText.includes(dateTimeForecast.hexagrams.hourJing.name));
    assert.ok(summaryText.includes(annual.name));
  }
});

test('皇极区间主题经 JSON 往返保留快照，后段变化会改变指纹', () => {
  const { session } = buildHuangjiSession();
  const subject = buildDivinationReadingSubject(emptyDraft, session);
  assert.ok(subject);

  const restoredSubject = normalizeReadingSubject(JSON.parse(JSON.stringify(subject)));
  assert.ok(restoredSubject);
  assert.deepEqual(restoredSubject.range.huangjiRange, subject.range.huangjiRange);

  const restoredSession = JSON.parse(JSON.stringify(session)) as DivinationSession;
  const rebuiltSubject = buildDivinationReadingSubject(emptyDraft, restoredSession);
  assert.ok(rebuiltSubject);
  assert.deepEqual(rebuiltSubject.range.huangjiRange, subject.range.huangjiRange);

  const range = session.huangjiRange;
  assert.ok(range);
  const changedSecondBranchSession = {
    ...session,
    huangjiRange: {
      ...range,
      branches: [range.branches[0]!, { ...range.branches[1]!, data: range.branches[0]!.data }],
    },
  } as DivinationSession;
  const changedSubject = buildDivinationReadingSubject(emptyDraft, changedSecondBranchSession);
  assert.ok(changedSubject);
  assert.notEqual(subject.id, changedSubject.id);
});

test('没有皇极区间的旧年月日时记录保留单盘字段', () => {
  const { session, first } = buildHuangjiSession(false);
  const subject = buildDivinationReadingSubject(emptyDraft, session);
  assert.ok(subject);
  assert.equal(subject.range.huangjiMode, '年月日时');
  assert.deepEqual(subject.range.huangjiInput, first.input);
  assert.equal(subject.range.huangjiDateTime, first.dateTimeForecast?.civilTime.dateTime);
  assert.equal(subject.range.huangjiRange, undefined);
});
