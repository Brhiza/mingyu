import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import {
  formatQimenRelationFacts,
  formatQimenStemLocations,
} from '../packages/core/src/prompt/qimen-facts';

test('奇门原生提示词绑定符使宫生克、天地盘时干和取用宫干冲', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt('qimen', '请做整体解读。', data);
  assert.match(prompt, /时干丁；天盘丁：离九宫；地盘丁：巽四宫/);
  assert.match(prompt, /值符宫与值使宫五行：值使宫乾六宫金克值符宫巽四宫木/);
  assert.match(prompt, /巽四宫天地盘干：天盘癸水克地盘丁火；天干相冲：癸与丁相冲/);
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

test('同干定位保留寄干、多落点和缺盘层，定位过程不改盘', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const before = structuredClone(data);
  const locations = formatQimenStemLocations(data);
  for (const palace of data.jiuGongGe) {
    if (palace.tianPan.companionStem) {
      const line = locations.find((item) => item.startsWith(`${palace.tianPan.companionStem}：`));
      assert.ok(line?.includes(`${palace.name}（寄干）`));
    }
    if (palace.diPan.stem) {
      const line = locations.find((item) => item.startsWith(`${palace.diPan.stem}：`));
      assert.ok(line?.split('；地盘')[1].includes(palace.name));
    }
  }
  assert.deepEqual(data, before);
  const partial = structuredClone(data);
  partial.jiuGongGe = partial.jiuGongGe.slice(0, 1);
  partial.jiuGongGe[0].tianPan.stem = '乙';
  partial.jiuGongGe[0].tianPan.companionStem = '乙';
  partial.jiuGongGe[0].diPan.stem = '丙';
  const lines = formatQimenStemLocations(partial);
  assert.equal(lines.length, 2);
  assert.match(
    lines.find((item) => item.startsWith('乙：'))!,
    /；地盘未列$/,
  );
  assert.match(
    lines.find((item) => item.startsWith('丙：'))!,
    /丙：天盘未列/,
  );
});

test('转盘与飞盘的换象造象任务保留原盘、转换条件与现实反馈', () => {
  for (const method of ['zhuanpan', 'feipan'] as const) {
    const data = generateQimen(new Date('2026-05-20T00:30:00+08:00'), method);
    const before = structuredClone(data);
    const prompt = buildDivinationPrompt('qimen', '项目谈判怎样换象与造象？', data);
    assert.match(prompt, /同干定位：/);
    assert.match(prompt, /换象：.*原象、转换依据、替代象及适用条件/);
    assert.match(prompt, /造象：.*实际作用路径和可观察的反馈/);
    assert.match(prompt, /主判断由原用神与宫况支持/);
    assert.deepEqual(data, before);
  }
});

test('奇门候选排序不替代问事取用，也不自动决定主客进退', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  for (const question of ['问求财回款', '问面试岗位', '请做整体解读']) {
    const prompt = buildDivinationPrompt('qimen', question, data);
    assert.match(prompt, /先按问题确定主体、事项用神与主客身份/);
    assert.doesNotMatch(prompt, /取用主线：优先看|兵法利客|兵法利主|宜主动出击|取用宫/);
    for (const palace of data.jiuGongGe) {
      if (palace.tianPan.stem || palace.tianPan.companionStem) {
        assert.ok(
          prompt.includes(`${palace.name}天地盘干：`),
          `${palace.name}应保留干关系供取用核验`,
        );
      }
    }
  }
});
