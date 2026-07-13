import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeLiurenEvidence, generateLiuren } from 'mingyu-core/divination/liuren';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

test('大六壬排盘应内置四课取传与三传推进结构化证据', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.lessons.length, 4);
  assert.equal(evidence.transmissions.length, 3);
  assert.deepEqual(
    evidence.transmissions.map((item) => item.label),
    ['起点', '过程', '落点'],
  );
  assert.equal(evidence.initialBranch, data.threeTransmissions[0].branch);
  assert.match(evidence.promptText, /【大六壬四课取传与三传推进结构化证据】/);
  assert.match(evidence.promptText, /四课取传与初传发用/);
  assert.doesNotMatch(evidence.promptText, /权重[：=]?\d|总分[：=]?\d|成功率[：=]?\d/);
});

test('大六壬证据应以旬空地支复核三传空亡，避免冗余字段冲突', () => {
  const data = generateLiuren(fixedDate);
  const initialBranch = data.threeTransmissions[0].branch;
  data.xunKong = Array.from(new Set([...(data.xunKong ?? []), initialBranch]));
  data.threeTransmissions[0].isVoid = false;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissions[0].isVoid, true);
  assert.match(evidence.promptText, new RegExp(`初传${initialBranch}空亡`));
  assert.doesNotMatch(evidence.promptText, new RegExp(`初传${initialBranch}不空`));
});

test('大六壬证据应保留类神未选定限制，不把日支或神煞固定当作用神', () => {
  const evidence = analyzeLiurenEvidence(generateLiuren(fixedDate));

  assert.match(evidence.promptText, /未按具体问题选定类神/);
  assert.match(evidence.promptText, /不得把日支或任一神煞固定当作用神/);
  assert.match(evidence.promptText, /未给期限时不换算唯一日期/);
});
