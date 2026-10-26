import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAstrolabeDynamicRange } from 'mingyu-core/divination/astrolabe-dynamic-range';
import {
  isAstrolabeDynamicReadingCheckpoint,
  type AstrolabeDynamicReadingStream,
} from '../src/lib/ai/astrolabe-dynamic-reading';
import {
  isAstrolabeDynamicCollectionCheckpoint,
  runAstrolabeDynamicCollectionRound,
  type AstrolabeDynamicCollectionCheckpoint,
  type AstrolabeDynamicCollectionSource,
  type AstrolabeDynamicCollectionSupplemental,
} from '../src/lib/ai/astrolabe-dynamic-collection';
import type { StreamOptions } from '../src/lib/ai/stream-client';

const start = Date.parse('2024-03-20T11:00:00+08:00');
const generated = generateAstrolabeDynamicRange(
  {
    name: '多主体逐页验证',
    gender: '男',
    year: '2024',
    month: '3',
    day: '20',
    hour: '11',
    minute: '0',
    second: '0',
    longitude: '116.416334',
    latitude: '39.9042',
    timezone: '8',
  },
  { startTimestamp: start, endTimestamp: start + 1000 },
  { scope: 'daily', referenceDate: '2028-03-20' },
);
const { branches, ...summary } = generated;

function makeSource(
  target: 'primary' | 'partner',
  subjectId: string,
  key = 'shared-range',
): AstrolabeDynamicCollectionSource {
  return {
    target,
    key,
    subjectId,
    summary,
    promptOptions: { question: '请分析学习安排。' },
    async readBranch(index) {
      const branch = branches[index];
      if (!branch) throw new Error(`缺少第${index}个动态分段。`);
      return branch;
    },
  };
}

const sources = [
  makeSource('primary', 'subject-primary'),
  makeSource('partner', 'subject-partner'),
];
const options = {
  question: '请结合全部资料判断学习安排。',
  onChunk() {},
  onProgress() {},
};

const successfulStream: AstrolabeDynamicReadingStream = async (
  _messages: Parameters<AstrolabeDynamicReadingStream>[0],
  streamOptions: StreamOptions,
) => {
  streamOptions.onChunk('当前资料支持的具体判断与适用条件。');
  streamOptions.onDone();
};

test('多主体分轮等待后仍按本轮主体资料与回调推进', async () => {
  const mutableSource = {
    ...makeSource('primary', 'fixed-subject'),
    summary: structuredClone(summary),
  };
  const mutableSources = [mutableSource];
  let originalChunks = 0;
  let replacedChunks = 0;
  const progress: string[] = [];
  let replacedProgress = 0;
  const mutableOptions = {
    question: '本轮集合问题',
    onChunk() {
      originalChunks += 1;
    },
    onProgress(text: string) {
      progress.push(text);
    },
  };
  mutableSource.readBranch = async (index) => {
    mutableSource.target = 'partner';
    mutableSource.summary.branchCount = 999;
    mutableSources.push(makeSource('partner', 'later-subject'));
    mutableOptions.onChunk = () => {
      replacedChunks += 1;
    };
    mutableOptions.onProgress = () => {
      replacedProgress += 1;
    };
    return branches[index];
  };
  const prompts: string[] = [];
  const checkpoint = await runAstrolabeDynamicCollectionRound(
    mutableSources,
    [],
    undefined,
    mutableOptions,
    async (messages, streamOptions) => {
      prompts.push(messages[0].content);
      await successfulStream(messages, streamOptions);
    },
  );
  assert.equal(checkpoint.sources.length, 1);
  assert.equal(checkpoint.sources[0].target, 'primary');
  assert.equal(checkpoint.completedPages, 1);
  assert.match(prompts[0], /【主体】本人/u);
  assert.doesNotMatch(prompts[0], /【主体】对方/u);
  assert.match(progress[0], new RegExp(`本人主体1/1，出生分段1/${summary.branchCount}`, 'u'));
  assert.equal(originalChunks, 1);
  assert.equal(replacedChunks, 0);
  assert.equal(progress.length, 2);
  assert.equal(replacedProgress, 0);
  assert.equal(mutableSources.length, 2);
  assert.equal(mutableSource.target, 'partner');
  assert.equal(mutableSource.summary.branchCount, 999);
});

test('v2按补充资料页、主体页、最终归纳顺序推进且不把全文写入检查点', async () => {
  const supplemental: AstrolabeDynamicCollectionSupplemental[] = [
    {
      key: 'initial-prompt',
      title: '原始盘面与问题',
      text: `INITIAL-MARKER${'普通上下文'.repeat(1800)}SUPPLEMENTAL-PAGE-2`,
    },
    {
      key: 'ordinary-resource',
      title: '普通补充资料',
      text: 'ORDINARY-RESOURCE-MARKER：需要在动态资料之前完整处理。',
    },
  ];
  const prompts: string[] = [];
  const stream: AstrolabeDynamicReadingStream = async (messages, streamOptions) => {
    assert.equal(messages.length, 1);
    assert.ok(messages[0]!.content.length < 40000);
    prompts.push(messages[0]!.content);
    await successfulStream(messages, streamOptions);
  };

  let checkpoint: AstrolabeDynamicCollectionCheckpoint | undefined;
  const stages: AstrolabeDynamicCollectionCheckpoint['stage'][] = [];
  let rounds = 0;
  do {
    checkpoint = await runAstrolabeDynamicCollectionRound(
      sources,
      supplemental,
      checkpoint,
      options,
      stream,
    );
    stages.push(checkpoint.stage);
    const serialized = JSON.stringify(checkpoint);
    assert.equal(isAstrolabeDynamicCollectionCheckpoint(JSON.parse(serialized)), true);
    assert.doesNotMatch(serialized, /INITIAL-MARKER|SUPPLEMENTAL-PAGE-2|ORDINARY-RESOURCE-MARKER/u);
    assert.doesNotMatch(serialized, /readBranch/u);
    assert.ok(++rounds < 200);
  } while (checkpoint.stage !== 'complete');

  assert.equal(checkpoint.completedSources, sources.length);
  assert.equal(checkpoint.completedBranches, sources.length * summary.branchCount);
  assert.equal(checkpoint.supplementalPageIndex, 3);
  assert.ok(stages.includes('supplemental'));
  assert.ok(stages.includes('pages'));
  assert.ok(stages.includes('summary'));
  assert.equal(stages.at(-1), 'complete');
  assert.ok(prompts.some((prompt) => prompt.includes('INITIAL-MARKER')));
  assert.ok(prompts.some((prompt) => prompt.includes('SUPPLEMENTAL-PAGE-2')));
  assert.ok(prompts.some((prompt) => prompt.includes('ORDINARY-RESOURCE-MARKER')));
  assert.ok(prompts.some((prompt) => prompt.includes('【主体】本人')));
  assert.ok(prompts.some((prompt) => prompt.includes('【主体】对方')));
  prompts.forEach((prompt) => {
    assert.doesNotMatch(prompt, /shared-range|subject-primary|subject-partner/u);
  });
  assert.ok(prompts.at(-1)?.includes('【西洋占星动态出生区间最终归纳】'));
  assert.equal(isAstrolabeDynamicReadingCheckpoint(JSON.parse(JSON.stringify(checkpoint))), false);
});

test('v2模型失败或取消时保留原检查点，重试仍从同一游标开始', async () => {
  const previous = await runAstrolabeDynamicCollectionRound(
    sources,
    [],
    undefined,
    options,
    successfulStream,
  );
  const before = structuredClone(previous);
  let failedPrompt = '';
  await assert.rejects(
    runAstrolabeDynamicCollectionRound(
      sources,
      [],
      previous,
      options,
      async (messages, streamOptions) => {
        failedPrompt = messages[0]!.content;
        streamOptions.onError('多主体模型故障');
      },
    ),
    /多主体模型故障/u,
  );
  assert.deepEqual(previous, before);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runAstrolabeDynamicCollectionRound(
      sources,
      [],
      previous,
      { ...options, signal: controller.signal },
      successfulStream,
    ),
    { name: 'AbortError' },
  );
  assert.deepEqual(previous, before);

  const retriedPrompts: string[] = [];
  const retried = await runAstrolabeDynamicCollectionRound(
    sources,
    [],
    previous,
    options,
    async (messages, streamOptions) => {
      retriedPrompts.push(messages[0]!.content);
      await successfulStream(messages, streamOptions);
    },
  );
  assert.equal(retriedPrompts[0], failedPrompt);
  assert.equal(
    retried.completedPages,
    previous.stage === 'pages' ? previous.completedPages + 1 : previous.completedPages,
  );
});

test('旧v2补充页与动态页追问进入解读和归纳，continue及最终追问保留原计划', async () => {
  const supplemental = [{ key: 'notes', title: '补充资料', text: 'SAVED_NOTES_'.repeat(900) }];
  const original = 'ORIGINAL_V2_PLAN_学习安排';
  let checkpoint = await runAstrolabeDynamicCollectionRound(
    [sources[0]!],
    supplemental,
    undefined,
    { ...options, question: original },
    successfulStream,
  );
  assert.equal(checkpoint.stage, 'supplemental');
  checkpoint = JSON.parse(JSON.stringify(checkpoint));
  const prompts: string[] = [];
  const stream: AstrolabeDynamicReadingStream = async (messages, callbacks) => {
    prompts.push(messages[0]!.content);
    await successfulStream(messages, callbacks);
  };
  for (const question of [
    'SUPPLEMENTAL_FOLLOWUP_事业条件',
    'PAGE_FOLLOWUP_事业依据',
    '继续下一批',
  ]) {
    const before = structuredClone(checkpoint);
    prompts.length = 0;
    checkpoint = await runAstrolabeDynamicCollectionRound(
      [sources[0]!],
      supplemental,
      checkpoint,
      { ...options, question },
      stream,
    );
    assert.equal(prompts.length, 2);
    for (const prompt of prompts) {
      assert.ok(prompt.includes(`【原问题】\n${original}`));
      assert.ok(prompt.includes(`【本轮问题】\n${question}`));
      assert.ok(prompt.includes(before.synopsis));
    }
    assert.equal(checkpoint.identity, before.identity);
    assert.equal(checkpoint.question, original);
    assert.equal(checkpoint.completedPages, before.completedPages + 1);
    if (before.stage === 'supplemental') {
      assert.match(prompts[0]!, /动态出生区间补充资料页/u);
      assert.equal(checkpoint.stage, 'pages');
    } else {
      assert.equal(before.stage, 'pages');
      assert.match(prompts[0]!, /【主体】本人/u);
      assert.notDeepEqual(checkpoint.cursor, before.cursor);
    }
  }
  while (checkpoint.stage === 'pages') {
    checkpoint = await runAstrolabeDynamicCollectionRound(
      [sources[0]!],
      supplemental,
      checkpoint,
      options,
      successfulStream,
    );
  }
  for (const question of ['SUMMARY_FOLLOWUP_关系条件', 'COMPLETE_FOLLOWUP_财运条件']) {
    const before = structuredClone(checkpoint);
    prompts.length = 0;
    checkpoint = await runAstrolabeDynamicCollectionRound(
      [sources[0]!],
      supplemental,
      checkpoint,
      { ...options, question },
      stream,
    );
    assert.equal(prompts.length, 1);
    assert.ok(prompts[0]!.includes(`【原问题】\n${original}`));
    assert.ok(prompts[0]!.includes(`【本轮问题】\n${question}`));
    assert.equal(checkpoint.synopsis, before.synopsis);
    assert.equal(checkpoint.completedPages, before.completedPages);
    assert.equal(checkpoint.question, original);
    assert.equal(checkpoint.stage, 'complete');
  }
});

test('v2补充页或动态页归纳失败与取消都不推进checkpoint', async () => {
  const supplemental = [{ key: 'notes', title: '补充资料', text: 'NOTES_'.repeat(1600) }];
  let checkpoint = await runAstrolabeDynamicCollectionRound(
    [sources[0]!],
    supplemental,
    undefined,
    options,
    successfulStream,
  );
  for (const stage of ['supplemental', 'pages'] as const) {
    assert.equal(checkpoint.stage, stage);
    const before = structuredClone(checkpoint);
    let failedPage = '';
    for (const cancel of [false, true]) {
      let calls = 0;
      const controller = new AbortController();
      await assert.rejects(
        runAstrolabeDynamicCollectionRound(
          [sources[0]!],
          supplemental,
          checkpoint,
          { ...options, question: 'FOLLOWUP_FAILURE_关注本页', signal: controller.signal },
          async (messages, callbacks) => {
            calls += 1;
            if (calls === 1) {
              failedPage = messages[0]!.content;
              await successfulStream(messages, callbacks);
            } else if (cancel) {
              controller.abort();
              callbacks.onDone();
            } else callbacks.onError('归纳失败');
          },
        ),
        cancel ? { name: 'AbortError' } : /归纳失败/u,
      );
      assert.deepEqual(checkpoint, before);
    }
    const retryPrompts: string[] = [];
    checkpoint = await runAstrolabeDynamicCollectionRound(
      [sources[0]!],
      supplemental,
      checkpoint,
      { ...options, question: 'FOLLOWUP_FAILURE_关注本页' },
      async (messages, callbacks) => {
        retryPrompts.push(messages[0]!.content);
        await successfulStream(messages, callbacks);
      },
    );
    assert.equal(retryPrompts[0], failedPage);
    assert.equal(checkpoint.completedPages, before.completedPages + 1);
    assert.equal(checkpoint.question, before.question);
  }
});

test('v2恢复时绑定主体身份、summary和promptOptions，跨主体可复用相同来源 key', async () => {
  const checkpoint = await runAstrolabeDynamicCollectionRound(
    sources,
    [],
    undefined,
    options,
    successfulStream,
  );
  let called = false;
  await assert.rejects(
    runAstrolabeDynamicCollectionRound(
      [sources[0]!, { ...sources[1]!, subjectId: 'changed-partner' }],
      [],
      checkpoint,
      options,
      async () => {
        called = true;
      },
    ),
    /不匹配/u,
  );
  assert.equal(called, false);
});
