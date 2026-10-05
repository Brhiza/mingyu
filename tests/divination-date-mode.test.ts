import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAlmanacReverseSelection,
  getAlmanacParticipantInputMode,
  updateAlmanacParticipantField,
} from '../src/lib/divination/almanac-participants';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';
import type { BaziReverseResolvedInput, BaziReverseSource } from '../src/lib/bazi-reverse-input';

const SOURCE: BaziReverseSource = {
  pillars: {
    year: '甲子',
    month: '丙寅',
    day: '丁卯',
    hour: '戊辰',
  },
  intervalStart: '2024-01-01 08:30:37',
  intervalEnd: '2024-01-01 09:30:37',
};

const SELECTION: BaziReverseResolvedInput = {
  year: '2024',
  month: '1',
  day: '1',
  timeIndex: 4,
  representativeHour: 8,
  representativeMinute: 30,
  representativeSecond: 37,
  source: SOURCE,
};

const ALMANAC_SOURCE: BaziReverseSource = {
  pillars: {
    year: '甲辰',
    month: '丙寅',
    day: '乙巳',
    hour: '甲申',
  },
  intervalStart: '2024-02-11 15:00:00',
  intervalEnd: '2024-02-11 17:00:00',
  startTimestamp: Date.parse('2024-02-11T15:00:00+08:00'),
  endTimestamp: Date.parse('2024-02-11T17:00:00+08:00'),
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

const ALMANAC_SELECTION: BaziReverseResolvedInput = {
  year: '2024',
  month: '2',
  day: '11',
  timeIndex: 8,
  representativeHour: 15,
  representativeMinute: 0,
  representativeSecond: 0,
  source: ALMANAC_SOURCE,
};

function buildDraft(overrides: Partial<DivinationDraft>): DivinationDraft {
  return {
    method: 'qimen',
    question: '这件事接下来如何推进？',
    gender: '',
    birthYear: '',
    divinationTimeMode: 'current',
    customDivinationDate: '',
    customDivinationTime: '',
    divinationTimeStandard: 'beijing',
    meihuaMethod: 'time',
    meihuaNumber: '',
    meihuaSoundCount: '',
    meihuaCharacterText: '',
    meihuaCharacterTones: '',
    meihuaCharacterStrokeCounts: '',
    meihuaCharacterLeftStrokes: '',
    meihuaCharacterRightStrokes: '',
    meihuaDirection: 'north',
    meihuaObjectType: 'earth',
    xiaoliurenMethod: 'time',
    jinkoujueMethod: 'time',
    jinkoujueBranch: '子',
    jinkoujueNumber: '',
    liuyaoTemplate: 'general',
    liurenTemplate: 'general',
    tarotSpread: 'single',
    almanacTopic: 'custom',
    almanacStartDate: '2026-06-01',
    almanacEndDate: '2026-06-05',
    almanacParticipants: [],
    astrolabeName: '本人',
    astrolabeGender: '',
    astrolabeYear: '1995',
    astrolabeMonth: '5',
    astrolabeDay: '20',
    astrolabeHour: '12',
    astrolabeMinute: '30',
    astrolabeLatitude: '39.9042',
    astrolabeLongitude: '116.4074',
    astrolabeTimezone: '8',
    taiyiYear: '2026',
    zhugeText: '',
    ...overrides,
  };
}

test('四柱时间模式必须保留秒、使用北京时间并把候选区间写入占卜事实', async () => {
  const draft = buildDraft({
    divinationTimeMode: 'pillars',
    customDivinationDate: '2024-01-01',
    customDivinationTime: '08:30:37',
    divinationTimeStandard: 'true-solar',
    divinationReverseSource: structuredClone(SOURCE),
  });
  const submitted = structuredClone(draft);
  const pending = generateDivinationSession(draft);
  draft.method = 'meihua';
  draft.question = '随后编辑的新问题';
  draft.questionSource = 'inspiration';
  draft.qimenMethod = 'feipan';
  draft.qimenScope = 'year';
  draft.qimenJuMethod = 'zhirun';
  draft.customDivinationTime = '09:00:00';
  const edited = structuredClone(draft);
  const session = await pending;

  assert.equal(session.method, 'qimen');
  assert.equal(session.requestedMethod, 'qimen');
  assert.equal(session.question, submitted.question);
  const data = session.data as { method: string; scope: string; juMethod: string };
  assert.equal(data.method, 'zhuanpan');
  assert.equal(data.scope, 'hour');
  assert.equal(data.juMethod, 'chaibu');
  assert.deepEqual(draft, edited, '完成原请求不应回写后来编辑的草稿');
  assert.equal(session.timeContext?.standard, 'beijing');
  assert.equal(session.timeContext?.clockDateTime, '2024-01-01T08:30:37');
  assert.equal(session.timeContext?.effectiveDateTime, '2024-01-01T08:30:37');
  assert.match(session.timeContext?.promptText ?? '', /北京时间/);
  assert.match(session.prompt, /2024-01-01 08:30:37 至 2024-01-01 09:30:37/);
  assert.doesNotMatch(session.prompt, /真太阳时/);

  const normal = await generateDivinationSession(submitted);
  assert.deepEqual(session.data, normal.data);
  assert.deepEqual(session.timeContext, normal.timeContext);
  const withoutCurrentTime = (text: string) =>
    text.replace(/(?:^|\n\n)【当前时间】\n[\s\S]*?(?=\n\n【|$)/u, '');
  assert.equal(withoutCurrentTime(session.prompt), withoutCurrentTime(normal.prompt));
  assert.deepEqual(
    submitted,
    buildDraft({
      divinationTimeMode: 'pillars',
      customDivinationDate: '2024-01-01',
      customDivinationTime: '08:30:37',
      divinationTimeStandard: 'true-solar',
      divinationReverseSource: structuredClone(SOURCE),
    }),
  );

  const fresh = await generateDivinationSession({ ...draft, method: 'qimen' });
  assert.equal(fresh.requestedMethod, 'qimen');
  assert.equal((fresh.data as { method: string }).method, 'feipan');
  assert.equal((fresh.data as { scope: string }).scope, 'year');
  assert.equal(fresh.question, '随后编辑的新问题');
  assert.equal(fresh.timeContext?.clockDateTime, '2024-01-01T09:00:00');
});

test('六种时间起局在真太阳时跨晚子时保留原秒、校正秒与实际时柱', async () => {
  const clockTimestamp = Date.parse('2025-02-01T23:13:42+08:00');
  const correctedTimestamp = Date.parse('2025-02-01T23:00:05+08:00');
  for (const method of [
    'liuyao',
    'meihua',
    'xiaoliuren',
    'jinkoujue',
    'qimen',
    'liuren',
  ] as const) {
    const session = await generateDivinationSession(
      buildDraft({
        method,
        divinationTimeMode: 'custom',
        customDivinationDate: '2025-02-01',
        customDivinationTime: '23:13:42',
        divinationTimeStandard: 'true-solar',
        birthPlace: '测试地点',
        birthLongitude: '120',
      }),
    );
    const data = session.data as {
      timestamp: number;
      ganzhi: { day: string; hour: string };
    };
    assert.equal(session.timeContext?.clockDateTime, '2025-02-01T23:13:42', method);
    assert.equal(session.timeContext?.effectiveDateTime, '2025-02-01T23:00:05', method);
    assert.equal(Date.parse(`${session.timeContext?.clockDateTime}+08:00`), clockTimestamp, method);
    assert.equal(data.timestamp, correctedTimestamp, method);
    assert.equal(data.ganzhi.day, '壬寅', method);
    assert.equal(data.ganzhi.hour, '庚子', method);
    assert.match(session.prompt, /当地钟表时间：2025-02-01 23:13:42/u, method);
    assert.match(session.prompt, /采用真太阳时：2025-02-01 23:00:05/u, method);
    assert.match(session.prompt, /干支：甲辰年 丁丑月 壬寅日 庚子时/u, method);
  }
});

test('旧占问恢复以保存盘面的秒级占时重建北京时间任务书，真太阳旧盘仍用原盘时刻', async () => {
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
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
    for (const method of ['qimen', 'taiyi', 'huangji'] as const) {
      const draft = buildDraft({
        method,
        ...(method === 'taiyi' ? { taiyiScope: 'hour' } : {}),
        ...(method === 'huangji' ? { huangjiMethod: 'standard' } : {}),
        divinationTimeMode: 'custom',
        customDivinationDate: '2025-01-01',
        customDivinationTime: '08:30:42',
      });
      const session = await generateDivinationSession(draft);
      const saved = addDivinationHistory(draft, {
        ...session,
        timeContext: {
          ...session.timeContext!,
          clockDateTime: '2025-01-01T08:30:00',
          effectiveDateTime: '2025-01-01T08:30:00',
          promptText: '时间口径：北京时间\n采用时间：2025-01-01 08:30',
        },
        prompt: session.prompt.replace(
          '采用时间：2025-01-01 08:30:42',
          '采用时间：2025-01-01 08:30',
        ),
      });
      assert.ok(saved);
      const restored = getDivinationHistoryById(saved.id)?.session;
      assert.ok(restored);
      assert.deepEqual(restored.data, JSON.parse(JSON.stringify(session.data)), method);
      assert.equal(restored.timeContext?.clockDateTime, '2025-01-01T08:30:42', method);
      assert.equal(restored.timeContext?.effectiveDateTime, '2025-01-01T08:30:42', method);
      assert.match(restored.prompt, /采用时间：2025-01-01 08:30:42/u, method);
    }

    const draft = buildDraft({
      method: 'qimen',
      divinationTimeMode: 'custom',
      customDivinationDate: '2025-02-01',
      customDivinationTime: '23:13:42',
      divinationTimeStandard: 'true-solar',
      birthPlace: '测试地点',
      birthLongitude: '120',
    });
    const minuteBasedOldChart = await generateDivinationSession({
      ...draft,
      customDivinationTime: '23:13:00',
    });
    const saved = addDivinationHistory(draft, minuteBasedOldChart);
    assert.ok(saved);
    const restored = getDivinationHistoryById(saved.id)?.session;
    assert.ok(restored);
    assert.deepEqual(restored.data, JSON.parse(JSON.stringify(minuteBasedOldChart.data)));
    assert.equal(restored.timeContext?.effectiveDateTime, '2025-02-01T22:59:23');
    assert.equal(
      (restored.data as { timestamp: number }).timestamp,
      Date.parse('2025-02-01T22:59:23+08:00'),
    );
    assert.match(restored.prompt, /采用真太阳时：2025-02-01 22:59:23/u);
    assert.doesNotMatch(restored.prompt, /采用真太阳时：2025-02-01 23:00:05/u);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('四柱模式在来源失效后不能继续提交旧代表日期', async () => {
  await assert.rejects(
    generateDivinationSession(
      buildDraft({
        divinationTimeMode: 'pillars',
        customDivinationDate: '2024-01-01',
        customDivinationTime: '08:30:37',
        divinationReverseSource: null,
      }),
    ),
    /请先选择一个四柱候选日期/,
  );
});

test('黄历参与人按四柱回填使用公历并在时间编辑后清除来源', () => {
  const participant = {
    id: 'participant-1',
    name: '本人',
    gender: '男' as const,
    year: '',
    month: '',
    day: '',
    timeIndex: '',
    dateType: 'lunar' as const,
  };
  const selected = applyAlmanacReverseSelection(participant, ALMANAC_SELECTION);

  assert.equal(selected.inputMode, 'pillars');
  assert.equal(selected.dateType, 'solar');
  assert.equal(selected.isLeapMonth, false);
  assert.equal(selected.birthSecond, '0');
  assert.equal(getAlmanacParticipantInputMode(selected), 'pillars');

  const edited = updateAlmanacParticipantField(selected, 'birthSecond', '38');
  assert.equal(edited.reverseSource, undefined);
  assert.equal(getAlmanacParticipantInputMode(edited), 'pillars');
});

test('黄历结果提示词应保留参与人的四柱候选区间事实', async () => {
  const participant = applyAlmanacReverseSelection(
    {
      id: 'participant-1',
      name: '本人',
      gender: '男',
      year: '',
      month: '',
      day: '',
      timeIndex: '',
      dateType: 'lunar',
    },
    ALMANAC_SELECTION,
  );
  const session = await generateDivinationSession(
    buildDraft({
      method: 'almanac',
      question: '近期哪天适合办理事项？',
      almanacParticipants: [participant],
    }),
  );

  assert.match(
    session.prompt,
    /本人：出生时间范围（北京时间）：2024-02-11 15:00:00 至 2024-02-11 17:00:00/,
  );
});

test('黄历参与人未明确选择四柱候选时不能使用旧日期提交', async () => {
  await assert.rejects(
    generateDivinationSession(
      buildDraft({
        method: 'almanac',
        question: '',
        almanacParticipants: [
          {
            id: 'participant-1',
            name: '本人',
            gender: '男',
            year: '2024',
            month: '1',
            day: '1',
            timeIndex: '4',
            dateType: 'solar',
            inputMode: 'pillars',
            reverseSource: null,
          },
        ],
      }),
    ),
    /参与人1请先选择一个四柱候选日期/,
  );
});
