import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { formatQimenRelationFacts } from '../packages/core/src/prompt/qimen-facts';

test('奇门原生提示词绑定符使宫生克、天地盘时干和取用宫干冲', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt('qimen', '请做整体解读。', data);
  assert.match(prompt, /时干丁；天盘丁：离九宫；地盘丁：巽四宫/);
  assert.match(prompt, /值符宫与值使宫五行：值使宫乾六宫金克值符宫巽四宫木/);
  assert.match(prompt, /取用宫巽四宫天地盘干：天盘癸水克地盘丁火；天干相冲：癸与丁相冲/);
  assert.doesNotMatch(prompt, /天干五合：癸与丁相合/);
});

test('奇门甲子时以旬首所遁戊分别定位天盘和地盘', () => {
  for (const method of ['zhuanpan', 'feipan'] as const) {
    const data = generateQimen(new Date('2026-05-20T00:30:00+08:00'), method);
    assert.equal(data.ganzhi.hour, '甲子');
    const prompt = buildDivinationPrompt('qimen', '请做整体解读。', data);
    assert.match(prompt, /时干甲（甲子遁于戊）；天盘戊：[一-龥]+；地盘戊：[一-龥]+/);
    assert.doesNotMatch(prompt, /时干甲未见落宫/);
  }
});

test('奇门同宫比和与寄干五合各自保持身份，五合不直接写成合化', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const palace = structuredClone(data.jiuGongGe.find((item) => item.gong === 4)!);
  palace.tianPan.stem = '丁';
  palace.tianPan.companionStem = '戊';
  palace.diPan.stem = '壬';
  const lines = formatQimenRelationFacts(palace, palace, palace).join('\n');
  assert.match(lines, /值符宫巽四宫木与值使宫巽四宫木同五行，比和/);
  assert.match(lines, /地盘壬水克天盘丁火；天干五合：丁与壬相合/);
  assert.match(lines, /天盘戊土克地盘壬水/);
  assert.doesNotMatch(lines, /合化|戊与壬相合/);
});
