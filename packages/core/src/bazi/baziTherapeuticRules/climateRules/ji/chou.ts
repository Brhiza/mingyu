import type { ClimateRule } from '../../types';

export const JI_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-ji-bing-jia-first',
    label: '己日丑月先丙后甲规则',
    description:
      '己土生丑月，寒湿土冻，传统多以丙火暖局、甲木疏土，先后有序，不宜只取冬土通用火候。',
    priority: 120,
    months: ['丑'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '己土丑月，先丙后甲',
  },
];
