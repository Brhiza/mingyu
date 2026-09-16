import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTaiyi } from 'mingyu-core/taiyi';
import type { DivinationDraft, DivinationSession } from '../src/lib/divination/engine';
import {
  buildDivinationReadingSubject,
  normalizeReadingSubject,
} from '../src/lib/ai/reading-subject';

function buildTaiyiSession(withRange = true): DivinationSession {
  const before = generateTaiyi({
    scope: 'hour',
    date: new Date('2026-06-21T16:24:29+08:00'),
  });
  const after = generateTaiyi({
    scope: 'hour',
    date: new Date('2026-06-21T16:24:30+08:00'),
  });
  return {
    method: 'taiyi',
    requestedMethod: 'taiyi',
    question: '公共历法边界夹具',
    prompt: '太乙区间事实',
    data: before,
    ...(withRange
      ? {
          taiyiRange: {
            source: {
              startTimestamp: Date.parse('2026-06-21T15:00:00+08:00'),
              endTimestamp: Date.parse('2026-06-21T17:00:00+08:00'),
              endExclusive: true as const,
              timezone: 'Asia/Shanghai' as const,
              offsetHours: 8 as const,
            },
            status: 'conditional' as const,
            branches: [
              {
                startTimestamp: Date.parse('2026-06-21T15:00:00+08:00'),
                endTimestamp: Date.parse('2026-06-21T16:24:30+08:00'),
                endExclusive: true as const,
                data: before,
              },
              {
                startTimestamp: Date.parse('2026-06-21T16:24:30+08:00'),
                endTimestamp: Date.parse('2026-06-21T17:00:00+08:00'),
                endExclusive: true as const,
                data: after,
              },
            ],
          },
        }
      : {}),
  } as DivinationSession;
}

const emptyDraft = {} as DivinationDraft;

test('太乙阅读主题保留完整区间来源与每个分支，而非只有首段时刻', () => {
  const subject = buildDivinationReadingSubject(emptyDraft, buildTaiyiSession());
  assert.ok(subject);
  assert.equal(subject?.lockedInputs.taiyi.scope, 'hour');
  assert.equal(subject?.range.taiyiDateTime, undefined);
  assert.equal(subject?.range.taiyiTarget, undefined);

  const taiyiRange = subject?.range.taiyiRange as {
    source: { startTimestamp: number; endTimestamp: number; endExclusive: true };
    status: string;
    branches: Array<{
      startTimestamp: number;
      endTimestamp: number;
      endExclusive: true;
      data: { dateTime: string; yinYang: string; bureau: number };
    }>;
  };
  assert.equal(taiyiRange.source.endExclusive, true);
  assert.equal(taiyiRange.status, 'conditional');
  assert.equal(taiyiRange.branches.length, 2);
  assert.equal(taiyiRange.branches[0].data.yinYang, '阳遁');
  assert.equal(taiyiRange.branches[1].data.yinYang, '阴遁');
  // 太乙结果的展示时间精确到分钟，区间边界仍由毫秒时间戳和局面事实表达。
  assert.equal(taiyiRange.branches[0].data.dateTime, taiyiRange.branches[1].data.dateTime);
  assert.equal(taiyiRange.branches[0].endTimestamp, taiyiRange.branches[1].startTimestamp);
});

test('太乙阅读主题指纹和恢复会包含次段变化', () => {
  const rangeSession = buildTaiyiSession();
  const changedSecondBranchSession = {
    ...rangeSession,
    taiyiRange: {
      ...rangeSession.taiyiRange!,
      branches: [
        rangeSession.taiyiRange!.branches[0],
        {
          ...rangeSession.taiyiRange!.branches[1],
          data: rangeSession.taiyiRange!.branches[0].data,
        },
      ],
    },
  } as DivinationSession;
  const conditionalSubject = buildDivinationReadingSubject(emptyDraft, rangeSession);
  const changedSecondSubject = buildDivinationReadingSubject(
    emptyDraft,
    changedSecondBranchSession,
  );
  assert.ok(conditionalSubject);
  assert.ok(changedSecondSubject);
  assert.notEqual(conditionalSubject?.id, changedSecondSubject?.id);

  const restored = normalizeReadingSubject(conditionalSubject);
  assert.ok(restored);
  assert.deepEqual(restored?.range.taiyiRange, conditionalSubject?.range.taiyiRange);
  assert.equal((restored?.range.taiyiRange as { branches: unknown[] }).branches.length, 2);
});

test('没有太乙区间的历史主题继续保留单时刻兼容形态', () => {
  const subject = buildDivinationReadingSubject(emptyDraft, buildTaiyiSession(false));
  assert.ok(subject);
  assert.equal(subject?.range.taiyiDateTime, '2026-06-21 16:24');
  assert.equal(subject?.range.taiyiRange, undefined);
});
