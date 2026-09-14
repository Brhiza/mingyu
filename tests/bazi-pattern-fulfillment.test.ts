import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import type { Pillars } from '../packages/core/src/bazi/baziTypes';

function pillars(values: [string, string, string, string]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      {
        gan: values[index][0],
        zhi: values[index][1],
        ganZhi: values[index],
      },
    ]),
  ) as unknown as Pillars;
}

test('正官见伤印财保留柱位与相碍条件，透印本身不判破而复成', () => {
  const chart = pillars(['壬申', '己酉', '甲子', '丁卯']);
  const result = evaluatePatternFulfillment(chart, '甲', '正官格', getTenGod);
  assert.equal(result.status, '未判定');
  assert.match(result.contradiction, /正官与伤官同见/);
  assert.ok(
    result.remedies.some(
      (item) => item.stem === '壬' && item.pillar === 'year' && item.placement === '透干',
    ),
  );
  assert.ok(result.remedies.some((item) => item.stem === '己' && item.tenGod === '正财'));
  assert.match(result.conditions!.join('；'), /财印.*各起作用/);
  assert.match(result.evidence!.join('；'), /月柱己酉.*月柱藏干辛（正官）/);
  assert.doesNotMatch(JSON.stringify(result), /紧贴克官|格局大成|仕途稳健|富贵自天来/);
  const changed = evaluatePatternFulfillment(
    pillars(['壬午', '己酉', '甲子', '丁卯']),
    '甲',
    '正官格',
    getTenGod,
  );
  assert.match(changed.evidence![0], /年柱壬午/);
  assert.doesNotMatch(changed.evidence![0], /藏干壬/);
  assert.notDeepEqual(changed.evidence, result.evidence);
});

test('食印并见的七杀格保留两条取用与印制食反证', () => {
  const result = evaluatePatternFulfillment(
    pillars(['丙午', '庚申', '甲辰', '壬申']),
    '甲',
    '七杀格',
    getTenGod,
  );
  assert.equal(result.status, '成格');
  assert.ok(
    result.remedies.some(
      (item) => item.stem === '丙' && item.pillar === 'year' && item.effect.includes('食神制杀'),
    ),
  );
  assert.ok(
    result.remedies.some(
      (item) => item.stem === '壬' && item.pillar === 'hour' && item.effect.includes('杀印相生'),
    ),
  );
  assert.match(result.contradiction, /印制食.*制杀/);
  assert.match(
    result.pathEvaluations?.find((path) => path.key === '印化杀')?.detail ?? '',
    /七杀生印=.*印星生身=/,
  );
  const withoutExposedYin = evaluatePatternFulfillment(
    pillars(['丙午', '庚申', '甲寅', '乙亥']),
    '甲',
    '七杀格',
    getTenGod,
  );
  assert.ok(
    withoutExposedYin.remedies.some((item) => item.stem === '壬' && item.placement === '藏干'),
  );
  assert.ok(
    !withoutExposedYin.remedies.some((item) => item.tenGod === '偏印' && item.placement === '透干'),
  );
});

test('财、食、印和禄劫取用保留实际候选，成败不由十神数量代替', () => {
  const cases = [
    {
      chart: ['甲子', '戊辰', '乙丑', '丙戌'],
      day: '乙',
      name: '正财格',
      path: '泄比生财',
      stem: '丙',
    },
    {
      chart: ['庚申', '甲申', '丙午', '戊子'],
      day: '丙',
      name: '食神格',
      path: '制枭护食',
      stem: '庚',
    },
    {
      chart: ['戊子', '癸亥', '甲寅', '庚申'],
      day: '甲',
      name: '正印格',
      path: '生印',
      stem: '庚',
    },
    {
      chart: ['甲寅', '丙寅', '甲戌', '乙卯'],
      day: '甲',
      name: '建禄格',
      path: '泄秀',
      stem: '丙',
    },
  ];
  for (const item of cases) {
    const result = evaluatePatternFulfillment(
      pillars(item.chart as [string, string, string, string]),
      item.day,
      item.name,
      getTenGod,
    );
    assert.ok(
      result.remedies.some((r) => r.stem === item.stem && r.effect.includes(item.path)),
      item.name,
    );
    assert.ok(result.conditions!.length > 0);
  }
  const monthJie = evaluatePatternFulfillment(
    pillars(['甲寅', '乙卯', '甲戌', '乙亥']),
    '甲',
    '劫财格',
    getTenGod,
  );
  assert.match(monthJie.basis, /禄劫刃/);
  assert.doesNotMatch(monthJie.basis, /^财格/);
  const noCompanion = evaluatePatternFulfillment(
    pillars(['丙午', '戊戌', '乙酉', '辛巳']),
    '乙',
    '正财格',
    getTenGod,
  );
  assert.ok(noCompanion.remedies.some((item) => item.effect.includes('食伤生财')));
  assert.doesNotMatch(JSON.stringify(noCompanion.remedies), /泄比|制比/);
});

test('未见格神或未知格局时不生成其他格局的救应', () => {
  const chart = pillars(['甲子', '乙卯', '甲寅', '乙卯']);
  const knownPattern = evaluatePatternFulfillment(chart, '甲', '正官格', getTenGod);
  assert.equal(knownPattern.status, '平常');
  assert.deepEqual(knownPattern.remedies, []);
  assert.equal(knownPattern.contradiction, '');
  assert.equal(knownPattern.evidence!.length, 4);
  const unknownPattern = evaluatePatternFulfillment(chart, '甲', '其他格局', getTenGod);
  assert.equal(unknownPattern.status, '未判定');
  assert.deepEqual(unknownPattern.remedies, []);
  assert.equal(unknownPattern.contradiction, '');
  assert.equal(unknownPattern.evidence!.length, 4);
  const yinDay = evaluatePatternFulfillment(
    pillars(['甲子', '辛未', '乙卯', '庚辰']),
    '乙',
    '正官格',
    getTenGod,
  );
  assert.match(yinDay.contradiction, /官杀同见/);
  assert.ok(!yinDay.remedies.some((item) => item.tenGod === '劫财'));
  const yangDay = evaluatePatternFulfillment(
    pillars(['乙丑', '庚辰', '甲寅', '辛未']),
    '甲',
    '正官格',
    getTenGod,
  );
  assert.ok(
    yangDay.remedies.some(
      (item) =>
        item.stem === '乙' && item.effect.includes('庚') && item.effect.includes('五合关系'),
    ),
  );
});

test('七杀格只在食神制杀路径双方有根且未被合绊时成格', () => {
  const valid = evaluatePatternFulfillment(
    // 丙年与庚月紧贴，且丙以午中丁、庚以申中庚为同类稳定根，满足当前直接路径口径。
    pillars(['丙午', '庚申', '甲辰', '戊辰']),
    '甲',
    '七杀格',
    getTenGod,
    { strengthStatus: '身强' },
  );
  assert.equal(valid.status, '成格');
  assert.match(
    valid.pathEvaluations?.find((path) => path.key === '食神制杀')?.detail ?? '',
    /有稳定根气.*紧贴/,
  );

  // 丙在时、庚在月虽均有根，但中隔日柱；只记录隔位事实，不冒充已闭合制杀。
  const separated = evaluatePatternFulfillment(
    pillars(['戊辰', '庚申', '甲辰', '丙午']),
    '甲',
    '七杀格',
    getTenGod,
    { strengthStatus: '身强' },
  );
  assert.equal(separated.status, '未判定');
  assert.equal(
    separated.pathEvaluations?.find((path) => path.key === '食神制杀')?.status,
    '资料不足',
  );
  assert.ok(
    separated.rootEvidence?.some(
      (item) =>
        item.stem === '丙' &&
        item.pillar === 'hour' &&
        item.rootType === '同类根' &&
        item.rootPositions.includes('时柱午藏丁（本气）'),
    ),
  );

  // 丙食神虽透且有巳根，但被时干辛以丙辛合绊；不能把“食神出现”当成有效制杀。
  const blocked = evaluatePatternFulfillment(
    pillars(['丙午', '庚申', '甲辰', '辛丑']),
    '甲',
    '七杀格',
    getTenGod,
    { strengthStatus: '身强' },
  );
  assert.equal(blocked.status, '未判定');
  assert.equal(blocked.pathEvaluations?.find((path) => path.key === '食神制杀')?.status, '不满足');
  assert.match(
    blocked.interactionEvidence?.find(
      (item) => item.type === '天干五合' && item.source.includes('年柱丙'),
    )?.detail ?? '',
    /合而不化|合绊/,
  );
});

test('正官见伤官时只有有效印制才能记为破而复成', () => {
  const broken = evaluatePatternFulfillment(
    pillars(['丁巳', '己酉', '甲子', '辛酉']),
    '甲',
    '正官格',
    getTenGod,
  );
  assert.equal(broken.status, '未判定');
  assert.equal(broken.pathEvaluations?.find((path) => path.key === '印制伤官')?.status, '资料不足');

  const repaired = evaluatePatternFulfillment(
    // 结构 helper：癸月与丁年紧贴，癸以日支子、丁以年支巳为根；辛时为明透正官，酉月提供月令。
    // 该四柱用于作用链单测，不宣称来自一组真实公历出生时刻。
    pillars(['丁巳', '癸酉', '甲子', '辛酉']),
    '甲',
    '正官格',
    getTenGod,
    { strengthStatus: '身强' },
  );
  assert.equal(repaired.status, '破而复成');
  assert.equal(repaired.pathEvaluations?.find((path) => path.key === '印制伤官')?.status, '满足');
  assert.match(
    repaired.conditionFacts?.find((fact) => fact.key === 'pattern.target')?.detail ?? '',
    /透干/,
  );
});

test('正偏印格均以财星破印为破格关系，食神不冒充偏印格破格神', () => {
  const result = evaluatePatternFulfillment(
    // 结构 helper：乙亥月令藏壬为偏印，年干壬透，丙食神虽透，但偏印格仍按财星破印核验。
    pillars(['壬申', '乙亥', '甲子', '丙寅']),
    '甲',
    '偏印格',
    getTenGod,
  );
  assert.equal(result.status, '成格');
  assert.match(result.basis, /正印、偏印同归印格/);
  assert.doesNotMatch(result.contradiction, /枭神夺食/);
  assert.ok(!result.pathEvaluations?.some((path) => path.label.includes('枭神')));
  assert.match(result.conditions!.join('；'), /枭神夺食只在食神格/);
});

test('财格比劫夺财的反例需有食伤或官杀有效承接', () => {
  const repaired = evaluatePatternFulfillment(
    // 丙年、戊月紧贴，甲劫财时支寅有根，食伤生财路径可直接核验。
    pillars(['丙午', '戊辰', '乙丑', '甲寅']),
    '乙',
    '正财格',
    getTenGod,
  );
  assert.equal(repaired.status, '未判定');
  assert.equal(
    repaired.pathEvaluations?.find((path) => path.key === '比劫泄秀生财')?.status,
    '资料不足',
  );
  assert.equal(repaired.pathEvaluations?.find((path) => path.key === '食伤生财')?.status, '满足');

  const broken = evaluatePatternFulfillment(
    pillars(['乙卯', '己未', '甲子', '癸未']),
    '甲',
    '正财格',
    getTenGod,
  );
  assert.equal(broken.status, '破格');
  assert.match(broken.summary, /比劫夺财|破格/);
});

test('真实排盘财格虽具格神条件，身承不足仍保留未判定', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 12,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.pillars).map(([key, pillar]) => [key, pillar.ganZhi])),
    { year: '己未', month: '丁丑', day: '甲申', hour: '庚午' },
  );
  assert.equal(result.analysis.mingGe.pattern, '杂气正财格');
  assert.equal(result.analysis.dayMasterStrength.status, '偏弱');
  assert.equal(result.analysis.mingGe.fulfillment?.status, '未判定');
  assert.equal(
    result.analysis.mingGe.fulfillment?.conditionFacts?.find(
      (fact) => fact.key === 'bazi.day-master-strength',
    )?.status,
    '满足',
  );
  assert.equal(
    result.analysis.mingGe.fulfillment?.conditionFacts?.find(
      (fact) => fact.key === 'pattern.target',
    )?.status,
    '满足',
  );
  assert.equal(
    result.analysis.mingGe.fulfillment?.conditionFacts?.find(
      (fact) => fact.key === 'bazi.wealth-bearing',
    )?.status,
    '不满足',
  );
});

test('真实排盘的正印格成格例保留已知中和状态', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 2,
    timeIndex: 9,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.pillars).map(([key, pillar]) => [key, pillar.ganZhi])),
    { year: '己未', month: '丙子', day: '甲戌', hour: '癸酉' },
  );
  assert.equal(result.analysis.mingGe.pattern, '正印格');
  assert.equal(result.analysis.dayMasterStrength.status, '中和');
  assert.equal(result.analysis.mingGe.fulfillment?.status, '成格');
  const strengthFact = result.analysis.mingGe.fulfillment?.conditionFacts?.find(
    (fact) => fact.key === 'bazi.day-master-strength',
  );
  assert.equal(strengthFact?.status, '满足');
  assert.match(strengthFact?.detail ?? '', /日主旺衰资料：中和（已提供）/);
});

test('真实排盘的正官伤官反例保留隔位与根气边界', () => {
  const separated = baziCalculator.calculateBazi({
    year: 2013,
    month: 9,
    day: 15,
    timeIndex: 3,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(separated.pillars).map(([key, pillar]) => [key, pillar.ganZhi]),
    ),
    { year: '癸巳', month: '辛酉', day: '甲申', hour: '丁卯' },
  );
  assert.equal(separated.analysis.mingGe.fulfillment?.status, '未判定');
  assert.equal(
    separated.analysis.mingGe.fulfillment?.pathEvaluations?.find((path) => path.key === '印制伤官')
      ?.status,
    '资料不足',
  );
  assert.equal(
    separated.analysis.mingGe.fulfillment?.pathEvaluations?.find((path) => path.key === '印制伤官')
      ?.position,
    '隔位',
  );

  const broken = baziCalculator.calculateBazi({
    year: 2013,
    month: 9,
    day: 25,
    timeIndex: 3,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(broken.pillars).map(([key, pillar]) => [key, pillar.ganZhi])),
    { year: '癸巳', month: '辛酉', day: '甲午', hour: '丁卯' },
  );
  assert.equal(broken.analysis.mingGe.fulfillment?.status, '破格');
  assert.equal(
    broken.analysis.mingGe.fulfillment?.pathEvaluations?.find((path) => path.key === '印制伤官')
      ?.status,
    '不满足',
  );
  assert.match(
    broken.analysis.mingGe.fulfillment?.pathEvaluations?.find((path) => path.key === '印制伤官')
      ?.detail ?? '',
    /来源无稳定根/,
  );
});
