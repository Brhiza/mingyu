import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';

// 校核底本：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('月令调候荐干依原文先后，不将其他月份的取用混入', () => {
  const cases: Array<[string, string[]]> = [
    ['mao-month-ji-jia-gui-first', ['甲', '癸']],
    ['chen-month-ji-bing-gui-jia', ['丙', '癸', '甲']],
    ['xu-month-ji-gui-bing-jia', ['癸', '丙', '甲']],
    ['zi-month-jia-ding-geng-bing', ['丁', '庚', '丙']],
    ['chen-month-ding-jia-geng-first', ['甲', '庚']],
    ['hai-month-geng-ding-bing-jia', ['丁', '丙', '甲']],
    ['xu-month-ren-jia-bing-first', ['甲', '丙']],
    ['you-month-ren-jia-drain-soil', ['甲', '庚']],
    ['you-month-ren-no-jia-gold-source', ['庚', '辛']],
    ['shen-month-gui-ding-first', ['丁']],
    ['hai-month-gui-geng-xin', ['庚', '辛']],
    ['xu-month-gui-xin-jia', ['辛', '甲']],
  ];

  for (const [id, stems] of cases) {
    const rule = CLIMATE_RULES.find((entry) => entry.id === id);
    assert.ok(rule, `缺少 ${id}`);
    assert.deepEqual(rule.recommendationStems, stems, id);
  }
});

test('亥月庚金科名分支须丁甲透而无水局，酉月壬水庚次之且无甲另用金', () => {
  const gengHai = CLIMATE_RULES.find(
    (entry) => entry.id === 'hai-month-geng-ding-jia-visible-no-water-formation',
  );
  assert.ok(gengHai);
  assert.deepEqual(gengHai.requiredVisibleStems, ['丁', '甲']);
  assert.deepEqual(gengHai.forbiddenFormationWuxings, ['水']);
  assert.doesNotMatch(gengHai.hint, /丙甲两透.*富贵/u);

  const renYouBase = CLIMATE_RULES.find((entry) => entry.id === 'you-month-ren-jia-drain-soil');
  assert.ok(renYouBase);
  assert.deepEqual(renYouBase.favorableOrder, ['木', '金']);
  assert.deepEqual(renYouBase.recommendationStems, ['甲', '庚']);

  const renYou = CLIMATE_RULES.find((entry) => entry.id === 'you-month-ren-no-jia-gold-source');
  assert.ok(renYou);
  assert.deepEqual(renYou.maxStemTotalCounts, { 甲: 0 });
  assert.deepEqual(renYou.recommendationStems, ['庚', '辛']);
});

test('壬未月辛甲藏透分支按原文区分，不保留无据的火局富贵断语', () => {
  const renWei = CLIMATE_RULES.filter(
    (entry) => entry.dayStems?.includes('壬') && entry.months.includes('未'),
  );
  assert.equal(renWei.length, 3);
  const baseline = renWei.find((entry) => entry.id === 'wei-month-ren-xin-jia-gui');
  assert.deepEqual(baseline?.recommendationStems, ['辛', '甲', '癸']);

  const bothVisible = renWei.find((entry) => entry.id === 'wei-month-ren-xin-jia-visible');
  assert.deepEqual(bothVisible?.requiredVisibleStems, ['辛', '甲']);
  assert.deepEqual(bothVisible?.recommendationStems, ['辛', '甲']);

  const xinHidden = renWei.find((entry) => entry.id === 'wei-month-ren-xin-hidden-jia-visible');
  assert.deepEqual(xinHidden?.requiredVisibleStems, ['甲']);
  assert.deepEqual(xinHidden?.requiredHiddenStems, ['辛']);
  assert.deepEqual(xinHidden?.forbiddenVisibleStems, ['辛']);
  assert.ok(!CLIMATE_RULES.some((entry) => entry.id === 'wei-month-ren-fire-formation-jia'));
  assert.ok(!CLIMATE_RULES.some((entry) => entry.id === 'wei-month-ren-no-jia-xin'));
});

test('壬申月同义基础规则合并，荐干保持戊先丁佐', () => {
  const renShen = CLIMATE_RULES.filter(
    (entry) => entry.dayStems?.includes('壬') && entry.months.includes('申'),
  );
  assert.equal(renShen.length, 1);
  assert.deepEqual(renShen[0]?.recommendationStems, ['戊', '丁']);
  assert.match(renShen[0]?.description ?? '', /辰戌所藏.*不取申中/u);
});
