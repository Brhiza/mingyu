import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildClimateCandidates, ensureClimateRulesLoaded } from '../src/systems/bazi/climate';
import { assessClimateRule } from '../src/systems/bazi/climate-match';
import rules from '../src/systems/bazi/climate-rules.json';

await ensureClimateRulesLoaded();

const pattern = { pattern: '正官格', source: '普通月令取格候选', limitation: '' };

test('真实规则候选保留来源，修改返回值不污染规则', () => {
  const pillars = buildPillarFacts({ year: '壬子', month: '戊子', day: '甲子', hour: '壬申' });
  const strength = buildDayMasterStrength(pillars, '癸');
  const build = () => buildClimateCandidates(pillars, strength, pattern, '冬至');
  const first = build();
  const item = first.candidates.find((candidate) => candidate.id === 'jia-zi-ren-repeated-no-fire');
  assert.equal(item?.status, '满足'); assert.equal(item?.mode, 'conditional');
  assert.match(first.limitation, /不可直接作为最终用神/);
  assert.ok(item?.source && item.effects);
  const original = structuredClone(build());
  item!.source!.title = '伪造'; item!.effects![0].stem = '伪造';
  assert.deepEqual(build(), original);
  const special = buildClimateCandidates(pillars, strength, { ...pattern, source: '曲直条件模型' }, '冬至');
  assert.equal(special.applicability, '特殊格暂不套用普通调候'); assert.deepEqual(special.candidates, []);
});

test('全部日干和月份的预筛选与逐条评估一致，缺失节气仍保留待核候选', () => {
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const stems = [...'甲乙丙丁戊己庚辛壬癸'], branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  for (const [stemIndex, stem] of stems.entries()) for (const [branchIndex, branch] of branches.entries()) {
    const pillars = buildPillarFacts({ year: '壬子', month: `${branchIndex % 2 ? '乙' : '甲'}${branch}`,
      day: `${stem}${stemIndex % 2 ? '丑' : '子'}`, hour: '壬申' });
    const strength = buildDayMasterStrength(pillars, '癸');
    const visibleStemSources = positions.map((pillar) => ({ pillar, stem: pillars[pillar].gan }));
    const hiddenStemSources = positions.map((pillar) => ({ pillar, branch: pillars[pillar].zhi, stems: pillars[pillar].hiddenStems.map((item) => item.stem) }));
    const wuxingCounts = Object.fromEntries(['木', '火', '土', '金', '水'].map((element) => [element,
      positions.reduce((sum, position) => sum + Number(pillars[position].stemElement === element) + Number(pillars[position].branchElement === element), 0)]));
    for (const currentJieqi of [undefined, '冬至']) {
      const context = { strengthStatus: strength.status, yearStem: pillars.year.gan, monthBranch: pillars.month.zhi, hourBranch: pillars.hour.zhi,
        dayMaster: pillars.day.stemElement, dayStem: pillars.day.gan, currentJieqi,
        visibleStems: visibleStemSources.map((item) => item.stem), visibleStemSources,
        hiddenStems: hiddenStemSources.flatMap((item) => item.stems), hiddenStemSources,
        formationWuxings: [...new Set(strength.formations.filter((item) => item.established).map((item) => item.element))], wuxingCounts };
      const expected = rules.map((rule) => ({ rule, assessment: assessClimateRule(rule, context) }))
        .filter(({ assessment }) => assessment.status !== '不满足')
        .sort((a, b) => (b.rule.priority || 0) - (a.rule.priority || 0))
        .map(({ rule, assessment }) => ({ id: rule.id, status: assessment.status, missingInputs: assessment.missingInputs }));
      const actual = buildClimateCandidates(pillars, strength, pattern, currentJieqi).candidates
        .map(({ id, status, missingInputs }) => ({ id, status, missingInputs }));
      assert.deepEqual(actual, expected, `${stem}/${branch}/${currentJieqi ?? '未提供节气'}`);
    }
  }
});

