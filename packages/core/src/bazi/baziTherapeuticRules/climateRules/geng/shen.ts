import type { ClimateRule } from '../../types';

export const GENG_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-geng-jia-bing-first',
    label: '庚日申月丁煅甲引规则',
    description: '庚金生申月，金刚锐，专用丁火煅炼，次取甲木引丁。',
    priority: 120,
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金申月，丁火煅炼，甲木引丁',
  },
  {
    id: 'shen-month-geng-ding-jia-visible',
    label: '庚日申月丁甲两透青云规则',
    description: '庚金生申月，专用丁火煅炼，次取甲木引丁；丁甲两透，定步青云。',
    priority: 123,
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丁', '甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    traceHints: ['取用层次:丁甲两透', '成格层次:定步青云'],
    hint: '庚金申月丁甲两透，定步青云',
  },
];
