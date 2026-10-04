import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZhugeNumber, getZhugeInterpretation } from 'mingyu-core/name-number';
import { ZHUGE_SIGNS } from '../packages/core/src/name-number/zhuge-signs.ts';
import { CHARACTER_TUPLES } from '../packages/core/src/name-number/generated-data.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import { buildDivinationPrompt } from '../packages/core/src/prompt/divination.ts';

test('诸葛恢复签谱按本签重取解释并拒绝矛盾的签号和签诗', () => {
  const first = calculateZhugeNumber('隻隻一');
  const second = calculateZhugeNumber('隻隻二');
  assert.deepEqual(first.strokes, [10, 10, 1]);
  assert.equal(first.number, 1);
  assert.equal(second.number, 2);
  const formatters = [
    (data: typeof first) => formatEnhancedDivinationInfo('zhuge', data),
    (data: typeof first) =>
      buildDivinationPrompt({ method: 'zhuge', data, question: '这件事如何推进？' }),
  ];
  for (const format of formatters) {
    const stale = { ...first, interpretation: second.interpretation };
    const prompt = format(stale);
    assert.equal(prompt, format(first));
    assert.match(prompt, /天门一挂榜，预定夺标人，马嘶芳草地，秋高听鹿鸣/u);
    assert.match(prompt, /《诗经·小雅·鹿鸣》/u);
    assert.doesNotMatch(prompt, /兴邦辅国，尊主庇民|神灵庇护/u);
    const legacy = { ...first };
    Reflect.deleteProperty(legacy, 'interpretation');
    assert.equal(format(legacy), prompt);
    for (const conflicting of [
      { ...first, number: 2 },
      { ...first, sign: { ...first.sign, number: 2 } },
      { ...first, sign: { ...first.sign, poem: second.sign.poem } },
    ]) {
      assert.throws(() => format(conflicting), /诸葛签号与签诗资料不一致/u);
    }
  }
});

test('诸葛签诗勉力、舒妍与培养的字词在结果和提示词中一致', () => {
  // 《秘本諸葛神數》电子文本第35、41、102签；仅据此核对这三处读法。
  // https://ctext.org/wiki.pl?chapter=446363&if=en
  for (const [number, text, phrase, meaning] of [
    [35, '夏三正', '勉力今朝度此滩', '勉力是尽力而行'],
    [41, '夏木一', '桃李舒妍', '舒妍写桃李绽放美好姿态'],
    [102, '一夏二', '但须培养元福', '培养元福与惠人助事相接'],
  ] as const) {
    const result = calculateZhugeNumber(text);
    assert.equal(result.number, number);
    assert.ok(result.sign.poem.includes(phrase));
    assert.ok(result.interpretation);
    assert.ok(result.interpretation.imageMeaning.includes(meaning));
    const prompt = formatEnhancedDivinationInfo('zhuge', result);
    assert.ok(prompt.includes(phrase));
    assert.ok(prompt.includes(meaning));
    assert.doesNotMatch(prompt, /琼力|舒姘|堷养/);
  }
});

test('诸葛384签解释逐一对应诗句且传入结果与提示词', () => {
  const digits = new Map<number, string>();
  for (const row of CHARACTER_TUPLES) if (!digits.has(row[2] % 10)) digits.set(row[2] % 10, row[0]);
  const interpretations = new Set<string>();
  for (let number = 1; number <= 384; number++) {
    const text = String(number)
      .padStart(3, '0')
      .split('')
      .map((digit) => digits.get(Number(digit)))
      .join('');
    const result = calculateZhugeNumber(text);
    assert.equal(result.number, number);
    const reading = getZhugeInterpretation(number)!;
    assert.ok(ZHUGE_SIGNS[number - 1].poem.includes(reading.quote));
    assert.ok(reading.imageMeaning.length > 20);
    assert.ok(reading.condition.length > 20);
    assert.equal(result.sign.summary, reading.interpretation);
    assert.deepEqual(result.interpretation, reading);
    interpretations.add(reading.interpretation);
    const prompt = formatEnhancedDivinationInfo('zhuge', result);
    for (const value of Object.values(reading)) assert.ok(prompt.includes(value));
    assert.doesNotMatch(prompt, /undefined|null|referenceUrl/);
    Reflect.deleteProperty(result, 'interpretation');
    assert.equal(formatEnhancedDivinationInfo('zhuge', result), prompt);
  }
  assert.equal(interpretations.size, 384);
});

test('诸葛释义保留完整签谱并拒绝非法签号', () => {
  assert.equal(ZHUGE_SIGNS.length, 384);
  for (const number of [0, 385, 1.5, NaN, -1, Infinity])
    assert.equal(getZhugeInterpretation(number), null);
  assert.match(getZhugeInterpretation(1)!.classicalImage!, /诗经·小雅·鹿鸣/);
  assert.match(getZhugeInterpretation(3)!.classicalImage!, /孟郊《登科后》/);
  assert.match(getZhugeInterpretation(69)!.classicalImage!, /沈既济《枕中记》.*主人蒸黍未熟/);
  assert.match(getZhugeInterpretation(70)!.classicalImage!, /周易·蛊·彖传.*终则有始/);
  assert.match(getZhugeInterpretation(96)!.classicalImage!, /论语·泰伯.*临大节/);
  assert.match(getZhugeInterpretation(99)!.classicalImage!, /殷芸《小说》.*兼取三愿/);
  assert.match(getZhugeInterpretation(100)!.classicalImage!, /庄子·列御寇.*龙醒/);
  assert.match(getZhugeInterpretation(116)!.classicalImage!, /苏轼《满庭芳》.*蜗角虚名/);
  assert.match(getZhugeInterpretation(148)!.classicalImage!, /论语·季氏.*学诗、学礼/);
  assert.match(getZhugeInterpretation(155)!.classicalImage!, /周易·鼎.*承载失当/);
  assert.match(getZhugeInterpretation(186)!.classicalImage!, /新唐书·薛仁贵传.*精确行动/);
  assert.match(getZhugeInterpretation(189)!.classicalImage!, /世说新语·假谲.*水源/);
  assert.match(getZhugeInterpretation(213)!.classicalImage!, /论语·述而.*颜渊/);
  assert.match(getZhugeInterpretation(225)!.classicalImage!, /周易·明夷.*垂其翼/);
  assert.match(getZhugeInterpretation(245)!.classicalImage!, /道德经.*功遂身退/);
  assert.match(getZhugeInterpretation(249)!.classicalImage!, /秦韬玉《贫女》.*付出/);
  assert.match(getZhugeInterpretation(282)!.classicalImage!, /尚书·尧典.*仲秋/);
  assert.match(getZhugeInterpretation(293)!.classicalImage!, /楚辞·卜居.*鸡鹜争食/);
  assert.match(getZhugeInterpretation(315)!.classicalImage!, /诗经·小雅·伐木.*求友/);
  assert.match(getZhugeInterpretation(327)!.classicalImage!, /周易·革.*其文蔚也/);
  assert.match(getZhugeInterpretation(332)!.classicalImage!, /诗经·小雅·小旻.*如履薄冰/);
  assert.match(getZhugeInterpretation(340)!.classicalImage!, /刘禹锡《乌衣巷》.*世事变迁/);
  assert.match(getZhugeInterpretation(354)!.classicalImage!, /史记·老子韩非列传.*良贾深藏若虚/);
  assert.match(getZhugeInterpretation(362)!.classicalImage!, /周易·既济.*初吉终乱/);
  assert.match(getZhugeInterpretation(380)!.classicalImage!, /论语·述而.*内在之乐/);
  assert.match(getZhugeInterpretation(384)!.classicalImage!, /左传·宣公二年.*过而能改/);
});

test('诸葛提示词只保留签谱资料字段', () => {
  const digitCharacters = new Map<number, string>();
  for (const row of CHARACTER_TUPLES)
    if (!digitCharacters.has(row[2] % 10)) digitCharacters.set(row[2] % 10, row[0]);
  const result = calculateZhugeNumber(
    [0, 0, 1].map((digit) => digitCharacters.get(digit)!).join(''),
  );
  const prompt = formatEnhancedDivinationInfo('zhuge', result);
  assert.equal(result.number, 1);
  assert.match(prompt, new RegExp(`签号：第${result.number}签`));
  assert.match(prompt, /签诗：/);
  assert.match(prompt, /典故：/);
  assert.match(prompt, /基础解签：/);
  assert.match(prompt, /补充解释：/);
  assert.doesNotMatch(
    prompt,
    /占法：|所写三字：|康熙笔画：|取数：|基础解意：|诗句取象：|典故取象：/,
  );
});
