import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('liuyao schools 生成结构化流派算法口径核验并在追问时生效', async () => {
  const result = await calculate('liuyao', {
    question: '此事近况如何？',
    divinationTime: '2026-10-15T10:00:00+08:00',
    liuyao: {
      method: 'manual',
      yaos: [7, 8, 9, 7, 6, 8],
    },
    prompt: {
      schools: ['zengshanbuyi', 'bushizhengzong', 'huozhulin'],
    },
  });

  const algs = (result.data as any).evidenceAnalysis.schoolAlgorithms;
  assert.ok(Array.isArray(algs) && algs.length === 3, '应生成三个流派的算法口径核验');
  assert.deepEqual(algs.map((a: any) => a.school), ['zengshanbuyi', 'bushizhengzong', 'huozhulin']);
  assert.ok(algs.every((a: any) => Array.isArray(a.findings) && a.findings.length > 0));
  assert.match(result.prompt.text, /【流派算法口径核验】/);
  assert.match(result.prompt.text, /增删卜易口径/);
  assert.match(result.prompt.text, /卜筮正宗口径/);
  assert.match(result.prompt.text, /火珠林口径/);

  const reprompted = await reprompt({
    method: 'liuyao',
    result,
    question: '换卜筮正宗口径再看一次',
    prompt: { schools: ['bushizhengzong'] },
  });
  assert.match(reprompted.prompt.text, /卜筮正宗口径/);
  assert.doesNotMatch(reprompted.prompt.text, /增删卜易口径/);
});
