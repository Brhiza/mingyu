import type { ClimateRule } from '../../types';

export const DING_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-ding-follow-kill-broken-by-companion',
    label: '丁日子月从杀见比破格规则',
    description:
      '丁火生子月，若水多癸旺而本金无比印可从杀，但再见丁火比肩出干，传统即谓难合格局，只作常人，不可仍按弃命从杀高断。',
    months: ['子'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredVisibleStems: ['癸', '庚'],
    minWuxingCounts: { 水: 5, 金: 2 },
    minVisibleStemCounts: { 丁: 2 },
    maxTenGodCategoryTotalCounts: { 印星: 0 },
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    traceHints: ['破格因素:丁比出干', '成格层次:难合格局，常人'],
    hint: '丁火子月水旺癸强而见丁比出干，多难合从杀格',
  },
  {
    id: 'zi-month-ding-follow-kill-water-prosper',
    label: '丁日子月水旺从杀规则',
    description:
      '丁火生子月，若水多癸旺而金神相随，明暗又无比劫印星牵绊，传统多按弃命从杀看，亦主异途功名，不应仍停留在普通冬丁甲庚调候。',
    months: ['子'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredVisibleStems: ['癸', '庚'],
    minWuxingCounts: { 水: 5, 金: 2 },
    maxTenGodCategoryTotalCounts: { 比劫: 0, 印星: 0 },
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:水旺癸强，金神相随', '成格层次:弃命从杀，异途功名'],
    hint: '丁火子月水多癸旺而金无比印，可按弃命从杀看',
  },
  {
    id: 'zi-month-ding-jia-geng',
    label: '丁日子月甲庚并用规则',
    description: '丁火生子月，火体衰微，传统多以甲木为尊、庚金佐之，较"冬火只取木"更贴近原法。',
    months: ['子'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火子月，甲木为尊，庚金佐之',
  },
];
