import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeLiurenEvidence,
  conditionLiurenTraditionalText,
  generateLiuren,
} from 'mingyu-core/divination/liuren';
import { TIANJIANG_ATTRIBUTES } from '../packages/core/src/divination/algorithms/liuren/helpers/plate';

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
  assert.equal(evidence.calculationFact.monthLeader, data.monthLeader);
  assert.equal(evidence.calculationFact.divinationBranch, data.divinationBranch);
  assert.equal(evidence.calculationFact.noblemanBranch, data.noblemanBranch);
  assert.equal(evidence.calculationFact.noblemanGroundBranch, data.noblemanGroundBranch);
  assert.deepEqual(evidence.calculationFact.xunKong, data.xunKong);
  assert.ok(evidence.calculationFact.sources.length >= 3);
  assert.match(evidence.calculationFact.limitation, /不单独证明现实事件/);
  assert.equal(evidence.plateFacts.length, 12);
  assert.ok(evidence.plateFacts.every((item) => /地盘.上见天盘.乘/.test(item)));
  assert.equal(evidence.platePositionFacts.length, 12);
  assert.equal(new Set(evidence.platePositionFacts.map((item) => item.key)).size, 12);
  assert.ok(
    evidence.platePositionFacts.every(
      (item, index) =>
        item.index === index + 1 &&
        item.earthBranch === data.heavenlyPlate[index].under &&
        item.heavenBranch === data.heavenlyPlate[index].branch &&
        item.god === data.heavenlyPlate[index].god &&
        item.promptText.includes(`地盘${item.earthBranch}上见天盘${item.heavenBranch}`) &&
        item.sources.length >= 2 &&
        item.limitation.includes('只证明月将加时'),
    ),
  );
  assert.equal(evidence.platePositionFacts.filter((item) => item.isNobleman).length, 1);
  assert.equal(evidence.platePositionFacts.filter((item) => item.isNoblemanGround).length, 1);
  assert.equal(evidence.plateFact.status, '完整');
  assert.equal(evidence.plateFact.actualCount, 12);
  assert.equal(evidence.plateFact.positionKeys.length, 12);
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

test('大六壬旧结果缺少天地盘时应明确标为证据缺口，不反推逐位事实', () => {
  const data = generateLiuren(fixedDate);
  data.heavenlyPlate = data.heavenlyPlate.slice(0, 11);

  const evidence = analyzeLiurenEvidence(data);
  assert.equal(evidence.plateFact.status, '缺少');
  assert.equal(evidence.plateFact.expectedCount, 12);
  assert.equal(evidence.plateFact.actualCount, 11);
  assert.match(evidence.plateFact.promptText, /仅保留11\/12位/);
  assert.match(evidence.plateFact.limitation, /不得反推或补造/);
  assert.ok(
    evidence.evidence.items.some(
      (item) => item.level === '反证' && item.title === '天地盘定位资料缺失',
    ),
  );
});

test('大六壬传统事实应保留原文并为提示词生成条件化副本', () => {
  const data = generateLiuren(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '经典取传规则'));
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '课体'));
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '天将属性'));
  assert.ok(evidence.traditionalFacts.some((item) => item.kind === '神煞'));
  assert.ok(
    evidence.traditionalFacts.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实事件'),
    ),
  );
  assert.doesNotMatch(
    evidence.promptText,
    /traditionalFacts|本项目|当前项目|工程|算法结果|主婚姻|主官非|主疾病|主死丧/,
  );
});

test('十二天将传统属性进入提示词时不得直接证明疾病、死亡、犯罪或婚姻结果', () => {
  const originalTexts = Object.values(TIANJIANG_ATTRIBUTES).map((item) => item.description);
  const promptTexts = originalTexts.map(conditionLiurenTraditionalText);

  assert.ok(originalTexts.some((item) => /主婚姻/.test(item)));
  assert.ok(originalTexts.some((item) => /主官非/.test(item)));
  assert.ok(originalTexts.some((item) => /主疾病、死丧/.test(item)));
  assert.ok(originalTexts.some((item) => /主失窃、欺骗/.test(item)));
  promptTexts.forEach((text) => {
    assert.doesNotMatch(text, /主婚姻|主官非|主疾病|主死丧|主失窃|主欺骗|必然|必定/);
  });

  const dangerousText = conditionLiurenTraditionalText(
    '白虎为凶丧之神，主疾病、死丧、血光、刀兵、破财；六合主婚姻；勾陈主官非。',
  );
  assert.match(dangerousText, /传统类象涉及健康、损伤、安全与财物风险等议题/);
  assert.match(dangerousText, /六合传统类象涉及婚姻/);
  assert.match(dangerousText, /勾陈传统类象涉及官非/);
});
