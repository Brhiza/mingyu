import type { ClimateRule } from '../../types';

export const GENG_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-geng-ding-jia-visible-bing-hidden',
    label: '庚日子月丁甲透丙藏科甲规则',
    description: '庚金生子月，丁甲两透且丙火藏支，必主科甲。',
    priority: 126,
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丁', '甲'],
    requiredHiddenStems: ['丙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    traceHints: ['取用层次:丁甲两透，丙火藏支', '成格层次:科甲'],
    hint: '庚金子月丁甲两透且丙藏支，必主科甲',
  },
  {
    id: 'zi-month-geng-ding-jia-first',
    label: '庚日子月丁甲为先丙佐规则',
    description: '庚金生子月，天气严寒，仍取丁甲，次取丙火照暖。',
    priority: 121,
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金子月，先丁甲，次取丙火照暖',
  },
];
