import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDivinationHistory,
  getDivinationHistoryById,
  loadDivinationHistory,
  loadCompatibilityHistory,
  loadPersonalHistory,
  upsertCompatibilityHistory,
  upsertPersonalHistory,
} from '../src/lib/history-records';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { resolveSignByNumber } from 'mingyu-core/divination/ssgw';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
import { calculateWuyunLiuqi } from 'mingyu-core/wuyun-liuqi';
import { generateDivinationSession, type DivinationSession } from '../src/lib/divination/engine';
import { buildCompatibilityRecordPath } from '../src/lib/case-navigation';
import {
  defaultInputState,
  defaultPromptState,
  parseInputState,
  type QueryInputState,
} from '../src/lib/query-state';
import { buildReadingSubject } from '../src/lib/ai/reading-subject';
import { buildFrontendBirthProfile } from '../src/lib/full-chart-engine/birth-profile';

function createInput(name: string): QueryInputState {
  return {
    ...defaultInputState,
    name,
    year: '2000',
    month: '1',
    day: '1',
    timeIndex: 0,
  };
}

function withMockStorage(
  run: (storage: Map<string, string>, setFail: (value: boolean) => void) => void,
) {
  const storage = new Map<string, string>();
  let failWrites = false;
  const originalWindow = globalThis.window;
  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (failWrites) throw new Error('quota exceeded');
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  } as Storage;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, dispatchEvent: () => true },
  });

  try {
    run(storage, (value) => {
      failWrites = value;
    });
  } finally {
    if (originalWindow === undefined) {
      // @ts-expect-error Node 测试环境下允许删除临时挂载的 window
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  }
}

test('历史签谱只用保存的签号与原盘重建任务书，缓存污染不进入复制和解读', () => {
  withMockStorage((storage) => {
    const data = resolveSignByNumber(18, new Date('2025-06-18T10:30:00+08:00'));
    const draft = { ...defaultDraft, method: 'ssgw' as const, question: '合作何时推进？' };
    const session: DivinationSession = {
      method: 'ssgw',
      requestedMethod: 'ssgw',
      question: draft.question,
      prompt: '【签谱】\n第99签：错误签题\n\n【任务】\n旧格局重复。',
      data: { ...data, story: undefined, details: undefined },
    };
    const saved = addDivinationHistory(draft, session);
    assert.ok(saved);
    const storedBefore = storage.get('prompt_studio_divination_history_v1');
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    assert.equal(restored.session.data.number, 18);
    assert.equal(restored.session.question, draft.question);
    assert.match(restored.session.prompt, /第十八签|第18签/u);
    assert.ok(restored.session.prompt.includes(data.title));
    assert.ok(restored.session.prompt.includes(data.poem));
    assert.match(restored.session.prompt, /典故：/u);
    assert.doesNotMatch(restored.session.prompt, /第99签|旧格局重复/u);
    assert.equal(storage.get('prompt_studio_divination_history_v1'), storedBefore);
  });
});

test('历史塔罗按已保存牌阵身份校正展示，保留原牌序、时间、问题与补充资料', () => {
  withMockStorage(() => {
    const generated = drawTarotSpread('three', {
      manualCards: [
        { id: 1, reversed: false },
        { id: 2, reversed: true },
        { id: 3, reversed: false },
      ],
    });
    const timestamp = Date.parse('2025-01-01T08:30:00+08:00');
    const data = {
      ...generated,
      timestamp,
      meta: generated.meta ? { ...generated.meta, calculatedAt: timestamp } : undefined,
    };
    const draft = {
      ...defaultDraft,
      method: 'tarot' as const,
      question: '合作如何推进？',
      userSupplement: '已经约定下周讨论方案。',
      tarotSpread: 'three' as const,
    };
    const saved = addDivinationHistory(draft, {
      method: 'tarot',
      requestedMethod: 'tarot',
      question: draft.question,
      prompt: '【当前时间】\n错误缓存时间\n\n【占卜信息】\n旧牌阵',
      data: { ...data, spreadName: '错误牌阵' },
    });
    assert.ok(saved);
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    assert.equal((restored.session.data as typeof data).spreadName, '时间流牌阵');
    assert.deepEqual((restored.session.data as typeof data).cards, data.cards);
    assert.ok(restored.session.prompt.includes('时间流牌阵'));
    assert.ok(restored.session.prompt.includes('2025年1月1日 8时30分'));
    assert.ok(restored.session.prompt.includes('已经约定下周讨论方案。'));
    assert.ok(restored.session.prompt.includes(draft.question));
    assert.doesNotMatch(restored.session.prompt, /错误缓存时间|错误牌阵|旧牌阵/u);
  });
});

test('历史签谱身份矛盾时拒绝选中，原记录仍在列表与存储中', () => {
  withMockStorage((storage) => {
    const data = resolveSignByNumber(18, new Date('2025-06-18T10:30:00+08:00'));
    const draft = { ...defaultDraft, method: 'ssgw' as const, question: '合作何时推进？' };
    const saved = addDivinationHistory(draft, {
      method: 'ssgw',
      requestedMethod: 'ssgw',
      question: draft.question,
      prompt: '【签谱】\n错误缓存',
      data: { ...data, title: '第十九签' },
    });
    assert.ok(saved);
    const storedBefore = storage.get('prompt_studio_divination_history_v1');
    assert.throws(() => getDivinationHistoryById(saved.id), /签号、签谱内容或抽签记录不一致/u);
    assert.equal(loadDivinationHistory()[0]?.id, saved.id);
    assert.equal(storage.get('prompt_studio_divination_history_v1'), storedBefore);
  });
});

test('历史皇极从保存的周期结果重建任务书，两个旧缓存都不再发送', () => {
  withMockStorage(() => {
    const data = calculateHuangjiJingshi({ year: 2025, question: '旧缓存问题' });
    const draft = { ...defaultDraft, method: 'huangji' as const, question: '2025 年应如何安排？' };
    const saved = addDivinationHistory(draft, {
      method: 'huangji',
      requestedMethod: 'huangji',
      question: draft.question,
      prompt: '【任务】\n旧 session 提示词',
      data: { ...data, prompt: '【任务】\n旧 data 提示词' },
    });
    assert.ok(saved);
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    assert.ok(restored.session.prompt.includes(draft.question));
    assert.ok(restored.session.prompt.includes('2025'));
    assert.doesNotMatch(restored.session.prompt, /旧缓存问题|旧 session 提示词|旧 data 提示词/u);
  });
});

test('历史六爻重建沿用原盘、模板、问题与原占时，不再起卦', async () => {
  const draft = {
    ...defaultDraft,
    method: 'liuyao' as const,
    question: '双方合作接下来如何推进？',
    questionSource: 'inspiration' as const,
    liuyaoMethod: 'manual' as const,
    liuyaoYaos: [6, 7, 8, 9, 7, 8] as Array<6 | 7 | 8 | 9>,
    liuyaoTemplate: 'ganqing' as const,
    divinationTimeMode: 'custom' as const,
    customDivinationDate: '2025-01-01',
    customDivinationTime: '08:30',
  };
  const original = await generateDivinationSession(draft);
  withMockStorage(() => {
    const saved = addDivinationHistory(draft, { ...original, prompt: '旧缓存格局与占时' });
    assert.ok(saved);
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    assert.deepEqual(restored.session.data, saved.session.data);
    assert.deepEqual(restored.session.timeContext, saved.session.timeContext);
    assert.ok(restored.session.prompt.includes('感情关系'));
    assert.ok(restored.session.prompt.includes('2025年1月1日'));
    assert.ok(restored.session.prompt.includes(draft.question));
    assert.doesNotMatch(restored.session.prompt, /旧缓存格局与占时/u);
  });
});

test('年度历史盘无时间戳时只沿用原时间段，原段缺失则不填入当前时间', () => {
  withMockStorage(() => {
    const data = calculateWuyunLiuqi({ year: 2025 });
    assert.equal('timestamp' in data, false);
    const draft = {
      ...defaultDraft,
      method: 'wuyun' as const,
      question: '2025 年运气如何？',
      wuyunYear: '2025',
    };
    const originalTime = '2025年1月2日 3时4分';
    const withTime = addDivinationHistory(draft, {
      method: 'wuyun',
      requestedMethod: 'wuyun',
      question: draft.question,
      prompt: `【当前时间】\n${originalTime}\n\n【任务】\n旧任务`,
      data,
    });
    assert.ok(withTime);
    const restoredTime = getDivinationHistoryById(withTime.id)?.session.prompt;
    assert.ok(restoredTime);
    assert.ok(restoredTime.includes(`【当前时间】\n${originalTime}`));
    assert.doesNotMatch(restoredTime, /旧任务/u);

    const withoutTime = addDivinationHistory(draft, {
      method: 'wuyun',
      requestedMethod: 'wuyun',
      question: draft.question,
      prompt: '【任务】\n旧任务',
      data,
    });
    assert.ok(withoutTime);
    const restoredWithoutTime = getDivinationHistoryById(withoutTime.id)?.session.prompt;
    assert.ok(restoredWithoutTime);
    assert.doesNotMatch(restoredWithoutTime, /【当前时间】|旧任务/u);
  });
});

test('案例存储写入失败时保留旧记录并向调用方报告失败', () => {
  withMockStorage((storage, setFail) => {
    const original = upsertPersonalHistory(createInput('旧案例'), 'bazi')[0];
    const before = storage.get('prompt_studio_personal_history_v1');
    assert.ok(original);
    assert.ok(before);

    setFail(true);
    assert.throws(() => upsertPersonalHistory(createInput('新案例'), 'bazi'), /原有案例未被改动/);
    assert.equal(storage.get('prompt_studio_personal_history_v1'), before);
    assert.deepEqual(
      loadPersonalHistory().map((item) => item.name),
      ['旧案例'],
    );
  });
});

test('历史记录中的损坏条目被隔离而不影响有效案例读取', () => {
  withMockStorage((storage) => {
    const valid = upsertPersonalHistory(createInput('有效案例'), 'bazi')[0];
    storage.set(
      'prompt_studio_personal_history_v1',
      JSON.stringify([{ type: 'single', name: '损坏案例' }, valid]),
    );

    const records = loadPersonalHistory();
    assert.deepEqual(
      records.map((item) => item.name),
      ['有效案例'],
    );
    assert.equal(records[0]?.input.name, '有效案例');
  });
});

test('四柱日期保存、重开与跨术数引用保留候选区间和秒数', async () => {
  const { getGanZhiFromDate } = await import('mingyu-core/ganzhi');
  const { reverseBaziDates } = await import('mingyu-core/calendar');
  const { resolveBaziReverseCandidate, parseBaziReverseSource } =
    await import('../src/lib/bazi-reverse-input');
  const { applyPersonReverseSelection, getPersonInputMode } =
    await import('../src/pages/InputPage.field-helpers');
  const { buildChartFeaturePathForCase } = await import('../src/lib/case-navigation');
  const { parseInputState } = await import('../src/lib/query-state');
  const pillars = getGanZhiFromDate(new Date('2000-01-07T09:00:00+08:00'));
  const candidate = reverseBaziDates({ pillars, startYear: 2000, endYear: 2000 }).candidates[0];
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  withMockStorage(() => {
    const input = applyPersonReverseSelection(createInput('合成日期'), 'self', selection);
    const partner = applyPersonReverseSelection(input, 'partner', selection);
    assert.equal(partner.birthReverseSource, input.birthReverseSource);
    assert.equal(partner.partnerBirthSecond, input.birthSecond);
    assert.equal(getPersonInputMode(partner, 'partner'), 'pillars');
    assert.equal(partner.partnerUseTrueSolarTime, false);
    upsertPersonalHistory(input, 'ziwei');
    const [record] = loadPersonalHistory();
    assert.equal(getPersonInputMode(record.input, 'self'), 'pillars');
    assert.deepEqual(parseBaziReverseSource(record.input.birthReverseSource), selection.source);
    for (const feature of [
      'bazi',
      'ziwei',
      'bazi-ziwei',
      'qimen-lifetime',
      'astrolabe',
      'qizheng',
      'bazhai',
      'compatibility',
    ] as const) {
      const path = buildChartFeaturePathForCase(record, feature);
      const restored = parseInputState(new URLSearchParams(path.split('?')[1]));
      assert.equal(restored.birthReverseSource, input.birthReverseSource, feature);
      assert.equal(restored.birthSecond, input.birthSecond, feature);
      assert.equal(restored.useTrueSolarTime, false, feature);
      assert.equal(getPersonInputMode(restored, 'self'), 'pillars', feature);
    }
  });
});

test('八字未知时辰案例保存重开保留三柱标志，其他命盘入口不继承', async () => {
  const { buildChartFeaturePathForCase, buildPersonalRecordPath } =
    await import('../src/lib/case-navigation');
  withMockStorage(() => {
    upsertPersonalHistory(
      {
        ...createInput('未知时辰合成案例'),
        gender: 'female',
        year: '2024',
        month: '2',
        day: '4',
        timeIndex: -1,
      },
      'bazi',
    );
    const [record] = loadPersonalHistory();
    assert.ok(record);
    assert.equal(record.input.timeIndex, -1);

    const baziParams = new URLSearchParams(buildPersonalRecordPath(record).split('?')[1]);
    assert.equal(parseInputState(baziParams).timeIndex, -1);

    for (const feature of ['ziwei', 'bazi-ziwei', 'qimen-lifetime', 'bazhai'] as const) {
      const path = buildChartFeaturePathForCase(record, feature);
      assert.equal(parseInputState(new URLSearchParams(path.split('?')[1])).timeIndex, '', feature);
    }
  });
});

test('双人历史恢复保留仅名称地点、坐标和双方分钟秒精度', () => {
  const startTimestamp = Date.parse('2000-01-01T00:00:00.000Z');
  const rangeSource = JSON.stringify({
    pillars: { year: '庚辰', month: '戊子', day: '甲午', hour: '丙寅' },
    intervalStart: '2000-01-01 08:00:00',
    intervalEnd: '2000-01-01 08:00:03',
    startTimestamp,
    endTimestamp: startTimestamp + 3_000,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  });
  const input: QueryInputState = {
    ...defaultInputState,
    analysisMode: 'compatibility',
    name: '仅名称主方',
    gender: 'female',
    year: '2000',
    month: '1',
    day: '1',
    timeIndex: '',
    birthHour: '8',
    birthMinute: '0',
    birthSecond: '',
    birthReverseSource: rangeSource,
    birthPlace: '仅名称主方',
    birthLongitude: '',
    birthLatitude: '',
    partnerName: '坐标对方',
    partnerGender: 'male',
    partnerYear: '2000',
    partnerMonth: '1',
    partnerDay: '1',
    partnerTimeIndex: '',
    partnerBirthHour: '8',
    partnerBirthMinute: '1',
    partnerBirthSecond: '7',
    partnerBirthReverseSource: '',
    partnerBirthPlace: '坐标对方',
    partnerBirthLongitude: '121.47',
    partnerBirthLatitude: '31.23',
  };

  withMockStorage(() => {
    upsertCompatibilityHistory(input);
    const [record] = loadCompatibilityHistory();
    assert.ok(record);
    const restored = parseInputState(
      new URLSearchParams(buildCompatibilityRecordPath(record).split('?')[1]),
    );

    for (const field of [
      'birthPlace',
      'birthLongitude',
      'birthLatitude',
      'birthSecond',
      'birthReverseSource',
      'partnerBirthPlace',
      'partnerBirthLongitude',
      'partnerBirthLatitude',
      'partnerBirthSecond',
    ] as const) {
      assert.equal(restored[field], input[field], field);
    }

    const restoredProfile = buildFrontendBirthProfile(restored, 'primary');
    assert.deepEqual(restoredProfile.birthTimeRange, {
      startTimestamp,
      endTimestamp: startTimestamp + 3_000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    });

    const subject = buildReadingSubject(restored, {
      ...defaultPromptState,
      promptSource: 'bazi-ziwei',
    });
    assert.equal(subject.lockedInputs.bazi?.timezone, 8);
    assert.equal(subject.lockedInputs.bazi?.birthPlace, '仅名称主方');
    assert.equal(subject.lockedInputs.baziPartner?.timeZoneId, 'Asia/Shanghai');
    assert.equal(subject.lockedInputs.baziPartner?.birthLongitude, 121.47);
    assert.equal(subject.lockedInputs.baziPartner?.birthSecond, 7);
  });
});
