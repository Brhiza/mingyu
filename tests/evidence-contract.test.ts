import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEvidenceItem,
  assertEvidenceItem,
  buildEvidenceTrail,
  attachEvidence,
  createHighConfidenceEvidence,
  MAX_EVIDENCE_DEPTH,
  CONFIDENCE_SCORE,
  type EvidenceItem,
  type EvidenceTrail,
} from '../packages/core/src/shared/evidence.ts';

// ---------------------------------------------------------------------------
// 证据条目验证
// ---------------------------------------------------------------------------

test('validateEvidenceItem: 合法证据通过验证', () => {
  const item: EvidenceItem = {
    title: '真太阳时校正',
    system: 'true-solar-time',
    computationChain: [
      { name: '经度差计算', formula: '(经度 - 120) * 4分钟', inputs: { longitude: 116.4 }, output: -14.4 },
    ],
    source: { type: 'algorithm', name: 'Meeus Astronomical Algorithms', location: 'Ch.7' },
    boundary: { applicableWhen: ['使用北京时间'], precision: '±1分钟' },
    confidence: 'high',
    depth: 0,
  };
  const errors = validateEvidenceItem(item);
  assert.deepEqual(errors, []);
});

test('validateEvidenceItem: 缺少必填字段返回错误', () => {
  const errors = validateEvidenceItem({ title: 'test' });
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.includes('computationChain')));
  assert.ok(errors.some((e) => e.includes('source')));
  assert.ok(errors.some((e) => e.includes('boundary')));
});

test('validateEvidenceItem: 深度超限返回错误', () => {
  const item = {
    title: 'test',
    computationChain: [],
    source: { type: 'algorithm', name: 'test' },
    boundary: {},
    confidence: 'high',
    depth: 99,
  };
  const errors = validateEvidenceItem(item);
  assert.ok(errors.some((e) => e.includes('depth')));
});

test('assertEvidenceItem: 不合法时抛错', () => {
  assert.throws(() => assertEvidenceItem(null), /Invalid evidence item/);
});

// ---------------------------------------------------------------------------
// 证据链构建
// ---------------------------------------------------------------------------

test('buildEvidenceTrail: 按深度排序并限制深度', () => {
  const items: EvidenceItem[] = [
    { ...createHighConfidenceEvidence('深层证据', 'test', { type: 'algorithm', name: 'x' }), depth: 3 },
    { ...createHighConfidenceEvidence('主证', 'test', { type: 'algorithm', name: 'x' }), depth: 0 },
    { ...createHighConfidenceEvidence('辅证', 'test', { type: 'algorithm', name: 'x' }), depth: 1 },
    { ...createHighConfidenceEvidence('超限证据', 'test', { type: 'algorithm', name: 'x' }), depth: 99 },
  ];
  const trail = buildEvidenceTrail(items, '测试摘要');
  assert.equal(trail.items.length, 3); // 超限的被过滤
  assert.equal(trail.items[0].depth, 0);
  assert.equal(trail.items[1].depth, 1);
  assert.equal(trail.items[2].depth, 3);
  assert.equal(trail.summary, '测试摘要');
  assert.ok(trail.generatedAt);
});

test('buildEvidenceTrail: 整体置信度取最低（短板效应）', () => {
  const items: EvidenceItem[] = [
    { ...createHighConfidenceEvidence('高置信', 'test', { type: 'algorithm', name: 'x' }), confidence: 'high' },
    { ...createHighConfidenceEvidence('低置信', 'test', { type: 'algorithm', name: 'x' }), confidence: 'low' },
  ];
  const trail = buildEvidenceTrail(items, '');
  assert.equal(trail.overallConfidence, 'low');
});

test('buildEvidenceTrail: 全高置信时整体为high', () => {
  const items: EvidenceItem[] = [
    createHighConfidenceEvidence('a', 'test', { type: 'algorithm', name: 'x' }),
    createHighConfidenceEvidence('b', 'test', { type: 'algorithm', name: 'x' }),
  ];
  const trail = buildEvidenceTrail(items, '');
  assert.equal(trail.overallConfidence, 'high');
});

// ---------------------------------------------------------------------------
// attachEvidence
// ---------------------------------------------------------------------------

test('attachEvidence: 给结果附加证据链', () => {
  const result = { value: 42, name: 'test' };
  const trail = buildEvidenceTrail(
    [createHighConfidenceEvidence('测试', 'test', { type: 'algorithm', name: 'x' })],
    '摘要',
  );
  const withEvidence = attachEvidence(result, trail);
  assert.equal(withEvidence.value, 42);
  assert.equal(withEvidence.name, 'test');
  assert.equal(withEvidence.evidenceTrail.overallConfidence, 'high');
  assert.equal(withEvidence.evidenceTrail.items.length, 1);
});

// ---------------------------------------------------------------------------
// 快捷构造函数
// ---------------------------------------------------------------------------

test('createHighConfidenceEvidence: 创建高置信度主证', () => {
  const item = createHighConfidenceEvidence(
    '五虎遁月干',
    'bazi',
    { type: 'classical', name: '《渊海子平》', location: '卷一' },
    [{ name: '甲己之年丙作首', formula: '年干 -> 月干起始' }],
    { applicableWhen: ['正月建寅'] },
  );
  assert.equal(item.title, '五虎遁月干');
  assert.equal(item.system, 'bazi');
  assert.equal(item.confidence, 'high');
  assert.equal(item.depth, 0);
  assert.equal(item.computationChain.length, 1);
  assert.equal(item.source.name, '《渊海子平》');
  assert.deepEqual(item.boundary.applicableWhen, ['正月建寅']);
});

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

test('MAX_EVIDENCE_DEPTH = 4', () => {
  assert.equal(MAX_EVIDENCE_DEPTH, 4);
});

test('CONFIDENCE_SCORE 映射正确', () => {
  assert.equal(CONFIDENCE_SCORE.high, 0.9);
  assert.equal(CONFIDENCE_SCORE.medium, 0.6);
  assert.equal(CONFIDENCE_SCORE.low, 0.3);
});

// ---------------------------------------------------------------------------
// 反证字段
// ---------------------------------------------------------------------------

test('EvidenceItem 支持反证字段', () => {
  const item: EvidenceItem = {
    title: '身强身弱判断',
    system: 'bazi',
    computationChain: [],
    source: { type: 'classical', name: '《滴天髓》' },
    boundary: {},
    confidence: 'medium',
    depth: 0,
    counterEvidence: [
      { description: '月令被合化时身强身弱需重新判断', severity: 'overturn' },
      { description: '从格例外', severity: 'alternative' },
    ],
  };
  assert.equal(item.counterEvidence!.length, 2);
  assert.equal(item.counterEvidence![0].severity, 'overturn');
});
