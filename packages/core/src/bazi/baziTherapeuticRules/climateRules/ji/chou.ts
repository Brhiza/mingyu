import type { ClimateRule } from '../../types';

export const JI_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-ji-bing-jia-first',
    label: '己日丑月先丙后甲规则',
    description: '己土生丑月，寒湿土冻，传统多以丙火暖局、甲木疏土，先后有序，不宜只取冬土通用火候。',
    priority: 120,
    months: ['丑'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '己土丑月，先丙后甲',
  },
  {
    id: 'chou-month-ji-bing-jia-geng-all',
    label: '己日丑月丙甲庚全透极品规则',
    description: '己土生丑月，丙甲庚三者全透，较合原文"己土生丑月，三者全透，鼎甲可期"。',
    priority: 126,
    months: ['丑'],
    dayMasters: ['土'],
    dayStems: ['己'],
    requiredVisibleStems: ['丙', '甲', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '金'],
    traceHints: ['取用层次:丙甲庚三者全透', '成格层次:鼎甲可期'],
    hint: '己土丑月丙甲庚三者全透，鼎甲可期',
  },
];
