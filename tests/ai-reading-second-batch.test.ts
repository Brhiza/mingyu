import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatReadingCurrentTime,
  getReadingGuide,
  isTimeReadingFollowup,
  runReadingWorkflow,
  type ReadingDependencies,
  type ReadingMemory,
  type ReadingOptions,
} from '../src/lib/ai/reading-workflow';
import { buildReadingSubject, type ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import { defaultInputState, defaultPromptState } from '../src/lib/query-state';

function createHarness(responses: string[]) {
  const sent: Parameters<ReadingDependencies['stream']>[0][] = [];
  const chunks: string[] = [];
  const notices: string[] = [];
  const memory: ReadingMemory = { resources: [] };
  const options: ReadingOptions = {
    memory,
    onProgress: () => undefined,
    onNotice: (notice) => notices.push(notice),
    onChunk: (chunk) => chunks.push(chunk),
    onDone: () => undefined,
  };
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    sent.push(messages);
    callbacks.onChunk(responses.shift() ?? '最终回答');
    callbacks.onDone();
  };
  return { memory, options, sent, chunks, notices, stream };
}

const baziSubject: ReadingSubjectSnapshot = {
  id: 'subject-second-batch',
  source: 'bazi',
  lockedInputs: {
    bazi: {
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 8,
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
      timeZoneId: 'Asia/Shanghai',
    },
  },
  allowedMethods: ['bazi'],
  range: { baziFortuneScope: 'year' },
};

test('明确主体来源时优先使用对应术式指南，避免盘面关键词碰撞', () => {
  const guide = getReadingGuide('八字与紫微斗数都出现在原始任务正文中', baziSubject);
  assert.match(guide, /八字：/u);
  assert.doesNotMatch(guide, /紫微斗数：/u);
});

test('明确占卜术式时按术式路由，避免太乙和六爻正文关键词碰撞', () => {
  const taiyiGuide = getReadingGuide('太乙天符与八字、紫微斗数均出现在正文中', undefined, 'taiyi');
  assert.match(taiyiGuide, /太乙/u);
  assert.doesNotMatch(taiyiGuide, /八字：|紫微斗数：/u);

  const liuyaoGuide = getReadingGuide(
    '六爻卦象与太乙天符、八字均出现在正文中',
    undefined,
    'liuyao',
  );
  assert.match(liuyaoGuide, /六爻/u);
  assert.doesNotMatch(liuyaoGuide, /太乙：|八字：/u);
});

test('时间追问覆盖普通相对时间，绝对年份仍按用户目标识别', () => {
  for (const question of [
    '明天如何',
    '昨天如何',
    '下个月如何',
    '上个月如何',
    '下周如何',
    '本季度如何',
    '最近如何',
    '接下来如何',
  ]) {
    assert.equal(isTimeReadingFollowup(question), true, question);
  }
  assert.equal(isTimeReadingFollowup('2030年事业如何'), true);
});

test('明确主体来源时跳过其他术式的补充资料动作', async () => {
  const harness = createHarness([
    '{"actions":[{"kind":"classic","method":"ziwei","query":"命宫"}]}',
    '八字解读',
  ]);
  let executed = false;
  await runReadingWorkflow(
    [{ role: 'user', content: '八字盘面与紫微关键词' }],
    { ...harness.options, subject: baziSubject },
    {
      stream: harness.stream,
      execute: async () => {
        executed = true;
        return { key: '', title: '不应出现', text: '不应出现', usable: true };
      },
    },
  );

  assert.equal(executed, false);
  assert.ok(harness.notices.some((notice) => notice.includes('命盘类型')));
  assert.doesNotMatch(harness.sent.at(-1)?.[0].content ?? '', /不应出现/u);
});

test('明确占卜术式时跳过正文关键词诱导的其他术式动作', async () => {
  const harness = createHarness([
    '{"actions":[{"kind":"classic","method":"bazi","query":"日主"}]}',
    '太乙解读',
  ]);
  let executed = false;
  await runReadingWorkflow(
    [{ role: 'user', content: '太乙天符与八字关键词' }],
    { ...harness.options, readingMethod: 'taiyi' },
    {
      stream: harness.stream,
      execute: async () => {
        executed = true;
        return { key: '', title: '不应出现', text: '不应出现', usable: true };
      },
    },
  );

  assert.equal(executed, false);
  assert.ok(harness.notices.some((notice) => notice.includes('当前术式')));
});

test('简单解释追问复用已有资料并跳过资料规划', async () => {
  const harness = createHarness(['{"actions":[]}', '首轮回答', '追问直答']);
  await runReadingWorkflow([{ role: 'user', content: '八字盘面与问题' }], harness.options, {
    stream: harness.stream,
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  await runReadingWorkflow(
    [
      { role: 'user', content: '八字盘面与问题' },
      { role: 'assistant', content: '首轮回答' },
      { role: 'user', content: '请总结一下' },
    ],
    harness.options,
    {
      stream: harness.stream,
      execute: async () => {
        throw new Error('不应执行');
      },
    },
  );

  assert.equal(harness.sent.length, 3);
  assert.match(harness.sent[2][0].content, /结合当前盘面、已有补充资料和上一轮解读直接回答/u);
  assert.deepEqual(harness.chunks, ['首轮回答', '追问直答']);
});

test('时间追问使用本轮当前时间并继续资料规划', async () => {
  const harness = createHarness(['{"actions":[]}', '首轮回答', '{"actions":[]}', '时间回答']);
  await runReadingWorkflow([{ role: 'user', content: '八字盘面与问题' }], harness.options, {
    stream: harness.stream,
    execute: async () => {
      throw new Error('不应执行');
    },
  });
  await runReadingWorkflow(
    [
      { role: 'user', content: '八字盘面与问题' },
      { role: 'assistant', content: '首轮回答' },
      { role: 'user', content: '下个月事业如何' },
    ],
    harness.options,
    {
      stream: harness.stream,
      execute: async () => {
        throw new Error('不应执行');
      },
    },
  );

  assert.equal(harness.sent.length, 4);
  assert.match(harness.sent[2][0].content, /【本轮当前时间】/u);
  assert.match(harness.sent[3][0].content, /【本轮当前时间】/u);
  assert.match(formatReadingCurrentTime(new Date('2026-09-11T01:02:00.000Z')), /2026/u);
});

test('绝对年份追问保留用户指定年份，不以当前时间替换', async () => {
  const harness = createHarness(['{"actions":[]}', '2030年回答']);
  await runReadingWorkflow(
    [
      { role: 'user', content: '八字盘面与问题' },
      { role: 'assistant', content: '首轮回答' },
      { role: 'user', content: '2030年事业如何' },
    ],
    harness.options,
    {
      stream: harness.stream,
      execute: async () => {
        throw new Error('不应执行');
      },
    },
  );

  assert.ok(harness.sent[0].some((message) => message.content.includes('2030年事业如何')));
  assert.doesNotMatch(harness.sent[0][0].content, /【本轮当前时间】/u);
});

test('双盘主体快照保留双方的时区、坐标、时分和时辰索引', () => {
  const input = {
    ...defaultInputState,
    analysisMode: 'compatibility' as const,
    name: '甲',
    gender: 'male' as const,
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 8 as const,
    birthHour: '10',
    birthMinute: '30',
    birthPlace: '北京',
    birthLongitude: '116.4',
    birthLatitude: '39.9',
    partnerName: '乙',
    partnerGender: 'female' as const,
    partnerYear: '1992',
    partnerMonth: '6',
    partnerDay: '16',
    partnerTimeIndex: 2 as const,
    partnerBirthHour: '1',
    partnerBirthMinute: '20',
    partnerBirthPlace: '上海',
    partnerBirthLongitude: '121.5',
    partnerBirthLatitude: '31.2',
  };
  const subject = buildReadingSubject(input, {
    ...defaultPromptState,
    promptSource: 'bazi-ziwei',
  });

  assert.equal(subject.lockedInputs.bazi.timeZoneId, 'Asia/Shanghai');
  assert.equal(subject.lockedInputs.bazi.birthLongitude, 116.4);
  assert.equal(subject.lockedInputs.bazi.timeIndex, 8);
  assert.equal(subject.lockedInputs.baziPartner.year, 1992);
  assert.equal(subject.lockedInputs.baziPartner.birthMinute, 20);
  assert.equal(subject.lockedInputs.ziweiPartner.timeIndex, 2);
  assert.equal(subject.lockedInputs.ziweiPartner.birthLatitude, 31.2);
});

test('同时包含绝对年份和流年术语时明确保留指定目标', async () => {
  const harness = createHarness(['{"actions":[]}', '2030年流年回答']);
  await runReadingWorkflow(
    [
      { role: 'user', content: '八字盘面与问题' },
      { role: 'assistant', content: '首轮回答' },
      { role: 'user', content: '请分析2030年流年' },
    ],
    harness.options,
    {
      stream: harness.stream,
      execute: async () => {
        throw new Error('不应执行');
      },
    },
  );
  for (const request of harness.sent) {
    assert.ok(request.some((message) => message.content.includes('请分析2030年流年')));
    assert.match(request[0].content, /用户明确指定的年月日作为目标时段/u);
  }
});

test('超容量补充资料未进入解读时明确提示实际缺项', async () => {
  const harness = createHarness([
    '{"actions":[{"kind":"classic","method":"bazi","query":"格局"}]}',
    '按已有资料解读',
  ]);
  await runReadingWorkflow([{ role: 'user', content: '八字盘面' }], harness.options, {
    stream: harness.stream,
    execute: async () => ({ key: '', title: '格局条文', text: '资料'.repeat(25000), usable: true }),
  });
  assert.equal(harness.memory.resources.length, 1);
  assert.equal(harness.memory.resources[0].text.length, 50000);
  assert.ok(
    harness.notices.some((notice) => notice.includes('格局条文') && notice.includes('未纳入')),
  );
  assert.match(harness.sent.at(-1)?.[0].content ?? '', /资料覆盖[\s\S]*格局条文/u);
  assert.doesNotMatch(harness.sent.at(-1)?.[0].content ?? '', /资料资料资料/u);
});
