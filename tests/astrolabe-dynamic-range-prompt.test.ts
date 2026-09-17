import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAstrolabeDynamicRange } from 'mingyu-core/divination/astrolabe-dynamic-range';
import {
  iterateAstrolabeDynamicPromptPages,
  isAstrolabeDynamicReadingFact,
} from '../src/lib/astrolabe-dynamic-range-prompt';
import { formatAstrolabeRangeContinuousFact } from '../src/lib/astrolabe-birth-range-prompt';

const start = Date.parse('2024-03-20T11:00:00+08:00');
const range = generateAstrolabeDynamicRange(
  {
    name: '公开合成分页样本',
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
  { startTimestamp: start, endTimestamp: start + 2000 },
  { scope: 'full', referenceDate: '2028-03-20' },
);

test('动态解读逐页限量且保留每段全部连续事实与首末秒候选相位', async () => {
  const read: number[] = [];
  const pages = [];
  for await (const page of iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => {
      read.push(index);
      return range.branches[index];
    },
    { maxCharacters: 3000 },
  )) {
    assert.ok(page.text.length <= 3000);
    assert.match(page.text, /本轮出生时段：/u);
    assert.doesNotMatch(
      page.text,
      /branchIndex|candidateAspectFacts|API|MCP|mingyu|\bSun\b|\bMoon\b/u,
    );
    pages.push(page);
  }
  assert.deepEqual(
    read,
    range.branches.map((_, index) => index),
  );
  assert.ok(pages.length > 1);
  for (const [index, branch] of range.branches.entries()) {
    const branchPages = pages.filter((page) => page.branchIndex === index);
    assert.equal(branchPages.filter((page) => page.lastPageOfBranch).length, 1);
    assert.equal(branchPages.at(-1)?.lastPageOfBranch, true);
    let nextFact = 0;
    for (const page of branchPages) {
      assert.equal(page.firstFactIndex, nextFact);
      nextFact += page.factCount;
    }
    const text = branchPages.map((page) => page.text).join('\n');
    assert.equal(
      text.match(/整段连续事实：/gu)?.length,
      branch.continuous.filter((fact) => isAstrolabeDynamicReadingFact(fact.path)).length,
    );
    assert.doesNotMatch(text, /粗搜|细化迭代|UTC毫秒|返照太阳残差/u);
    const expected = [branch.representative, branch.last]
      .flatMap((sample) => sample.scopes)
      .reduce(
        (count, scope) =>
          count +
          [
            scope.solarReturnEvidence,
            scope.secondaryProgressionEvidence,
            scope.solarArcEvidence,
          ].reduce(
            (subtotal, evidence) => subtotal + (evidence?.candidateAspectFacts.length ?? 0),
            0,
          ),
        0,
      );
    assert.equal(text.match(/候选相位第/gu)?.length ?? 0, expected);
  }
});

test('连续推运时刻显示北京时间并保留毫秒，不向解读输出机器时间戳', () => {
  const value = start + 123;
  const text = formatAstrolabeRangeContinuousFact(
    {
      path: 'dynamic.yearly.solarReturn.returnTime',
      label: '太阳返照时刻',
      unit: 'UTC毫秒',
      first: value,
      last: value,
      min: value,
      max: value,
      sampleCount: 1,
    },
    range.branches[0].representative.natal,
  );
  assert.match(text, /北京时间2024-03-20 11:00:00\.123/u);
  assert.doesNotMatch(text, /UTC毫秒|171090/u);
});

test('各页任务书重复问题、主题和时间地点口径', async () => {
  const iterator = iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => range.branches[index],
    { maxCharacters: 3000, question: '请分析事业节奏。', topicId: 'career' },
  );
  for (let index = 0; index < 2; index += 1) {
    const page = await iterator.next();
    assert.equal(page.done, false);
    assert.match(page.value!.text, /【问题】\n请分析事业节奏。/u);
    assert.match(page.value!.text, /【解读选择】/u);
    assert.match(page.value!.text, /时间与地点：北京时间东八区/u);
    assert.doesNotMatch(page.value!.text, /undefined|null/u);
  }
  await iterator.return(undefined);
});

test('序列化续读位置恢复下一页内容，越界页明确失败', async () => {
  const original = iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => range.branches[index],
    { maxCharacters: 3000 },
  );
  const first = await original.next();
  assert.ok(!first.done && first.value.nextCursor);
  const second = await original.next();
  const resumed = iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => range.branches[index],
    { maxCharacters: 3000, startAt: JSON.parse(JSON.stringify(first.value.nextCursor)) },
  );
  assert.deepEqual(await resumed.next(), second);
  await original.return(undefined);
  await resumed.return(undefined);
  const invalid = iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => range.branches[index],
    { startAt: { branchIndex: 0, pageIndex: 999999, branchStartTimestamp: start } },
  );
  await assert.rejects(invalid.next(), /续读页超出/u);
});

test('动态解读取消或停止消费后不继续加载分段', async () => {
  const controller = new AbortController();
  let reads = 0;
  const iterator = iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => {
      reads += 1;
      return range.branches[index];
    },
    { maxCharacters: 3000, signal: controller.signal },
  );
  assert.equal(reads, 0);
  await iterator.next();
  assert.equal(reads, 1);
  controller.abort();
  await assert.rejects(iterator.next(), { name: 'AbortError' });
  assert.equal(reads, 1);
});

test('动态解读拒绝不连续分段及超容量问题，不截断事实', async () => {
  const bad = iterateAstrolabeDynamicPromptPages(range, async (index) => ({
    ...range.branches[index],
    startTimestamp: start + 1000,
  }));
  await assert.rejects(bad.next(), /覆盖范围不连续/u);
  const oversized = iterateAstrolabeDynamicPromptPages(
    range,
    async (index) => range.branches[index],
    { maxCharacters: 2000, question: '问题'.repeat(2000) },
  );
  await assert.rejects(oversized.next(), /超过每页提示词容量/u);
});
