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
