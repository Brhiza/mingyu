import type { ClimateRule } from '../../types';

export const JI_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-ji-follow-kill-no-resource',
    label: '己日卯月无比印从杀贵规则',
    description:
      '己土生卯月，木势偏盛而比劫印星明暗皆不见时，传统有"无比印，从杀者贵"之论，不宜仍按普通春土调候一概处理。',
    priority: 124,
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
    id: 'mao-month-ji-jia-gui-first',
    label: '己日卯月先甲后癸规则',
    description: '己土生卯月，原文先取甲木疏土、次取癸水润土；甲木被合时须另核其作用。',
    priority: 119,
    months: ['卯'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    hint: '己土卯月，先取甲木疏土，次取癸水润土',
  },
];
