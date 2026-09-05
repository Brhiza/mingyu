import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCulturePromptSamples,
  assertCulturePromptSamples,
} from '../scripts/generate-culture-prompt-audit';

test('文字数理及新增占问的实际完整提示词纳入固定审查', async () => {
  const samples = await buildCulturePromptSamples();
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
