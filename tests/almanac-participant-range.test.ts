import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';
import type { AlmanacData, AlmanacParticipantInput } from '../packages/core/src/types/divination';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { generateDivinationSession } from '../src/lib/divination/engine';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

const RANGE_START = Date.parse('2024-02-11T15:00:00+08:00');
const RANGE_CHANGE = Date.parse('2024-02-11T16:27:07+08:00');
const RANGE_END = Date.parse('2024-02-11T17:00:00+08:00');
const RANGE_PILLARS = {
  year: '甲辰',
  month: '丙寅',
  day: '乙巳',
  hour: '甲申',
};

const RANGE_PARTICIPANT: AlmanacParticipantInput = {
  id: 'synthetic-range',
  name: '合成参与人甲',
  gender: '男',
  dateType: 'solar',
  year: '2024',
  month: '2',
  day: '11',
  birthHour: '15',
  birthMinute: '0',
  birthSecond: '0',
  birthTimeRange: {
    startTimestamp: RANGE_START,
    endTimestamp: RANGE_END,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
    pillars: RANGE_PILLARS,
  },
};

const FIXED_PARTICIPANT: AlmanacParticipantInput = {
  id: 'synthetic-fixed',
  name: '合成参与人乙',
  gender: '女',
  dateType: 'solar',
  year: '1990',
  month: '1',
  day: '2',
  timeIndex: '4',
};

test('黄历参与人完整出生区间按实际司令边界保留条件画像并参与日时关系', () => {
  const result = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    participants: [RANGE_PARTICIPANT, FIXED_PARTICIPANT],
  });

  const ranged = result.participants[0]!;
  assert.equal(ranged.birthTimeRange?.status, 'conditional');
  assert.deepEqual(
    ranged.birthTimeRange?.branches.map((branch) => [
      branch.startTimestamp,
      branch.endTimestamp,
      branch.endExclusive,
      branch.profile.usefulGods,
    ]),
    [
      [RANGE_START, RANGE_CHANGE, true, ['土', '火', '金']],
      [RANGE_CHANGE, RANGE_END, true, ['火', '土', '金']],
    ],
  );
  assert.equal(result.participants[1]!.birthTimeRange, undefined);

  const dayFacts = result.days[0]!.participantRelationFacts ?? [];
  const rangedDayFacts = dayFacts.filter((fact) => fact.participantId === ranged.id);
  const usefulConditionFacts = rangedDayFacts.filter(
    (fact) => fact.relation === '未采用' && fact.birthTimeRange?.status === 'conditional',
  );
  assert.equal(usefulConditionFacts.length, 2);
  assert.deepEqual(
    usefulConditionFacts.flatMap((fact) => fact.birthTimeRange?.intervals ?? []),
    [
      { startTimestamp: RANGE_START, endTimestamp: RANGE_CHANGE, endExclusive: true },
      { startTimestamp: RANGE_CHANGE, endTimestamp: RANGE_END, endExclusive: true },
    ],
  );

  for (const hour of result.days[0]!.hourCandidates ?? []) {
    const rangeFacts = hour.participantRelationFacts.filter(
      (fact) => fact.participantId === ranged.id,
    );
    assert.ok(rangeFacts.length > 0);
    assert.ok(rangeFacts.every((fact) => fact.birthTimeRange?.status === 'stable'));
    assert.deepEqual(rangeFacts[0]!.birthTimeRange?.intervals, [
      { startTimestamp: RANGE_START, endTimestamp: RANGE_END, endExclusive: true },
    ]);
  }
});

test('黄历前端会话、提示词、结果页和历史重开保留一人范围及另一人定点资料', async () => {
  const session = await generateDivinationSession({
    ...defaultDraft,
    method: 'almanac',
    question: '合成黄历参与人区间验证',
    almanacTopic: 'custom',
    almanacStartDate: '2026-06-01',
    almanacEndDate: '2026-06-01',
    almanacParticipants: [
      {
        ...RANGE_PARTICIPANT,
        inputMode: 'pillars',
        birthTimeRange: undefined,
        reverseSource: {
          pillars: RANGE_PILLARS,
          intervalStart: '2024-02-11 15:00:00',
          intervalEnd: '2024-02-11 17:00:00',
          startTimestamp: RANGE_START,
          endTimestamp: RANGE_END,
          endExclusive: true,
          timezone: 'Asia/Shanghai',
          offsetHours: 8,
        },
      },
      FIXED_PARTICIPANT,
    ],
  });
  const data = session.data as AlmanacData;
  assert.equal(data.participants[0]!.birthTimeRange?.status, 'conditional');
  assert.equal(data.participants[1]!.birthTimeRange, undefined);
  for (const [consumer, text] of [
    ['提示词', session.prompt],
    ['结果页', renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }))],
  ] as const) {
    for (const expected of [
      '2024-02-11 15:00:00',
      '2024-02-11 16:27:07',
      '2024-02-11 17:00:00',
      '土、火、金',
      '火、土、金',
      '合成参与人乙',
    ]) {
      assert.ok(text.includes(expected), `${consumer}缺少${expected}`);
    }
  }
  assert.doesNotMatch(session.prompt, /当前盘面采用区间起点作为代表时刻/u);

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
    const draft = {
      ...defaultDraft,
      method: 'almanac' as const,
      question: '合成黄历参与人区间验证',
      almanacTopic: 'custom' as const,
      almanacStartDate: '2026-06-01',
      almanacEndDate: '2026-06-01',
      almanacParticipants: [
        {
          ...RANGE_PARTICIPANT,
          inputMode: 'pillars' as const,
          birthTimeRange: undefined,
          reverseSource: {
            pillars: RANGE_PILLARS,
            intervalStart: '2024-02-11 15:00:00',
            intervalEnd: '2024-02-11 17:00:00',
            startTimestamp: RANGE_START,
            endTimestamp: RANGE_END,
            endExclusive: true as const,
            timezone: 'Asia/Shanghai' as const,
            offsetHours: 8 as const,
          },
        },
        FIXED_PARTICIPANT,
      ],
    };
    const saved = addDivinationHistory(draft, session);
    assert.ok(saved);
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    assert.deepEqual(
      restored.draft.almanacParticipants,
      JSON.parse(JSON.stringify(draft.almanacParticipants)),
    );
    assert.deepEqual(
      (restored.session.data as AlmanacData).participants[0]!.birthTimeRange,
      data.participants[0]!.birthTimeRange,
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('旧案例只有文字区间时从秒级文本恢复完整半开区间', async () => {
  const session = await generateDivinationSession({
    ...defaultDraft,
    method: 'almanac',
    question: '合成旧案例兼容验证',
    almanacStartDate: '2026-06-01',
    almanacEndDate: '2026-06-01',
    almanacParticipants: [
      {
        ...RANGE_PARTICIPANT,
        inputMode: 'pillars',
        birthTimeRange: undefined,
        reverseSource: {
          pillars: RANGE_PILLARS,
          intervalStart: '2024-02-11 15:00:00',
          intervalEnd: '2024-02-11 17:00:00',
        },
      },
    ],
  });
  assert.deepEqual((session.data as AlmanacData).participants[0]!.birthTimeRange?.source, {
    startTimestamp: RANGE_START,
    endTimestamp: RANGE_END,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
    pillars: RANGE_PILLARS,
  });
  assert.match(session.prompt, /2024-02-11 15:00:00 至 2024-02-11 17:00:00/u);
});

test('黄历核心拒绝缺失来源四柱或与范围实际四柱不一致的区间', () => {
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'custom',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        participants: [
          {
            ...RANGE_PARTICIPANT,
            birthTimeRange: {
              ...RANGE_PARTICIPANT.birthTimeRange!,
              pillars: undefined,
            } as never,
          },
        ],
      }),
    /必须提供完整来源四柱/u,
  );
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'custom',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        participants: [
          {
            ...RANGE_PARTICIPANT,
            birthTimeRange: {
              ...RANGE_PARTICIPANT.birthTimeRange!,
              pillars: { ...RANGE_PILLARS, hour: '乙酉' },
            },
          },
        ],
      }),
    /时柱与四柱反推来源不一致/u,
  );
});
