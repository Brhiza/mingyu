import type { ClimateRule } from '../../types';

export const JI_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-ji-follow-kill-no-resource',
    label: '己日卯月无比印从杀贵规则',
    description:
      '己土生卯月，木势偏盛而比劫印星明暗皆不见时，传统有"无比印，从杀者贵"之论，不宜仍按普通春土调候一概处理。',
    months: ['卯'],
    dayMasters: ['土'],
    dayStems: ['己'],
    minWuxingCounts: { 木: 4 },
    maxTenGodCategoryVisibleCounts: { 比劫: 0, 印星: 0 },
    maxTenGodCategoryHiddenCounts: { 比劫: 0, 印星: 0 },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:木旺成势，明暗无比印', '成格层次:无比印，从杀者贵'],
    hint: '己土卯月木势偏盛而明暗无比印，可作从杀贵论',
  },
  {
    id: 'mao-month-ji-bing-jia-first',
    label: '己日卯月先丙后甲规则',
    description: '己土生卯月，春湿土润，传统多以丙火暖局、甲木疏土，先后有序。',
    months: ['卯'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '己土卯月，先丙后甲',
  },
];
