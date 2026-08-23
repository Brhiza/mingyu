import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sortPersonalCasesForQuickSwitch,
  type PersonalHistoryRecord,
} from '../src/lib/history-records';
import { defaultInputState } from '../src/lib/query-state';

function createCase(id: string, lastUsedAt: string, pinned = false): PersonalHistoryRecord {
  return {
    id,
    type: 'single',
    name: id,
    gender: 'male',
    chartType: 'bazi',
    birthText: '2000-1-1',
    input: { ...defaultInputState, year: '2000', month: '1', day: '1' },
    lastUsedAt,
    updatedAt: lastUsedAt,
    pinned,
  };
}

test('案例快速切换应先显示置顶案例，再按最近使用时间排列', () => {
  const records = [
    createCase('较早', '2026-08-20T00:00:00.000Z'),
    createCase('最新', '2026-08-23T00:00:00.000Z'),
    createCase('置顶较早', '2026-08-19T00:00:00.000Z', true),
    createCase('置顶较新', '2026-08-21T00:00:00.000Z', true),
  ];

  assert.deepEqual(
    sortPersonalCasesForQuickSwitch(records).map((record) => record.id),
    ['置顶较新', '置顶较早', '最新', '较早'],
  );
  assert.deepEqual(
    records.map((record) => record.id),
    ['较早', '最新', '置顶较早', '置顶较新'],
  );
});

test('旧案例没有最近使用时间时应回退到更新时间排序', () => {
  const older = createCase('旧案例', '2026-08-20T00:00:00.000Z');
  const newer = createCase('新案例', '2026-08-22T00:00:00.000Z');
  delete older.lastUsedAt;
  delete newer.lastUsedAt;

  assert.deepEqual(
    sortPersonalCasesForQuickSwitch([older, newer]).map((record) => record.id),
    ['新案例', '旧案例'],
  );
});
