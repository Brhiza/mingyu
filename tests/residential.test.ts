import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('agreements 与 advice 区分一致关注、口径不同需分述与资料不足，并渲染合参要点与勘察建议', async () => {
  // 坎(东四命) + 子山(坎宅，东四宅) => 同组 => 一致关注
  const sameGroup = await calculate('residential', {
    question: '同组如何解读？',
    person: { kind: 'gua', mingGua: '坎' },
    orientation: { kind: 'mountain', sitMountain: '子' },
    construction: { year: 2008 },
  });
  assert.ok(sameGroup.data.agreements.some((item) => item.level === '可互补'));
  assert.ok(sameGroup.data.agreements.some((item) => item.level === '一致关注'));
  assert.ok(sameGroup.data.advice.some((line) => line.startsWith('先看宅运：')));
  assert.ok(sameGroup.data.advice.some((line) => line.startsWith('再看人宅：')));
  assert.match(sameGroup.prompt.text, /【合参要点】/);
  assert.match(sameGroup.prompt.text, /\[一致关注\]/);
  assert.match(sameGroup.prompt.text, /【勘察建议】/);

  // 乾(西四命) + 子山(坎宅，东四宅) => 异组 => 口径不同需分述
  const diffGroup = await calculate('residential', {
    question: '异组如何解读？',
    person: { kind: 'gua', mingGua: '乾' },
    orientation: { kind: 'mountain', sitMountain: '子' },
    construction: { year: 2008 },
  });
  assert.ok(diffGroup.data.agreements.some((item) => item.level === '口径不同需分述'));
  assert.ok(diffGroup.data.advice.some((line) => line.includes('不硬统一成一个总分')));
  assert.match(diffGroup.prompt.text, /\[口径不同需分述\]/);

  // 缺建造年 => 仅八宅 => 资料不足
  const noConstruction = await calculate('residential', {
    question: '缺建造年',
    person: { kind: 'gua', mingGua: '坎' },
    orientation: { kind: 'mountain', sitMountain: '子' },
  });
  assert.equal(noConstruction.data.agreements[0]?.level, '资料不足');
  assert.match(noConstruction.data.agreements[0]?.detail ?? '', /缺少住宅建造年或起运年/);
  assert.ok(noConstruction.data.advice.some((line) => line.includes('补充住宅建造年或起运年')));

  // 缺居住人 => 仅玄空 => 资料不足
  const noPerson = await calculate('residential', {
    question: '缺居住人',
    orientation: { kind: 'mountain', sitMountain: '子' },
    construction: { year: 2008 },
  });
  assert.equal(noPerson.data.agreements[0]?.level, '资料不足');
  assert.equal(noPerson.data.agreements[0]?.title, '仅完成玄空宅运层');

  // 北向基准未声明 => 提示核定北向基准
  const unspecifiedNorth = await calculate('residential', {
    question: '未声明北向基准',
    person: { kind: 'gua', mingGua: '坎' },
    orientation: { kind: 'degree', reading: 'sit', degree: 0 },
    construction: { year: 2008 },
  });
  assert.ok(unspecifiedNorth.data.advice.some((line) => line.includes('北向基准')));
});

test('reprompt 校验 agreements 与 advice，篡改时拒绝追问', async () => {
  const saved = await calculate('residential', {
    question: '初始问题',
    person: { kind: 'gua', mingGua: '坎' },
    orientation: { kind: 'mountain', sitMountain: '子' },
    construction: { year: 2008 },
  });

  const ok = await reprompt({ method: 'residential', result: saved, question: '追问布局' });
  assert.match(ok.prompt.text, /【合参要点】/);
  assert.match(ok.prompt.text, /【勘察建议】/);
  assert.match(ok.prompt.text, /追问布局/);

  const tamperedAgreements = structuredClone(saved);
  tamperedAgreements.data.agreements[0].title = '篡改标题';
  await assert.rejects(
    () => reprompt({ method: 'residential', result: tamperedAgreements, question: '追问' }),
    /不一致/,
  );

  const tamperedAdvice = structuredClone(saved);
  tamperedAdvice.data.advice[0] = '篡改建议';
  await assert.rejects(
    () => reprompt({ method: 'residential', result: tamperedAdvice, question: '追问' }),
    /不一致/,
  );
});
