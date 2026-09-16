import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateQizhengBirthRange,
  generateQizhengFlowBirthRange,
  type QizhengBirthRange,
  type QizhengFlowBirthRange,
  type QizhengInput,
} from 'mingyu-core/qizheng';
import { formatQizhengBirthRangePrompt } from '../src/lib/qizheng-birth-range-prompt';
import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';
import {
  runReadingWorkflow,
  type ReadingDependencies,
  type ReadingMemory,
  type ReadingOptions,
  type ReadingResource,
} from '../src/lib/ai/reading-workflow';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { ChatMessage } from '../src/lib/ai/stream-client';

const OFFSET_MINUTES = 480;
const OFFSET_MILLISECONDS = OFFSET_MINUTES * 60 * 1_000;
const input: QizhengInput = {
  gender: 'male',
  year: 2024,
  month: 2,
  day: 19,
  hour: 11,
  minute: 24,
  second: 48,
  latitude: 39.9,
  longitude: 116.4,
  timezone: 8,
  useTrueSolarTime: false,
};

function timestamp(text: string) {
  return Date.parse(`${text.replace(' ', 'T')}+08:00`);
}

function makeRange(seconds: number): QizhengBirthRange {
  const startTimestamp = timestamp('2024-02-19 11:24:48');
  return generateQizhengBirthRange(input, {
    startTimestamp,
    endTimestamp: startTimestamp + seconds * 1_000,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  });
}

let longFlowRange: QizhengFlowBirthRange | undefined;
function getLongFlowRange() {
  const startTimestamp = timestamp('2024-02-19 11:24:48');
  return (longFlowRange ??= generateQizhengFlowBirthRange(
    { ...input, flowYear: 2024, flowMonth: 3, flowDay: 15, flowHour: 12, flowMinute: 0 },
    {
      startTimestamp,
      endTimestamp: startTimestamp + 7_200 * 1_000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
  ));
}

function makeResource(
  range: QizhengBirthRange | QizhengFlowBirthRange,
  key: string,
  title: string,
): ReadingResource {
  return {
    key,
    title,
    text: formatQizhengBirthRangePrompt(range),
    usable: true,
    structured: range as unknown as Record<string, unknown>,
  };
}

function makeWrappedResource(
  range: QizhengBirthRange | QizhengFlowBirthRange,
  key: string,
  title: string,
): ReadingResource {
  return {
    key,
    title,
    text: buildMetaphysicsPrompt(formatQizhengBirthRangePrompt(range), '资源生成问题', {
      method: 'qizheng',
      currentTime: new Date('2026-09-16T12:00:00+08:00'),
    }),
    usable: true,
    structured: range as unknown as Record<string, unknown>,
  };
}

function makeSingleLongRange(): QizhengBirthRange {
  const base = makeRange(2);
  const branch = base.branches[0]!;
  const continuous = branch.continuous[0]!;
  return {
    ...base,
    branches: [
      {
        ...branch,
        continuous: Array.from({ length: 1_800 }, (_, index) => ({
          ...continuous,
          path: `${continuous.path}.${index}`,
          label: `${continuous.label}${index}`,
        })),
      },
    ],
  };
}

function makeSubject(): ReadingSubjectSnapshot {
  return {
    id: 'qizheng-reading-phase-test',
    source: 'qizheng',
    lockedInputs: { 'qi-zheng': input },
    allowedMethods: ['qi-zheng'],
    range: {},
  };
}

function makeHarness(resources: ReadingResource[]) {
  const sent: ChatMessage[][] = [];
  const errors: string[] = [];
  const notices: string[] = [];
  let done = 0;
  const memory: ReadingMemory = { resources };
  const options: ReadingOptions = {
    memory,
    subject: makeSubject(),
    onProgress: () => {},
    onNotice: (text) => notices.push(text),
    onError: (text) => errors.push(text),
    onChunk: () => {},
    onDone: () => {
      done += 1;
    },
  };
  return { sent, errors, notices, memory, options, done: () => done };
}

function makeStream(harness: ReturnType<typeof makeHarness>) {
  return async (
    messages: ChatMessage[],
    callbacks: Parameters<ReadingDependencies['stream']>[1],
  ) => {
    harness.sent.push(messages);
    const content = messages[0]?.content ?? '';
    const latest = messages.at(-1)?.content ?? '';
    if (latest.includes('当前任务：准备解读资料')) callbacks.onChunk('{"actions":[]}');
    else if (content.includes('七政四余出生区间阶段覆盖核对'))
      callbacks.onChunk('七政四余全部阶段汇总');
    else callbacks.onChunk('七政四余阶段判断');
    callbacks.onDone();
  };
}

test('七政四余小区间容量足够时沿用单次最终解读', async () => {
  const resource = makeResource(makeRange(2), 'qizheng-small', '七政四余小区间');
  const h = makeHarness([resource]);
  const stream = makeStream(h);

  await runReadingWorkflow(
    [{ role: 'user', content: '七政四余本命出生区间，问事业。' }],
    h.options,
    {
      stream,
      execute: async () => resource,
    },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  assert.equal(h.memory.qizhengPhaseReading, undefined);
  assert.equal(
    h.sent.filter((messages) => messages[0]?.content.includes('七政四余出生区间阶段资料')).length,
    0,
  );
});

test('七政四余超容量时按出生分段完整消费并汇总', async () => {
  const resource = makeResource(getLongFlowRange(), 'qizheng-long', '七政四余流曜长区间');
  const h = makeHarness([resource]);
  const stream = makeStream(h);

  await runReadingWorkflow(
    [{ role: 'user', content: '七政四余流曜出生区间，问全部分段的事业变化。' }],
    h.options,
    { stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  assert.ok((h.memory.qizhengPhaseReading?.phases.length ?? 0) > 1);
  assert.equal(
    h.memory.qizhengPhaseReading?.phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
  const phaseMessages = h.sent.filter((messages) =>
    messages[0]?.content.includes('七政四余出生区间阶段资料'),
  );
  assert.ok(phaseMessages.length >= (h.memory.qizhengPhaseReading?.phases.length ?? 0));
  assert.ok(
    phaseMessages.every(
      (messages) => messages.reduce((sum, message) => sum + message.content.length, 0) <= 49_000,
    ),
  );
  const phaseText = phaseMessages.map((messages) => messages[0]!.content).join('\n');
  for (const [index, branch] of (
    resource.structured as unknown as QizhengFlowBirthRange
  ).branches.entries()) {
    const start = new Date(branch.startTimestamp + OFFSET_MILLISECONDS)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    assert.match(phaseText, new RegExp(`出生分段${index + 1}/`, 'u'));
    assert.match(phaseText, new RegExp(start.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  assert.match(h.sent.at(-1)?.[0]?.content ?? '', /七政四余出生区间阶段覆盖核对/u);
});

test('七政四余原始任务书包装在分阶段资料中保留', async () => {
  const resource = makeWrappedResource(
    getLongFlowRange(),
    'qizheng-wrapped-long',
    '七政四余带任务书包装长区间',
  );
  const h = makeHarness([resource]);
  const stream = makeStream(h);

  await runReadingWorkflow(
    [{ role: 'user', content: '七政四余带任务书包装的流曜区间，问目标流日变化。' }],
    h.options,
    { stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  const phaseText = h.sent
    .filter((messages) => messages[0]?.content.includes('七政四余出生区间阶段资料'))
    .map((messages) => messages[0]!.content)
    .join('\n');
  assert.match(phaseText, /【传统依据】/u);
  assert.match(phaseText, /《果老星宗》/u);
  assert.match(phaseText, /【当前时间】/u);
  assert.match(phaseText, /2026年9月16日/u);
  assert.match(phaseText, /【任务】/u);
  assert.match(phaseText, /【问题】\n资源生成问题/u);
});

test('七政四余流曜区间阶段保留本命、流曜、周期事件和连续量', async () => {
  const range = getLongFlowRange();
  const resource = makeResource(range, 'qizheng-flow-long', '七政四余流曜长区间');
  const h = makeHarness([resource]);
  const stream = makeStream(h);

  await runReadingWorkflow(
    [{ role: 'user', content: '七政四余流曜出生区间，问目标流日变化。' }],
    h.options,
    { stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  const phaseMessages = h.sent.filter((messages) =>
    messages[0]?.content.includes('七政四余出生区间阶段资料'),
  );
  assert.ok(phaseMessages.length > 1);
  const phaseText = phaseMessages.map((messages) => messages[0]!.content).join('\n');
  assert.match(phaseText, /流曜落宫落宿/u);
  assert.match(phaseText, /周期事件/u);
  assert.match(phaseText, /连续量（最小至最大）/u);
});

test('七政四余单一出生分段过长时按完整连续量行拆分', async () => {
  const range = makeSingleLongRange();
  const resource = makeResource(range, 'qizheng-single-long', '七政四余单段长区间');
  const h = makeHarness([resource]);
  const stream = makeStream(h);

  await runReadingWorkflow(
    [{ role: 'user', content: '七政四余出生分段连续量，问事业。' }],
    h.options,
    { stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  const phases = h.memory.qizhengPhaseReading?.phases ?? [];
  assert.ok(phases.length > 1);
  assert.ok(
    phases.every((phase) => phase.coverageKeys.every((key) => key.includes(':continuous:'))),
  );
  const phaseText = h.sent
    .filter((messages) => messages[0]?.content.includes('七政四余出生区间阶段资料'))
    .map((messages) => messages[0]!.content)
    .join('\n');
  const firstContinuous = range.branches[0]!.continuous[0]!;
  const lastContinuous = range.branches[0]!.continuous.at(-1)!;
  assert.ok(phaseText.includes(`${firstContinuous.label}：`));
  assert.ok(phaseText.includes(`${lastContinuous.label}：`));
});

test('七政四余阶段空回答或失败不会标记完整，重试只补未完成阶段', async () => {
  const range = makeSingleLongRange();
  const resource = makeResource(range, 'qizheng-retry', '七政四余重试区间');
  const h = makeHarness([resource]);
  let shouldFail = true;
  let phaseCalls = 0;
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    h.sent.push(messages);
    const content = messages[0]?.content ?? '';
    const latest = messages.at(-1)?.content ?? '';
    if (latest.includes('当前任务：准备解读资料')) {
      callbacks.onChunk('{"actions":[]}');
      callbacks.onDone();
      return;
    }
    if (content.includes('七政四余出生区间阶段资料')) {
      phaseCalls += 1;
      if (shouldFail) {
        shouldFail = false;
        callbacks.onDone();
        return;
      }
      callbacks.onChunk(`阶段回答${phaseCalls}`);
      callbacks.onDone();
      return;
    }
    callbacks.onChunk('七政四余最终汇总');
    callbacks.onDone();
  };

  const messages = [{ role: 'user' as const, content: '七政四余重试区间，问事业。' }];
  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  assert.equal(h.done(), 0);
  assert.ok(h.errors.some((error) => error.includes('返回空结果')));
  assert.equal(h.memory.qizhengPhaseReading?.phases[0]?.status, 'failed');

  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  assert.equal(h.done(), 1);
  assert.equal(
    h.memory.qizhengPhaseReading?.phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
});

test('七政四余阶段取消后保留取消状态，换信号重试完成剩余阶段', async () => {
  const resource = makeResource(makeSingleLongRange(), 'qizheng-cancel', '七政四余取消区间');
  const h = makeHarness([resource]);
  const controller = new AbortController();
  h.options.signal = controller.signal;
  let resolvePhaseStarted!: () => void;
  const phaseStarted = new Promise<void>((resolve) => {
    resolvePhaseStarted = resolve;
  });
  let firstPhase = true;
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    h.sent.push(messages);
    const content = messages[0]?.content ?? '';
    const latest = messages.at(-1)?.content ?? '';
    if (latest.includes('当前任务：准备解读资料')) {
      callbacks.onChunk('{"actions":[]}');
      callbacks.onDone();
      return;
    }
    if (content.includes('七政四余出生区间阶段资料') && firstPhase) {
      firstPhase = false;
      resolvePhaseStarted();
      await new Promise((resolve) => setTimeout(resolve, 50));
      callbacks.onChunk('已取消的阶段回答');
      callbacks.onDone();
      return;
    }
    if (content.includes('七政四余出生区间阶段资料')) {
      callbacks.onChunk('阶段回答');
      callbacks.onDone();
      return;
    }
    callbacks.onChunk('七政四余最终汇总');
    callbacks.onDone();
  };
  const messages = [{ role: 'user' as const, content: '七政四余取消区间，问事业。' }];

  const cancelledRun = runReadingWorkflow(messages, h.options, {
    stream,
    execute: async () => resource,
  });
  await phaseStarted;
  controller.abort();
  await cancelledRun;
  assert.equal(h.done(), 0);
  assert.deepEqual(h.errors, []);
  assert.equal(h.memory.qizhengPhaseReading?.phases[0]?.status, 'cancelled');

  h.options.signal = new AbortController().signal;
  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  assert.equal(h.done(), 1);
  assert.equal(
    h.memory.qizhengPhaseReading?.phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
});

test('七政四余阶段缓存身份包含引导与当前时间上下文', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-16T04:00:00Z') });
  const resource = makeResource(
    makeSingleLongRange(),
    'qizheng-cache-identity',
    '七政四余缓存身份区间',
  );
  const h = makeHarness([resource]);
  const stream = makeStream(h);
  const messages = [
    { role: 'user' as const, content: '七政四余缓存身份区间，问事业。' },
    { role: 'assistant' as const, content: '上一轮已完成本命资料整理。' },
    { role: 'user' as const, content: '现在事业如何？' },
  ];

  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  const firstPhaseCalls = h.sent.filter((items) =>
    items[0]?.content.includes('七政四余出生区间阶段资料'),
  ).length;
  assert.ok(firstPhaseCalls > 0);
  const cached = h.memory.qizhengPhaseReading!;
  cached.guide += '\n缓存身份变化';
  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  const afterGuideCalls = h.sent.filter((items) =>
    items[0]?.content.includes('七政四余出生区间阶段资料'),
  ).length;
  assert.ok(afterGuideCalls > firstPhaseCalls);

  const firstTimeContext = h.memory.qizhengPhaseReading!.currentTimeContext;
  context.mock.timers.setTime(new Date('2026-09-16T04:01:00Z').getTime());
  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  const afterTimeContextCalls = h.sent.filter((items) =>
    items[0]?.content.includes('七政四余出生区间阶段资料'),
  ).length;
  assert.ok(afterTimeContextCalls > afterGuideCalls);
  assert.notEqual(h.memory.qizhengPhaseReading?.currentTimeContext, firstTimeContext);
});

test('七政四余多份超容量资料的阶段覆盖键保持独立', async () => {
  const range = getLongFlowRange();
  const primary = makeResource(range, 'qizheng-primary', '本人七政四余长区间');
  const partner = makeResource(range, 'qizheng-partner', '对方七政四余长区间');
  const h = makeHarness([primary, partner]);
  const stream = makeStream(h);

  await runReadingWorkflow(
    [{ role: 'user', content: '七政四余两份出生区间，问双方事业变化。' }],
    h.options,
    { stream, execute: async () => primary },
  );

  assert.deepEqual(h.errors, []);
  const phases = h.memory.qizhengPhaseReading?.phases ?? [];
  assert.ok(phases.some((phase) => phase.subjectTitle === primary.title));
  assert.ok(phases.some((phase) => phase.subjectTitle === partner.title));
  const coverageKeys = phases.flatMap((phase) => phase.coverageKeys);
  assert.equal(coverageKeys.length, new Set(coverageKeys).size);
  assert.ok(coverageKeys.some((key) => key.startsWith(`${primary.key}:`)));
  assert.ok(coverageKeys.some((key) => key.startsWith(`${partner.key}:`)));
});
