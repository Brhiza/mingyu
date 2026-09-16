import assert from 'node:assert/strict';
import test from 'node:test';

import { getDivinationTime } from 'mingyu-core/calendar';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import {
  formatAstrolabeBirthRangePrompt,
  formatAstrolabeBirthRangeTime,
} from '../src/lib/astrolabe-birth-range-prompt';
import {
  generateAstrolabeBirthRange,
  type AstrolabeBirthRange,
} from '../src/lib/astrolabe-birth-range';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
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
const INPUT: AstrolabeBirthInput = {
  name: '公开合成本命样本',
  gender: '女',
  year: '2024',
  month: '3',
  day: '20',
  hour: '11',
  minute: '6',
  second: '20',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

function timestamp(text: string) {
  return Date.parse(`${text.replace(' ', 'T')}+08:00`);
}

function sourceFor(startText: string, endText: string): BaziReverseSource {
  const startTimestamp = timestamp(startText);
  const endTimestamp = timestamp(endText);
  return {
    pillars: getDivinationTime(new Date(startTimestamp), OFFSET_MINUTES).ganzhi,
    intervalStart: startText,
    intervalEnd: endText,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

function makeRange(seconds: number): AstrolabeBirthRange {
  const startTimestamp = timestamp('2024-03-20 11:06:20');
  return generateAstrolabeBirthRange(
    INPUT,
    sourceFor('2024-03-20 11:06:20', '2024-03-20 11:06:30'),
    { startTimestamp, endTimestamp: startTimestamp + seconds * 1_000 },
  );
}

function inflateContinuous(range: AstrolabeBirthRange, count: number): AstrolabeBirthRange {
  return {
    ...range,
    branches: range.branches.map((branch, branchIndex) => {
      const seeds = branch.continuous.length ? branch.continuous : [];
      const seed = seeds[0];
      if (!seed) return branch;
      return {
        ...branch,
        continuous: Array.from({ length: count }, (_, index) => ({
          ...seed,
          path: `${seed.path}.${branchIndex}.${index}`,
          label: `${seed.label}（分段${branchIndex + 1}-${index + 1}）`,
        })),
      };
    }),
  };
}

function makeLargeRange(): AstrolabeBirthRange {
  const base = makeRange(10);
  return {
    ...base,
    branches: base.branches.map((branch, index) =>
      index === 0 ? inflateContinuous({ ...base, branches: [branch] }, 900).branches[0]! : branch,
    ),
  };
}

function makeSingleLongRange(): AstrolabeBirthRange {
  const base = makeRange(2);
  return {
    ...base,
    branches: [inflateContinuous({ ...base, branches: [base.branches[0]!] }, 1_200).branches[0]!],
  };
}

function makeResource(
  range: AstrolabeBirthRange,
  key: string,
  title: string,
  wrapped = false,
): ReadingResource {
  const prompt = formatAstrolabeBirthRangePrompt(range, {
    question: '资源生成问题',
    topicId: 'career',
  });
  return {
    key,
    title,
    text: wrapped
      ? [
          '【当前时间】2026年9月16日 星期三 20:00',
          '【解读选择】本命事业',
          prompt,
          '【问题】\n资源生成问题',
          '【任务】依据完整西洋占星本命资料回答问题。',
        ].join('\n\n')
      : prompt,
    usable: true,
    structured: range as unknown as Record<string, unknown>,
  };
}

function makeSubject(): ReadingSubjectSnapshot {
  return {
    id: 'astrolabe-reading-phase-test',
    source: 'astrolabe',
    lockedInputs: { astrolabe: INPUT as unknown as Record<string, unknown> },
    allowedMethods: ['astrolabe'],
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
    else if (content.includes('西洋占星本命出生区间阶段覆盖核对'))
      callbacks.onChunk('西洋占星全部阶段汇总');
    else callbacks.onChunk('西洋占星阶段判断');
    callbacks.onDone();
  };
}

test('西洋占星本命小区间容量足够时沿用单次最终解读', async () => {
  const resource = makeResource(makeRange(2), 'astrolabe-small', '西洋占星小区间');
  const h = makeHarness([resource]);

  await runReadingWorkflow(
    [{ role: 'user', content: '西洋占星本命出生区间，问事业。' }],
    h.options,
    { stream: makeStream(h), execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  assert.equal(h.memory.astrolabePhaseReading, undefined);
  assert.equal(
    h.sent.filter((messages) => messages[0]?.content.includes('西洋占星本命出生区间阶段资料'))
      .length,
    0,
  );
});

test('西洋占星超容量时完整消费多分支盘面与连续事实并汇总', async () => {
  const resource = makeResource(makeLargeRange(), 'astrolabe-long', '西洋占星本命长区间');
  const h = makeHarness([resource]);

  await runReadingWorkflow(
    [{ role: 'user', content: '西洋占星本命出生区间，问全部分段的事业判断。' }],
    h.options,
    { stream: makeStream(h), execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  const phases = h.memory.astrolabePhaseReading?.phases ?? [];
  const range = resource.structured as unknown as AstrolabeBirthRange;
  assert.ok(phases.length > range.branches.length);
  assert.equal(
    phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
  const phaseMessages = h.sent.filter((messages) =>
    messages[0]?.content.includes('西洋占星本命出生区间阶段资料'),
  );
  assert.ok(phaseMessages.length >= phases.length);
  assert.ok(
    phaseMessages.every(
      (messages) => messages.reduce((sum, message) => sum + message.content.length, 0) <= 49_000,
    ),
  );
  const phaseText = phaseMessages.map((messages) => messages[0]!.content).join('\n');
  const coverageKeys = phases.flatMap((phase) => phase.coverageKeys);
  assert.equal(
    coverageKeys.length,
    range.branches[0]!.continuous.length + range.branches.length - 1,
  );
  assert.equal(coverageKeys.length, new Set(coverageKeys).size);
  for (const [index, branch] of range.branches.entries()) {
    assert.match(phaseText, new RegExp(`出生分段${index + 1}/`, 'u'));
    assert.match(phaseText, new RegExp(formatAstrolabeBirthRangeTime(branch.startTimestamp), 'u'));
    const first = branch.continuous[0]!;
    const last = branch.continuous.at(-1)!;
    assert.ok(phaseText.includes(`${first.label}：`));
    assert.ok(phaseText.includes(`${last.label}：`));
  }
  assert.doesNotMatch(phaseText, /七政四余/u);
  assert.match(h.sent.at(-1)?.[0]?.content ?? '', /西洋占星本命出生区间阶段覆盖核对/u);
});

test('西洋占星原始任务书包装和分段依据在阶段资料中保留', async () => {
  const resource = makeResource(
    makeLargeRange(),
    'astrolabe-wrapped-long',
    '西洋占星带任务书包装长区间',
    true,
  );
  const h = makeHarness([resource]);

  await runReadingWorkflow(
    [{ role: 'user', content: '西洋占星带任务书包装的本命区间，问事业。' }],
    h.options,
    { stream: makeStream(h), execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  const phaseText = h.sent
    .filter((messages) => messages[0]?.content.includes('西洋占星本命出生区间阶段资料'))
    .map((messages) => messages[0]!.content)
    .join('\n');
  assert.match(phaseText, /【解读选择】/u);
  assert.match(phaseText, /【问题】\n资源生成问题/u);
  assert.match(phaseText, /【任务】/u);
  assert.match(phaseText, /【输出要求】/u);
  assert.match(phaseText, /【西洋占星本命出生时间区间】/u);
});

test('西洋占星单一出生分段过长时按完整连续事实行拆分', async () => {
  const range = makeSingleLongRange();
  const resource = makeResource(range, 'astrolabe-single-long', '西洋占星单段长区间');
  const h = makeHarness([resource]);

  await runReadingWorkflow(
    [{ role: 'user', content: '西洋占星出生分段连续事实，问事业。' }],
    h.options,
    { stream: makeStream(h), execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  const phases = h.memory.astrolabePhaseReading?.phases ?? [];
  assert.ok(phases.length > 1);
  assert.ok(
    phases.every((phase) => phase.coverageKeys.every((key) => key.includes(':continuous:'))),
  );
  const phaseText = h.sent
    .filter((messages) => messages[0]?.content.includes('西洋占星本命出生区间阶段资料'))
    .map((messages) => messages[0]!.content)
    .join('\n');
  assert.ok(phaseText.includes(`${range.branches[0]!.continuous[0]!.label}：`));
  assert.ok(phaseText.includes(`${range.branches[0]!.continuous.at(-1)!.label}：`));
});

test('西洋占星阶段取消后可恢复，且问题变化不会复用旧阶段回答', async () => {
  const resource = makeResource(
    makeSingleLongRange(),
    'astrolabe-cancel-retry',
    '西洋占星取消区间',
  );
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
    if (content.includes('西洋占星本命出生区间阶段资料') && firstPhase) {
      firstPhase = false;
      resolvePhaseStarted();
      await new Promise((resolve) => setTimeout(resolve, 50));
      callbacks.onChunk('已取消的阶段回答');
      callbacks.onDone();
      return;
    }
    if (content.includes('西洋占星本命出生区间阶段资料')) {
      callbacks.onChunk('西洋占星阶段回答');
      callbacks.onDone();
      return;
    }
    callbacks.onChunk('西洋占星最终汇总');
    callbacks.onDone();
  };
  const messages = [{ role: 'user' as const, content: '西洋占星取消区间，问事业。' }];

  const cancelledRun = runReadingWorkflow(messages, h.options, {
    stream,
    execute: async () => resource,
  });
  await phaseStarted;
  controller.abort();
  await cancelledRun;
  assert.equal(h.done(), 0);
  assert.deepEqual(h.errors, []);
  assert.equal(h.memory.astrolabePhaseReading?.phases[0]?.status, 'cancelled');

  h.options.signal = new AbortController().signal;
  await runReadingWorkflow(messages, h.options, { stream, execute: async () => resource });
  assert.equal(h.done(), 1);
  assert.equal(
    h.memory.astrolabePhaseReading?.phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
  const firstPhaseCalls = h.sent.filter((items) =>
    items[0]?.content.includes('西洋占星本命出生区间阶段资料'),
  ).length;
  await runReadingWorkflow(
    [{ role: 'user', content: '西洋占星取消区间，改问伴侣关系。' }],
    h.options,
    { stream, execute: async () => resource },
  );
  const afterQuestionCalls = h.sent.filter((items) =>
    items[0]?.content.includes('西洋占星本命出生区间阶段资料'),
  ).length;
  assert.ok(afterQuestionCalls > firstPhaseCalls);
  assert.match(h.memory.astrolabePhaseReading?.question ?? '', /伴侣关系/u);
});

test('西洋占星多份出生区间资料的阶段覆盖键保持独立', async () => {
  const range = makeLargeRange();
  const primary = makeResource(range, 'astrolabe-primary', '本人西洋占星长区间');
  const partner = makeResource(range, 'astrolabe-partner', '对方西洋占星长区间');
  const h = makeHarness([primary, partner]);

  await runReadingWorkflow(
    [{ role: 'user', content: '西洋占星两份本命出生区间，问双方事业变化。' }],
    h.options,
    { stream: makeStream(h), execute: async () => primary },
  );

  assert.deepEqual(h.errors, []);
  const phases = h.memory.astrolabePhaseReading?.phases ?? [];
  const coverageKeys = phases.flatMap((phase) => phase.coverageKeys);
  assert.equal(coverageKeys.length, new Set(coverageKeys).size);
  assert.ok(coverageKeys.some((key) => key.startsWith(`${primary.key}:`)));
  assert.ok(coverageKeys.some((key) => key.startsWith(`${partner.key}:`)));
  assert.ok(phases.some((phase) => phase.subjectTitle === primary.title));
  assert.ok(phases.some((phase) => phase.subjectTitle === partner.title));
});
