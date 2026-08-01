import test from 'node:test';
import assert from 'node:assert/strict';

import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter.ts';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { TEN_GODS_DEFINITIONS } from '../packages/core/src/bazi/baziElementData.ts';
import {
  analyzeBaziKinship,
  KINSHIP_FACT_LIMITATION,
  type BaziKinshipInput,
} from '../packages/core/src/bazi/baziKinship.ts';

const baseInput: BaziKinshipInput = {
  gender: 'male',
  pillars: {
    year: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
    month: { gan: '庚', zhi: '子', ganZhi: '庚子' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  },
  tenGods: {
    year: '正财',
    month: '偏财',
    day: '比肩',
    hour: '七杀',
  },
  hiddenStems: {
    year: ['己', '癸', '辛'],
    month: ['癸'],
    day: ['甲', '丙', '戊'],
    hour: ['戊', '乙', '癸'],
  },
  hiddenTenGods: {
    year: ['伤官', '正官', '正财'],
    month: ['正官'],
    day: ['偏印', '比肩', '食神'],
    hour: ['食神', '正印', '正官'],
  },
};

test('八字六亲宫位应固定映射年祖、月父母、日支配偶、时支子息', () => {
  const facts = analyzeBaziKinship(baseInput);
  const palaces = facts.filter((item) => item.kind === '宫位');

  assert.equal(facts.length, 9);
  assert.deepEqual(
    palaces.map((item) => [item.subject, item.locations]),
    [
      ['祖辈', ['年柱辛丑']],
      ['父母', ['月柱庚子']],
      ['配偶', ['日支寅']],
      ['子息', ['时支辰']],
    ],
  );
  assert.ok(palaces.every((item) => item.limitation === KINSHIP_FACT_LIMITATION));
});

test('八字六亲十神应逐项保留明透与藏干位置', () => {
  const facts = analyzeBaziKinship(baseInput);
  const mother = facts.find((item) => item.key === 'bazi:kinship:ten-god:mother');
  const father = facts.find((item) => item.key === 'bazi:kinship:ten-god:father');
  const brother = facts.find((item) => item.key === 'bazi:kinship:ten-god:brother');
  const children = facts.find((item) => item.key === 'bazi:kinship:ten-god:children');

  assert.deepEqual(mother?.locations, ['时柱藏干乙（正印）']);
  assert.deepEqual(father?.locations, ['月柱天干庚（偏财）']);
  assert.deepEqual(brother?.locations, ['日柱天干丙（比肩）', '日柱藏干丙（比肩）']);
  assert.deepEqual(children?.locations, [
    '时柱天干壬（七杀）',
    '年柱藏干癸（正官）',
    '月柱藏干癸（正官）',
    '时柱藏干癸（正官）',
  ]);

  const missingFather = analyzeBaziKinship({
    ...baseInput,
    tenGods: { ...baseInput.tenGods, month: '食神' },
  }).find((item) => item.key === 'bazi:kinship:ten-god:father');
  assert.equal(missingFather?.status, '未见对应十神');
  assert.match(missingFather?.promptText || '', /十神缺位不等于现实中没有该亲属/);
});

test('男命妻星只扫描年、月、时干财星，不把日干或藏干计入妻星', () => {
  const facts = analyzeBaziKinship(baseInput);
  const wife = facts.find((item) => item.key === 'bazi:kinship:ten-god:wife');

  assert.equal(wife?.status, '已记录');
  assert.deepEqual(wife?.locations, ['年柱天干辛（正财）', '月柱天干庚（偏财）']);
  assert.doesNotMatch(wife?.locations.join('、') || '', /日柱|藏干/);

  const onlyDayAndHiddenFinance: BaziKinshipInput = {
    ...baseInput,
    tenGods: { ...baseInput.tenGods, year: '正印', month: '食神', day: '正财', hour: '正官' },
  };
  const missingWife = analyzeBaziKinship(onlyDayAndHiddenFinance).find(
    (item) => item.key === 'bazi:kinship:ten-god:wife',
  );
  assert.equal(missingWife?.status, '未见对应十神');
  assert.deepEqual(missingWife?.locations, []);
  assert.match(missingWife?.promptText || '', /年、月、时干未见正财、偏财/);
  assert.match(missingWife?.promptText || '', /不等于现实中没有该亲属/);
});

test('女命不得套用男命妻星规则或自行改写丈夫星', () => {
  const facts = analyzeBaziKinship({ ...baseInput, gender: 'female' });
  const wife = facts.find((item) => item.key === 'bazi:kinship:ten-god:wife');

  assert.equal(wife?.status, '需另按女命口径复核');
  assert.deepEqual(wife?.locations, []);
  assert.match(wife?.promptText || '', /当前为坤造/);
  assert.match(wife?.promptText || '', /不把财星直接改写成丈夫星/);
});

test('性别未记录时不得误称坤造或套用任一配偶星口径', () => {
  const facts = analyzeBaziKinship({ ...baseInput, gender: '' });
  const wife = facts.find((item) => item.key === 'bazi:kinship:ten-god:wife');

  assert.equal(wife?.status, '需另按性别口径复核');
  assert.deepEqual(wife?.locations, []);
  assert.match(wife?.promptText || '', /当前性别未记录/);
  assert.doesNotMatch(wife?.promptText || '', /当前为坤造/);
});

test('六亲事实应贯穿本命证据、汇总、限制与最终提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 8,
    gender: 'male',
  });
  const evidence = result.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.kinshipFacts.length, 9);
  assert.equal(evidence.summaryFact.kinshipFactCount, 9);
  assert.ok(
    evidence.limitationFacts.some(
      (item) => item.type === '六亲取象边界' && item.promptText === KINSHIP_FACT_LIMITATION,
    ),
  );
  assert.ok(evidence.evidence.items.filter((item) => item.tags.includes('六亲')).length === 9);
  assert.ok(evidence.supportingFacts.some((item) => item.includes('年柱祖辈宫')));
  assert.match(evidence.promptText, /六亲取象9项/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /【六亲宫星取象】/);
  assert.match(prompt, /宫分: 年柱祖辈宫：乙亥/);
  assert.match(prompt, /十神缺位不等于现实中没有该亲属/);
  assert.match(prompt, /不得由单柱、单一十神或缺位直接断定亲属有无/);
});

test('十神基础文案只登记五行与阴阳映射，不输出人物类象或性格结论', () => {
  const descriptions = Object.values(TEN_GODS_DEFINITIONS)
    .map((item) => item.description)
    .join('\n');

  assert.doesNotMatch(
    descriptions,
    /兄弟|同辈|竞争者|父亲|妻|配偶|子女|母亲|继母|情人|异性朋友|福气|才华|温和|叛逆|聪明|傲气/,
  );
  assert.ok(
    Object.values(TEN_GODS_DEFINITIONS).every((item) =>
      item.description.endsWith('这里只登记固定映射。'),
    ),
  );
});
