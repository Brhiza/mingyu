import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { analyzeMeihuaEvidence } from '../packages/core/src/divination/meihua-evidence.ts';
import {
  findHexagramByTrigrams,
  resolveTiYongByMovingYao,
} from '../packages/core/src/divination/algorithms/meihua/helpers/hexagram.ts';
import {
  resolveNumberMethod,
  resolveTimeMethod,
} from '../packages/core/src/divination/algorithms/meihua/helpers/methods.ts';
import { MeihuaHelpers } from '../packages/core/src/divination/divination-helpers.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('梅花：变卦应按初爻到上爻的传统爻位计算', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.originalName, '火地晋');
  assert.equal(data.movingYao.position, 2);
  assert.equal(data.changedName, '火水未济');
  assert.equal(data.changedHexagram?.upper, '离');
  assert.equal(data.changedHexagram?.lower, '坎');
  assert.equal(data.calculation.timeZhi, '辰');
  assert.equal(data.calculation.timeZhiIndex, 5);
  assert.equal(data.calculation.totalWithTime, 128);
  assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
  assert.equal(data.evidenceAnalysis?.calculationFact.methodKey, 'number');
  assert.equal(data.evidenceAnalysis?.calculationFact.inputs.number, 123);
  assert.equal(data.evidenceAnalysis?.calculationFact.steps.length, 3);
  assert.deepEqual(
    data.evidenceAnalysis?.calculationFact.steps.map((item) => item.target),
    ['上卦', '下卦', '动爻'],
  );
  assert.ok(
    data.evidenceAnalysis?.calculationFact.steps.every(
      (item) => item.promptText && typeof item.result === 'number',
    ),
  );
  assert.match(data.evidenceAnalysis?.calculationFact.limitation || '', /不证明卦象预测有效性/);
});

test('梅花：互卦应取二三四爻为下互、三四五爻为上互', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.equal(data.interName, '水山蹇');
  assert.equal(data.interHexagram?.upper, '坎');
  assert.equal(data.interHexagram?.lower, '艮');
  assert.equal(data.interTiGua?.name, '坎');
  assert.equal(data.interYongGua?.name, '艮');
  assert.equal(data.analysis.inter1Relation, '体互克原体');
  assert.equal(data.analysis.inter2Relation, '原体生用互');
});

test('梅花：天泽履二爻动应变天雷无妄，不得错认成天山遁', () => {
  const data = generateMeihua(new Date('2026-07-25T23:30:00+08:00'), { method: 'time' });

  assert.equal(data.originalName, '天泽履');
  assert.equal(data.movingYao.position, 2);
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.yaoType),
    ['阳', '阳', '阴', '阳', '阳', '阳'],
  );
  assert.equal(data.interName, '风火家人');
  assert.equal(data.changedName, '天雷无妄');
  assert.equal(data.changedHexagram?.upper, '乾');
  assert.equal(data.changedHexagram?.lower, '震');
  assert.equal(data.analysis.monthBranch, '未');
  assert.equal(data.analysis.monthElement, '土');
  assert.equal(data.analysis.tiSeasonState, '相');
  assert.equal(data.analysis.yongSeasonState, '相');
});

test('梅花：数字起卦生成的主互变三卦与动爻资料必须始终完整', () => {
  for (let number = 1; number <= 192; number += 1) {
    const data = generateMeihua(SAMPLE_DATE, { method: 'number', number });

    assert.ok(data.originalName);
    assert.ok(data.interName);
    assert.ok(data.changedName);
    assert.ok(data.interHexagram?.upper && data.interHexagram.lower);
    assert.ok(data.changedHexagram?.upper && data.changedHexagram.lower);
    assert.ok(data.changedTiGua && data.changedYongGua);
    assert.ok(data.mainHexagram.movingYaoCi);
    assert.doesNotMatch(data.movingYao.yaoName, /未知/);
    assert.doesNotMatch(JSON.stringify(data.analysis), /无变卦|关系未定/);
  }
});

test('梅花：爻位详情应从初爻往上排列并准确标出动爻', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });

  assert.deepEqual(
    data.yaosDetail.map((yao) => ({
      position: yao.position,
      yaoType: yao.yaoType,
      isChanging: yao.isChanging,
      tiYong: yao.tiYong,
    })),
    [
      { position: 1, yaoType: '阴', isChanging: false, tiYong: '用' },
      { position: 2, yaoType: '阴', isChanging: true, tiYong: '用' },
      { position: 3, yaoType: '阴', isChanging: false, tiYong: '用' },
      { position: 4, yaoType: '阳', isChanging: false, tiYong: '体' },
      { position: 5, yaoType: '阴', isChanging: false, tiYong: '体' },
      { position: 6, yaoType: '阳', isChanging: false, tiYong: '体' },
    ],
  );
});

test('梅花：八个纯卦的六个动爻均应按上下位置区分体用', () => {
  const pureMotionCases = new Set<string>();

  for (let seedIndex = 1; seedIndex <= 20000 && pureMotionCases.size < 48; seedIndex += 1) {
    const data = generateMeihua(SAMPLE_DATE, {
      method: 'random',
      seed: `纯卦体用回归-${seedIndex}`,
    });
    if (data.mainHexagram.upper !== data.mainHexagram.lower) continue;

    const movingYao = data.movingYao.position;
    const movingInLower = movingYao <= 3;
    const expectedTiYong = movingInLower
      ? ['用', '用', '用', '体', '体', '体']
      : ['体', '体', '体', '用', '用', '用'];

    assert.deepEqual(
      data.yaosDetail.map((yao) => yao.tiYong),
      expectedTiYong,
    );
    assert.equal(data.yaosDetail.find((yao) => yao.isChanging)?.tiYong, '用');
    assert.ok(data.yaosDetail.filter((yao) => yao.tiYong === '体').every((yao) => !yao.isChanging));
    pureMotionCases.add(`${data.mainHexagram.upper}:${movingYao}`);
  }

  assert.equal(pureMotionCases.size, 48);
});

test('梅花：应期字段只登记盘面事实，不把体用生克或旺衰直接裁定为快慢', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 1 });

  assert.equal(data.analysis.tiYongRaw, '用生体');
  assert.ok(
    data.analysis.yingQi?.includes('主卦体用关系为用生体，只作生克事实，不单独裁定应期快慢'),
  );
  assert.ok(data.analysis.yingQi?.includes('体卦月令状态为旺，只作盛衰事实，不单独裁定应期快慢'));
  assert.ok(data.analysis.yingQi?.some((item) => item.includes('不能单独计算传统克应')));
  assert.doesNotMatch(data.analysis.yingQi?.join('\n') ?? '', /应期快于常规|应期迟缓/);
});

test('梅花：六个动爻与五种月令状态均不得套用固定现实阶段或统一迟速', () => {
  const movingYaoPositions = new Set<number>();
  const seasonStates = new Set<string>();

  for (let number = 1; number <= 192; number += 1) {
    const data = generateMeihua(SAMPLE_DATE, { method: 'number', number });
    const timingText = data.analysis.yingQi?.join('\n') ?? '';

    movingYaoPositions.add(data.movingYao.position);
    seasonStates.add(data.analysis.tiSeasonState);
    assert.match(timingText, new RegExp(`第${data.movingYao.position}爻为变化层位`));
    assert.match(timingText, /不能单独计算传统克应/);
    assert.doesNotMatch(
      timingText,
      /事情刚开始|基层条件|内部配合|近端条件|由内向外|外部环境开始介入|核心决策|主导条件|事情末端|退出|重新定局|应期快于常规|应期迟缓/,
    );
  }

  assert.deepEqual(
    [...movingYaoPositions].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual([...seasonStates].sort(), ['休', '囚', '旺', '死', '相'].sort());
});

test('梅花：timeTrigram 兼容入口应回到年月日时起卦', () => {
  const timeData = generateMeihua(SAMPLE_DATE, { method: 'time' });
  const compatData = generateMeihua(SAMPLE_DATE, { method: 'timeTrigram' });

  assert.equal(compatData.calculation.methodKey, 'timeTrigram');
  assert.deepEqual(
    [
      compatData.calculation.upperTrigramIndex,
      compatData.calculation.lowerTrigramIndex,
      compatData.calculation.movingYaoIndex,
    ],
    [
      timeData.calculation.upperTrigramIndex,
      timeData.calculation.lowerTrigramIndex,
      timeData.calculation.movingYaoIndex,
    ],
  );
  assert.match(String(compatData.calculation.compatibilityNote), /年月日时起卦法/);
  assert.equal(compatData.evidenceAnalysis?.calculationFact.status, '完整');
  assert.equal(compatData.evidenceAnalysis?.calculationFact.methodKey, 'timeTrigram');
  assert.match(
    compatData.evidenceAnalysis?.calculationFact.compatibilityNote || '',
    /历史兼容入口/,
  );
});

test('梅花：年月日时起卦应以农历年支入数，不应在立春后春节前提前换年', () => {
  const data = generateMeihua(new Date('2024-02-05T12:00:00+08:00'), { method: 'time' });

  assert.equal(data.ganzhi.year, '甲辰');
  assert.equal(data.calculation.yearZhi, '卯');
  assert.equal(data.calculation.yearZhiIndex, 4);
  assert.equal(data.calculation.month, 12);
  assert.equal(data.calculation.day, 26);
  assert.equal(data.calculation.timeZhi, '午');
  assert.equal(data.calculation.timeZhiIndex, 7);
  assert.equal(data.calculation.upperTrigramIndex, 2);
  assert.equal(data.calculation.lowerTrigramIndex, 1);
  assert.equal(data.calculation.movingYaoIndex, 1);
  assert.equal(data.originalName, '泽天夬');
  assert.equal(data.changedName, '泽风大过');
});

test('梅花：未知起卦方式应明确报错，不应静默退回时间卦', () => {
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'unknown' as never }),
    /未知的梅花易数起卦方式/,
  );
});

test('梅花：仅随机起卦应把重放轨迹接入统一证据', () => {
  const randomData = generateMeihua(SAMPLE_DATE, { method: 'random', seed: '梅花证据样例' });
  const numberData = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });
  const randomItem = randomData.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '随机起卦重放记录',
  );

  assert.equal(randomItem?.level, '辅证');
  assert.doesNotMatch(randomItem?.detail || '', /梅花证据样例/);
  assert.match(randomItem?.detail || '', /随机种子保留在结构化结果中/);
  assert.match(randomItem?.detail || '', /不表示可信度或预测有效性/);
  assert.ok(
    randomData.evidenceAnalysis?.randomFacts.some((item) =>
      item.includes('随机种子：梅花证据样例'),
    ),
  );
  assert.equal(randomData.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(randomData.evidenceAnalysis?.randomFact.seed, '梅花证据样例');
  assert.equal(randomData.evidenceAnalysis?.randomFact.sampleCount, 3);
  assert.doesNotMatch(randomData.evidenceAnalysis?.randomFact.promptText || '', /梅花证据样例/);
  assert.equal(randomData.evidenceAnalysis?.calculationFact.status, '完整');
  assert.equal(randomData.evidenceAnalysis?.calculationFact.steps.length, 3);
  assert.ok(
    randomData.evidenceAnalysis?.calculationFact.steps.every((item) =>
      item.expression.startsWith('随机整数'),
    ),
  );
  assert.equal(numberData.evidenceAnalysis?.randomFact.status, '不适用');
  assert.deepEqual(numberData.evidenceAnalysis?.randomFacts, []);
  assert.ok(
    !numberData.evidenceAnalysis?.evidence.items.some((item) => item.tags?.includes('随机起卦')),
  );
});

test('梅花：旧结果缺少取数中间参数时应保留已定卦象并标记证据缺口', () => {
  const data = generateMeihua(SAMPLE_DATE, { method: 'number', number: 123 });
  data.calculation = undefined;
  data.evidenceAnalysis = undefined;

  const rebuilt = analyzeMeihuaEvidence(data);
  assert.equal(rebuilt.calculationFact.status, '缺少中间参数');
  assert.equal(rebuilt.calculationFact.steps.length, 0);
  assert.equal(rebuilt.calculationFact.resolvedResult.upperTrigram, data.mainHexagram.upper);
  assert.match(rebuilt.calculationFact.promptText, /计算过程未附/);
  assert.ok(
    rebuilt.evidence.items.some(
      (item) => item.level === '反证' && item.title === '起卦方式与取数算式',
    ),
  );
});

test('梅花：数字起卦应拒绝超出安全整数范围的数字', () => {
  assert.throws(
    () => generateMeihua(SAMPLE_DATE, { method: 'number', number: Number.MAX_SAFE_INTEGER + 1 }),
    /安全范围内的正整数/,
  );
});

test('梅花：六十四卦查询应拒绝越界八卦索引，不应取模折回', () => {
  assert.throws(() => findHexagramByTrigrams(9, 1), /上卦索引必须在 1-8 之间/);
  assert.throws(() => findHexagramByTrigrams(1, 0), /下卦索引必须在 1-8 之间/);
});

test('梅花：体用判定应拒绝非法动爻位置', () => {
  const upper = { name: '乾', element: '金', nature: '天' };
  const lower = { name: '坤', element: '土', nature: '地' };

  assert.throws(() => resolveTiYongByMovingYao(upper, lower, 0), /动爻位置必须在 1-6 之间/);
  assert.throws(() => resolveTiYongByMovingYao(upper, lower, 7), /动爻位置必须在 1-6 之间/);
  assert.throws(() => resolveTiYongByMovingYao(upper, lower, 3.5), /动爻位置必须在 1-6 之间/);
});

test('梅花：按月份取季节应拒绝越界月份，不应默认归入冬季', () => {
  assert.equal(MeihuaHelpers.getSeasonByMonth(12), '冬');
  assert.throws(() => MeihuaHelpers.getSeasonByMonth(0), /月份必须是 1-12/);
  assert.throws(() => MeihuaHelpers.getSeasonByMonth(13), /月份必须是 1-12/);
});

test('梅花：低层时间起卦应拒绝坏农历月日和坏时支', () => {
  const validGanzhi = { year: '甲辰', month: '丁丑', day: '庚午', hour: '庚辰' };
  const validLunar = {
    yearInChinese: '农历甲辰',
    monthNumber: 12,
    dayNumber: 2,
  } as Parameters<typeof resolveTimeMethod>[1];

  assert.throws(
    () => resolveTimeMethod(validGanzhi, { ...validLunar, monthNumber: 13 }),
    /农历月份必须是 1-12/,
  );
  assert.throws(
    () => resolveTimeMethod(validGanzhi, { ...validLunar, dayNumber: 31 }),
    /农历日期必须是 1-30/,
  );
  assert.throws(
    () => resolveTimeMethod({ ...validGanzhi, hour: '庚A' }, validLunar),
    /无法识别时支/,
  );
  assert.throws(() => resolveNumberMethod(1, 'A'), /数字起卦无法识别起卦时辰/);
});

test('梅花：五行关系 helper 应拒绝非法五行，不应返回未知', () => {
  assert.equal(MeihuaHelpers.getElementRelation('火', '木'), '体生用');
  assert.throws(() => MeihuaHelpers.getElementRelation('', '木'), /用卦五行无效/);
  assert.throws(() => MeihuaHelpers.getElementSeasonState('风', '春'), /目标五行无效/);
});
