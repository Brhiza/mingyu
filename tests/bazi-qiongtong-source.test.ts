import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { getBaziQiongtongAdvice } from 'mingyu-core/classics';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';
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
  const climateCases = [
    {
      name: '丙寅',
      month: 2,
      day: 12,
      pillars: ['甲辰', '丙寅', '丙午', '甲午'],
      id: 'yin-month-bing-ren-geng-first',
      stems: ['壬', '庚'],
      order: ['水', '金'],
      verse: /取壬为尊，庚金佐之/u,
    },
    {
      name: '丙卯',
      month: 3,
      day: 13,
      pillars: ['甲辰', '丁卯', '丙子', '甲午'],
      id: 'mao-month-bing-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /耑用壬水/u,
    },
    {
      name: '丙辰',
      month: 4,
      day: 12,
      pillars: ['甲辰', '戊辰', '丙午', '甲午'],
      id: 'chen-month-bing-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /用壬水.*壬不可离/u,
    },
    {
      name: '丙酉',
      month: 9,
      day: 19,
      pillars: ['甲辰', '癸酉', '丙戌', '甲午'],
      id: 'you-month-bing-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /仍用壬水辅映/u,
    },
    {
      name: '丙戌',
      month: 10,
      day: 19,
      pillars: ['甲辰', '甲戌', '丙辰', '甲午'],
      id: 'xu-month-bing-jia-ren-first',
      stems: ['甲', '壬'],
      order: ['木', '水'],
      verse: /先用甲木，次取壬水/u,
    },
    {
      name: '丁酉',
      month: 9,
      day: 10,
      pillars: ['甲辰', '癸酉', '丁丑', '丙午'],
      id: 'you-month-ding-jia-geng-bing',
      stems: ['甲', '庚', '丙'],
      order: ['木', '金', '火'],
      verse: /八月甲丙庚皆用/u,
    },
    {
      name: '戊申',
      month: 8,
      day: 12,
      pillars: ['甲辰', '壬申', '戊申', '戊午'],
      id: 'shen-month-wu-bing-gui-jia-first',
      stems: ['丙', '癸', '甲'],
      order: ['火', '水', '木'],
      verse: /先丙后癸，甲木次之/u,
    },
    {
      name: '戊酉',
      month: 9,
      day: 11,
      pillars: ['甲辰', '癸酉', '戊寅', '戊午'],
      id: 'you-month-wu-bing-gui-first',
      stems: ['丙', '癸'],
      order: ['火', '水'],
      verse: /先丙后癸，不必木疏/u,
    },
    {
      name: '己未',
      month: 7,
      day: 14,
      pillars: ['甲辰', '辛未', '己卯', '庚午'],
      id: 'wei-month-ji-gui-bing-first',
      stems: ['癸', '丙'],
      order: ['水', '火'],
      verse: /取癸为要，次用丙火/u,
    },
    {
      name: '辛寅',
      month: 2,
      day: 17,
      pillars: ['甲辰', '丙寅', '辛亥', '甲午'],
      id: 'yin-month-xin-ji-ren-first',
      stems: ['己', '壬', '庚'],
      order: ['土', '水', '金'],
      verse: /先己后壬.*庚为佐/u,
    },
    {
      name: '辛卯',
      month: 3,
      day: 18,
      pillars: ['甲辰', '丁卯', '辛巳', '甲午'],
      id: 'mao-month-xin-ren-first',
      stems: ['壬'],
      order: ['水'],
      verse: /壬水为尊/u,
    },
    {
      name: '辛辰',
      month: 4,
      day: 27,
      pillars: ['甲辰', '戊辰', '辛酉', '甲午'],
      id: 'chen-month-xin-ren-jia-first',
      stems: ['壬', '甲'],
      order: ['水', '木'],
      verse: /先壬后甲/u,
    },
    {
      name: '癸午',
      month: 6,
      day: 18,
      pillars: ['甲辰', '庚午', '癸丑', '戊午'],
      id: 'wu-month-gui-geng-xin-ren-reference',
      stems: ['庚', '辛', '壬'],
      order: ['金'],
      verse: /庚辛壬参酌并用/u,
    },
    {
      name: '癸未',
      month: 7,
      day: 18,
      pillars: ['甲辰', '辛未', '癸未', '戊午'],
      id: 'wei-month-gui-geng-xin-first',
      stems: ['庚', '辛'],
      order: ['金'],
      verse: /上半月庚辛休囚.*专用庚辛/u,
    },
  ] as const;
  const fireClimateCases = [
    {
      month: 8,
      day: 10,
      pillars: ['甲辰', '壬申', '丙午', '甲午'],
      ruleId: 'shen-month-bing-wu-xin-first',
      stems: ['壬'],
      order: ['水'],
      hint: /取壬映光；壬多时取戊/u,
    },
    {
      month: 1,
      day: 13,
      pillars: ['癸卯', '乙丑', '丙子', '甲午'],
      ruleId: 'chou-month-bing-wu-xin-first',
      stems: ['壬'],
      order: ['水'],
      hint: /喜壬为用；土多时还须甲/u,
    },
    {
      month: 2,
      day: 13,
      pillars: ['甲辰', '丙寅', '丁未', '丙午'],
      ruleId: 'yin-month-ding-geng-chop-jia',
      stems: ['庚'],
      order: ['金', '木'],
      hint: /庚劈甲引丁/u,
    },
    {
      month: 3,
      day: 14,
      pillars: ['甲辰', '丁卯', '丁丑', '丙午'],
      ruleId: 'mao-month-ding-jia-geng-first',
      stems: ['庚', '甲'],
      order: ['金', '木'],
      hint: /先庚去乙，后甲引丁/u,
    },
    {
      month: 5,
      day: 13,
      pillars: ['甲辰', '己巳', '丁丑', '丙午'],
      ruleId: 'si-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /甲引丁、庚劈甲；甲多时庚为先/u,
    },
    {
      month: 7,
      day: 12,
      pillars: ['甲辰', '辛未', '丁丑', '丙午'],
      ruleId: 'wei-month-ding-geng-jia-first',
      stems: ['甲', '壬'],
      order: ['木', '水'],
      hint: /专取甲木，壬水次之/u,
    },
    {
      month: 8,
      day: 11,
      pillars: ['甲辰', '壬申', '丁未', '丙午'],
      ruleId: 'shen-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /甲木为主、庚劈甲引丁，可借丙/u,
    },
    {
      month: 10,
      day: 10,
      pillars: ['甲辰', '甲戌', '丁未', '丙午'],
      ruleId: 'xu-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /专用甲庚，甲引丁、庚劈甲/u,
    },
    {
      month: 11,
      day: 19,
      pillars: ['甲辰', '乙亥', '丁亥', '丙午'],
      ruleId: 'hai-month-ding-geng-jia-first',
      stems: ['甲', '庚'],
      order: ['木', '金'],
      hint: /甲木为尊，庚金为佐/u,
    },
  ] as const;
  const woodMetalClimateCases = [
    {
      month: 8,
      day: 18,
      dayStem: '甲',
      monthBranch: '申',
      ruleId: 'shen-month-jia-bing-gui-first',
      stems: ['丁', '庚'],
      order: ['火', '金'],
      wording: /丁火为尊.*庚金次之/u,
    },
    {
      month: 11,
      day: 16,
      dayStem: '甲',
      monthBranch: '亥',
      ruleId: 'hai-month-jia-bing-gui-first',
      stems: ['庚', '丁', '丙'],
      order: ['金', '火'],
      wording: /庚金与丁火为要.*丙火次之/u,
    },
    {
      month: 11,
      day: 17,
      dayStem: '乙',
      monthBranch: '亥',
      ruleId: 'hai-month-yi-bing-gui-first',
      stems: ['丙', '戊'],
      order: ['火', '土'],
      wording: /丙火为用.*戊土次之/u,
    },
    {
      month: 8,
      day: 14,
      dayStem: '庚',
      monthBranch: '申',
      ruleId: 'shen-month-geng-jia-bing-first',
      stems: ['丁', '甲'],
      order: ['火', '木'],
      wording: /丁火煅炼.*甲木引丁/u,
    },
    {
      month: 10,
      day: 13,
      dayStem: '庚',
      monthBranch: '戌',
      ruleId: 'xu-month-geng-jia-ren',
      stems: ['甲', '壬'],
      order: ['木', '水'],
      wording: /甲木疏厚土为先.*壬水洗金为后/u,
    },
  ] as const;
  const earthClimateCases = [
    {
      month: 2,
      day: 15,
      dayStem: '己',
      monthBranch: '寅',
      id: 'yin-month-ji-bing-jia-first',
      stems: ['丙'],
      order: ['火'],
      label: /丙火为尊/u,
      verse: /正月己土.*故丙为尊/u,
    },
    {
      month: 8,
      day: 13,
      dayStem: '己',
      monthBranch: '申',
      id: 'shen-month-ji-bing-jia-first',
      stems: ['癸', '丙', '辛'],
      order: ['水', '火', '金'],
      label: /先癸后丙/u,
      verse: /三秋己土，先癸后丙，取辛辅癸/u,
    },
    {
      month: 5,
      day: 14,
      dayStem: '戊',
      monthBranch: '巳',
      id: 'si-month-wu-gui-bing-first',
      stems: ['甲', '丙', '癸'],
      order: ['木', '火', '水'],
      label: /甲先丙癸为佐/u,
      verse: /四月戊土.*先用甲疏噼，次取丙癸为佐/u,
    },
    {
      month: 11,
      day: 10,
      dayStem: '戊',
      monthBranch: '亥',
      id: 'hai-month-wu-bing-jia-first',
      stems: ['甲', '丙'],
      order: ['木', '火'],
      label: /先甲后丙/u,
      verse: /十月戊土.*先用甲木，次取丙火/u,
    },
    {
      month: 5,
      day: 15,
      dayStem: '己',
      monthBranch: '巳',
      id: 'si-month-ji-bing-gui-first',
      stems: ['癸', '丙'],
      order: ['水', '火'],
      label: /先癸后丙/u,
      verse: /三夏己土.*取癸为要，次用丙火/u,
    },
  ] as const;

  for (let month = 1; month <= 12; month += 1) {
    for (let day = 10; day <= 19; day += 1) {
      const chart = baziCalculator.calculateBazi({
        year: 2024,
        month,
        day,
        timeIndex: 6,
        gender: 'male',
        isLunar: false,
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

      const climateCase = climateCases.find((item) => item.month === month && item.day === day);
      if (climateCase) {
        assert.deepEqual(
          Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
          climateCase.pillars,
          `${climateCase.name}：真实四柱`,
        );
        assert.match(entry.classicVerse, climateCase.verse, `${climateCase.name}：月令原文`);
        const rule = CLIMATE_RULES.find((item) => item.id === climateCase.id);
        assert.ok(rule, `${climateCase.name}：基础规则存在`);
        assert.deepEqual(
          rule.recommendationStems,
          climateCase.stems,
          `${climateCase.name}：具体荐干`,
        );
        const candidate = chart.analysis.usefulGod.decisionEvidence?.climateCandidates.find(
          (item) => item.ruleId === climateCase.id,
        );
        assert.ok(candidate, `${climateCase.name}：候选存在`);
        assert.equal(candidate.status, '满足', `${climateCase.name}：候选状态`);
        assert.equal(candidate.mode, 'reference', `${climateCase.name}：参考层`);
        assert.equal(candidate.adopted, false, `${climateCase.name}：不直接采纳`);
        assert.deepEqual(
          candidate.requestedOrder,
          climateCase.order,
          `${climateCase.name}：月令取用层次`,
        );
      }

      const fireClimateCase = fireClimateCases.find(
        (item) => item.month === month && item.day === day,
      );
      if (fireClimateCase) {
        assert.deepEqual(
          Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
          fireClimateCase.pillars,
          fireClimateCase.ruleId,
        );
        const rule = CLIMATE_RULES.find((item) => item.id === fireClimateCase.ruleId);
        assert.ok(rule, fireClimateCase.ruleId);
        assert.deepEqual(rule.recommendationStems, fireClimateCase.stems, fireClimateCase.ruleId);
        assert.deepEqual(rule.favorableOrder, fireClimateCase.order, fireClimateCase.ruleId);
        assert.deepEqual(
          chart.analysis.usefulGod.decisionEvidence?.climateReferenceOrder,
          fireClimateCase.order,
          fireClimateCase.ruleId,
        );
        assert.ok(
          chart.analysis.usefulGod.matchedRules?.some((item) => item.id === fireClimateCase.ruleId),
          fireClimateCase.ruleId,
        );
        assert.match(
          chart.analysis.usefulGod.strategyTrace?.find((item) => item.startsWith('病药提示:')) ??
            '',
          fireClimateCase.hint,
          fireClimateCase.ruleId,
        );
      }
      if (month === 11 && day === 18) {
        assert.deepEqual(
          Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
          ['甲辰', '乙亥', '丙戌', '甲午'],
        );
        assert.ok(!CLIMATE_RULES.some((rule) => rule.id === 'hai-month-bing-wu-xin-first'));
        assert.ok(
          !chart.analysis.usefulGod.matchedRules?.some(
            (rule) => rule.id === 'hai-month-bing-wu-xin-first',
          ),
        );
        assert.match(
          getBaziQiongtongAdvice('丙', '亥')?.classicVerse ?? '',
          /木旺宜庚，水旺宜戊，火旺用壬/u,
        );
      }

      const woodMetalClimateCase = woodMetalClimateCases.find(
        (item) => item.month === month && item.day === day,
      );
      if (woodMetalClimateCase) {
        assert.equal(chart.dayMaster.gan, woodMetalClimateCase.dayStem);
        assert.equal(chart.pillars.month.zhi, woodMetalClimateCase.monthBranch);
        const rule = CLIMATE_RULES.find((item) => item.id === woodMetalClimateCase.ruleId);
        assert.ok(rule, woodMetalClimateCase.ruleId);
        assert.deepEqual(rule.recommendationStems, woodMetalClimateCase.stems);
        assert.deepEqual(rule.favorableOrder, woodMetalClimateCase.order);
        assert.match(rule.description, woodMetalClimateCase.wording);
        const candidate = chart.analysis.usefulGod.decisionEvidence.climateCandidates.find(
          (item) => item.ruleId === woodMetalClimateCase.ruleId,
        );
        assert.equal(candidate?.status, '满足');
        assert.deepEqual(candidate?.requestedOrder, woodMetalClimateCase.order);
      }

      const earthClimateCase = earthClimateCases.find(
        (item) => item.month === month && item.day === day,
      );
      if (earthClimateCase) {
        assert.equal(chart.pillars.day.gan, earthClimateCase.dayStem);
        assert.equal(chart.pillars.month.zhi, earthClimateCase.monthBranch);
        const reference = getBaziQiongtongAdvice(
          earthClimateCase.dayStem,
          earthClimateCase.monthBranch,
        );
        assert.ok(reference);
        assert.match(reference.classicVerse, earthClimateCase.verse);
        const rule = CLIMATE_RULES.find((item) => item.id === earthClimateCase.id);
        assert.ok(rule);
        assert.deepEqual(rule.recommendationStems, earthClimateCase.stems);
        const matched = chart.analysis.usefulGod.matchedRules?.find(
          (item) => item.id === earthClimateCase.id,
        );
        assert.ok(matched);
        assert.match(matched.label, earthClimateCase.label);
        const candidates = chart.analysis.usefulGod.decisionEvidence?.climateCandidates.filter(
          (item) => item.ruleId === earthClimateCase.id,
        );
        assert.ok(candidates);
        assert.equal(candidates.length, 1);
        assert.equal(candidates[0].status, '满足');
        assert.deepEqual(candidates[0].requestedOrder, earthClimateCase.order);
        assert.equal(candidates[0].mode, 'reference');
        assert.equal(candidates[0].adopted, false);
      }
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
