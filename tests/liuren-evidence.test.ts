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
  assert.deepEqual(evidence.focusEvidence, data.focusEvidence);
  assert.deepEqual(evidence.timingEvidence, data.timingEvidence);
  assert.match(evidence.promptText, /应期触发证据/);
  assert.ok(
    (data.focusEvidence ?? []).every((focus) =>
      evidence.evidence.items.some((item) => item.title === `${focus.target}${focus.role}`),
    ),
  );
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

test('大六壬起盘链、天地盘、课体神煞与天将属性应进入统一证据条目', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;
  const items = evidence?.evidence.items ?? [];

  assert.ok(evidence);
  assert.ok(evidence.calculationFacts.some((item) => item.includes(`月将${data.monthLeader}`)));
  assert.ok(
    evidence.calculationFacts.some(
      (item) => item.includes(data.dayNight ?? '') && item.includes(data.noblemanBranch ?? ''),
    ),
  );
  assert.equal(evidence.plateFacts.length, 12);
  assert.ok(evidence.plateFacts.every((item) => /地盘.上见天盘.乘/.test(item)));
  assert.deepEqual(new Set(evidence.patternEvidence), new Set(data.patternTags));
  assert.deepEqual(evidence.shenShaEvidence, data.shenShaSummary);

  assert.ok(items.some((item) => item.title === '月将加时与贵人起盘事实'));
  assert.ok(items.some((item) => item.title === '天地盘十二支与天将定位'));
  assert.equal(items.filter((item) => item.tags?.includes('四课')).length >= 5, true);
  assert.equal(items.filter((item) => item.tags?.includes('三传推进')).length, 2);
  assert.ok(items.some((item) => item.title === '课体与三传结构标签'));
  assert.ok(items.some((item) => item.title === '神煞定位事实'));
  assert.ok(items.some((item) => item.tags?.includes('天将属性')));
  assert.ok(items.some((item) => item.level === '应期' && item.title === '应期触发证据'));
  assert.ok(evidence.counterEvidence.length === 0 || items.some((item) => item.level === '反证'));
  assert.doesNotMatch(
    JSON.stringify(evidence.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});
