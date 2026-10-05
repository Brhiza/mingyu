import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { getBaziQiongtongAdvice } from 'mingyu-core/classics';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer';
import { MingluPatternUsefulGodSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPatternUsefulGodSection';

test('《穷通宝鉴》调候资料按原文校正取用先后', () => {
  assert.deepEqual(getBaziQiongtongAdvice('乙', '卯')?.primaryGods, ['丙', '癸']);
  assert.deepEqual(getBaziQiongtongAdvice('辛', '亥')?.primaryGods, ['壬', '丙']);
  assert.deepEqual(getBaziQiongtongAdvice('壬', '午')?.primaryGods, ['癸', '庚']);
  assert.deepEqual(getBaziQiongtongAdvice('癸', '卯')?.primaryGods, ['庚', '辛']);
  assert.deepEqual(getBaziQiongtongAdvice('癸', '巳')?.primaryGods, ['辛', '庚']);
});

test('乙酉条保留白露与秋分后的不同取用条件', () => {
  const entry = getBaziQiongtongAdvice('乙', '酉');
  assert.ok(entry);
  assert.match(entry.classicVerse, /白露之后.*耑用癸水/u);
  assert.match(entry.classicVerse, /秋分后.*宜用丙，癸水次之/u);
  assert.match(entry.seasonSummary, /秋分前.*秋分后/u);
  assert.match(entry.modernExplanation, /白露后.*秋分后/u);
});

test('丙子引文保留壬戊原文且不再列甲为通用取用', () => {
  const entry = getBaziQiongtongAdvice('丙', '子');
  assert.ok(entry);
  assert.equal(entry.classicVerse, '十一月丙火，冬至一阳生，弱中复强，壬水为最，戊土佐之。');
  assert.deepEqual(entry.primaryGods, ['壬', '戊']);
});

test('丙火卯辰月直录本月原文，并区分壬水主用与土局取甲', () => {
  const mao = getBaziQiongtongAdvice('丙', '卯');
  const chen = getBaziQiongtongAdvice('丙', '辰');
  assert.ok(mao);
  assert.ok(chen);
  assert.deepEqual(mao.primaryGods, ['壬']);
  assert.equal(mao.classicVerse, '二月丙火，阳气舒升，耑用壬水。');
  assert.match(mao.modernExplanation, /无壬时.*己土姑用/);
  assert.deepEqual(chen.primaryGods, ['壬', '甲']);
  assert.match(chen.classicVerse, /三月丙火.*或成土局，取甲为辅，壬不可离/u);
  assert.match(chen.modernExplanation, /支成土局才取甲木为辅/u);
});

test('丙火其余六个月各引本月原文，分清主用、替用和随局取用', () => {
  const cases = [
    { branch: '丑', gods: ['壬', '甲'], verse: /^十二月丙火/u },
    { branch: '巳', gods: ['壬', '庚'], verse: /^四月丙火/u },
    { branch: '未', gods: ['壬', '庚'], verse: /^六月丙火/u },
    { branch: '酉', gods: ['壬', '癸'], verse: /^八月丙火/u },
    { branch: '戌', gods: ['甲', '壬', '癸'], verse: /^九月丙火/u },
    { branch: '亥', gods: ['庚', '戊', '壬'], verse: /^总之十月丙火/u },
  ] as const;

  for (const { branch, gods, verse } of cases) {
    const entry = getBaziQiongtongAdvice('丙', branch);
    assert.ok(entry);
    assert.deepEqual(entry.primaryGods, gods);
    assert.match(entry.classicVerse, verse);
    if (branch === '巳') assert.match(entry.modernExplanation, /无壬时.*癸水姑用/u);
    if (branch === '未') assert.match(entry.modernExplanation, /无庚有壬、不见戊出/u);
    if (branch === '酉') assert.match(entry.modernExplanation, /无壬时癸水.*替用/u);
    if (branch === '戌') assert.match(entry.modernExplanation, /无壬且癸透干时.*替用/u);
    if (branch === '亥') assert.match(entry.classicVerse, /木旺宜庚，水旺宜戊，火旺用壬/u);
    if (branch === '丑') assert.match(entry.modernExplanation, /土多时才需甲木/u);
  }
});

test('丁火缺月按本月条文或三冬总论归属，并保留条件取用', () => {
  const cases = [
    { branch: '丑', gods: ['甲', '庚'], verse: /^三冬丁火/u },
    { branch: '寅', gods: ['庚'], verse: /^正月丁火/u },
    { branch: '辰', gods: ['甲', '庚'], verse: /^三月丁火/u },
    { branch: '巳', gods: ['甲', '庚', '戊'], verse: /^四月丁火/u },
    { branch: '未', gods: ['甲', '壬'], verse: /^六月之丁/u },
    { branch: '申', gods: ['甲', '庚', '丙'], verse: /^七月丁火/u },
    { branch: '戌', gods: ['甲', '庚'], verse: /^九月耑用/u },
    { branch: '亥', gods: ['甲', '庚'], verse: /^三冬丁火/u },
  ] as const;

  for (const { branch, gods, verse } of cases) {
    const entry = getBaziQiongtongAdvice('丁', branch);
    assert.ok(entry);
    assert.deepEqual(entry.primaryGods, gods);
    assert.match(entry.classicVerse, verse);
    if (branch === '辰') assert.match(entry.modernExplanation, /支成木局.*庚为先/u);
    if (branch === '巳') assert.match(entry.modernExplanation, /无甲而庚、戊透时.*取戊/u);
    if (branch === '申') assert.match(entry.modernExplanation, /丙火.*可借/u);
    if (branch === '亥' || branch === '丑') assert.match(entry.modernExplanation, /三冬总论/u);
  }
});

test('戊土缺月按明确单月或合写月份原文取用', () => {
  const cases = [
    { branch: '丑', gods: ['丙', '甲'], verse: /^十一二月严寒/u },
    { branch: '寅', gods: ['丙', '甲', '癸'], verse: /^正二月先丙/u },
    { branch: '卯', gods: ['丙', '甲', '癸'], verse: /^正二月先丙/u },
    { branch: '巳', gods: ['甲', '丙', '癸'], verse: /^四月戊土/u },
    { branch: '未', gods: ['癸', '丙', '甲'], verse: /^六月戊土/u },
    { branch: '申', gods: ['丙', '癸', '甲'], verse: /^七月戊土/u },
    { branch: '酉', gods: ['丙', '癸'], verse: /^八月戊土/u },
    { branch: '亥', gods: ['甲', '丙'], verse: /^十月戊土/u },
  ] as const;

  let yinVerse: string | undefined;
  let chouVerse: string | undefined;
  for (const { branch, gods, verse } of cases) {
    const entry = getBaziQiongtongAdvice('戊', branch);
    assert.ok(entry);
    assert.deepEqual(entry.primaryGods, gods);
    assert.match(entry.classicVerse, verse);
    if (branch === '寅') yinVerse = entry.classicVerse;
    if (branch === '卯') assert.equal(yinVerse, entry.classicVerse);
    if (branch === '丑') chouVerse = entry.classicVerse;
    if (branch === '申') assert.match(entry.modernExplanation, /支成水局时.*甲泄水/u);
    if (branch === '酉') assert.match(entry.classicVerse, /不必木疏/u);
  }

  assert.equal(getBaziQiongtongAdvice('戊', '子')?.classicVerse, chouVerse);
});

test('十干十二月调候资料均能由实盘查询并进入释义', () => {
  const branches = ['丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子'];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const tenthDayStems = [...'癸甲癸甲甲乙乙丙丁丁戊戊'];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 10; day <= 19; day += 1) {
      const chart = baziCalculator.calculateBazi({
        year: 2024,
        month,
        day,
        timeIndex: 6,
        gender: 'male',
        useTrueSolarTime: false,
      });
      const stem = chart.dayMaster.gan;
      const branch = chart.pillars.month.zhi;
      assert.equal(stem, stems[(stems.indexOf(tenthDayStems[month - 1]) + day - 10) % 10]);
      assert.equal(branch, branches[month - 1]);
      const key = `${stem}+${branch}`;
      const entry = getBaziQiongtongAdvice(stem, branch);
      assert.ok(entry, key);
      assert.equal(entry.dayMaster, stem);
      assert.equal(entry.monthBranch, branch);
      const section = buildEnhancedPatternUsefulGodSection(chart);
      assert.equal(section.qiongtongAdvice?.title, `${stem}生于${branch}月`);
      assert.deepEqual(section.qiongtongAdvice?.quotes, [entry.classicVerse]);
      assert.equal(section.qiongtongAdvice?.summary, entry.modernExplanation);
    }
  }
  for (const { month, day, stem, branch } of [
    { month: 9, day: 9, stem: '丙', branch: '酉' },
    { month: 10, day: 9, stem: '丙', branch: '戌' },
    { month: 11, day: 8, stem: '丙', branch: '亥' },
    { month: 11, day: 9, stem: '丁', branch: '亥' },
  ]) {
    const chart = baziCalculator.calculateBazi({
      year: 2024,
      month,
      day,
      timeIndex: 6,
      gender: 'male',
      useTrueSolarTime: false,
    });
    assert.equal(chart.dayMaster.gan, stem);
    assert.equal(chart.pillars.month.zhi, branch);
  }

  assert.match(getBaziQiongtongAdvice('乙', '丑')!.classicVerse, /^冬月之木/u);
  assert.match(getBaziQiongtongAdvice('己', '亥')!.modernExplanation, /初冬壬旺时取戊/u);
  assert.match(getBaziQiongtongAdvice('己', '戌')!.modernExplanation, /土盛时另以甲木/u);
  assert.match(getBaziQiongtongAdvice('庚', '未')!.modernExplanation, /土局.*甲先丁后/u);
  assert.match(getBaziQiongtongAdvice('辛', '未')!.modernExplanation, /戊土出干时另以甲木/u);
  assert.match(getBaziQiongtongAdvice('壬', '酉')!.modernExplanation, /无甲才.*另用金.*庚若破甲/u);
  assert.match(getBaziQiongtongAdvice('癸', '辰')!.modernExplanation, /清明后.*谷雨后/u);
  assert.match(getBaziQiongtongAdvice('癸', '未')!.modernExplanation, /上半月.*下半月/u);
});

test('午月丙丁实盘不把条件荐干写成通用调候结论', () => {
  const cases = [
    { day: 10, stem: '丙', primaryGods: ['壬'] },
    { day: 11, stem: '丁', primaryGods: [] },
  ];
  for (const { day, stem, primaryGods } of cases) {
    const chart = baziCalculator.calculateBazi({
      year: 1990,
      month: 6,
      day,
      timeIndex: 5,
      gender: 'male',
      useTrueSolarTime: false,
    });
    assert.equal(chart.dayMaster.gan, stem);
    assert.equal(chart.pillars.month.zhi, '午');
    assert.deepEqual(
      getBaziQiongtongAdvice(chart.dayMaster.gan, chart.pillars.month.zhi)?.primaryGods,
      primaryGods,
    );
  }
  assert.match(getBaziQiongtongAdvice('丁', '午')?.modernExplanation ?? '', /火局.*无火局/u);
  assert.match(getBaziQiongtongAdvice('丁', '酉')?.classicVerse ?? '', /^八月甲丙庚皆用/u);
});

test('命录调候释义补充取用作用，甲巳原文只展示一次', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 19,
    timeIndex: 5,
    gender: 'male',
    useTrueSolarTime: false,
  });
  const section = buildEnhancedPatternUsefulGodSection(result);
  const entry = getBaziQiongtongAdvice('甲', '巳')!;
  assert.equal(section.qiongtongAdvice?.summary, entry.modernExplanation);
  assert.deepEqual(section.qiongtongAdvice?.quotes, [entry.classicVerse]);
  const html = renderToStaticMarkup(
    createElement(MingluPatternUsefulGodSection, { data: section }),
  );
  assert.equal(html.split(entry.classicVerse).length - 1, 1);
  assert.ok(html.includes(entry.modernExplanation));
});
