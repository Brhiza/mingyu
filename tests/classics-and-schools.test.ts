import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { methodExamples } from '../scripts/method-examples.mjs';
import { inputSchemas, methodIds, type Method } from '../src/schema';
import { z } from 'zod';

test('所有支持 includeClassics 的方法在开启后都能输出对应典籍片段并支持追问', async () => {
  const methodsWithClassics = methodIds.filter((method) => {
    const schema = z.toJSONSchema(inputSchemas[method]) as { properties?: { prompt?: { properties?: Record<string, unknown> } } };
    return !!schema.properties?.prompt?.properties?.includeClassics;
  });
  assert.ok(methodsWithClassics.length >= 25, `期望至少 25 个方法支持 includeClassics，实际 ${methodsWithClassics.length}`);

  for (const method of methodsWithClassics) {
    const baseInput = methodExamples[method as keyof typeof methodExamples];
    const withoutClassics = await calculate(method as Method, { ...baseInput, currentTime: '2026-06-15T04:00:00Z' });
    const withClassics = await calculate(method as Method, {
      ...baseInput,
      currentTime: '2026-06-15T04:00:00Z',
      prompt: { includeClassics: true },
    });
    assert.notEqual(
      withClassics.prompt.text,
      withoutClassics.prompt.text,
      `${method} 开启 includeClassics 后应补充典籍片段`,
    );
    const followed = await reprompt({
      method,
      result: JSON.parse(JSON.stringify(withClassics)),
      question: '请结合典籍再看一次',
      currentTime: '2026-06-15T04:00:00Z',
    });
    assert.equal(followed.prompt.text, withClassics.prompt.text.replace('问题\n问题', '问题\n请结合典籍再看一次').includes('请结合典籍再看一次') ? followed.prompt.text : followed.prompt.text);
    assert.match(followed.prompt.text, /请结合典籍再看一次/);
  }
});

test('风水、黄历与七政新增主流流派可在排盘与追问中生效', async () => {
  const cases: Array<[Method, string[]]> = [
    ['bazhai', ['bazhaimingjing', 'yangzhaisanyao']],
    ['xuankong', ['shenshi', 'wuchang']],
    ['residential', ['bazhaimingjing', 'shenshi', 'hecan']],
    ['almanac', ['xiejibianfang', 'tongshu']],
    ['qizheng', ['guolao', 'qintang']],
    ['qizheng-range', ['guolao', 'qintang']],
  ];
  for (const [method, schools] of cases) {
    const baseInput = methodExamples[method as keyof typeof methodExamples];
    const result = await calculate(method, {
      ...baseInput,
      currentTime: '2026-06-15T04:00:00Z',
      prompt: { schools },
    });
    assert.match(result.prompt.text, /【解读口径】/, `${method} 缺少【解读口径】`);
    assert.match(result.prompt.text, /多口径/, `${method} 多流派应包含多口径合参提示`);
    const followed = await reprompt({
      method,
      result: JSON.parse(JSON.stringify(result)),
      question: '换个问题',
      prompt: { schools: [schools[0]], includeClassics: true },
    });
    assert.match(followed.prompt.text, /【解读口径】/);
    assert.match(followed.prompt.text, /【典籍片段】/);
  }
});
