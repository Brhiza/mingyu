import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { applyPersonalCaseToDivinationDraft } from '../src/lib/divination/case-context';
import type { PersonalHistoryRecord } from '../src/lib/history-records';
import { defaultInputState } from '../src/lib/query-state';

const personalCase: PersonalHistoryRecord = {
  id: 'case-1',
  type: 'single',
  name: '案例一',
  gender: 'female',
  chartType: 'bazi',
  birthText: '2000-1-2',
  input: {
    ...defaultInputState,
    name: '案例一',
    gender: 'female',
    year: '2000',
    month: '1',
    day: '2',
    timeIndex: 3,
    dateType: 'lunar',
    isLeapMonth: true,
  },
  updatedAt: '2026-08-23T00:00:00.000Z',
};

test('占问应复用全局案例中实际需要的补充资料', () => {
  const draft = applyPersonalCaseToDivinationDraft(defaultDraft, personalCase);
  assert.equal(draft.gender, '女');
  assert.equal(draft.birthYear, '2000');
  assert.deepEqual(draft.almanacParticipants[0], {
    id: 'active-case:case-1',
    name: '案例一',
    gender: '女',
    year: '2000',
    month: '1',
    day: '2',
    timeIndex: '3',
    dateType: 'lunar',
    isLeapMonth: true,
  });
});

test('切换为不指定应只移除案例自动带入的资料', () => {
  const withCase = applyPersonalCaseToDivinationDraft(
    {
      ...defaultDraft,
      almanacParticipants: [
        {
          id: 'manual-1',
          name: '同行人',
          gender: '',
          year: '',
          month: '',
          day: '',
          timeIndex: '',
          dateType: 'solar',
        },
      ],
    },
    personalCase,
  );
  const withoutCase = applyPersonalCaseToDivinationDraft(withCase, null);
  assert.equal(withoutCase.gender, '');
  assert.equal(withoutCase.birthYear, '');
  assert.deepEqual(
    withoutCase.almanacParticipants.map((item) => item.id),
    ['manual-1'],
  );
});
