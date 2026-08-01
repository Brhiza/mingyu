import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  analyzeJinkoujueEvidence,
  generateJinkoujue,
  rebuildAuditedJinkoujueData,
} from '../packages/core/src/divination/algorithms/jinkoujue.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('金口诀：时间起课只保留时间、四柱与规则待校边界', () => {
  const data = generateJinkoujue({ method: 'time', customDate: SAMPLE_DATE });

  assert.equal(data.method, 'time');
  assert.equal(data.timestamp, SAMPLE_DATE.getTime());
  assert.ok(data.ganzhi.year);
  assert.ok(data.ganzhi.month);
  assert.ok(data.ganzhi.day);
  assert.ok(data.ganzhi.hour);
  assert.equal(data.evidenceAnalysis?.status, '资料不足');
  assert.equal(data.evidenceAnalysis?.summaryFact.status, '证据链有缺口');
  assert.match(data.evidenceAnalysis?.promptText || '', /金口诀原始起课事实与待校边界/);
  assert.doesNotMatch(JSON.stringify(data), /"positions"|"yinYangUse"|"movements"|"diFenBranch"/);
});

test('金口诀：数字起课保留用户原始数字但不映射地分', () => {
  const data = generateJinkoujue({ method: 'number', number: 29, customDate: SAMPLE_DATE });

  assert.equal(data.numberInput, 29);
  assert.match(data.evidenceAnalysis?.inputFact.promptText || '', /用户原始数字：29/);
  assert.doesNotMatch(JSON.stringify(data), /"diFenBranch"|"positions"|"yinYangUse"|"movements"/);
  assert.throws(
    () => generateJinkoujue({ method: 'number', number: 0, customDate: SAMPLE_DATE }),
    /不小于 1 的安全整数/,
  );
});

test('金口诀：同种子随机记录可复现且不生成派生课盘', () => {
  const a = generateJinkoujue({
    method: 'random',
    seed: 'jinkoujue-seed',
    customDate: SAMPLE_DATE,
  });
  const b = generateJinkoujue({
    method: 'random',
    seed: 'jinkoujue-seed',
    customDate: SAMPLE_DATE,
  });

  assert.deepEqual(a.randomTrace, b.randomTrace);
  assert.equal(a.randomTrace?.samples.length, 1);
  assert.equal(a.evidenceAnalysis?.randomTraceFact.status, '可重放');
  assert.doesNotMatch(JSON.stringify(a), /"positions"|"yinYangUse"|"movements"/);
});

test('金口诀：审核重建只信任原始输入并清除旧课盘污染', () => {
  const clean = generateJinkoujue({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  const polluted = {
    ...structuredClone(clean),
    methodLabel: '伪造起课法',
    ganzhi: { year: '甲子', month: '甲子', day: '甲子', hour: '甲子' },
    positions: { diFen: { branch: '亥' } },
    mainLine: '伪造课盘结论',
    evidenceAnalysis: { promptText: '伪造旧证据' },
  } as unknown as typeof clean;

  assert.deepEqual(rebuildAuditedJinkoujueData(polluted), clean);
  assert.deepEqual(analyzeJinkoujueEvidence(polluted), clean.evidenceAnalysis);
});

test('金口诀：审核重建拒绝缺失或矛盾的原始资料', () => {
  const number = generateJinkoujue({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  assert.throws(
    () => rebuildAuditedJinkoujueData(null as unknown as typeof number),
    /结果必须是对象/,
  );
  assert.throws(
    () => rebuildAuditedJinkoujueData({ ...number, timestamp: Number.NaN }),
    /时间戳无效/,
  );
  assert.throws(
    () => rebuildAuditedJinkoujueData({ ...number, method: 'manual' as typeof number.method }),
    /未知的金口诀起课方式/,
  );
  assert.throws(
    () => rebuildAuditedJinkoujueData({ ...number, numberInput: undefined }),
    /缺少有效的原始用户数字/,
  );

  const time = generateJinkoujue({ method: 'time', customDate: SAMPLE_DATE });
  assert.throws(
    () =>
      rebuildAuditedJinkoujueData({
        ...time,
        randomTrace: { mode: 'system', samples: [0.5] },
      }),
    /时间起课不应携带随机轨迹/,
  );

  const random = generateJinkoujue({
    method: 'random',
    seed: 'audit-seed',
    customDate: SAMPLE_DATE,
  });
  const missingTrace = structuredClone(random);
  delete missingTrace.randomTrace;
  if (missingTrace.meta) delete missingTrace.meta.random;
  assert.throws(() => rebuildAuditedJinkoujueData(missingTrace), /缺少原始随机轨迹/);

  const mismatchedCopies = structuredClone(random);
  mismatchedCopies.randomTrace!.samples[0] = 0.25;
  assert.throws(() => rebuildAuditedJinkoujueData(mismatchedCopies), /两份随机轨迹不一致/);
});
