import type { ClimateRule } from '../../types';

export const GENG_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-geng-jia-ding-first',
    label: '庚日酉月先丁次甲规则',
    description: '庚金生酉月，金旺极而刚，需丁火锻炼、甲木裁抑，方能成器。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金酉月，先丁次甲',
  },
  {
    id: 'you-month-geng-ding-jia',
    label: '庚日酉月丁甲并用规则',
    description:
      '庚金生酉月，金气最旺，丁火为先，甲木佐之。丁甲两透，富贵可期，不宜只按秋金喜水泛论。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金酉月，丁火为先，甲木佐之，丁甲两透富贵',
  },
];
