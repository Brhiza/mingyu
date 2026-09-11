import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimenLifetimePrompt } from 'mingyu-core/divination/qimen';
import type { QimenLifetimeData } from 'mingyu-core/types';
import {
  runReadingWorkflow,
  type ReadingDependencies,
  type ReadingMemory,
  type ReadingOptions,
  type ReadingResource,
} from '../src/lib/ai/reading-workflow';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { ChatMessage } from '../src/lib/ai/stream-client';

function buildQimenResource() {
  const { data, prompt } = generateQimenLifetimePrompt(
    {
      birthDateTime: '1990-05-15T10:30:00',
      timeZoneId: 'Asia/Shanghai',
      calendarType: 'solar',
      isLeapMonth: false,
      timeStandard: 'civil',
      applyChinaDst: false,
      method: 'zhuanpan',
      juMethod: 'chaibu',
      stagePolicy: {
        model: 'pillarFourLimits',
        anchorRule: 'birthInstant',
        ageSystem: 'fullYears',
        yearsPerStage: 15,
      },
      periodRange: { startDate: '2026-01-01', endDate: '2056-12-31' },
      topics: ['career', 'wealth'],
      name: '甲',
      gender: 'male',
    },
    '结合全部人生阶段与目标时间范围分析事业变化。',
  );
  return {
    key: 'qimen-lifetime-full-31-years',
    title: '甲奇门终身局完整资料',
    text: prompt,
    usable: true,
    structured: data,
  } satisfies ReadingResource;
}

function buildSubject(data: QimenLifetimeData): ReadingSubjectSnapshot {
  return {
    id: 'qimen-lifetime-phase-test',
    source: 'qimen-lifetime',
    lockedInputs: { 'qimen-lifetime': data.input },
    allowedMethods: ['qimen-lifetime'],
    range: { qimenLifetimeScope: 'full' },
  };
}

function makeHarness(resource: ReadingResource, subject: ReadingSubjectSnapshot) {
  const sent: ChatMessage[][] = [];
  const errors: string[] = [];
  const notices: string[] = [];
  let done = 0;
  const memory: ReadingMemory = { resources: [resource] };
  const options: ReadingOptions = {
    memory,
    subject,
    onProgress: () => {},
    onNotice: (text) => notices.push(text),
    onError: (text) => errors.push(text),
    onChunk: () => {},
    onDone: () => {
      done += 1;
    },
  };
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    sent.push(messages);
    callbacks.onChunk(`阶段回答${sent.length}`);
    callbacks.onDone();
  };
  return { sent, errors, notices, memory, options, stream, done: () => done };
}

function formatTriggerDateNeedle(item: { date: string; dateTime?: string }) {
  if (item.dateTime) return item.dateTime;
  return `${item.date.slice(0, 4)}年${item.date.slice(5, 7)}月${item.date.slice(8, 10)}日`;
}

test('三十一年奇门终身局超容量时分阶段送入AI并覆盖每条日期', async () => {
  const resource = buildQimenResource();
  const data = resource.structured as unknown as QimenLifetimeData;
  const subject = buildSubject(data);
  const h = makeHarness(resource, subject);
  assert.ok(resource.text.length > 49_000);

  await runReadingWorkflow(
    [{ role: 'user', content: '奇门终身局完整资料，问全部人生阶段事业变化。' }],
    h.options,
    { stream: h.stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  const phaseMessages = h.sent.slice(0, -1);
  assert.ok(phaseMessages.length > 1);
  for (const messages of phaseMessages) {
    assert.ok(messages.reduce((sum, item) => sum + item.content.length, 0) <= 49_000);
    assert.match(messages[0]!.content, /终身局基础盘/u);
    assert.match(messages[0]!.content, /目标时间范围：2026-01-01至2056-12-31/u);
  }

  const phaseText = phaseMessages.map((messages) => messages[0]!.content).join('\n');
  for (const cluster of data.eventClusters ?? []) {
    for (const date of cluster.triggerDates ?? []) {
      assert.ok(
        phaseText.includes(formatTriggerDateNeedle(date)),
        `阶段资料缺少日期 ${date.dateTime ?? date.date}`,
      );
    }
  }
  const expectedDateKeys = (data.eventClusters ?? []).flatMap((cluster, clusterIndex) =>
    (cluster.triggerDates ?? []).map((_, dateIndex) => `${clusterIndex}:${dateIndex}`),
  );
  const coveredDateKeys = [...(h.memory.qimenPhaseReading?.phases ?? [])]
    .flatMap((phase) => phase.dateKeys)
    .sort();
  assert.deepEqual(coveredDateKeys, expectedDateKeys.sort());
  const finalPrompt = h.sent.at(-1)![0]!.content;
  assert.match(finalPrompt, /奇门终身局阶段覆盖核对/u);
  assert.match(finalPrompt, /2026-01-01至2056-12-31/u);
  assert.equal(
    h.memory.qimenPhaseReading?.phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
  assert.deepEqual(h.notices, []);
});

test('已有奇门完整资料遇到非简单追问仍进入目标时段资料准备', async () => {
  const resource = buildQimenResource();
  const data = resource.structured as unknown as QimenLifetimeData;
  const subject = buildSubject(data);
  const h = makeHarness(resource, subject);
  const planningCalls: ChatMessage[][] = [];
  let streamCount = 0;
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    streamCount += 1;
    const latest = messages.at(-1)?.content ?? '';
    if (latest.includes('当前任务：准备解读资料')) {
      planningCalls.push(messages);
      callbacks.onChunk('{"actions":[]}');
    } else {
      callbacks.onChunk(`阶段回答${streamCount}`);
    }
    callbacks.onDone();
  };

  await runReadingWorkflow(
    [
      { role: 'user', content: '奇门终身局完整资料，问事业变化。' },
      { role: 'assistant', content: '上一轮阶段判断。' },
      { role: 'user', content: '请进一步分析2035年的事业变化。' },
    ],
    h.options,
    { stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  assert.equal(planningCalls.length, 1);
  assert.match(planningCalls[0]!.at(-1)!.content, /当前任务：准备解读资料/u);
});

test('同一事件簇拆分到多个阶段时仍完整保留事件日期', async () => {
  const baseResource = buildQimenResource();
  const data = JSON.parse(JSON.stringify(baseResource.structured)) as QimenLifetimeData;
  const clusters = data.eventClusters ?? [];
  const clusterIndex = clusters.findIndex((cluster) => (cluster.triggerDates?.length ?? 0) > 0);
  assert.ok(clusterIndex >= 0);
  const cluster = clusters[clusterIndex]!;
  const sourceDates = cluster.triggerDates!;
  clusters[clusterIndex] = {
    ...cluster,
    triggerDates: Array.from({ length: 4_000 }, (_, index) => ({
      ...sourceDates[index % sourceDates.length]!,
    })),
  };
  const resource: ReadingResource = {
    ...baseResource,
    key: 'qimen-lifetime-full-31-years-split-cluster',
    structured: data,
  };
  const subject = buildSubject(data);
  const h = makeHarness(resource, subject);

  await runReadingWorkflow(
    [{ role: 'user', content: '奇门终身局完整资料，问全部人生阶段事业变化。' }],
    h.options,
    { stream: h.stream, execute: async () => resource },
  );

  assert.deepEqual(h.errors, []);
  assert.equal(h.done(), 1);
  assert.ok(h.sent.length > 2);
  assert.ok(
    h.memory.qimenPhaseReading?.phases.filter((phase) =>
      phase.clusterKeys.includes(`${clusterIndex}:${cluster.key}`),
    ).length > 1,
  );
  const expectedDateKeys = clusters.flatMap((item, itemIndex) =>
    (item.triggerDates ?? []).map((_, dateIndex) => `${itemIndex}:${dateIndex}`),
  );
  const coveredDateKeys = (h.memory.qimenPhaseReading?.phases ?? [])
    .flatMap((phase) => phase.dateKeys)
    .sort();
  assert.deepEqual(coveredDateKeys, expectedDateKeys.sort());
  for (const messages of h.sent) {
    assert.ok(messages.reduce((sum, item) => sum + item.content.length, 0) <= 49_000);
  }
});

test('奇门阶段失败后重试只补跑未完成阶段并完成汇总', async () => {
  const resource = buildQimenResource();
  const data = resource.structured as unknown as QimenLifetimeData;
  const subject = buildSubject(data);
  const h = makeHarness(resource, subject);
  const requestSizes: number[] = [];
  let phaseRequestCount = 0;
  let finalRequestCount = 0;
  let shouldFailSecondPhase = true;
  const stream: ReadingDependencies['stream'] = async (messages, callbacks) => {
    requestSizes.push(messages.reduce((sum, item) => sum + item.content.length, 0));
    const firstContent = messages[0]?.content ?? '';
    if (firstContent.includes('奇门终身局阶段覆盖核对')) {
      finalRequestCount += 1;
      callbacks.onChunk('全部阶段的最终汇总');
      callbacks.onDone();
      return;
    }
    assert.match(firstContent, /奇门终身局资料阶段/u);
    phaseRequestCount += 1;
    if (phaseRequestCount === 2 && shouldFailSecondPhase) {
      shouldFailSecondPhase = false;
      callbacks.onError('模拟阶段失败');
      return;
    }
    callbacks.onChunk(`阶段回答${phaseRequestCount}`);
    callbacks.onDone();
  };
  const messages: ChatMessage[] = [
    { role: 'user', content: '奇门终身局完整资料，问全部人生阶段事业变化。' },
  ];

  await runReadingWorkflow(messages, h.options, {
    stream,
    execute: async () => resource,
  });

  const phaseCount = h.memory.qimenPhaseReading?.phases.length ?? 0;
  assert.ok(phaseCount > 1);
  assert.equal(h.done(), 0);
  assert.equal(h.errors.length, 1);
  assert.equal(h.memory.qimenPhaseReading?.phases[0]?.status, 'succeeded');
  assert.equal(h.memory.qimenPhaseReading?.phases[1]?.status, 'failed');

  await runReadingWorkflow(messages, h.options, {
    stream,
    execute: async () => resource,
  });

  assert.equal(h.done(), 1);
  assert.equal(finalRequestCount, 1);
  assert.equal(phaseRequestCount, phaseCount + 1);
  assert.equal(
    h.memory.qimenPhaseReading?.phases.every((phase) => phase.status === 'succeeded'),
    true,
  );
  assert.ok(requestSizes.length > 0);
  assert.ok(requestSizes.every((size) => size <= 49_000));
});
