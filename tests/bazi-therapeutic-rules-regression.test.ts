import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyClimateCandidates,
  collectClimateRuleCandidates,
  resolveClimateFavorableOrder,
  selectTherapeuticHintRule,
} from '@core/bazi/baziTherapeuticStrategy';
import { CLIMATE_RULES } from '@core/bazi/baziTherapeuticRules';
import { determineUsefulGod } from '@core/bazi/baziUsefulGodStrategy';

function context(visibleStems: string[]) {
  return {
    monthBranch: '寅',
    dayMaster: '金',
    dayStem: '庚',
    visibleStems,
    hiddenStems: [],
    visibleStemSources: visibleStems.map((stem, index) => ({
      pillar: (['year', 'month', 'day', 'hour'] as const)[index],
      stem,
    })),
    hiddenStemSources: [],
    formationWuxings: [],
    wuxingCounts: { 木: 0, 火: 0, 土: 0, 金: 1, 水: 0 },
  };
}

test('丙火酉月戊多困水只计戊干，不把己土合计为戊多', () => {
  const ruleId = 'you-month-bing-wu-heavy-false-scholar';
  const base = {
    ...context(['壬', '戊', '丙', '己']),
    monthBranch: '酉',
    dayMaster: '火',
    dayStem: '丙',
    wuxingCounts: { 木: 0, 火: 1, 土: 3, 金: 1, 水: 1 },
  };
  const find = (hiddenStems: string[]) =>
    collectClimateRuleCandidates({ ...base, hiddenStems }).find(
      (candidate) => candidate.rule.id === ruleId,
    );

  assert.equal(find(['己'])?.status, '不满足');
  assert.equal(find(['戊'])?.status, '满足');
});

test('戊土辰月甲乙并透不能由甲透乙藏替代', () => {
  const find = (visibleStems: string[], hiddenStems: string[], id: string) =>
    collectClimateRuleCandidates({
      ...context(visibleStems),
      monthBranch: '辰',
      dayMaster: '土',
      dayStem: '戊',
      hiddenStems,
      formationWuxings: ['木'],
    }).find((candidate) => candidate.rule.id === id)?.status;

  const withGeng = 'chen-month-wu-officer-party-geng';
  const noGeng = 'chen-month-wu-officer-party-no-geng';
  assert.equal(find(['甲', '庚', '戊', '癸'], ['乙'], withGeng), '不满足');
  assert.equal(find(['甲', '乙', '戊', '庚'], ['乙'], withGeng), '满足');
  assert.equal(find(['甲', '癸', '戊', '壬'], ['乙'], noGeng), '不满足');
  assert.equal(find(['甲', '乙', '戊', '癸'], ['乙'], noGeng), '满足');
});

test('丙火午月丁壬隔位不能据同透断合绊，紧贴也只列核对条件', () => {
  const id = 'wu-month-bing-ding-ren-he';
  const find = (visibleStems: string[]) =>
    collectClimateRuleCandidates({
      ...context(visibleStems),
      monthBranch: '午',
      dayMaster: '火',
      dayStem: '丙',
    }).find((candidate) => candidate.rule.id === id);

  assert.equal(find(['丁', '甲', '丙', '壬'])?.status, '不满足');
  const adjacent = find(['丁', '壬', '丙', '甲']);
  assert.equal(adjacent?.status, '满足');
  assert.doesNotMatch(
    `${adjacent?.rule.hint}；${adjacent?.rule.traceHints?.join('；')}`,
    /化合|平人/u,
  );
});

test('戊土申酉月全无荐干须连藏干一并核对', () => {
  const find = (monthBranch: string, hiddenStems: string[], id: string) =>
    collectClimateRuleCandidates({
      ...context(['戊', '辛', '戊', '庚']),
      monthBranch,
      dayMaster: '土',
      dayStem: '戊',
      hiddenStems,
    }).find((candidate) => candidate.rule.id === id)?.status;

  const shenNoGuiJia = 'shen-month-wu-no-gui-no-jia';
  const shenNone = 'shen-month-wu-no-bing-no-gui-no-jia';
  const youNone = 'you-month-wu-no-bing-no-gui';
  assert.equal(find('申', ['甲'], shenNoGuiJia), '不满足');
  assert.equal(find('申', ['丙'], shenNone), '不满足');
  assert.equal(find('酉', ['癸'], youNone), '不满足');
  assert.equal(find('申', [], shenNone), '满足');
  assert.equal(find('酉', [], youNone), '满足');
});

test('调候月令取用对应本月原文，不把虚构等级写入规则', () => {
  const cases = [
    {
      monthBranch: '卯',
      dayMaster: '木',
      dayStem: '甲',
      id: 'mao-month-jia-geng-wu-first',
      order: ['金', '土'],
    },
    {
      monthBranch: '戌',
      dayMaster: '木',
      dayStem: '甲',
      id: 'xu-month-jia-ding-gui-first',
      order: ['火', '水'],
    },
    {
      monthBranch: '戌',
      dayMaster: '木',
      dayStem: '乙',
      id: 'xu-month-yi-gui-xin-first',
      order: ['水', '金'],
    },
    {
      monthBranch: '巳',
      dayMaster: '水',
      dayStem: '壬',
      id: 'si-month-ren-water-self-support',
      order: ['水', '金'],
    },
  ];

  for (const item of cases) {
    const candidate = collectClimateRuleCandidates({
      ...context(['庚', '戊', '丁', '壬']),
      monthBranch: item.monthBranch,
      dayMaster: item.dayMaster,
      dayStem: item.dayStem,
    }).find((entry) => entry.rule.id === item.id);
    assert.equal(candidate?.status, '满足', item.id);
    assert.deepEqual(candidate?.requestedOrder, item.order, item.id);
  }

  const falseRuleIds = [
    'mao-month-jia-bing-gui-first',
    'mao-month-jia-bing-gui-wu-all',
    'xu-month-jia-bing-gui-first',
    'xu-month-jia-bing-gui-geng-all',
    'xu-month-yi-bing-gui-first',
    'xu-month-yi-bing-gui-geng-all',
    'si-month-ren-bing-jia-first',
    'si-month-ren-bing-jia-xin-all',
  ];
  for (const id of falseRuleIds) {
    assert.equal(
      CLIMATE_RULES.some((rule) => rule.id === id),
      false,
      id,
    );
  }
  for (const rule of CLIMATE_RULES) {
    assert.doesNotMatch(
      [rule.label, rule.description, rule.hint, ...(rule.traceHints ?? [])].join('；'),
      /鼎甲可期/u,
      rule.id,
    );
  }
});

test('无本月依据的全透组合不能占据调候参考与病药提示首位', () => {
  const candidates = collectClimateRuleCandidates({
    ...context(['丙', '癸', '辛', '乙']),
    monthBranch: '子',
    dayMaster: '木',
    dayStem: '乙',
  });
  assert.equal(
    candidates.some((item) => item.rule.id === 'zi-month-yi-bing-gui-xin-all'),
    false,
  );
  assert.equal(selectTherapeuticHintRule(candidates, '身弱')?.id, 'zi-month-yi-bing-only');

  const result = applyClimateCandidates(
    {
      favorableWuxing: ['木'],
      unfavorableWuxing: ['金'],
      trace: [],
      primaryReason: '扶抑',
    },
    candidates,
  );
  assert.deepEqual(result.referenceOrder, ['火']);
  assert.equal(result.adjusted, false);
  assert.deepEqual(result.state.favorableWuxing, ['木']);
});

test('庚金丑未调候先后与酉月功名条件按本月原文区分', () => {
  const chou = collectClimateRuleCandidates({
    ...context(['丙', '丁', '庚', '甲']),
    monthBranch: '丑',
  });
  const chouRule = selectTherapeuticHintRule(chou, '身强');
  assert.equal(chouRule?.id, 'chou-month-geng-bing-first');
  assert.deepEqual((chouRule as (typeof CLIMATE_RULES)[number]).recommendationStems, [
    '丙',
    '丁',
    '甲',
  ]);
  assert.match(chouRule?.hint ?? '', /先丙解冻、次丁炼金/);

  const wei = collectClimateRuleCandidates({
    ...context(['丁', '壬', '庚', '甲']),
    monthBranch: '未',
  });
  const weiRule = selectTherapeuticHintRule(wei, '身强');
  assert.equal(weiRule?.id, 'wei-month-geng-ding-jia-first');
  assert.deepEqual((weiRule as (typeof CLIMATE_RULES)[number]).recommendationStems, ['丁', '甲']);

  const youWithoutBing = collectClimateRuleCandidates({
    ...context(['丁', '甲', '庚', '壬']),
    monthBranch: '酉',
  });
  const youWithBing = collectClimateRuleCandidates({
    ...context(['丁', '甲', '庚', '丙']),
    monthBranch: '酉',
  });
  assert.equal(
    youWithoutBing.find((candidate) => candidate.rule.id === 'you-month-geng-ding-jia')?.status,
    '不满足',
  );
  assert.equal(
    youWithBing.find((candidate) => candidate.rule.id === 'you-month-geng-ding-jia')?.status,
    '满足',
  );
  assert.equal(selectTherapeuticHintRule(youWithBing, '身强')?.id, 'you-month-geng-ding-jia');
});

test('庚金子月无丙丁时仍按本月丁甲为先，不套用亥月丙火主作用', () => {
  const base = context(['壬', '甲', '庚', '癸']);
  const ziCandidates = collectClimateRuleCandidates({ ...base, monthBranch: '子' });
  const haiCandidates = collectClimateRuleCandidates({ ...base, monthBranch: '亥' });
  const crossMonthRuleId = 'geng-winter-no-fire-warm';

  assert.equal(
    ziCandidates.find((candidate) => candidate.rule.id === crossMonthRuleId)?.status,
    '不满足',
  );
  assert.equal(selectTherapeuticHintRule(ziCandidates, '身强')?.id, 'zi-month-geng-ding-jia-first');
  assert.equal(
    haiCandidates.find((candidate) => candidate.rule.id === crossMonthRuleId)?.status,
    '满足',
  );

  const baseline = {
    favorableWuxing: ['土'],
    unfavorableWuxing: ['火'],
    trace: [],
    primaryReason: '扶抑',
  };
  const ziDecision = applyClimateCandidates(baseline, ziCandidates);
  const haiDecision = applyClimateCandidates(baseline, haiCandidates);
  assert.equal(ziDecision.appliedCandidateIds?.includes(crossMonthRuleId) ?? false, false);
  assert.deepEqual(ziDecision.state.conditionalFavorableStems ?? [], []);
  assert.equal(haiDecision.appliedCandidateIds?.includes(crossMonthRuleId), true);
  assert.deepEqual(haiDecision.state.conditionalFavorableStems, ['丙']);
});

test('乙子专丙与甲丑先庚后丁不把相反天干列入推荐', () => {
  const cases = [
    {
      monthBranch: '子',
      dayStem: '乙',
      stems: ['乙', '丙', '癸'],
      id: 'zi-month-yi-bing-only',
      order: ['火'],
      recommendationStems: ['丙'],
      removedId: 'zi-month-yi-bing-gui-first',
    },
    {
      monthBranch: '丑',
      dayStem: '甲',
      stems: ['甲', '庚', '丁'],
      id: 'chou-month-jia-geng-ding-first',
      order: ['金', '火'],
      recommendationStems: ['庚', '丁'],
      removedId: 'chou-month-jia-bing-gui-first',
    },
  ];
  for (const item of cases) {
    const candidates = collectClimateRuleCandidates({
      ...context(item.stems),
      monthBranch: item.monthBranch,
      dayMaster: '木',
      dayStem: item.dayStem,
    });
    const matched = candidates.find((candidate) => candidate.rule.id === item.id);
    assert.equal(matched?.status, '满足', item.id);
    assert.deepEqual(matched?.requestedOrder, item.order, item.id);
    assert.deepEqual(matched?.rule.recommendationStems, item.recommendationStems, item.id);
    assert.equal(
      candidates.some((candidate) => candidate.rule.id === item.removedId),
      false,
    );
  }
});

test('本月原文明确列出的丙子壬戊与戊午壬甲两透条件仍可匹配', () => {
  const cases = [
    {
      monthBranch: '子',
      dayMaster: '火',
      dayStem: '丙',
      stems: ['壬', '戊', '丙'],
      id: 'zi-month-bing-ren-wu-both-visible',
      order: ['水', '土'],
    },
    {
      monthBranch: '午',
      dayMaster: '土',
      dayStem: '戊',
      stems: ['壬', '甲', '戊'],
      id: 'wu-month-wu-ren-jia-both-visible',
      order: ['水', '木'],
    },
  ];
  for (const item of cases) {
    const candidates = collectClimateRuleCandidates({
      ...context(item.stems),
      monthBranch: item.monthBranch,
      dayMaster: item.dayMaster,
      dayStem: item.dayStem,
    });
    const matched = candidates.find((candidate) => candidate.rule.id === item.id);
    assert.equal(matched?.status, '满足', item.id);
    assert.deepEqual(matched?.requestedOrder, item.order, item.id);
    assert.equal(selectTherapeuticHintRule(candidates, '身强')?.id, item.id);
  }
});

test('庚日寅月丙甲两透显荣，未见丙仍先取丙火', () => {
  const withBingJia = collectClimateRuleCandidates(context(['丙', '甲', '庚', '辛']));
  const withoutBing = collectClimateRuleCandidates(context(['甲', '庚', '辛', '壬']));
  const withoutJia = collectClimateRuleCandidates(context(['丙', '庚', '辛', '壬']));
  const withDingJia = collectClimateRuleCandidates(context(['丁', '甲', '庚', '辛']));

  const specialized = withBingJia.find(
    (candidate) => candidate.rule.id === 'yin-month-geng-bing-jia-visible',
  );
  assert.equal(specialized?.status, '满足');
  assert.equal(specialized?.rule.priority, 123);
  assert.equal(selectTherapeuticHintRule(withBingJia, '身弱')?.id, specialized?.rule.id);
  assert.deepEqual(
    resolveClimateFavorableOrder(
      '金',
      undefined,
      '庚',
      '寅',
      undefined,
      false,
      undefined,
      ['丙', '甲', '庚', '辛'],
      [],
      [],
      [],
      [],
      { 木: 0, 火: 0, 土: 0, 金: 1, 水: 0 },
    ),
    ['火', '木'],
  );
  assert.deepEqual(
    resolveClimateFavorableOrder(
      '金',
      undefined,
      '庚',
      '寅',
      undefined,
      false,
      undefined,
      ['甲', '庚', '辛', '壬'],
      [],
      [],
      [],
      [],
      { 木: 0, 火: 0, 土: 0, 金: 1, 水: 0 },
    ),
    ['火', '木'],
  );
  assert.equal(
    withoutBing.some(
      (candidate) =>
        candidate.rule.id === 'yin-month-geng-bing-jia-visible' && candidate.status === '满足',
    ),
    false,
  );
  assert.equal(
    withoutJia.some(
      (candidate) =>
        candidate.rule.id === 'yin-month-geng-bing-jia-visible' && candidate.status === '满足',
    ),
    false,
  );
  assert.equal(
    withDingJia.find((candidate) => candidate.rule.id === 'yin-month-geng-bing-jia-visible')
      ?.status,
    '不满足',
  );

  const usefulGod = determineUsefulGod(
    '身弱',
    { pattern: '普通格', isSpecial: false },
    '金',
    '寅',
    undefined,
    '庚',
    {
      visibleStems: ['甲', '庚', '辛', '壬'],
      hiddenStems: [],
      formationWuxings: [],
      wuxingCounts: { 木: 1, 火: 0, 土: 0, 金: 3, 水: 1 },
    },
  );
  assert.deepEqual(usefulGod.favorableWuxing, ['土', '金']);
  assert.equal(usefulGod.primaryReason, '扶抑');
});

test('调候高等级断语按本月原文所列干支条件命中', () => {
  const cases = [
    {
      id: 'mao-month-ren-wu-xin-visible',
      monthBranch: '卯',
      dayMaster: '水',
      dayStem: '壬',
      stems: ['戊', '辛', '壬'],
      missing: ['丙', '甲', '壬'],
    },
    {
      id: 'yin-month-ren-geng-bing-wu-visible',
      monthBranch: '寅',
      dayMaster: '水',
      dayStem: '壬',
      stems: ['庚', '丙', '戊', '壬'],
      missing: ['庚', '丙', '甲', '壬'],
    },
    {
      id: 'shen-month-geng-ding-jia-visible',
      monthBranch: '申',
      dayMaster: '金',
      dayStem: '庚',
      stems: ['丁', '甲', '庚'],
      missing: ['丙', '甲', '庚'],
    },
    {
      id: 'si-month-geng-ren-wu-bing-visible',
      monthBranch: '巳',
      dayMaster: '金',
      dayStem: '庚',
      stems: ['壬', '戊', '丙', '庚'],
      missing: ['壬', '丙', '甲', '庚'],
    },
  ] as const;
  for (const item of cases) {
    const base = {
      monthBranch: item.monthBranch,
      dayMaster: item.dayMaster,
      dayStem: item.dayStem,
    };
    const matched = collectClimateRuleCandidates({ ...context([...item.stems]), ...base });
    const unmatched = collectClimateRuleCandidates({ ...context([...item.missing]), ...base });
    assert.equal(
      matched.find((candidate) => candidate.rule.id === item.id)?.status,
      '满足',
      item.id,
    );
    assert.equal(
      unmatched.find((candidate) => candidate.rule.id === item.id)?.status,
      '不满足',
      item.id,
    );
    assert.equal(selectTherapeuticHintRule(matched, '身弱')?.id, item.id, item.id);
  }
});

test('庚子丁甲两透还须丙藏支，庚卯丁甲两透还须庚藏支', () => {
  for (const item of [
    {
      id: 'zi-month-geng-ding-jia-visible-bing-hidden',
      monthBranch: '子',
      stems: ['丁', '甲', '庚'],
      hidden: ['丙'],
    },
    {
      id: 'mao-month-geng-ding-jia-visible-geng-hidden',
      monthBranch: '卯',
      stems: ['丁', '甲', '庚'],
      hidden: ['庚'],
    },
  ]) {
    const base = { ...context(item.stems), monthBranch: item.monthBranch };
    const withHidden = collectClimateRuleCandidates({ ...base, hiddenStems: item.hidden });
    const withoutHidden = collectClimateRuleCandidates(base);
    assert.equal(withHidden.find((candidate) => candidate.rule.id === item.id)?.status, '满足');
    assert.equal(
      withoutHidden.find((candidate) => candidate.rule.id === item.id)?.status,
      '不满足',
    );
  }
  const gengMao = CLIMATE_RULES.find(
    (rule) => rule.id === 'mao-month-geng-ding-jia-visible-geng-hidden',
  );
  assert.match(gengMao?.hint ?? '', /得中和方论大贵/u);
  assert.equal(
    gengMao?.traceHints?.some((hint) => hint.startsWith('成格层次:')),
    false,
  );
});

test('丁午庚壬科甲须火局及另一火透，土透制壬则降等', () => {
  const base = {
    ...context(['庚', '壬', '丁', '丙']),
    monthBranch: '午',
    dayMaster: '火',
    dayStem: '丁',
  };
  const withFireFormation = collectClimateRuleCandidates({ ...base, formationWuxings: ['火'] });
  const withoutFireFormation = collectClimateRuleCandidates(base);
  const withoutFireCompanion = collectClimateRuleCandidates({
    ...context(['庚', '壬', '丁']),
    monthBranch: '午',
    dayMaster: '火',
    dayStem: '丁',
    formationWuxings: ['火'],
  });
  const withEarth = collectClimateRuleCandidates({
    ...context(['庚', '壬', '丁', '戊']),
    monthBranch: '午',
    dayMaster: '火',
    dayStem: '丁',
    formationWuxings: ['火'],
  });
  const id = 'wu-month-ding-geng-ren-kejia';
  assert.equal(withFireFormation.find((candidate) => candidate.rule.id === id)?.status, '满足');
  assert.equal(
    withoutFireFormation.find((candidate) => candidate.rule.id === id)?.status,
    '不满足',
  );
  assert.equal(
    withoutFireCompanion.find((candidate) => candidate.rule.id === id)?.status,
    '不满足',
  );
  assert.equal(withEarth.find((candidate) => candidate.rule.id === id)?.status, '不满足');
  assert.equal(
    withEarth.find((candidate) => candidate.rule.id === 'wu-month-ding-geng-ren-tu-ordinary')
      ?.status,
    '满足',
  );
});

test('丙未庚壬两透须贴身相生方论科甲名宦', () => {
  const near = collectClimateRuleCandidates({
    ...context(['庚', '壬', '丙', '甲']),
    monthBranch: '未',
    dayMaster: '火',
    dayStem: '丙',
  });
  const far = collectClimateRuleCandidates({
    ...context(['庚', '甲', '丙', '壬']),
    monthBranch: '未',
    dayMaster: '火',
    dayStem: '丙',
  });
  const id = 'wei-month-bing-geng-ren-kejia';
  assert.equal(near.find((candidate) => candidate.rule.id === id)?.status, '满足');
  assert.equal(far.find((candidate) => candidate.rule.id === id)?.status, '不满足');
  assert.equal(selectTherapeuticHintRule(near, '身强')?.id, id);
});

test('壬子戊丙两透与火局分属富贵荣华、一富而已', () => {
  const base = { monthBranch: '子', dayMaster: '水', dayStem: '壬' };
  const both = collectClimateRuleCandidates({ ...context(['戊', '丙', '壬']), ...base });
  const onlyWu = collectClimateRuleCandidates({ ...context(['戊', '甲', '壬']), ...base });
  const onlyBing = collectClimateRuleCandidates({ ...context(['丙', '甲', '壬']), ...base });
  const waterWithoutBing = collectClimateRuleCandidates({
    ...context(['戊', '甲', '壬']),
    ...base,
    formationWuxings: ['水'],
  });
  const waterWithBing = collectClimateRuleCandidates({
    ...context(['戊', '丙', '壬']),
    ...base,
    formationWuxings: ['水'],
  });
  const fireWithoutWu = collectClimateRuleCandidates({
    ...context(['甲', '乙', '壬']),
    ...base,
    formationWuxings: ['火'],
  });
  const fireWithBoth = collectClimateRuleCandidates({
    ...context(['戊', '丙', '壬']),
    ...base,
    formationWuxings: ['火'],
  });
  assert.equal(selectTherapeuticHintRule(both, '身强')?.id, 'zi-month-ren-wu-bing-visible');
  assert.equal(selectTherapeuticHintRule(onlyWu, '身强')?.id, 'zi-month-ren-wu-no-bing');
  assert.equal(selectTherapeuticHintRule(onlyBing, '身强')?.id, 'zi-month-ren-bing-no-wu');
  assert.equal(
    selectTherapeuticHintRule(waterWithoutBing, '身强')?.id,
    'zi-month-ren-water-formation-no-fire',
  );
  assert.equal(
    waterWithBing.find((candidate) => candidate.rule.id === 'zi-month-ren-water-formation-no-fire')
      ?.status,
    '不满足',
  );
  assert.equal(
    selectTherapeuticHintRule(fireWithoutWu, '身强')?.id,
    'zi-month-ren-fire-formation-wealth',
  );
  assert.equal(selectTherapeuticHintRule(fireWithBoth, '身强')?.id, 'zi-month-ren-wu-bing-visible');
  assert.equal(
    CLIMATE_RULES.some((rule) => rule.id === 'zi-month-ren-fire-formation-wu'),
    false,
  );
});

test('庚辰丁甲两透无比肩方论科甲，甲藏丁透另论异路', () => {
  const base = { monthBranch: '辰', dayMaster: '金', dayStem: '庚' };
  const noPeer = collectClimateRuleCandidates({ ...context(['丁', '甲', '庚', '壬']), ...base });
  const withPeer = collectClimateRuleCandidates({ ...context(['丁', '甲', '庚', '庚']), ...base });
  const hiddenJia = collectClimateRuleCandidates({
    ...context(['丁', '戊', '庚', '壬']),
    ...base,
    hiddenStems: ['甲'],
  });
  const noHiddenJia = collectClimateRuleCandidates({
    ...context(['丁', '戊', '庚', '壬']),
    ...base,
  });
  assert.equal(
    selectTherapeuticHintRule(noPeer, '身弱')?.id,
    'chen-month-geng-jia-ding-visible-no-peer',
  );
  assert.equal(
    withPeer.find((candidate) => candidate.rule.id === 'chen-month-geng-jia-ding-visible-no-peer')
      ?.status,
    '不满足',
  );
  assert.equal(
    hiddenJia.find((candidate) => candidate.rule.id === 'chen-month-geng-jia-hidden-ding-visible')
      ?.status,
    '满足',
  );
  assert.equal(
    noHiddenJia.find((candidate) => candidate.rule.id === 'chen-month-geng-jia-hidden-ding-visible')
      ?.status,
    '不满足',
  );
});

test('壬辰甲庚俱透科甲，甲透庚藏仅论修齐品格', () => {
  const base = { monthBranch: '辰', dayMaster: '水', dayStem: '壬' };
  const both = collectClimateRuleCandidates({ ...context(['甲', '庚', '壬']), ...base });
  const hiddenGeng = collectClimateRuleCandidates({
    ...context(['甲', '丙', '壬']),
    ...base,
    hiddenStems: ['庚'],
  });
  const noGeng = collectClimateRuleCandidates({ ...context(['甲', '丙', '壬']), ...base });
  assert.equal(selectTherapeuticHintRule(both, '身强')?.id, 'chen-month-ren-jia-geng-visible');
  assert.equal(
    selectTherapeuticHintRule(hiddenGeng, '身强')?.id,
    'chen-month-ren-jia-visible-geng-hidden',
  );
  assert.equal(
    noGeng.find((candidate) => candidate.rule.id === 'chen-month-ren-jia-visible-geng-hidden')
      ?.status,
    '不满足',
  );
  assert.equal(
    CLIMATE_RULES.some((rule) => rule.id === 'chen-month-ren-water-formation-wu'),
    false,
  );
});
