import type { ClimateRule } from '../../types';

export const JIA_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-jia-fire-forge',
    label: '甲日酉月丁火为先规则',
    description:
      '甲木生酉月，木囚金旺，常以丁火为先，次取丙火，先求制金暖木，不宜泛以润木之水概论。',
    months: ['酉'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '甲木酉月，先取丁火制金暖木',
  },
];
