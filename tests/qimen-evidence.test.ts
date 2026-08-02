import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeQimenEvidence,
  generateQimen,
  rebuildAuditedQimenData,
} from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const fixedDate = new Date('2025-06-18T10:30:00+08:00');

test('奇门排盘应内置九宫位置与宫间关系结构化证据', () => {
  const data = generateQimen(fixedDate);
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'qimen:evidence');
  assert.equal(evidence.status, '已计算');
  assert.deepEqual(evidence.calculationSteps, evidence.calculationEvidenceFacts);
  assert.equal(evidence.calculationChain.length, evidence.calculationEvidenceFacts.length);
  assert.equal(data.jiuGongGe.length, 9);
  assert.equal(evidence.palaceFacts.length, 9);
  assert.deepEqual(
    evidence.palaceFacts.map((item) => item.gong),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.ok(
    evidence.palaceFacts.every(
      (item) =>
        item.tianPan &&
        item.diPan &&
        item.renPan &&
        item.shenPan &&
        item.promptText &&
        item.sources.length >= 3 &&
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(evidence.positionIndexes.length > 0);
  assert.ok(
    evidence.positionIndexes.every((item) =>
      evidence.palaceFacts.some((fact) => fact.key === item.palaceFactKey),
    ),
  );
  assert.ok(evidence.positionIndexes.some((item) => item.indexSources.includes('值符落宫')));
  assert.ok(evidence.positionIndexes.some((item) => item.indexSources.includes('值使落宫')));
  assert.equal(evidence.palaceRelations.length, 36);
  assert.equal(new Set(evidence.palaceRelations.map((item) => item.key)).size, 36);
  assert.ok(
    evidence.palaceRelations.every(
      (item) =>
        item.fromGong < item.toGong &&
        evidence.palaceFacts.some((fact) => fact.key === item.fromPalaceFactKey) &&
        evidence.palaceFacts.some((fact) => fact.key === item.toPalaceFactKey),
    ),
  );
  assert.equal(evidence.summaryFact.status, '盘面资料完整');
  assert.equal(evidence.summaryFact.palaceFactCount, evidence.palaceFacts.length);
  assert.equal(evidence.summaryFact.positionIndexCount, evidence.positionIndexes.length);
  assert.equal(evidence.summaryFact.palaceRelationCount, evidence.palaceRelations.length);
  assert.equal(evidence.summaryFact.patternCount, evidence.patternFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  assert.equal(evidence.directionBoundaryFact.status, '仅保留九宫方向');
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.limitationFacts.every((item) => item.ownerFactKeys.every((key) => factKeys.has(key))),
  );
  assert.match(evidence.promptText, /【奇门九宫位置与关系结构化证据】/);
  assert.match(evidence.promptText, /奇门九宫逐宫计算事实/);
  assert.match(evidence.promptText, /计算链：/);
  assert.match(evidence.promptText, /证据汇总：/);
  assert.match(evidence.promptText, /解释限制：/);
  assert.match(evidence.promptText, /门.+、星.+、神.+、天盘.+、地盘/);
  const ruleSourceItems = evidence.evidence.items.filter((item) =>
    item.tags?.includes('奇门规则来源'),
  );
  assert.equal(ruleSourceItems.length, evidence.ruleSourceFacts.length);
  evidence.ruleSourceFacts.forEach((item) => {
    assert.match(
      evidence.promptText,
      new RegExp(item.promptText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });
  const calculationItem = evidence.evidence.items.find((item) => item.title === '定局计算事实');
  assert.ok(calculationItem);
  const calculationSourceKeys = new Set(
    evidence.calculationEvidenceFacts.flatMap((item) => item.sourceKeys),
  );
  calculationSourceKeys.forEach((key) => assert.match(calculationItem.source, new RegExp(key)));
  assert.doesNotMatch(
    evidence.promptText,
    /主宫评分|辅宫评分|权重[：=]?\d|评分-?\d+|（-?\d+分|成功率[：=]?\d|应期范围\d/,
  );
  assert.doesNotMatch(evidence.promptText, /qimen:(?:evidence|limitation|calculation):/);
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('奇门证据应在四项取用资料不全时失败关闭', () => {
  const evidence = analyzeQimenEvidence(generateQimen(fixedDate));

  assert.match(evidence.promptText, /不自动指定用神/);
  assert.match(
    evidence.promptText,
    /问题文字、主题或出生年份也不能替代具体底本版本、事项角色、完整取用规则和已指定用神对象/,
  );
  assert.match(
    evidence.promptText,
    /未同时明确具体底本版本、事项角色、完整取用规则、已指定用神对象和目标期限前，不生成应期快慢/,
  );
  assert.match(evidence.promptText, /通用入口不生成吉方、避方或候选方向/);
  assert.match(evidence.promptText, /不得输出吉凶总分、成功率/);
  assert.match(evidence.promptText, /不输出.*方位结论、应期、现实结果或行动建议/);
});

test('奇门证据应保留真实空亡与宫间五行反证', () => {
  const data = generateQimen(new Date('2024-01-01T17:00:00+08:00'));
  const evidence = analyzeQimenEvidence(data);
  const voidPalace = evidence.palaceFacts.find((item) => item.isVoid);

  assert.ok(voidPalace);
  assert.ok(evidence.counterEvidenceFacts.some((item) => item.detail.includes('宫位逢空')));
  assert.equal(evidence.palaceRelations.length, 36);
  assert.ok(evidence.palaceRelations.every((item) => item.relation.length > 0));
});

test('奇门审核重建应删除旧方位应期并重算经典格局', () => {
  const clean = generateQimen(fixedDate);
  const polluted = {
    ...clean,
    directions: {
      goodDirections: [{ gong: 1, direction: '北', use: '必胜', reasons: ['伪造'] }],
      avoidDirections: [{ gong: 2, direction: '西南', use: '必败', reasons: ['伪造'] }],
    },
    yingQi: { rhythm: '快', triggerConditions: ['三日必成'] },
    classicPatterns: [{ name: '伪造大吉格', type: 'good', summary: '现实必胜', palaces: [1] }],
  } as unknown as Parameters<typeof rebuildAuditedQimenData>[0];

  const rebuilt = rebuildAuditedQimenData(polluted) as unknown as Record<string, unknown>;

  assert.equal(rebuilt.directions, undefined);
  assert.equal(rebuilt.yingQi, undefined);
  assert.doesNotMatch(JSON.stringify(rebuilt.classicPatterns), /伪造|必胜/);
});

test('奇门审核重建应在派生规则前拒绝残缺或重复九宫', () => {
  const clean = generateQimen(fixedDate);
  const missing = structuredClone(clean);
  missing.jiuGongGe = missing.jiuGongGe.filter((item) => item.gong !== 5);
  assert.throws(
    () => rebuildAuditedQimenData(missing),
    /需要一至九宫各一项；当前8项，缺少5.*已禁止计算派生规则/,
  );

  const duplicate = structuredClone(clean);
  duplicate.jiuGongGe[4] = structuredClone(duplicate.jiuGongGe[0]);
  assert.throws(
    () => rebuildAuditedQimenData(duplicate),
    /需要一至九宫各一项；当前9项，缺少5，重复1.*已禁止计算派生规则/,
  );
});

test('奇门审核重建应拒绝非法四柱、范围、排盘法与局数', () => {
  const clean = generateQimen(fixedDate);
  const pillarLabels = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
  } as const;

  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    const corrupted = structuredClone(clean);
    corrupted.ganzhi[key] = '甲丑';
    assert.throws(
      () => rebuildAuditedQimenData(corrupted),
      new RegExp(`${pillarLabels[key]}必须是有效六十甲子`),
    );
  }

  assert.throws(
    () =>
      rebuildAuditedQimenData({
        ...clean,
        scope: 'unknown' as typeof clean.scope,
      }),
    /无法识别排盘级别/,
  );
  assert.throws(
    () =>
      rebuildAuditedQimenData({
        ...clean,
        method: 'unknown' as typeof clean.method,
      }),
    /无法识别排盘法/,
  );
  assert.throws(() => rebuildAuditedQimenData({ ...clean, juShu: 0 }), /局数必须是1至9的整数/);
  assert.throws(() => rebuildAuditedQimenData({ ...clean, timestamp: Number.NaN }), /时间戳无效/);

  for (const [field, expected] of [
    ['scope', /无法识别排盘级别/],
    ['method', /无法识别排盘法/],
    ['juMethod', /无法识别定局法/],
  ] as const) {
    const missing = structuredClone(clean) as unknown as Record<string, unknown>;
    delete missing[field];
    assert.throws(
      () =>
        rebuildAuditedQimenData(
          missing as unknown as Parameters<typeof rebuildAuditedQimenData>[0],
        ),
      expected,
    );
  }

  assert.throws(
    () => rebuildAuditedQimenData({ ...clean, juMethod: 'zhirun' }),
    /时家奇门定局法必须明确.*并与排盘时间记录一致/,
  );
});

test('日家旧盘不得通过审核重建或提示词证据入口恢复', () => {
  const legacyDay = {
    ...generateQimen(fixedDate),
    scope: 'day' as const,
  };

  assert.throws(
    () => rebuildAuditedQimenData(legacyDay),
    /日家奇门存在多套互相冲突的古法.*旧数据不得.*不开放/,
  );
  assert.throws(
    () => analyzeQimenEvidence(legacyDay),
    /日家奇门存在多套互相冲突的古法.*旧数据不得.*不开放/,
  );
});

test('年月家旧定局不得绕过审核重建进入提示词', () => {
  const month = generateQimen(new Date('2025-06-18T10:30:00+08:00'), 'zhuanpan', 'month');
  const legacyMonth = {
    ...month,
    isYangDun: true,
    juShu: 1,
    juMethod: 'chaibu' as const,
    timeInfo: { ...month.timeInfo, epoch: '月局' },
  };
  assert.throws(() => rebuildAuditedQimenData(legacyMonth), /月家奇门旧定局与已校勘规则不一致/);
  assert.throws(() => analyzeQimenEvidence(legacyMonth), /月家奇门旧定局与已校勘规则不一致/);

  const year = generateQimen(new Date('1984-07-01T08:00:00+08:00'), 'zhuanpan', 'year');
  const legacyYear = {
    ...year,
    isYangDun: true,
    juShu: 1,
    juMethod: 'chaibu' as const,
  };
  assert.throws(() => rebuildAuditedQimenData(legacyYear), /年家奇门旧定局与已校勘规则不一致/);
  assert.throws(() => analyzeQimenEvidence(legacyYear), /年家奇门旧定局与已校勘规则不一致/);
});

test('年月家提示词应写明各自三元定局法而不冒充时家拆补或置闰', () => {
  const month = generateQimen(new Date('2025-06-18T10:30:00+08:00'), 'zhuanpan', 'month');
  const year = generateQimen(new Date('1984-07-01T08:00:00+08:00'), 'zhuanpan', 'year');

  assert.match(month.evidenceAnalysis?.promptText ?? '', /月家五年段三元法/);
  assert.match(month.evidenceAnalysis?.promptText ?? '', /定局结果：行年.*属.*元，阴遁[147]局/);
  assert.match(year.evidenceAnalysis?.promptText ?? '', /年家一百八十年三元法/);
  assert.match(year.evidenceAnalysis?.promptText ?? '', /定局结果：下元，阴遁7局/);
  for (const data of [month, year]) {
    assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', /采用(?:拆补法|置闰法)/);
  }
});

test('奇门审核重建应拒绝值符值使落点缺失与原始盘污染', () => {
  const clean = generateQimen(fixedDate);

  const missingZhiFu = structuredClone(clean);
  const zhiFuPalace = missingZhiFu.jiuGongGe.find(
    (item) =>
      item.tianPan.star === missingZhiFu.zhiFu || item.tianPan.companionStar === missingZhiFu.zhiFu,
  );
  assert.ok(zhiFuPalace);
  if (zhiFuPalace.tianPan.star === missingZhiFu.zhiFu) {
    zhiFuPalace.tianPan.star = '';
  } else {
    zhiFuPalace.tianPan.companionStar = undefined;
  }
  assert.throws(
    () => rebuildAuditedQimenData(missingZhiFu),
    /值符星.*必须有且只有一个落宫，当前定位到0处/,
  );

  const missingZhiShi = structuredClone(clean);
  const zhiShiPalace = missingZhiShi.jiuGongGe.find(
    (item) => item.renPan.door === missingZhiShi.zhiShi,
  );
  assert.ok(zhiShiPalace);
  zhiShiPalace.renPan.door = '';
  assert.throws(
    () => rebuildAuditedQimenData(missingZhiShi),
    /值使门.*必须有且只有一个落宫，当前定位到0处/,
  );

  const pollutedPalace = structuredClone(clean);
  pollutedPalace.jiuGongGe[0].name = '伪造吉宫';
  assert.throws(
    () => rebuildAuditedQimenData(pollutedPalace),
    /第1宫原始盘与声明的遁局、值符值使及排盘法不一致/,
  );
});
