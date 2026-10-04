import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCulturePromptSamples,
  assertCulturePromptSamples,
} from '../scripts/generate-culture-prompt-audit';

let cultureSamplesPromise: ReturnType<typeof buildCulturePromptSamples> | undefined;

function getCultureSamples() {
  cultureSamplesPromise ??= buildCulturePromptSamples();
  return cultureSamplesPromise;
}

test('文字数理及新增占问的实际完整提示词纳入固定审查', async () => {
  const samples = await getCultureSamples();
  assertCulturePromptSamples(samples);
  for (const [index, sample] of samples.entries()) {
    const changed = [...samples];
    changed[index] = { ...sample, prompt: sample.prompt.replaceAll(sample.required[0], '') };
    assert.throws(() => assertCulturePromptSamples(changed), /缺少资料/);
    changed[index] = { ...sample, prompt: sample.prompt + '\n内部字段：API' };
    assert.throws(() => assertCulturePromptSamples(changed), /无关内容/);
  }
  assert.throws(() => assertCulturePromptSamples(samples.slice(1)));
});

test('实际汉字样本交换笔画归属后，即使原有数值仍全部出现也不能通过审计', async () => {
  const samples = await getCultureSamples();
  const index = samples.findIndex((sample) => sample.name === '汉字与选字');
  const sample = samples[index];
  const strokeLines = sample.prompt.match(/^简体笔画：.+$/gmu)!;
  assert.equal(strokeLines.length, 2);
  assert.notEqual(strokeLines[0], strokeLines[1]);
  let cursor = 0;
  const changed = sample.prompt.replace(/^简体笔画：.+$/gmu, () => strokeLines[1 - cursor++]);
  for (const line of strokeLines) assert.ok(changed.includes(line));
  const changedSamples = [...samples];
  changedSamples[index] = { ...sample, prompt: changed };
  assert.throws(() => assertCulturePromptSamples(changedSamples), /提示词事实覆盖未通过/);
});

test('两类实际签谱提示词仅承载本签材料，结构化起签过程不进入任务书', async () => {
  const samples = await getCultureSamples();
  for (const sample of samples.filter((sample) => ['诸葛神数', '孔明神卦'].includes(sample.name))) {
    assert.doesNotMatch(
      sample.prompt,
      /【当前时间】|占法：|所写三字|康熙笔画|五枚硬币|取数过程|基础解意：|基础解卦：|卦序：|卦名：|等第：|卦诗：|诗句取象：|典故取象：|【传统依据】/u,
    );
    assert.match(sample.prompt, /签号：|签诗：|基础解签：|补充解释：/u);
    const noisySamples = [...samples];
    noisySamples[samples.indexOf(sample)] = {
      ...sample,
      prompt: `${sample.prompt}\n占法：诸葛神数`,
    };
    assert.throws(() => assertCulturePromptSamples(noisySamples), /签谱外字段|无关内容/);
  }
});
